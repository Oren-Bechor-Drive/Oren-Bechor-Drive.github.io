import assert from "node:assert/strict";
import test from "node:test";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";

test("section catalog and reader expose only authorized published definitions and lessons", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const client = browserClient(app.origin);
	async function request(path, body) {
		const response = await fetch(app.origin + "/api/sections" + path, { method: body ? "POST" : "GET",
			headers: { cookie: client.cookie, origin: app.origin, "content-type": "application/json", "x-csrf-token": client.csrf },
			...(body ? { body: JSON.stringify(body) } : {}) });
		return { status: response.status, data: await response.json() };
	}
	assert.equal((await request("")).status, 401);
	await client.request();
	await client.request("login", { email: "reader@example.test", password: "correct-password" });
	let catalog = await request("");
	assert.equal(catalog.status, 200);
	assert.equal(catalog.data.sections.length, 1);
	const free = catalog.data.sections[0];
	assert.equal(free.accessLevel, "free");
	assert.equal(free.title, "הגדרה לבדיקה");
	const reading = await request(`/${free.id}/free`);
	assert.equal(reading.status, 200);
	assert.deepEqual(reading.data.media, []);
	assert.match(reading.data.lesson.body, /תוכן בדיקה חינמי/);
	assert.equal((await request(`/${free.id}/free/position`, { contentVersionId: reading.data.lesson.id, position: 4200, expectedRevision: 0 })).status, 200);
	await app.grant("reader@example.test");
	catalog = await request("");
	assert.equal(catalog.data.sections.length, 2);
	const paid = catalog.data.sections.find(section => section.accessLevel === "paid");
	assert.equal((await request(`/${paid.id}/paid`)).status, 200);
	await app.expire("reader@example.test", 10);
	assert.equal((await request(`/${paid.id}/paid`)).status, 404);
	assert.equal((await request("")).data.sections.length, 1);
	assert.equal((await request(`/${free.id}/free`)).data.position, null);
});
