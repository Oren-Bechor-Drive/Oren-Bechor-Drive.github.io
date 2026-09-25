import assert from "node:assert/strict";
import test from "node:test";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";
import { testSectionPath } from "../fixtures/test-sections.mjs";

test("injection-shaped HTTP inputs cannot change quiz state or bypass paid access", async t => {
	const app = await startLessonGateway({ quiz: true });
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "injection@example.test", password: "correct-password" });
	await app.grant("injection@example.test");
	async function request(path, body) {
		return fetch(app.origin + path, { method: body === undefined ? "GET" : "POST", headers: {
			cookie: client.cookie, origin: app.origin, "content-type": "application/json", "x-csrf-token": client.csrf,
		}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
	}
	const draft = await (await request("/api/quizzes/synthetic-topic/start", {})).json();
	const injection = "' OR 1=1; DROP TABLE public.quiz_attempts; --";
	const escaped = encodeURIComponent(injection);
	for (const [path, body, status] of [
		[`/api/attempts/${escaped}`, undefined, 404],
		[`/api/quizzes/${escaped}/start`, {}, 404],
		[`/api/quizzes/synthetic-topic/history?before=${escaped}`, undefined, 400],
		[`/api/attempts/${draft.id}/save`, { answers: { q1: injection }, expectedRevision: 0 }, 400],
		[`/api/attempts/${draft.id}/save`, { answers: { q1: { $ne: null } }, expectedRevision: 0 }, 400],
		[`/api/attempts/${draft.id}/save`, { answers: { q1: "a" }, expectedRevision: injection }, 400],
		[`/api/attempts/${draft.id}/submit`, JSON.parse('{"expectedRevision":0,"__proto__":{"score":20}}'), 400],
		["/api/quizzes/constructor/start", {}, 404],
		["/api/learning?operation=provision_learner", undefined, 400],
	]) {
		const response = await request(path, body);
		assert.equal(response.status, status, path);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		assert.doesNotMatch(await response.text(), /DROP TABLE|SELECT |access-|refresh-|sb_secret_/);
	}
	const unchanged = await (await request(`/api/attempts/${draft.id}`)).json();
	assert.deepEqual(unchanged.answers, {});
	assert.equal(unchanged.revision, 0);
	assert.equal(unchanged.status, "draft");
	assert.equal((await request(`/api/attempts/${draft.id}/save`, { answers: { q1: "a" }, expectedRevision: 0 })).status, 200);
	await app.expire("injection@example.test");
	assert.equal((await request(testSectionPath("paid"))).status, 404);
	assert.equal((await request(testSectionPath("free"))).status, 200);
});
