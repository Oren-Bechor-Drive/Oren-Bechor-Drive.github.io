import assert from "node:assert/strict";
import { once } from "node:events";
import { connect } from "node:net";
import test from "node:test";
import { startLocalApplication } from "../../server/application.mjs";
import { accountProvider, browserClient } from "../helpers/account-gateway.mjs";

test("local application serves static pages and authenticated API on its resolved origin", async t => {
	const app = await startLocalApplication({ provider: accountProvider() });
	t.after(app.close);
	assert.notEqual(new URL(app.origin).port, "0");
	const page = await fetch(`${app.origin}/account/login.html`);
	assert.equal(page.status, 200);
	assert.match(page.headers.get("content-type"), /text\/html/);
	assert.match(await page.text(), /<html[^>]*dir="rtl"/);
	const client = browserClient(app.origin);
	assert.equal((await client.request()).response.status, 200);
	const login = await client.request("login", { email: "learner@example.test", password: "correct-password" });
	assert.equal(login.response.status, 200);
	assert.equal(login.data.user.email, "learner@example.test");
	assert.equal((await fetch(`${app.origin}/server/start.mjs`)).status, 404);
});

test("shutdown closes incomplete requests, is repeatable, and releases the port", { timeout: 5000 }, async t => {
	const app = await startLocalApplication();
	t.after(app.close);
	const socket = connect(Number(new URL(app.origin).port), "127.0.0.1");
	t.after(() => socket.destroy());
	await once(socket, "connect");
	const disconnected = new Promise(resolve => socket.once("close", resolve));
	socket.on("error", error => assert.equal(error.code, "ECONNRESET"));
	socket.write("GET /account/login.html HTTP/1.1\r\nHost: localhost\r\n");
	await Promise.all([app.close(), app.close(), disconnected]);
	await app.close();
	const replacement = await startLocalApplication({ origin: app.origin });
	t.after(replacement.close);
	assert.equal((await fetch(`${replacement.origin}/api/account/session`)).status, 200);
});

test("bind failure rejects without disturbing the running application", async t => {
	const app = await startLocalApplication();
	t.after(app.close);
	await assert.rejects(startLocalApplication({ origin: app.origin }), { code: "EADDRINUSE" });
	assert.equal((await fetch(`${app.origin}/account/login.html`)).status, 200);
});

test("local application rejects origins that its loopback HTTP listener cannot serve", async () => {
	for (const origin of ["https://localhost:0", "http://site.example:0", "http://[::1]:0", "http://localhost:0/path", "http://localhost:0/"]) {
		await assert.rejects(startLocalApplication({ origin }), /APP_ORIGIN must be an exact HTTP origin/);
	}
});
