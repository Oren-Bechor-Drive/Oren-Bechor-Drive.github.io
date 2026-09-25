import assert from "node:assert/strict";
import test from "node:test";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";

async function login(origin, email) {
	const client = browserClient(origin);
	await client.request();
	await client.request("login", { email, password: "correct-password" });
	return client;
}
function positionRequest(origin, client, key, body, headers = {}) {
	return fetch(`${origin}/api/lessons/${key}/position`, {
		method: body === undefined ? "GET" : "POST",
		headers: { cookie: client.cookie, origin, "content-type": "application/json", "x-csrf-token": client.csrf, ...headers },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}
async function lesson(origin, client, key) {
	return (await (await fetch(`${origin}/api/lessons/${key}`, { headers: { cookie: client.cookie } })).json()).lesson;
}

test("saved positions survive new sessions, reject stale changes and isolate learners", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const first = await login(app.origin, "reader@example.test");
	assert.equal((await positionRequest(app.origin, first, "free")).status, 200);
	assert.deepEqual(await (await positionRequest(app.origin, first, "free")).json(), { position: null });
	const content = await lesson(app.origin, first, "free");
	const input = { contentVersionId: content.id, position: 3750, expectedRevision: 0 };
	const saved = await positionRequest(app.origin, first, "free", input);
	assert.equal(saved.status, 200);
	assert.equal(saved.headers.get("cache-control"), "private, no-store");
	const expected = { position: { contentVersionId: content.id, position: 3750, revision: 1 } };
	assert.deepEqual(await saved.json(), expected);
	assert.deepEqual(await (await positionRequest(app.origin, first, "free", input)).json(), expected);
	const second = await login(app.origin, "reader@example.test");
	assert.deepEqual(await (await positionRequest(app.origin, second, "free")).json(), expected);
	const conflict = await positionRequest(app.origin, second, "free", { ...input, position: 8000 });
	assert.equal(conflict.status, 409);
	assert.deepEqual(await conflict.json(), { error: "position_conflict", ...expected });
	const updated = await positionRequest(app.origin, second, "free", { ...input, position: 8000, expectedRevision: 1 });
	assert.equal((await updated.json()).position.revision, 2);
	const other = await login(app.origin, "other@example.test");
	assert.deepEqual(await (await positionRequest(app.origin, other, "free")).json(), { position: null });
	assert.equal((await positionRequest(app.origin, other, "free", { ...input, learnerId: "reader@example.test" })).status, 400);
	assert.equal((await positionRequest(app.origin, other, "free", { ...input, position: 0 })).status, 200);
	assert.equal((await (await positionRequest(app.origin, first, "free")).json()).position.position, 8000);
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
	assert.equal((await (await positionRequest(app.origin, client, "paid")).json()).position.position, 10000);
	assert.equal((await positionRequest(app.origin, client, "free", input)).status, 404);
	await app.grant("paid-reader@example.test");
	assert.equal((await positionRequest(app.origin, client, "paid", { ...input, position: 5000, expectedRevision: 1 })).status, 200);
	await client.request("logout", {});
	assert.equal((await positionRequest(app.origin, client, "paid")).status, 401);
});
