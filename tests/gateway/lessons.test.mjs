import assert from "node:assert/strict";
import test from "node:test";
import { startAccountGateway, browserClient } from "../helpers/account-gateway.mjs";

async function signedIn(app) {
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "learner@example.test", password: "correct-password" });
	return client;
}
const read = (app, key, cookie = "", options = {}) => fetch(`${app.origin}/api/lessons/${key}`, { ...options, headers: { cookie } });

test("test lesson reads require an ordinary signed-in session and never cache bodies", async t => {
	const app = await startAccountGateway();
	t.after(app.close);
	const calls = [];
	app.provider.readSection = async (token, section, level) => {
		calls.push({ token, section, level });
		return level === "free" ? { id: "version", section_id: section, access_level: level, revision: 1, body_text: "תוכן בדיקה בלבד.", private_field: "must not escape" } : null;
	};
	const anonymous = await read(app, "free");
	assert.equal(anonymous.status, 401);
	assert.deepEqual(await anonymous.json(), { error: "session_expired" });
	assert.equal(calls.length, 0);
	const client = await signedIn(app);
	const allowed = await read(app, "free", client.cookie);
	assert.equal(allowed.status, 200);
	assert.equal(allowed.headers.get("cache-control"), "private, no-store");
	assert.deepEqual(await allowed.json(), { lesson: { id: "version", sectionId: "a524e32d-2640-4d94-a51c-000000000001", accessLevel: "free", revision: 1, body: "תוכן בדיקה בלבד." } });
	assert.equal(calls[0].token, [...app.provider.tokens.keys()][0]);
	const denied = await read(app, "paid", client.cookie);
	assert.equal(denied.status, 404);
	assert.deepEqual(await denied.json(), { error: "lesson_unavailable" });
	assert.equal((await read(app, "free", client.cookie, { method: "POST" })).status, 405);
	assert.equal((await read(app, "unknown", client.cookie)).status, 404);
	assert.equal((await read(app, "free?learner_id=another&plan=paid", client.cookie)).status, 400);
	await client.request("logout", {});
	assert.equal((await read(app, "free", client.cookie)).status, 401);
});

test("lesson reads reject recovery sessions and unavailable providers", async t => {
	const app = await startAccountGateway();
	t.after(app.close);
	app.provider.readSection = async () => assert.fail("Recovery authority must not read lessons");
	const client = browserClient(app.origin);
	await client.request();
	await client.request("recover", { email: "learner@example.test" });
	const flow = app.provider.calls.find(call => call[0] === "recover")[2];
	await client.request(`callback?state=${flow.state}&code=valid-code`);
	assert.equal((await read(app, "free", client.cookie)).status, 401);
	const unavailable = await startAccountGateway({ provider: null });
	t.after(unavailable.close);
	assert.equal((await read(unavailable, "free")).status, 503);
});

test("lesson reads refresh tokens and discard results after concurrent session invalidation", async t => {
	let time = Date.now();
	const app = await startAccountGateway({ now: () => time });
	t.after(app.close);
	const client = await signedIn(app);
	time += 3_580_000;
	app.provider.readSection = async token => {
		assert.equal(token, "access-2");
		time += 43_200_000;
		return { body_text: "must not escape" };
	};
	const response = await read(app, "free", client.cookie);
	assert.equal(response.status, 401);
	assert.doesNotMatch(await response.text(), /must not escape/);
});

test("lesson outages return safe errors without leaking provider payloads", async t => {
	const app = await startAccountGateway();
	t.after(app.close);
	const client = await signedIn(app);
	app.provider.readSection = async () => { throw Object.assign(new Error("private token"), { status: 500 }); };
	const response = await read(app, "free", client.cookie);
	assert.equal(response.status, 503);
	assert.deepEqual(await response.json(), { error: "unavailable" });
});
