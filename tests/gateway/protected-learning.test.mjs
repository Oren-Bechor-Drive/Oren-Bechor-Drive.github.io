import assert from "node:assert/strict";
import test from "node:test";
import { accountProvider, startAccountGateway, browserClient } from "../helpers/account-gateway.mjs";
import { startLessonGateway } from "../helpers/test-lessons.mjs";

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

for (const method of ["saveQuiz","submitQuiz"]) {
	test(`only withdrawal SQLSTATE maps ${method} to the safe HTTP 410 contract`, async t => {
		const provider = accountProvider();
		let code = "P4100";
		provider[method] = async () => { throw Object.assign(new Error("private provider diagnostic"),{ code }); };
		const app = await startAccountGateway({ provider }); t.after(app.close);
		const client = browserClient(app.origin);
		await client.request();
		await client.request("login",{ email:"withdrawal@example.test",password:"correct-password" });
		const suffix = method === "saveQuiz" ? "save" : "submit";
		const request = () => fetch(`${app.origin}/api/attempts/${id}/${suffix}`,{ method:"POST",
			headers:{ cookie:client.cookie,origin:app.origin,"content-type":"application/json","x-csrf-token":client.csrf },
			body:JSON.stringify(method === "saveQuiz" ? { answers:{ q1:"a" },expectedRevision:0 } : { expectedRevision:0 }) });
		const withdrawn = await request();
		assert.equal(withdrawn.status,410);
		assert.deepEqual(await withdrawn.json(),{ error:"quiz_withdrawn" });
		assert.equal(withdrawn.headers.get("cache-control"),"private, no-store");
		code = "P4101";
		const unexpected = await request();
		assert.equal(unexpected.status,503);
		assert.deepEqual(await unexpected.json(),{ error:"unavailable" });
	});
}

test("real database withdrawal stops drafts over HTTP and keeps submitted history and completion", async t => {
	const app = await startLessonGateway({ quiz:true,quizCount:3 }); t.after(app.close);
	async function learner(email) {
		const client = browserClient(app.origin); await client.request();
		await client.request("login",{ email,password:"correct-password" }); await app.grant(email);
		return async (path,body) => {
			const response = await fetch(`${app.origin}/api/${path}`,{ method:body === undefined ? "GET" : "POST",
				headers:{ cookie:client.cookie,origin:app.origin,"content-type":"application/json","x-csrf-token":client.csrf },
				...(body === undefined ? {} : { body:JSON.stringify(body) }) });
			assert.equal(response.headers.get("cache-control"),"private, no-store");
			return { status:response.status,body:await response.json() };
		};
	}
	const unfinished = await learner("withdrawn-draft@example.test"), submitted = await learner("withdrawn-history@example.test");
	const draft = (await unfinished("quizzes/synthetic-topic/start",{})).body;
	const second = (await submitted("quizzes/synthetic-topic/start",{})).body;
	const saved = (await submitted(`attempts/${second.id}/save`,{ answers:{ q1:"a",q2:"a",q3:"a" },expectedRevision:0 })).body;
	const result = await submitted(`attempts/${second.id}/submit`,{ expectedRevision:saved.revision });
	const completion = await submitted("topics/synthetic-topic/complete",{});
	const history = await submitted("quizzes/synthetic-topic/history");
	await app.withdrawQuiz("synthetic-topic");
	const stopped = await unfinished(`attempts/${draft.id}`);
	assert.equal(stopped.status,200);
	assert.equal(stopped.body.status,"withdrawn");
	assert.deepEqual(Object.keys(stopped.body).sort(),["csrf","id","revision","status","topicKey"]);
	for (const [suffix,body] of [["save",{ answers:{ q1:"a" },expectedRevision:0 }],["submit",{ expectedRevision:0 }]]) {
		assert.deepEqual(await unfinished(`attempts/${draft.id}/${suffix}`,body),{ status:410,body:{ error:"quiz_withdrawn" } });
	}
	assert.deepEqual(await submitted(`attempts/${second.id}`),result);
	assert.deepEqual(await submitted("topics/synthetic-topic/complete",{}),completion);
	assert.deepEqual(await submitted("quizzes/synthetic-topic/history"),history);
	assert.deepEqual(await unfinished(`attempts/${second.id}`),{ status:404,body:{ error:"learning_unavailable" } });
	assert.equal((await unfinished("learning")).body.topics.length,0);
	await app.publishQuiz("synthetic-topic",4);
	const replacement = await unfinished("quizzes/synthetic-topic/start",{});
	assert.equal(replacement.status,200);
	assert.notEqual(replacement.body.id,draft.id);
	assert.deepEqual(replacement.body.answers,{});
	assert.equal(replacement.body.questions.length,4);
});
