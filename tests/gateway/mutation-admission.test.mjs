import assert from "node:assert/strict";
import test from "node:test";
import { accountProvider, browserClient, startAccountGateway } from "../helpers/account-gateway.mjs";

test("account, reading-position and quiz mutations share admission while preserving account-only limits", async t => {
	const writes = [];
	const provider = accountProvider();
	provider.savePosition = async (token, section, access, body) => {
		writes.push("position");
		return { content_version_id: body.contentVersionId, position: body.position, revision: 1 };
	};
	for (const name of ["startQuiz", "saveQuiz", "submitQuiz", "completeTopic"]) provider[name] = async () => {
		writes.push(name);
		return { ok: true };
	};
	let limitCalls = 0, allow = true;
	const app = await startAccountGateway({ provider, mutationLimiter: async () => { limitCalls++; return allow; } });
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "learner@example.test", password: "correct-password" });
	const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const mutations = [
		["/api/account/recover", { email: "learner@example.test" }, true],
		[`/api/sections/${id}/free/position`, { contentVersionId: id, position: 10000, expectedRevision: 0 }, false],
		["/api/quizzes/synthetic-topic/start", {}, false],
		[`/api/attempts/${id}/save`, { answers: { q1: "a" }, expectedRevision: 0 }, false],
		[`/api/attempts/${id}/submit`, { expectedRevision: 0 }, false],
		["/api/topics/synthetic-topic/complete", {}, false],
	];
	const request = (path, body, headers = {}, method = "POST") => fetch(app.origin + path, {
		method, headers: { cookie: client.cookie, origin: app.origin,
			"content-type": "application/json; charset=utf-8", "x-csrf-token": client.csrf, ...headers },
		...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
	});
	async function rejected(path, body, status, error, headers = {}, method) {
		const before = writes.length + provider.calls.length;
		const response = await request(path, body, headers, method);
		assert.equal(response.status, status, path);
		assert.deepEqual(await response.json(), { error }, path);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		assert.equal(writes.length + provider.calls.length, before, path);
	}
	for (const [path, body, limited] of mutations) {
		limitCalls = 0;
		for (const headers of [{ origin: "https://other.test" }, { origin: "" },
			{ "content-type": "text/plain" }, { "x-csrf-token": "wrong" }]) {
			await rejected(path, "{", 403, "request_rejected", headers);
		}
		await rejected(path, body, 405, "method_not_allowed", {}, "GET");
		assert.equal(limitCalls, 0, "admission and method errors precede the account limiter");
		await rejected(path, "{", 400, "invalid_input");
		await rejected(path, { ...body, unowned: true }, 400, "invalid_input");
		await rejected(path, { ...body, unowned: "a".repeat(17000) }, 413, "too_large");
		assert.equal(limitCalls, limited ? 3 : 0, "only account mutations consume the account limit before parsing");
	}
	allow = false;
	limitCalls = 0;
	await rejected(mutations[0][0], "{", 403, "request_rejected", { origin: "https://other.test" });
	assert.equal(limitCalls, 0);
	await rejected(mutations[0][0], "{", 429, "rate_limited");
	assert.equal(limitCalls, 1, "account rate rejection precedes malformed body parsing");
	for (const [path, body] of mutations.slice(1)) assert.equal((await request(path, body)).status, 200, path);
	assert.deepEqual(writes, ["position", "startQuiz", "saveQuiz", "submitQuiz", "completeTopic"]);
	assert.equal(limitCalls, 1, "protected learning mutations remain outside the account mutation limit");
	allow = true;
	assert.equal((await request(mutations[0][0], mutations[0][1])).status, 200);
	assert.equal(limitCalls, 2);
	assert.equal(provider.calls.filter(call => call[0] === "recover").length, 1);
});
