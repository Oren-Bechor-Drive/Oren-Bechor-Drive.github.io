import assert from "node:assert/strict";
import test from "node:test";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";
import { testSectionPath, testSections } from "../fixtures/test-sections.mjs";

test("gateway lesson reads enforce actual RLS and privileged development grants", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "learner@example.test", password: "correct-password" });
	const read = key => fetch(`${app.origin}${testSectionPath(key)}`, { headers: { cookie: client.cookie } });
	assert.equal((await read("free")).status, 200);
	assert.equal((await read("paid")).status, 404);
	await app.grant("learner@example.test");
	const paid = await read("paid");
	assert.equal(paid.status, 200);
	assert.match((await paid.json()).lesson.body, /תוכן בדיקה בתשלום/);
	await app.revoke("learner@example.test");
	assert.equal((await read("paid")).status, 404);
	assert.equal((await read("free")).status, 200);
});

test("a rejected development grant leaves the fixture usable for the next grant", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "learner@example.test", password: "correct-password" });
	await assert.rejects(app.grant("learner@example.test", "2020-01-01T00:00:00Z"));
	await app.grant("learner@example.test");
	assert.equal((await fetch(`${app.origin}${testSectionPath("paid")}`, { headers: { cookie: client.cookie } })).status, 200);
});

test("concurrent learner sessions share identity while grants and revocation stay learner-scoped", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const emails = ["first@example.test", "first@example.test", "second@example.test"];
	const clients = emails.map(() => browserClient(app.origin));
	await Promise.all(clients.map(async (client, i) => {
		await client.request();
		assert.equal((await client.request("login", { email: emails[i], password: "correct-password" })).response.status, 200);
	}));
	const paidStatus = async client => (await fetch(`${app.origin}${testSectionPath("paid")}`, { headers: { cookie: client.cookie } })).status;
	const results = await Promise.allSettled([
		app.grant(emails[0]), app.grant(emails[2], "2020-01-01T00:00:00Z"),
	]);
	assert.deepEqual(results.map(result => result.status), ["fulfilled", "rejected"]);
	assert.deepEqual(await Promise.all(clients.map(paidStatus)), [200, 200, 404]);
	await app.grant(emails[2]);
	await app.revoke(emails[0]);
	assert.deepEqual(await Promise.all(clients.map(paidStatus)), [404, 404, 200]);
	await app.grant(emails[0]);
	assert.deepEqual(await Promise.all(clients.map(paidStatus)), [200, 200, 200]);
	await Promise.all([app.close(), app.close()]);
});
