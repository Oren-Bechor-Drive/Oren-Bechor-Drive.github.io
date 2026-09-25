import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { createStorageMedia } from "../../server/storage-media.mjs";
import { accountProvider, browserClient, startAccountGateway } from "../helpers/account-gateway.mjs";

const descriptor = { id: "video", sectionId: "a524e32d-2640-4d94-a51c-000000000001", contentVersionId: "a524e32d-2640-4d94-a51c-000000000002", file: "lessons/video.mp4", type: "video/mp4", title: "סרטון בדיקה" };
const config = { url: "https://test-project.supabase.co", secretKey: "sb_secret_test", bucket: "private-lessons", entries: [descriptor] };

async function fixture(t, handler, settings = {}) {
	const requests = [];
	const storage = createServer((req, res) => { requests.push({ method: req.method, url: req.url, headers: req.headers }); handler(req, res); });
	storage.listen(0, "127.0.0.1");
	await once(storage, "listening");
	t.after(() => new Promise(resolve => { storage.close(resolve); storage.closeAllConnections(); }));
	const media = createStorageMedia({ ...config, url: `http://127.0.0.1:${storage.address().port}`, ...settings });
	const provider = accountProvider();
	let allowed = true, version = descriptor.contentVersionId;
	provider.readSection = async () => allowed ? { id: version } : null;
	const app = await startAccountGateway({ provider, media });
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "media@example.test", password: "correct-password" });
	return { media, requests, client, provider, url: app.origin + "/api/media/video", deny() { allowed = false; }, replaceVersion() { version = "a524e32d-2640-4d94-a51c-000000000003"; },
		get: (options = {}) => fetch(app.origin + "/api/media/video", { ...options, headers: { cookie: client.cookie, ...options.headers } }) };
}

function object(req, res) {
	const ranges = { "bytes=2-5": ["bytes 2-5/10", "2345"], "bytes=-3": ["bytes 7-9/10", "789"], "bytes=8-": ["bytes 8-9/10", "89"], "bytes=8-100": ["bytes 8-9/10", "89"] };
	const range = ranges[req.headers.range];
	if (req.headers.range && !range) { res.writeHead(416, { "Content-Range": "bytes */10" }); res.end("provider details"); return; }
	const body = range?.[1] ?? "0123456789";
	res.writeHead(range ? 206 : 200, { "Content-Type": "video/mp4", "Content-Length": body.length, "Cache-Control": "public, max-age=3600", "Set-Cookie": "provider=secret", "Location": "https://secret.example.test", ...(range ? { "Content-Range": range[0] } : {}) });
	res.end(body);
}

test("storage delivery preserves private gateway authorization and opaque public descriptors", async t => {
	const app = await fixture(t, object);
	assert.deepEqual(app.media.forSection(descriptor.sectionId, descriptor.contentVersionId), [{ id: "video", title: descriptor.title, type: "video/mp4", url: "/api/media/video" }]);
	for (const method of ["GET", "HEAD"]) assert.equal((await fetch(app.url, { method, headers: { range: "bytes=2-5" } })).status, 401);
	assert.equal(app.requests.length, 0);
	const response = await app.get();
	assert.equal(response.status, 200);
	assert.equal(await response.text(), "0123456789");
	assert.equal(response.headers.get("cache-control"), "private, no-store");
	assert.equal(response.headers.get("set-cookie"), null);
	assert.equal(response.headers.get("location"), null);
	assert.equal(app.requests[0].url, "/storage/v1/object/authenticated/private-lessons/lessons/video.mp4");
	assert.equal(app.requests[0].headers.apikey, "sb_secret_test");
	assert.equal(app.requests[0].headers.authorization, undefined);
	assert.equal(app.requests[0].headers.cookie, undefined);
	app.replaceVersion();
	assert.equal((await app.get()).status, 404);
	app.deny();
	for (const method of ["GET", "HEAD"]) assert.equal((await app.get({ method, headers: { range: "bytes=2-5" } })).status, 404);
	assert.equal(app.requests.length, 1);
});

test("Storage forwards valid seeks and uses authenticated GET for browser HEAD", async t => {
	const app = await fixture(t, object);
	for (const method of ["GET", "HEAD"]) {
		const response = await app.get({ method, headers: { range: "bytes=2-5" } });
		assert.equal(response.status, 206);
		assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
		assert.equal(response.headers.get("content-length"), "4");
		assert.equal(await response.text(), method === "HEAD" ? "" : "2345");
		assert.equal(app.requests.at(-1).method, "GET");
		assert.equal(app.requests.at(-1).headers.range, "bytes=2-5");
	}
});

test("Storage rejects unsafe origins, credentials, buckets and object paths", () => {
	for (const url of ["http://example.com", "https://127.0.0.1", "https://metadata.google.internal", "https://test.supabase.co/path", "https://test.supabase.co?key=x", "https://user:secret@test.supabase.co", "https://test.supabase.co.evil.test"]) assert.throws(() => createStorageMedia({ ...config, url }));
	for (const file of ["../secret", "/secret", "folder//file", "folder/./file", "folder/%2e%2e/file", "https://evil.test/file", "file?x", "file#x", "folder\\file"]) assert.throws(() => createStorageMedia({ ...config, entries: [{ ...descriptor, file }] }));
	for (const patch of [{ bucket: "../secret" }, { secretKey: "sb_publishable_x" }, { secretKey: "sb_secret_" }, { secretKey: "bad\r\nkey" }]) assert.throws(() => createStorageMedia({ ...config, ...patch }));
});

