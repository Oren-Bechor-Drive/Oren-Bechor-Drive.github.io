import assert from "node:assert/strict";
import test from "node:test";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";
import { testSectionPath } from "../fixtures/test-sections.mjs";
import { createReaderPosition } from "../../account/reader-position.js";

async function login(origin, email) {
	const client = browserClient(origin);
	await client.request();
	await client.request("login", { email, password: "correct-password" });
	return client;
}
function positionRequest(origin, client, key, body, headers = {}) {
	return fetch(`${origin}${testSectionPath(key)}${body === undefined ? "" : "/position"}`, {
		method: body === undefined ? "GET" : "POST",
		headers: { cookie: client.cookie, origin, "content-type": "application/json", "x-csrf-token": client.csrf, ...headers },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}
async function readingPosition(origin, client, key) {
	const response = await positionRequest(origin, client, key);
	return { position: (await response.json()).position };
}
async function lesson(origin, client, key) {
	return (await (await fetch(`${origin}${testSectionPath(key)}`, { headers: { cookie: client.cookie } })).json()).lesson;
}

test("saved positions survive new sessions, reject stale changes and isolate learners", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const first = await login(app.origin, "reader@example.test");
	assert.equal((await positionRequest(app.origin, first, "free")).status, 200);
	assert.deepEqual(await readingPosition(app.origin, first, "free"), { position: null });
	const content = await lesson(app.origin, first, "free");
	const input = { contentVersionId: content.id, position: 3750, expectedRevision: 0 };
	const saved = await positionRequest(app.origin, first, "free", input);
	assert.equal(saved.status, 200);
	assert.equal(saved.headers.get("cache-control"), "private, no-store");
	const expected = { position: { contentVersionId: content.id, position: 3750, revision: 1 } };
	assert.deepEqual(await saved.json(), expected);
	assert.deepEqual(await (await positionRequest(app.origin, first, "free", input)).json(), expected);
	const second = await login(app.origin, "reader@example.test");
	assert.deepEqual(await readingPosition(app.origin, second, "free"), expected);
	const conflict = await positionRequest(app.origin, second, "free", { ...input, position: 8000 });
	assert.equal(conflict.status, 409);
	assert.deepEqual(await conflict.json(), { error: "position_conflict", ...expected });
	const updated = await positionRequest(app.origin, second, "free", { ...input, position: 8000, expectedRevision: 1 });
	assert.equal((await updated.json()).position.revision, 2);
	const other = await login(app.origin, "other@example.test");
	assert.deepEqual(await readingPosition(app.origin, other, "free"), { position: null });
	assert.equal((await positionRequest(app.origin, other, "free", { ...input, learnerId: "reader@example.test" })).status, 400);
	assert.equal((await positionRequest(app.origin, other, "free", { ...input, position: 0 })).status, 200);
	assert.equal((await readingPosition(app.origin, first, "free")).position.position, 8000);
});

test("the reader accepts a matching position saved by another session and uses its current revision", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const first = await login(app.origin, "matching-reader@example.test");
	const content = await lesson(app.origin, first, "free");
	assert.equal((await positionRequest(app.origin, first, "free", { contentVersionId: content.id, position: 2000, expectedRevision: 0 })).status, 200);
	const savedPosition = (await readingPosition(app.origin, first, "free")).position;
	const requests = [];
	const saver = createReaderPosition({ send: async ({ csrf, ...input }) => {
		assert.equal(csrf, first.csrf);
		requests.push(input);
		const response = await positionRequest(app.origin, first, "free", input);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		return response.json();
	} });
	saver.hydrate({ contentVersionId: content.id, csrf: first.csrf, savedPosition });
	const second = await login(app.origin, "matching-reader@example.test");
	for (const [position, expectedRevision] of [[4000, 1], [3000, 2]]) {
		const response = await positionRequest(app.origin, second, "free", { contentVersionId: content.id, position, expectedRevision });
		assert.equal(response.status, 200);
		assert.equal((await response.json()).position.revision, expectedRevision + 1);
	}
	saver.update(3000);
	await saver.flush();
	saver.update(7500);
	await saver.flush();
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 3]]);
	assert.deepEqual(await readingPosition(app.origin, first, "free"), { position: { contentVersionId: content.id, position: 7500, revision: 4 } });
	const conflict = await positionRequest(app.origin, second, "free", { contentVersionId: content.id, position: 8000, expectedRevision: 3 });
	assert.equal(conflict.status, 409);
});

