import assert from "node:assert/strict";
import test from "node:test";
import { accountProvider, startAccountGateway, browserClient } from "../helpers/account-gateway.mjs";

const id = "11111111-1111-4111-8111-111111111111";
test("protected learning routes validate ownership boundaries, CSRF and draft input", async t => {
	const provider = accountProvider();
	const calls = [];
	for (const method of ["myLearning", "startQuiz", "readAttempt", "saveQuiz", "submitQuiz", "quizHistory", "completeTopic"]) {
		provider[method] = async (...args) => { calls.push([method, ...args]); return { marker: method }; };
	}
	const app = await startAccountGateway({ provider });
	t.after(app.close);
	const client = browserClient(app.origin);
	async function request(path, body, headers = {}) {
		const response = await fetch(app.origin + "/api/" + path, { method: body === undefined ? "GET" : "POST",
			headers: { cookie: client.cookie, origin: app.origin, "content-type": "application/json", "x-csrf-token": client.csrf, ...headers },
			...(body === undefined ? {} : { body: JSON.stringify(body) }) });
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		return { status: response.status, body: await response.json() };
	}
	assert.equal((await request("learning")).status, 401);
	await client.request();
	await client.request("login", { email: "quiz@example.test", password: "correct-password" });
	const overview = (await request("learning")).body;
	assert.equal(overview.marker, "myLearning");
	assert.deepEqual(overview.subscriptionOffer, { currency: "ILS", monthlyAmountMinor: 15000, trialDays: 3, checkoutAvailable: false });
	assert.equal((await request("quizzes/right-of-way/start", {})).body.marker, "startQuiz");
	assert.equal((await request(`attempts/${id}`)).body.marker, "readAttempt");
	assert.equal((await request(`attempts/${id}/save`, { answers: { q1: "a" }, expectedRevision: 1 })).body.marker, "saveQuiz");
	assert.equal((await request(`attempts/${id}/submit`, { expectedRevision: 2 })).body.marker, "submitQuiz");
	assert.equal((await request("quizzes/right-of-way/history")).body.marker, "quizHistory");
	assert.equal((await request("topics/right-of-way/complete", {})).body.marker, "completeTopic");
	assert.equal((await request(`attempts/${id}/save`, { answers: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`q${i}`, "a"])), expectedRevision: 1 })).status, 200);
	assert.ok(calls.every(call => call[1].startsWith("access-")));
	for (const body of [{ answers: [], expectedRevision: 1 }, { answers: { q1: 0 }, expectedRevision: 1 }, { answers: { q1: "a" }, expectedRevision: -1 }, { answers: {}, expectedRevision: 1, learnerId: id }]) {
		assert.equal((await request(`attempts/${id}/save`, body)).status, 400);
	}
	assert.equal((await request(`attempts/${id}/submit`, { score: 20, expectedRevision: 1 })).status, 400);
	assert.equal((await request("quizzes/right-of-way/start", {}, { origin: "https://evil.test" })).status, 403);
	assert.equal((await request("quizzes/right-of-way/start", {}, { "x-csrf-token": "bad" })).status, 403);
	assert.equal((await request("attempts/not-an-id")).status, 404);
	assert.equal((await request("learning?learner_id=other")).status, 400);
	provider.saveQuiz = async () => { throw Object.assign(new Error("private database details"), { code: "40001" }); };
	assert.deepEqual(await request(`attempts/${id}/save`, { answers: {}, expectedRevision: 1 }), { status: 409, body: { error: "quiz_conflict" } });
	provider.readAttempt = async () => { throw Object.assign(new Error("private database details"), { code: "42501" }); };
	assert.deepEqual(await request(`attempts/${id}`), { status: 404, body: { error: "learning_unavailable" } });
});
