import assert from "node:assert/strict";
import test from "node:test";
import { createLearnerAccounts } from "../../server/learner-accounts.mjs";
import { accountProvider } from "../helpers/account-gateway.mjs";

const credentials = { email: "learner@example.test", password: "correct-password" };

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
