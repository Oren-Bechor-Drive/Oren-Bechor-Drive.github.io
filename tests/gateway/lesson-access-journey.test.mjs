import assert from "node:assert/strict";
import test from "node:test";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";

test("test lesson API preserves access until period end, retains progress through expiry and isolates renewal", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const first = browserClient(app.origin);
	const second = browserClient(app.origin);
	async function request(client, path, body) {
		const response = await fetch(`${app.origin}/api/lessons/${path}`, {
			method: body === undefined ? "GET" : "POST",
			headers: { cookie: client.cookie, origin: app.origin, "content-type": "application/json", "x-csrf-token": client.csrf },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		return { status: response.status, data: await response.json() };
	}
	const denied = async (client, path, status, error, body) => {
		assert.deepEqual(await request(client, path, body), { status, data: { error } });
	};
	const read = async (client, path) => {
		const result = await request(client, path);
		assert.equal(result.status, 200);
		return result.data;
	};
	const save = async (client, key, input) => {
		const result = await request(client, `${key}/position`, input);
		assert.equal(result.status, 200);
		return result.data;
	};
	for (const key of ["free", "paid"]) {
		await denied(first, key, 401, "session_expired");
		await denied(first, `${key}/position`, 401, "session_expired");
	}
	for (const [client, email] of [[first, "period-first@example.test"], [second, "period-second@example.test"]]) {
		await client.request();
		assert.equal((await client.request("login", { email, password: "correct-password" })).response.status, 200);
	}
	const free = (await read(first, "free")).lesson;
	assert.match(free.body, /תוכן בדיקה חינמי/);
	await denied(first, "paid", 404, "lesson_unavailable");
	const freeInput = { contentVersionId: free.id, position: 2000, expectedRevision: 0 };
	await save(first, "free", freeInput);

	// Simulated cancellation leaves the already-paid finite grant unchanged.
	// There is no renewal scheduler or payment provider in this development slice.
	await app.grant("period-first@example.test", new Date(Date.now() + 3_600_000).toISOString());
	const paid = (await read(first, "paid")).lesson;
	assert.match(paid.body, /תוכן בדיקה בתשלום/);
	const paidInput = { contentVersionId: paid.id, position: 3750, expectedRevision: 0 };
	const saved = await save(first, "paid", paidInput);
	assert.deepEqual(saved, { position: { contentVersionId: paid.id, position: 3750, revision: 1 } });
	assert.deepEqual((await read(first, "paid")).lesson, paid);

	// A different learner never inherits the grant or saved position.
	await denied(second, "paid", 404, "lesson_unavailable");
	await denied(second, "paid/position", 404, "lesson_unavailable", paidInput);
	assert.deepEqual(await read(second, "paid/position"), { position: null });
	const claimedLearner = "11111111-1111-4111-8111-111111111111";
	const forged = { ...paidInput, learnerId: claimedLearner };
	await denied(second, `paid/position?learner_id=${claimedLearner}`, 400, "invalid_input");
	await denied(second, "paid/position", 400, "invalid_input", forged);
	assert.deepEqual(await read(first, "paid/position"), saved);

	await app.expire("period-first@example.test");
	await denied(first, "paid", 404, "lesson_unavailable");
	await denied(first, "paid/position", 404, "lesson_unavailable", { ...paidInput, position: 8000, expectedRevision: 1 });
	// Even an identical retry must recheck entitlement before accepting a save.
	await denied(first, "paid/position", 404, "lesson_unavailable", paidInput);
	assert.deepEqual(await read(first, "paid/position"), saved);
	assert.deepEqual((await read(first, "free")).lesson, free);
	assert.equal((await save(first, "free", { ...freeInput, position: 5000, expectedRevision: 1 })).position.revision, 2);

	// Backdate only the test entitlement to exercise a month without renewal.
	await app.expire("period-first@example.test", 31);
	await denied(first, "paid", 404, "lesson_unavailable");
	assert.deepEqual(await read(first, "paid/position"), saved);
	await app.grant("period-first@example.test");
	assert.deepEqual((await read(first, "paid")).lesson, paid);
	assert.deepEqual(await read(first, "paid/position"), saved);
	await denied(second, "paid", 404, "lesson_unavailable");

	// Both learners can save the same content without reading or overwriting each other.
	await app.grant("period-second@example.test");
	assert.deepEqual(await read(second, "paid/position"), { position: null });
	const otherSaved = await save(second, "paid", { ...paidInput, position: 1000 });
	assert.deepEqual(await read(first, "paid/position"), saved);
	const resumed = await save(first, "paid", { ...paidInput, position: 8000, expectedRevision: 1 });
	assert.equal(resumed.position.revision, 2);
	assert.deepEqual(await read(second, "paid/position"), otherSaved);
	await denied(first, "paid/position", 400, "invalid_input", { ...paidInput, learnerId: claimedLearner });
	assert.deepEqual(await read(second, "paid/position"), otherSaved);

	await first.request("logout", {});
	for (const key of ["free", "paid"]) {
		await denied(first, key, 401, "session_expired");
		await denied(first, `${key}/position`, 401, "session_expired");
	}
	assert.deepEqual(await read(second, "paid/position"), otherSaved);
});
