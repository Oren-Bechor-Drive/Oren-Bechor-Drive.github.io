import assert from "node:assert/strict";
import test from "node:test";
import { startAccountGateway, browserClient } from "../helpers/account-gateway.mjs";

async function setup(t, options) {
	const app = await startAccountGateway(options);
	t.after(app.close);
	return { ...app, client: browserClient(app.origin) };
}
const credentials = { email: "learner@example.test", password: "correct-password" };

test("Google accepts only a bounded optional string destination and falls back for unsafe paths", async t => {
	const { client } = await setup(t);
	await client.request();
	for (const returnTo of [null, 3, {}, "x".repeat(2049)]) {
		assert.equal((await client.request("google", { returnTo })).response.status, 400);
	}
	const begun = await client.request("google", { returnTo: "https://evil.test/account/" });
	assert.equal(begun.response.status, 200);
	const state = new URL(begun.data.url).searchParams.get("state");
	const completed = await client.request(`callback?state=${state}&code=valid-code`);
	assert.equal(completed.response.headers.get("location"), "/account/");
});

test("session capacity allows rotation and reclaims expired browser sessions", async t => {
	let now = 0;
	const { client, origin } = await setup(t, { now: () => now, sessionLimit: 1 });
	await client.request();
	const other = browserClient(origin);
	assert.equal((await other.request()).response.status, 503);
	assert.equal((await client.request("login", credentials)).response.status, 200);
	assert.equal((await other.request()).response.status, 503);
	const expiredCookie = client.cookie;
	now = 43_200_000;
	assert.equal((await other.request()).response.status, 200);
	assert.equal((await client.request("login", credentials, { headers: { cookie: expiredCookie } })).response.status, 403);
	await other.request("logout", {});
	assert.equal((await client.request()).response.status, 200);
});

test("session reads cannot revive access while provider logout is pending", async t => {
	const { client, provider } = await setup(t);
	await client.request();
	await client.request("login", credentials);
	const signedCookie = client.cookie;
	const entered = Promise.withResolvers(), block = Promise.withResolvers();
	t.after(() => block.resolve());
	provider.logout = async () => { entered.resolve(); await block.promise; };
	const pending = client.request("logout", {});
	await entered.promise;
	const session = await client.request("session", undefined, { headers: { cookie: signedCookie } });
	assert.equal(session.data.user, null);
	block.resolve();
	assert.equal((await pending).response.status, 200);
});

test("temporary identity-provider failures preserve a usable session for retry", async t => {
	const { client, provider } = await setup(t);
	await client.request();
	await client.request("login", credentials);
	const signedCookie = client.cookie;
	const identity = provider.identity;
	provider.identity = async () => { throw Object.assign(new Error(), { status: 503 }); };
	assert.equal((await client.request()).response.status, 503);
	assert.equal(client.cookie, signedCookie);
	provider.identity = identity;
	assert.equal((await client.request()).data.user.email, credentials.email);
});

test("expired recovery and superseded PKCE flows cannot grant account access", async t => {
	let now = 0;
	const { client, provider } = await setup(t, { now: () => now });
	await client.request();
	await client.request("google", {});
	const firstFlow = provider.calls.find(call => call[0] === "google")[1];
	await client.request("recover", { email: credentials.email });
	const flow = provider.calls.find(call => call[0] === "recover")[2];
	assert.match((await client.request(`callback?state=${firstFlow.state}&code=valid-code`)).response.headers.get("location"), /link-expired/);
	assert.equal((await client.request(`callback?state=${flow.state}&code=valid-code`)).response.headers.get("location"), "/account/reset.html");
	await client.request();
	now = 600_000;
	assert.equal((await client.request("reset", { password: "another-password" })).response.status, 403);
	assert.equal((await client.request()).data.recovery, false);
	assert.equal(provider.calls.filter(call => call[0] === "exchange").length, 1);
});

