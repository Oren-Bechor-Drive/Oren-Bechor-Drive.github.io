import assert from "node:assert/strict";
import test from "node:test";
import { createLearnerAccounts } from "../../server/learner-accounts.mjs";
import { accountProvider } from "../helpers/account-gateway.mjs";

const credentials = { email: "learner@example.test", password: "correct-password" };
const malformedTokens = [
	["absent response", () => null],
	["missing access token", tokens => ({ ...tokens, access_token: undefined })],
	["empty access token", tokens => ({ ...tokens, access_token: "" })],
	["missing refresh token", tokens => ({ ...tokens, refresh_token: undefined })],
	["empty refresh token", tokens => ({ ...tokens, refresh_token: "" })],
	["blank refresh token", tokens => ({ ...tokens, refresh_token: " " })],
	["non-string refresh token", tokens => ({ ...tokens, refresh_token: {} })],
	["non-string access token", tokens => ({ ...tokens, access_token: {} })],
	["missing expiry", tokens => ({ ...tokens, expires_in: undefined })],
	["zero expiry", tokens => ({ ...tokens, expires_in: 0 })],
	["negative expiry", tokens => ({ ...tokens, expires_in: -1 })],
	["non-finite expiry", tokens => ({ ...tokens, expires_in: Infinity })],
	["string expiry", tokens => ({ ...tokens, expires_in: "3600" })],
	["overflowing expiry", tokens => ({ ...tokens, expires_in: Number.MAX_VALUE })],
];

test("malformed password tokens cannot publish an authenticated session or mask the safe failure", async () => {
	for (const [name, malformed] of malformedTokens) {
		const provider = accountProvider();
		const password = provider.password;
		provider.password = async (...args) => malformed(await password(...args));
		const accounts = createLearnerAccounts({ origin: "http://localhost", provider });
		const anonymous = await accounts.session();
		await assert.rejects(accounts.perform(anonymous.cookie.token, "login", credentials),
			error => error.status === 401 && error.code === "sign_in_failed", name);
		assert.equal((await accounts.session(anonymous.cookie.token)).data.user, null, name);
	}
});

test("malformed recovery exchange tokens consume the flow without granting recovery authority", async () => {
	for (const [name, malformed] of malformedTokens) {
		const provider = accountProvider();
		const exchange = provider.exchange;
		provider.exchange = async (...args) => malformed(await exchange(...args));
		const accounts = createLearnerAccounts({ origin: "http://localhost", provider });
		const anonymous = await accounts.session();
		await accounts.perform(anonymous.cookie.token, "recover", { email: credentials.email });
		const flow = provider.calls.find(call => call[0] === "recover")[2];
		const callback = await accounts.completeCallback(anonymous.cookie.token, { state: flow.state, code: "valid-code" });
		assert.deepEqual(callback, { redirect: "/account/login.html?status=link-expired" }, name);
		const session = await accounts.session(anonymous.cookie.token);
		assert.equal(session.data.recovery, false, name);
		assert.equal(session.data.user, null, name);
		assert.equal((await accounts.completeCallback(anonymous.cookie.token, { state: flow.state, code: "valid-code" })).redirect,
			"/account/login.html?status=link-expired", name);
		assert.equal(provider.calls.filter(call => call[0] === "exchange").length, 1, name);
	}
});

test("malformed refreshed tokens revoke the session before returning learner state", async () => {
	for (const [name, malformed] of malformedTokens) {
		let time = 0;
		const provider = accountProvider();
		const refresh = provider.refresh;
		provider.refresh = async (...args) => malformed(await refresh(...args));
		const accounts = createLearnerAccounts({ origin: "http://localhost", provider, now: () => time });
		const anonymous = await accounts.session();
		const signed = await accounts.perform(anonymous.cookie.token, "login", credentials);
		time = 3_600_000;
		const session = await accounts.session(signed.cookie.token);
		assert.equal(session.data.user, null, name);
		assert.equal(session.data.recovery, false, name);
		assert.notEqual(session.cookie.token, signed.cookie.token, name);
		assert.equal(await accounts.acceptsRequest(signed.cookie.token, signed.data.csrf), false, name);
		assert.doesNotMatch(JSON.stringify(session), /access-|refresh-/);
	}
});

test("Google preserves its server-held protected destination and ignores callback redirect claims", async () => {
	const accounts = createLearnerAccounts({ origin: "https://course.example.test", provider: accountProvider(), googleEnabled: true });
	const anonymous = await accounts.session();
	const returnTo = "/account/reader.html?section=a524e32d-2640-4d94-a51c-000000000001&access=free";
	const begun = await accounts.perform(anonymous.cookie.token, "google", { returnTo });
	const state = new URL(begun.data.url).searchParams.get("state");
	const signed = await accounts.completeCallback(anonymous.cookie.token, { state, code: "valid-code", returnTo: "https://evil.test" });
	assert.equal(signed.redirect, returnTo);
	assert.equal((await accounts.completeCallback(anonymous.cookie.token, { state, code: "valid-code" })).redirect, "/account/login.html?status=link-expired");
});

test("account results are detached snapshots without provider credentials", async () => {
	const accounts = createLearnerAccounts({ origin: "http://localhost", provider: accountProvider() });
	const anonymous = await accounts.session();
	const signed = await accounts.perform(anonymous.cookie.token, "login", credentials);
	const token = signed.cookie.token;
	assert.deepEqual(signed.data.user, { email: credentials.email, displayName: "" });
	assert.doesNotMatch(JSON.stringify(signed), /access-|refresh-|verifier/);
	signed.data.user.email = "other@example.test";
	signed.data.user.displayName = "Changed by caller";
	signed.data.csrf = "replaced";
	signed.cookie.token = "replaced";
	const current = await accounts.session(token);
	assert.deepEqual(current.data.user, { email: credentials.email, displayName: "" });
	assert.equal(await accounts.acceptsRequest(token, current.data.csrf), true);
	assert.equal(await accounts.acceptsRequest(token, signed.data.csrf), false);
	assert.equal(await accounts.acceptsRequest(anonymous.cookie.token, anonymous.data.csrf), false);
});

test("operations queued behind logout recheck authority before calling the provider", async () => {
	const provider = accountProvider();
	const accounts = createLearnerAccounts({ origin: "http://localhost", provider });
	const anonymous = await accounts.session();
	const signed = await accounts.perform(anonymous.cookie.token, "login", credentials);
	const token = signed.cookie.token;
	const results = await Promise.allSettled([
		accounts.perform(token, "logout", {}),
		accounts.perform(token, "login", credentials),
		accounts.session(token),
	]);
	assert.equal(results[0].status, "fulfilled");
	assert.deepEqual(results[0].value.cookie, { token: "", maxAge: 0 });
	assert.equal(results[1].status, "rejected");
	assert.equal(results[1].reason.status, 401);
	assert.equal(results[2].status, "fulfilled");
	assert.equal(results[2].value.data.user, null);
	assert.equal(provider.tokens.size, 0);
});

test("a session read completes its snapshot before a queued logout clears identity", async () => {
	const accounts = createLearnerAccounts({ origin: "http://localhost", provider: accountProvider() });
	const anonymous = await accounts.session();
	const signed = await accounts.perform(anonymous.cookie.token, "login", credentials);
	const token = signed.cookie.token;
	const [read, logout] = await Promise.all([
		accounts.session(token),
		accounts.perform(token, "logout", {}),
	]);
	assert.deepEqual(read.data.user, { email: credentials.email, displayName: "" });
	assert.equal(logout.data.ok, true);
	assert.equal((await accounts.session(token)).data.user, null);
});