test("legacy service credentials are server-only Authorization headers", async t => {
	const key = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from('{"role":"service_role"}').toString("base64url")}.synthetic-signature`;
	const app = await fixture(t, object, { secretKey: key });
	const response = await app.get();
	assert.equal(await response.text(), "0123456789");
	assert.equal(app.requests[0].headers.authorization, `Bearer ${key}`);
	assert.equal(app.requests[0].headers.apikey, key);
	assert.equal(response.headers.get("authorization"), null);
	assert.equal(response.headers.get("apikey"), null);
});

test("Storage range errors without HTTP range metadata become safe local 416 responses", async t => {
	let errorStatus = 400;
	const app = await fixture(t, (req, res) => {
		if (req.headers.range) { res.writeHead(errorStatus, { "content-type": "application/json" }); res.end('{"code":"InvalidRange","message":"private details"}'); }
		else object(req, res);
	});
	for (const status of [400, 416]) {
		errorStatus = status;
		const response = await app.get({ headers: { range: "bytes=20-30" } });
		assert.equal(response.status, 416);
		assert.equal(response.headers.get("content-range"), "bytes */10");
		assert.equal(await response.text(), "");
	}
	const response = await app.get({ headers: { range: "bytes=2-5" } });
	assert.equal(response.status, 503);
	assert.deepEqual(await response.json(), { error: "unavailable" });
});

test("provider failures and malformed successful responses never leak provider content", async t => {
	let status = 302, headers = { location: "http://127.0.0.1:1/secret" };
	const app = await fixture(t, (req, res) => { res.writeHead(status, headers); res.end("provider secret"); });
	for (const scenario of [
		[302, { location: "http://127.0.0.1:1/secret" }, undefined],
		[403, {}, undefined], [500, {}, undefined],
		[200, { "content-type": "text/html", "content-length": "15" }, undefined],
		[200, { "content-type": "video/mp4", "content-length": "15", "content-encoding": "gzip" }, undefined],
		[200, { "content-type": "video/mp4" }, undefined],
		[206, { "content-type": "video/mp4", "content-length": "15", "content-range": "bytes 0-14/20" }, "bytes=2-5"],
		[416, { "content-range": "bytes */10" }, "bytes=2-5"],
		[200, { "content-type": "video/mp4", "content-length": "15" }, "bytes=2-5"],
	]) {
		[status, headers] = scenario;
		const response = await app.get({ headers: scenario[2] ? { range: scenario[2] } : {} });
		assert.equal(response.status, 503, JSON.stringify(scenario));
		assert.deepEqual(await response.json(), { error: "unavailable" });
		assert.equal(response.headers.get("location"), null);
	}
});

test("storage starts streaming before completion and cancels upstream on client disconnect", async t => {
	let closeUpstream;
	const closed = new Promise(resolve => { closeUpstream = resolve; });
	const app = await fixture(t, (req, res) => {
		res.on("close", closeUpstream);
		res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "1000000" });
		res.write("first bytes");
	});
	const abort = new AbortController();
	const response = await app.get({ signal: abort.signal });
	const reader = response.body.getReader();
	assert.equal(new TextDecoder().decode((await reader.read()).value), "first bytes");
	abort.abort();
	await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("upstream was not cancelled")), 2000); timer.unref(); })]);
});

test("HEAD cancels the upstream GET without waiting for the media body", async t => {
	let closeUpstream;
	const closed = new Promise(resolve => { closeUpstream = resolve; });
	const app = await fixture(t, (req, res) => {
		res.on("close", closeUpstream);
		res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "1000000" });
		res.flushHeaders();
	});
	const response = await app.get({ method: "HEAD" });
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("content-length"), "1000000");
	await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("HEAD did not cancel upstream")), 2000); timer.unref(); })]);
});

test("a browser that disconnects during authorization does not start a Storage download", async t => {
	const app = await fixture(t, object);
	let entered, release;
	const authorizing = new Promise(resolve => { entered = resolve; });
	const authorized = new Promise(resolve => { release = resolve; });
	app.provider.readSection = async () => { entered(); await authorized; return { id: descriptor.contentVersionId }; };
	const controller = new AbortController();
	const request = app.get({ signal: controller.signal });
	await authorizing;
	controller.abort();
	await assert.rejects(request);
	await new Promise(resolve => setTimeout(resolve, 20));
	release();
	await new Promise(resolve => setTimeout(resolve, 20));
	assert.equal(app.requests.length, 0);
});

test("truncated upstream media terminates the browser response", async t => {
	const app = await fixture(t, (req, res) => {
		res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "1000000" });
		res.write("first bytes");
		setTimeout(() => res.destroy(), 30);
	});
	const response = await app.get();
	assert.equal(response.status, 200);
	await assert.rejects(response.arrayBuffer());
});

test("stalled Storage headers time out with a generic response and cancel the upstream", { timeout: 20_000 }, async t => {
	let closeUpstream;
	const closed = new Promise(resolve => { closeUpstream = resolve; });
	const app = await fixture(t, (req, res) => res.on("close", closeUpstream));
	const response = await app.get();
	assert.equal(response.status, 503);
	assert.deepEqual(await response.json(), { error: "unavailable" });
	await closed;
});