test("a delayed idempotent write advances the restored revision before saving newer reader progress", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const first = await login(app.origin, "restored-matching-reader@example.test");
	const second = await login(app.origin, "restored-matching-reader@example.test");
	const content = await lesson(app.origin, first, "free");
	assert.equal((await positionRequest(app.origin, first, "free", { contentVersionId: content.id, position: 2000, expectedRevision: 0 })).status, 200);
	let release;
	const held = new Promise(resolve => { release = resolve; });
	const requests = [];
	const saver = createReaderPosition({ send: async ({ csrf, ...input }) => {
		assert.equal(csrf, first.csrf);
		requests.push(input);
		if (requests.length === 1) await held;
		const response = await positionRequest(app.origin, first, "free", input);
		assert.equal(response.status, 200);
		return response.json();
	} });
	saver.hydrate({ contentVersionId: content.id, csrf: first.csrf,
		savedPosition: (await readingPosition(app.origin, first, "free")).position });
	saver.update(3000);
	const pending = saver.flush();
	saver.update(7500);
	try {
		const observed = await positionRequest(app.origin, second, "free", { contentVersionId: content.id, position: 3000, expectedRevision: 1 });
		assert.equal(observed.status, 200);
		assert.equal((await observed.json()).position.revision, 2);
		assert.deepEqual(saver.hydrate({ contentVersionId: content.id, csrf: first.csrf,
			savedPosition: (await readingPosition(app.origin, first, "free")).position }), { position: 7500, contentChanged: false });
		for (const [position, expectedRevision] of [[4000, 2], [3000, 3]]) {
			const response = await positionRequest(app.origin, second, "free", { contentVersionId: content.id, position, expectedRevision });
			assert.equal(response.status, 200);
			assert.equal((await response.json()).position.revision, expectedRevision + 1);
		}
		release();
		await pending;
		assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 4]]);
		assert.deepEqual(await readingPosition(app.origin, first, "free"),
			{ position: { contentVersionId: content.id, position: 7500, revision: 5 } });
	} finally {
		release();
		await pending.catch(() => {});
	}
});

test("position writes require valid inputs, CSRF and current paid access without losing saved data", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	assert.equal((await positionRequest(app.origin, { cookie: "", csrf: "" }, "free")).status, 401);
	const client = await login(app.origin, "paid-reader@example.test");
	await app.grant("paid-reader@example.test");
	const content = await lesson(app.origin, client, "paid");
	const input = { contentVersionId: content.id, position: 10000, expectedRevision: 0 };
	for (const headers of [{ origin: "https://other.test" }, { "x-csrf-token": "wrong" }, { "content-type": "text/plain" }]) {
		assert.equal((await positionRequest(app.origin, client, "paid", input, headers)).status, 403);
	}
	for (const changes of [{ position: -1 }, { position: 10001 }, { position: 0.1 }, { position: "10" }, { expectedRevision: -1 }, { expectedRevision: 1.1 }, { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { contentVersionId: "invalid" }, { contentVersionId: [content.id] }, { contentVersionId: {} }, { position: null }, { claimedPlan: "paid" }]) {
		assert.equal((await positionRequest(app.origin, client, "paid", { ...input, ...changes })).status, 400);
	}
	assert.equal((await positionRequest(app.origin, client, "paid", input)).status, 200);
	await app.revoke("paid-reader@example.test");
	assert.equal((await positionRequest(app.origin, client, "paid", { ...input, position: 5000, expectedRevision: 1 })).status, 404);
	assert.equal((await positionRequest(app.origin, client, "paid")).status, 404);
	assert.equal((await positionRequest(app.origin, client, "free", input)).status, 404);
	await app.grant("paid-reader@example.test");
	assert.equal((await readingPosition(app.origin, client, "paid")).position.position, 10000);
	assert.equal((await positionRequest(app.origin, client, "paid", { ...input, position: 5000, expectedRevision: 1 })).status, 200);
	await client.request("logout", {});
	assert.equal((await positionRequest(app.origin, client, "paid")).status, 401);
});
