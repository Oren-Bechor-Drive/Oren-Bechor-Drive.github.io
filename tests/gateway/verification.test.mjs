import assert from "node:assert/strict";
import test from "node:test";
import { startAccountGateway, browserClient, accountProvider } from "../helpers/account-gateway.mjs";

const credentials = { email: "pending@example.test", password: "correct-password" };
async function fixture(t, options = {}) {
	let now = Date.now();
	const app = await startAccountGateway({ authLimit: 100, ...options, now: () => now });
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	return { ...app, client, advance: milliseconds => { now += milliseconds; } };
}
async function register(client) {
	const result = await client.request("register", credentials);
	assert.deepEqual(result.data, { ok: true });
}

test("verification summaries and resend remain bound to the initiating session and original PKCE flow", async t => {
	const { client, provider, origin, advance } = await fixture(t);
	await register(client);
	const original = structuredClone(provider.calls.find(call => call[0] === "signup")[2]);
	const pending = (await client.request()).data.verification;
	assert.deepEqual(pending, { maskedEmail: "p***@example.test", resendAfter: 60, expiresAfter: 3600 });
	assert.doesNotMatch(JSON.stringify((await client.request()).data), /pending@example|verifier|challenge|access_token|refresh_token|state/);
	const other = browserClient(origin);
	assert.equal((await other.request()).data.verification, null);
	assert.deepEqual((await other.request("resend", {})).data, { ok: true, verification: null });
	assert.equal(provider.calls.some(call => call[0] === "resend"), false);
	assert.equal((await client.request("resend", {})).response.headers.get("retry-after"), "60");
	advance(12_000);
	assert.equal((await client.request("resend", {})).response.headers.get("retry-after"), "48");
	advance(48_000);
	const resent = await client.request("resend", {});
	assert.equal(resent.response.status, 200);
	assert.equal(resent.data.verification.resendAfter, 60);
	const call = provider.calls.find(call => call[0] === "resend");
	assert.equal(call[1], credentials.email);
	for (const key of ["kind", "verifier", "state", "challenge", "expires", "redirect", "email"]) assert.equal(call[2][key], original[key], `resending must retain ${key}`);
	assert.equal((await client.request("resend", {})).response.status, 429);
});

test("resend requires origin, CSRF, an empty body and current signup context", async t => {
	const { client, provider, advance } = await fixture(t);
	await register(client); advance(60_000);
	for (const headers of [{ origin: "https://elsewhere.test" }, { "x-csrf-token": "wrong" }, { "content-type": "text/plain" }]) {
		assert.equal((await client.request("resend", {}, { headers })).response.status, 403);
	}
	assert.equal((await client.request("resend", { email: "other@example.test" })).response.status, 400);
	assert.equal(provider.calls.some(call => call[0] === "resend"), false);
	await client.request("recover", { email: credentials.email });
	assert.equal((await client.request()).data.verification, null);
	assert.deepEqual((await client.request("resend", {})).data, { ok: true, verification: null });
});

test("expiry and callback consumption remove pending verification and prevent another send", async t => {
	for (const finish of ["expiry", "callback"]) {
		const { client, provider, advance } = await fixture(t);
		await register(client);
		const flow = provider.calls.find(call => call[0] === "signup")[2];
		if (finish === "expiry") advance(3600_000);
		else await client.request(`callback?state=${flow.state}&code=valid-code`);
		assert.equal((await client.request()).data.verification, null);
		assert.deepEqual((await client.request("resend", {})).data, { ok: true, verification: null });
		assert.equal(provider.calls.some(call => call[0] === "resend"), false);
	}
});

test("known, unknown and denied signup requests expose the same verification state and acknowledgement", async t => {
	const summaries = [], results = [];
	for (const outcome of ["known", "unknown", "denied"]) {
		const provider = accountProvider();
		const signup = provider.signup;
		provider.signup = async (...args) => { await signup(...args); if (outcome === "known") throw Object.assign(new Error(), { status: 400, code: "user_already_exists" }); };
		const { client, advance } = await fixture(t, { provider, admit: () => outcome !== "denied" });
		await register(client);
		summaries.push((await client.request()).data.verification);
		advance(60_000);
		const result = await client.request("resend", {});
		assert.equal(result.response.status, 200);
		assert.equal(result.data.ok, true);
		assert.equal(summaries.at(-1).maskedEmail, "p***@example.test");
		results.push(result.data);
		assert.equal(provider.calls.some(call => call[0] === "signup" || call[0] === "resend"), outcome !== "denied");
	}
	assert.deepEqual(summaries[0], summaries[1]); assert.deepEqual(summaries[1], summaries[2]);
	assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});

test("resend rechecks admission and keeps a conditional acknowledgement for expected provider failures", async t => {
	for (const outcome of ["admission-closes", "provider-failure"]) {
		let allowed = true;
		const { client, provider, advance } = await fixture(t, { admit: () => allowed });
		await register(client); advance(60_000);
		if (outcome === "admission-closes") allowed = false;
		else provider.resend = async () => { throw Object.assign(new Error("private provider payload"), { status: 503 }); };
		const result = await client.request("resend", {});
		assert.equal(result.response.status, 200);
		assert.equal(result.data.ok, true);
		assert.equal(result.data.verification.maskedEmail, "p***@example.test");
		assert.equal(result.data.verification.resendAfter, 60);
		assert.doesNotMatch(JSON.stringify(result.data), /private|pending@example/);
		assert.equal((await client.request("resend", {})).response.status, 429);
		if (outcome === "admission-closes") assert.equal(provider.calls.some(call => call[0] === "resend"), false);
	}
});

test("unexpected resend implementation errors remain failures without private payloads", async t => {
	const { client, provider, advance } = await fixture(t);
	await register(client); advance(60_000);
	provider.resend = async () => { throw new Error("internal secret"); };
	const result = await client.request("resend", {});
	assert.equal(result.response.status, 503);
	assert.deepEqual(result.data, { error: "unavailable" });
});