test("opaque HttpOnly sessions rotate at login, isolate learners and revoke locally", async t => {
	const { client, origin, provider } = await setup(t);
	const first = await client.request();
	assert.equal(first.data.user, null);
	assert.match(first.response.headers.get("set-cookie"), /HttpOnly/);
	assert.match(first.response.headers.get("set-cookie"), /SameSite=Lax/);
	assert.match(first.response.headers.get("cache-control"), /no-store/);
	const oldCookie = client.cookie;
	const login = await client.request("login", credentials);
	assert.equal(login.response.status, 200);
	assert.notEqual(client.cookie, oldCookie);
	assert.doesNotMatch(JSON.stringify(login.data), /access-|refresh-/);
	assert.equal((await client.request()).data.user.email, credentials.email);
	const other = browserClient(origin);
	await other.request();
	await other.request("login", { ...credentials, email: "other@example.test" });
	assert.equal((await client.request()).data.user.email, credentials.email);
	const signedCookie = client.cookie;
	await client.request("logout", {});
	assert.equal((await client.request()).data.user, null);
	const replay = await client.request("session", undefined, { headers: { cookie: signedCookie } });
	assert.equal(replay.data.user, null);
	assert.ok(provider.calls.some(call => call[0] === "logout" && call[1] === "local"));
	assert.equal((await other.request()).data.user.email, "other@example.test");
});

test("unsafe requests require exact origin, session CSRF, JSON, and bounded known fields", async t => {
	const { client, provider } = await setup(t);
	await client.request();
	for (const headers of [{ origin: "https://evil.test" }, { origin: "" }, { "x-csrf-token": "" }, { "content-type": "text/plain" }]) {
		assert.equal((await client.request("login", credentials, { headers })).response.status, 403);
	}
	assert.equal(provider.calls.length, 0);
	assert.equal((await client.request("login", { ...credentials, learnerId: "other" })).response.status, 400);
	assert.equal((await client.request("login", { ...credentials, password: "a".repeat(17000) })).response.status, 413);
});

test("bad credentials and suspended accounts cannot create sessions", async t => {
	const { client } = await setup(t);
	await client.request();
	const bad = await client.request("login", { ...credentials, password: "wrong" });
	const suspended = await client.request("login", { ...credentials, email: "suspended@example.test" });
	assert.equal(bad.response.status, 401);
	assert.deepEqual(bad.data, suspended.data);
	assert.equal((await client.request()).data.user, null);
});

test("refresh is serialized, provider revocation and absolute expiry fail closed", async t => {
	let now = Date.now();
	const { client, provider } = await setup(t, { now: () => now });
	await client.request();
	await client.request("login", credentials);
	now += 3600_000;
	const responses = await Promise.all([client.request(), client.request(), client.request()]);
	assert.ok(responses.every(result => result.data.user?.email === credentials.email));
	assert.equal(provider.calls.filter(call => call[0] === "refresh").length, 1);
	provider.tokens.clear();
	assert.equal((await client.request()).data.user, null);
	await client.request("login", credentials);
	now += 13 * 3600_000;
	assert.equal((await client.request()).data.user, null);
});

test("PKCE callbacks bind to initiating browser, consume state once and ignore callback return URLs", async t => {
	const { client, provider, origin } = await setup(t);
	await client.request();
	const result = await client.request("google", {});
	assert.match(result.data.url, /^https:\/\/accounts.google.com/);
	const flow = provider.calls.find(call => call[0] === "google")[1];
	const path = `callback?state=${flow.state}&code=valid-code&next=https://evil.test`;
	const other = browserClient(origin);
	const stolen = await other.request(path);
	assert.equal(stolen.response.headers.get("location"), "/account/login.html?status=link-expired");
	const success = await client.request(path);
	assert.equal(success.response.headers.get("location"), "/account/");
	assert.equal((await client.request()).data.user.email, credentials.email);
	const replay = await client.request(path);
	assert.match(replay.response.headers.get("location"), /link-expired/);
	assert.equal(provider.calls.filter(call => call[0] === "exchange").length, 1);
});

test("recovery session has only reset authority and invalidates all local user sessions", async t => {
	const { client, origin, provider } = await setup(t);
	await client.request();
	await client.request("login", credentials);
	assert.equal((await client.request("reset", { password: "another-password" })).response.status, 403);
	const recovery = browserClient(origin);
	await recovery.request();
	assert.equal((await recovery.request("recover", { email: credentials.email })).response.status, 200);
	const flow = provider.calls.find(call => call[0] === "recover")[2];
	const callback = await recovery.request(`callback?state=${flow.state}&code=valid-code`);
	assert.equal(callback.response.headers.get("location"), "/account/reset.html");
	const session = await recovery.request();
	assert.equal(session.data.user, null);
	assert.equal(session.data.recovery, true);
	assert.equal((await recovery.request("reset", { password: "another-password" })).response.status, 200);
	assert.equal((await client.request()).data.user, null);
	assert.equal((await recovery.request()).data.recovery, false);
	assert.ok(provider.calls.some(call => call[0] === "logout" && call[1] === "global"));
});

