import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { unstable_startWorker } from "wrangler";
import { packageWorkerAssets } from "../../scripts/package-worker.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));

async function start(t, main = "tests/fixtures/hosting/worker.mjs") {
	const directory = await mkdtemp(path.join(tmpdir(), "oren-worker-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const assets = path.join(directory, "public");
	await packageWorkerAssets({ root, output: assets });
	const config = path.join(directory, "wrangler.json");
	await writeFile(config, JSON.stringify({ name: "oren-local-test", main: path.join(root, main), compatibility_date: "2026-09-23", compatibility_flags: ["nodejs_compat"], workers_dev: false, preview_urls: false,
		assets: { directory: assets, binding: "ASSETS", run_worker_first: JSON.parse(await readFile(path.join(root, "wrangler.jsonc"), "utf8")).assets.run_worker_first, html_handling: "none", not_found_handling: "404-page" } }));
	const worker = await unstable_startWorker({ config, dev: { origin: { hostname: "course.example.test", secure: true }, remote: false, persist: false, server: { hostname: "127.0.0.1", port: 0 }, inspector: false, watch: false } });
	t.after(() => worker.dispose());
	await worker.ready;
	// Dispatch through real asset routing. The direct binding below also lets us
	// test a hostile origin without Wrangler rewriting it to the dev origin.
	const runtime = { fetch: (...args) => worker.raw.runtimes[0].mf.dispatchFetch(...args) };
	const request = (pathname, options = {}) => runtime.fetch(`https://course.example.test${pathname}`, { redirect: "manual", ...options,
		headers: { "cf-connecting-ip": "2001:db8::1", ...options.headers } });
	return { worker: await worker.raw.runtimes[0].mf.getWorker(), request, networkOrigin: (await worker.url).origin };
}

test("Worker serves the static site with safe routing and private account responses", { timeout: 60_000 }, async t => {
	const { request } = await start(t);
	for (const pathname of ["/", "/index.html", "/course/", "/course/right-of-way/", "/account/login.html"]) {
		const response = await request(pathname);
		assert.equal(response.status, 200, pathname);
		assert.match(response.headers.get("content-type"), /text\/html/);
		assert.equal(response.headers.get("x-content-type-options"), "nosniff");
		assert.equal(response.headers.get("content-security-policy"), "frame-ancestors 'none'");
		if (pathname.startsWith("/account")) assert.equal(response.headers.get("cache-control"), "private, no-store");
	}
	assert.equal((await request("/course")).headers.get("location"), "/course/");
	const asset = await request("/css/base.css");
	assert.equal(asset.status, 200);
	assert.equal(asset.headers.get("x-test-worker"), null);
	assert.equal(asset.headers.get("x-content-type-options"), "nosniff");
	assert.equal(asset.headers.get("cache-control"), "no-cache");
	for (const pathname of ["/.env", "/server/gateway.mjs", "/docs/PRODUCT.md", "/package.json", "/assets/.secret.txt", "/assets/private.json", "/course/%2ehidden/file.html"]) {
		assert.equal((await request(pathname)).status, 404, pathname);
	}
	const api = await request("/api/not-found", { headers: { "sec-fetch-mode": "navigate" } });
	assert.equal(api.status, 404);
	assert.deepEqual(await api.json(), { error: "not_found" });
	assert.equal(api.headers.get("cache-control"), "private, no-store");
	assert.equal((await request("/", { method: "POST" })).status, 405);
	assert.equal(await (await request("/account/login.html", { method: "HEAD" })).text(), "");
});

test("Worker runs real gateway login with Secure cookies, CSRF and trusted client limits", { timeout: 60_000 }, async t => {
	const { worker, request } = await start(t);
	const session = await request("/api/account/session");
	assert.equal(session.status, 200);
	const initialCookie = session.headers.get("set-cookie");
	assert.match(initialCookie, /^__Host-oren_session=/);
	assert.match(initialCookie, /; Secure/);
	assert.match(initialCookie, /; HttpOnly/);
	const { csrf } = await session.json();
	const login = { method: "POST", body: JSON.stringify({ email: "learner@example.test", password: "correct-password" }), headers: { cookie: initialCookie.split(";")[0], origin: "https://course.example.test", "content-type": "application/json", "x-csrf-token": csrf } };
	assert.equal((await request("/api/account/login", { ...login, headers: { ...login.headers, origin: "https://evil.test" } })).status, 403);
	assert.equal((await worker.fetch("https://evil.test/api/account/session", { headers: { "cf-connecting-ip": "192.0.2.1" } })).status, 421);
	const result = await request("/api/account/login", login);
	assert.equal(result.status, 200, await result.clone().text());
	assert.doesNotMatch(await result.text(), /access-secret|refresh-secret/);
	const signedCookie = result.headers.get("set-cookie").split(";")[0];
	const signed = await request("/api/account/session", { headers: { cookie: signedCookie } });
	const snapshot = await signed.json();
	assert.equal(snapshot.user.email, "learner@example.test");
	const action = { method: "POST", body: "{}", headers: { ...login.headers, cookie: signedCookie, "x-csrf-token": snapshot.csrf, "x-forwarded-for": "192.0.2.99" } };
	assert.equal((await request("/api/account/logout", action)).status, 200);
	const next = await request("/api/account/session");
	const nextLogin = { ...login, headers: { ...login.headers, cookie: next.headers.get("set-cookie").split(";")[0], "x-csrf-token": (await next.json()).csrf, "forwarded": "for=198.51.100.1", "x-forwarded-for": "198.51.100.1" } };
	assert.equal((await request("/api/account/login", nextLogin)).status, 429);
	assert.equal((await request("/api/account/login", { ...nextLogin, headers: { ...nextLogin.headers, "cf-connecting-ip": "2001:0DB8:0:0:0:0:0:1", "x-oren-client-address": "192.0.2.80" } })).status, 429);
	assert.equal((await request("/api/account/session", { headers: { "cf-connecting-ip": "invalid" } })).status, 503);
	const callback = await request("/api/account/callback?code=bogus", { headers: { "x-forwarded-host": "evil.test", "x-forwarded-proto": "http" } });
	assert.equal(callback.status, 303);
	assert.match(callback.headers.get("location"), /^\/account\/login.html\?/);
	assert.equal((await request("/api/account/login", { ...nextLogin, headers: { ...nextLogin.headers, "cf-connecting-ip": "192.0.2.33" } })).status, 200);
});

test("production entry serves public files while missing configuration disables every API", { timeout: 60_000 }, async t => {
	const { request } = await start(t, "server/worker.mjs");
	assert.equal((await request("/")).status, 200);
	assert.equal((await request("/account/login.html")).headers.get("cache-control"), "private, no-store");
	for (const pathname of ["/api/account/session", "/api/account/callback?code=secret", "/api/media/private"]) {
		const response = await request(pathname);
		assert.equal(response.status, 503);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		assert.equal(response.headers.get("set-cookie"), null);
		assert.deepEqual(await response.json(), { error: "unavailable" });
	}
});

test("Worker streams authorized Storage media and cancels the upstream on disconnect", { timeout: 60_000 }, async t => {
	const { request, networkOrigin } = await start(t);
	assert.equal((await request("/api/media/stream")).status, 401);
	const session = await request("/api/account/session");
	const login = await request("/api/account/login", { method: "POST", body: JSON.stringify({ email: "learner@example.test", password: "correct-password" }), headers: {
		cookie: session.headers.get("set-cookie").split(";")[0], origin: "https://course.example.test", "content-type": "application/json", "x-csrf-token": (await session.json()).csrf,
	} });
	assert.equal(login.status, 200);
	const cookie = login.headers.get("set-cookie").split(";")[0];
	const range = await request("/api/media/stream", { headers: { cookie, range: "bytes=0-3" } });
	assert.equal(range.status, 206, await range.clone().text());
	assert.equal(range.headers.get("content-range"), "bytes 0-3/8388608");
	assert.equal(range.headers.get("cache-control"), "private, no-store");
	assert.deepEqual([...new Uint8Array(await range.arrayBuffer())], [0, 1, 2, 3]);
	const head = await request("/api/media/stream", { method: "HEAD", headers: { cookie } });
	assert.equal(head.status, 200);
	assert.equal(head.headers.get("content-length"), "8388608");
	assert.equal(await head.text(), "");
	const abort = new AbortController();
	const response = await fetch(`${networkOrigin}/api/media/stream`, { headers: { cookie }, signal: abort.signal });
	assert.equal(response.status, 200);
	const reader = response.body.getReader();
	assert.ok((await reader.read()).value.length > 0);
	abort.abort();
	await reader.cancel().catch(() => {});
	let state;
	for (let attempt = 0; attempt < 20; attempt++) {
		state = await (await request("/api/learning", { headers: { cookie } })).json();
		if (state.cancelled) break;
		await new Promise(resolve => setTimeout(resolve, 20));
	}
	assert.equal(state.cancelled, true);
	assert.ok(state.sentChunks < 128, "Disconnect must stop the upstream before the full video is read.");
});