test("signup sends PKCE without retaining or returning credentials", async t => {
	const { client, provider } = await setup(t);
	await client.request();
	const result = await client.request("register", { ...credentials, password: "twelve chars" });
	assert.deepEqual(result.data, { ok: true });
	const flow = provider.calls.find(call => call[0] === "signup")[2];
	assert.ok(flow.challenge);
	assert.match(flow.redirect, /\/api\/account\/callback\?state=/);
	assert.equal((await client.request()).data.user, null);
});

test("registration and reset require 12 Unicode characters and at most 72 UTF-8 bytes without composition", async t => {
	const { client, provider } = await setup(t, { authLimit: 100 });
	await client.request();
	for (const password of ["", "a".repeat(11), "a".repeat(73), "א".repeat(37), "😀".repeat(6), "😀".repeat(6) + "a".repeat(5), "😀".repeat(19), "a\u0301".repeat(25), "א".repeat(34) + "aaaaa"]) {
		for (const route of ["register", "reset"]) {
			const result = await client.request(route, route === "register" ? { ...credentials, password } : { password });
			assert.equal(result.response.status, 400, `${route}: ${[...password].length}`);
			assert.equal(result.data.error, "invalid_password");
		}
	}
	assert.equal(provider.calls.length, 0);
	for (const password of ["abcdefghijkl", "אבגדהוזחטיכל", "1".repeat(12), " ".repeat(12), "a".repeat(72), "א".repeat(36), "😀".repeat(12), "😀".repeat(18), "a\u0301".repeat(6), "א".repeat(34) + "aaaa"]) {
		assert.equal((await client.request("register", { ...credentials, password })).response.status, 200);
	}
	for (const password of ["a".repeat(72), "א".repeat(36), "😀".repeat(18), "a\u0301".repeat(6)]) {
		await client.request();
		await client.request("recover", { email: credentials.email });
		const flow = provider.calls.findLast(call => call[0] === "recover")[2];
		await client.request(`callback?state=${flow.state}&code=valid-code`);
		await client.request();
		assert.equal((await client.request("reset", { password })).response.status, 200);
		assert.ok(provider.calls.some(call => call[0] === "update" && call[2] === password));
	}
});

test("login keeps existing short passwords and its 128 Unicode character maximum", async t => {
	const { client, provider } = await setup(t);
	const received = [];
	const issue = provider.password;
	provider.password = async (email, password) => { received.push(password); return issue(email, credentials.password); };
	for (const password of ["😀", "😀".repeat(12), "😀".repeat(128)]) {
		await client.request();
		assert.equal((await client.request("login", { ...credentials, password })).response.status, 200);
	}
	await client.request();
	assert.equal((await client.request("login", { ...credentials, password: "😀".repeat(129) })).data.error, "invalid_password");
	assert.deepEqual(received, ["😀", "😀".repeat(12), "😀".repeat(128)]);
});

test("account rate limits reject excess requests before reaching the provider", async t => {
	let now = 0;
	const { client, provider } = await setup(t, { authLimit: 2, now: () => now });
	await client.request();
	await client.request("login", credentials);
	await client.request("logout", {});
	await client.request();
	const result = await client.request("login", credentials);
	assert.equal(result.response.status, 429);
	assert.equal(result.response.headers.get("retry-after"), "900");
	now += 60_000;
	assert.equal((await client.request("login", credentials)).response.headers.get("retry-after"), "840");
	now += 840_000;
	assert.equal((await client.request("login", credentials)).response.status, 200);
	assert.equal(provider.calls.filter(call => call[0] === "password").length, 2);
});

test("static service exposes only public files", async t => {
	const { origin } = await setup(t);
	for (const path of ["/.env", "/.git/config", "/package.json", "/server/start.mjs", "/supabase/config.toml", "/tests/helpers/account-gateway.mjs", "/docs/plans/session-gateway-design.md", "/assets/../package.json"]) {
		const response = await fetch(origin + path);
		assert.equal(response.status, 404, path);
		assert.equal(response.headers.get("x-content-type-options"), "nosniff");
		assert.equal(response.headers.get("referrer-policy"), "no-referrer");
		assert.equal(response.headers.get("content-security-policy"), "frame-ancestors 'none'");
	}
	for (const path of ["/", "/course/", "/css/base.css", "/account/login.html", "/site.webmanifest"]) {
		const response = await fetch(origin + path);
		assert.equal(response.status, 200, path);
		assert.equal(response.headers.get("x-content-type-options"), "nosniff");
		assert.equal(response.headers.get("referrer-policy"), "no-referrer");
		assert.equal(response.headers.get("content-security-policy"), "frame-ancestors 'none'");
		assert.equal(response.headers.get("cache-control"), path.startsWith("/account/") ? "private, no-store" : "no-cache");
	}
});

for (const attempt of ["login", "callback", "anonymous-login"]) {
	test(`password reset prevents an in-flight ${attempt} from reviving a session`, async t => {
		const { client, origin, provider } = await setup(t);
		await client.request();
		if (attempt !== "anonymous-login") await client.request("login", credentials);
		const recovery = browserClient(origin);
		await recovery.request();
		await recovery.request("recover", { email: credentials.email });
		const flow = provider.calls.find(call => call[0] === "recover")[2];
		await recovery.request(`callback?state=${flow.state}&code=valid-code`);
		await recovery.request();
		let path;
		if (attempt === "callback") {
			await client.request("google", {});
			const googleFlow = provider.calls.find(call => call[0] === "google")[1];
			path = `callback?state=${googleFlow.state}&code=valid-code`;
		}
		let release, entered;
		const waiting = new Promise(resolve => { entered = resolve; });
		const block = new Promise(resolve => { release = resolve; });
		const learner = provider.learner;
		provider.learner = async token => { const result = await learner(token); entered(); await block; return result; };
		const pending = attempt.includes("login") ? client.request("login", credentials) : client.request(path);
		await waiting;
		assert.equal((await recovery.request("reset", { password: "another-password" })).response.status, 200);
		release();
		const stale = await pending;
		assert.equal((await client.request()).data.user, null);
		if (attempt.includes("login")) assert.equal(stale.response.status, 401);
		else assert.match(stale.response.headers.get("location"), /link-expired/);
	});
}

test("password reset reports its completed change when provider logout is unavailable", async t => {
	const { client, provider } = await setup(t);
	await client.request();
	await client.request("recover", { email: credentials.email });
	const flow = provider.calls.find(call => call[0] === "recover")[2];
	await client.request(`callback?state=${flow.state}&code=valid-code`);
	await client.request();
	provider.logout = async () => { throw Object.assign(new Error(), { status: 503 }); };
	const result = await client.request("reset", { password: "another-password" });
	assert.equal(result.response.status, 200);
	assert.deepEqual(result.data, { ok: true, otherSessionsSignedOut: false });
	assert.equal((await client.request()).data.recovery, false);
});

test("concurrent recovery sessions report completed password changes after local revocation", async t => {
	const { client, provider, origin } = await setup(t);
	const other = browserClient(origin);
	for (const recovery of [client, other]) {
		await recovery.request();
		await recovery.request("recover", { email: credentials.email });
		const flow = provider.calls.filter(call => call[0] === "recover").at(-1)[2];
		await recovery.request(`callback?state=${flow.state}&code=valid-code`);
		await recovery.request();
	}
	const entered = Promise.withResolvers(), block = Promise.withResolvers();
	t.after(() => block.resolve());
	let updates = 0;
	provider.updatePassword = async () => {
		if (++updates === 1) { entered.resolve(); await block.promise; }
	};
	const pending = client.request("reset", { password: "another-password" });
	await entered.promise;
	assert.equal((await other.request("reset", { password: "newer-password" })).response.status, 200);
	block.resolve();
	const result = await pending;
	assert.equal(result.response.status, 200);
	assert.equal(result.data.ok, true);
	assert.equal((await client.request()).data.recovery, false);
	assert.equal((await other.request()).data.recovery, false);
});

test("failed callback admission revokes the exchanged provider session", async t => {
	const { client, provider } = await setup(t);
	await client.request();
	await client.request("google", {});
	const flow = provider.calls.find(call => call[0] === "google")[1];
	provider.learner = async () => null;
	const result = await client.request(`callback?state=${flow.state}&code=valid-code`);
	assert.match(result.response.headers.get("location"), /link-expired/);
	assert.equal(provider.tokens.size, 0);
	assert.equal((await client.request()).data.user, null);
});
