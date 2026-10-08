import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseProvider } from "../../server/supabase.mjs";

test("verification resend uses the original PKCE challenge and callback without forwarding private flow data", async () => {
	let sent;
	const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "public", secretKey: "secret",
		fetcher: async (url, options) => { sent = { url: new URL(url), ...options, body: JSON.parse(options.body) }; return Response.json({}); } });
	const flow = { verifier: "server-only-verifier", challenge: "original-challenge", state: "original-state", email: "learner@example.test",
		redirect: "https://site.test/api/account/callback?state=original-state", expires: 999999999, nextResendAt: 9999 };
	await provider.resend(flow.email, flow);
	assert.equal(sent.url.pathname, "/auth/v1/resend");
	assert.equal(sent.url.searchParams.get("redirect_to"), flow.redirect);
	assert.equal(sent.method, "POST");
	assert.equal(sent.headers.apikey, "public");
	assert.equal(sent.headers.authorization, undefined);
	assert.deepEqual(sent.body, { type: "signup", email: flow.email, code_challenge: flow.challenge, code_challenge_method: "s256" });
	assert.doesNotMatch(JSON.stringify(sent.body), /verifier|password|expires|nextResendAt/);
});

test("Supabase REST adapter keeps secrets scoped and uses PKCE and learner-context queries", async () => {
	const calls = [];
	const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "sb_publishable_test", secretKey: "sb_secret_test",
		async fetcher(url, options) {
			calls.push({ url: new URL(url), ...options, body: options.body ? JSON.parse(options.body) : undefined });
			return new Response(JSON.stringify(url.includes("/learners?") ? [{ id: "learner" }] : {}));
		} });
	const flow = { verifier: "server-only-verifier", challenge: "pkce-challenge-fixture", redirect: "https://site.test/api/account/callback?state=abc" };
	await provider.password("learner@example.test", "correct-password");
	await provider.signup("learner@example.test", "correct-password", flow);
	await provider.recover("learner@example.test", flow);
	await provider.exchange("one-time-code", flow.verifier);
	await provider.refresh("refresh-secret");
	await provider.identity("learner-jwt");
	await provider.provision("auth-user-id");
	await provider.learner("learner-jwt");
	await provider.updatePassword("learner-jwt", "new-password-value");
	await provider.logout("learner-jwt", "local");
	assert.deepEqual(calls.map(call => [call.method, call.url.pathname]), [
		["POST", "/auth/v1/token"], ["POST", "/auth/v1/signup"], ["POST", "/auth/v1/recover"], ["POST", "/auth/v1/token"],
		["POST", "/auth/v1/token"], ["GET", "/auth/v1/user"], ["POST", "/rest/v1/rpc/provision_learner"],
		["GET", "/rest/v1/learners"], ["PUT", "/auth/v1/user"], ["POST", "/auth/v1/logout"],
	]);
	assert.deepEqual(calls[3].body, { auth_code: "one-time-code", code_verifier: flow.verifier });
	for (const index of [1, 2]) {
		assert.equal(calls[index].url.searchParams.get("redirect_to"), flow.redirect);
		assert.equal(calls[index].body.code_challenge_method, "s256");
		assert.equal(calls[index].body.code_challenge, flow.challenge);
		assert.equal(calls[index].body.code_verifier, undefined);
	}
	for (const [index, call] of calls.entries()) {
		assert.equal(call.headers.apikey, index === 6 ? "sb_secret_test" : "sb_publishable_test");
		assert.notEqual(call.headers.authorization, "Bearer sb_secret_test");
		assert.equal(call.redirect, "error");
	}
	assert.equal(calls[7].headers.authorization, "Bearer learner-jwt");
	assert.equal(calls[7].url.searchParams.get("select"), "id,display_name");
	assert.equal(calls[9].url.searchParams.get("scope"), "local");
	const google = new URL(provider.google(flow));
	assert.equal(google.origin, "https://project.supabase.co");
	assert.equal(google.searchParams.get("code_challenge"), flow.challenge);
	assert.equal(google.searchParams.get("provider"), "google");
	assert.equal(google.searchParams.get("redirect_to"), flow.redirect);
});

test("Auth requests preserve accepted ASCII, Hebrew, emoji and combining passwords unchanged", async () => {
	const calls = [];
	const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "public", secretKey: "secret",
		fetcher: async (url, options) => { calls.push({ url: new URL(url), ...options, body: JSON.parse(options.body) }); return Response.json({}); } });
	const flow = { challenge: "synthetic-challenge", redirect: "https://site.test/api/account/callback?state=test" };
	const passwords = ["a".repeat(72), "א".repeat(36), "😀".repeat(18), "a\u0301".repeat(6)];
	for (const password of passwords) {
		await provider.signup("learner@example.test", password, flow);
		await provider.updatePassword("learner-token", password);
	}
	assert.deepEqual(calls.map(call => call.body.password), passwords.flatMap(password => [password, password]));
	for (let index = 0; index < calls.length; index += 2) {
		assert.equal(calls[index].method, "POST");
		assert.equal(calls[index].url.pathname, "/auth/v1/signup");
		assert.equal(calls[index + 1].method, "PUT");
		assert.equal(calls[index + 1].url.pathname, "/auth/v1/user");
		assert.equal(calls[index + 1].headers.authorization, "Bearer learner-token");
	}
});

test("provider errors exclude payload secrets and distinguish outages from failed credentials", async () => {
	for (const status of [400, 401, 429, 503]) {
		const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "public", secretKey: "secret",
			fetcher: async () => new Response(JSON.stringify({ error_code: "invalid_credentials", message: "private information" }), { status }) });
		await assert.rejects(provider.identity("token"), error => error.status === status && !error.message.includes("private information"));
	}
});

test("provider sign-out accepts the Auth endpoint's empty 204 response", async () => {
	const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "public", secretKey: "secret",
		fetcher: async () => new Response(null, { status: 204 }) });
	assert.equal(await provider.logout("learner-jwt", "global"), null);
});

test("lesson RPC uses the learner token and publishable key, including denied empty results", async () => {
	let rows = [{ id: "version", body_text: "synthetic" }];
	const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "sb_publishable_test", secretKey: "sb_secret_test",
		async fetcher(url, options) {
			assert.equal(url, "https://project.supabase.co/rest/v1/rpc/read_section");
			assert.equal(options.method, "POST");
			assert.equal(options.headers.apikey, "sb_publishable_test");
			assert.equal(options.headers.authorization, "Bearer learner-jwt");
			assert.deepEqual(JSON.parse(options.body), { p_section_id: "section-id", p_access_level: "paid" });
			return Response.json(rows);
		} });
	assert.deepEqual(await provider.readSection("learner-jwt", "section-id", "paid"), rows[0]);
	rows = [];
	assert.equal(await provider.readSection("learner-jwt", "section-id", "paid"), null);
});

test("position adapter scopes reads and saves to the learner token and preserves conflict codes only", async () => {
	let response = Response.json([{ content_version_id: "version", position: 2500, revision: 2 }]);
	const calls = [];
	const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "public", secretKey: "secret",
		async fetcher(url, options) { calls.push({ url: new URL(url), ...options }); return response; } });
	assert.deepEqual(await provider.readPosition("learner-token", "section", "free"), { content_version_id: "version", position: 2500, revision: 2 });
	assert.equal(calls[0].url.pathname, "/rest/v1/rpc/read_my_position");
	assert.deepEqual(JSON.parse(calls[0].body), { p_section_id: "section", p_access_level: "free" });
	// save_my_position returns one composite row, unlike the collection read endpoint.
	response = Response.json({ content_version_id: "version", position: 5000, revision: 3 });
	assert.equal((await provider.savePosition("learner-token", "section", "free", { contentVersionId: "version", position: 5000, expectedRevision: 2 })).position, 5000);
	assert.equal(calls[1].url.pathname, "/rest/v1/rpc/save_my_position");
	assert.deepEqual(JSON.parse(calls[1].body), { p_section_id: "section", p_access_level: "free", p_content_version_id: "version", p_position: 5000, p_expected_revision: 2 });
	for (const call of calls) {
		assert.equal(call.headers.apikey, "public");
		assert.equal(call.headers.authorization, "Bearer learner-token");
	}
	response = Response.json({ code: "40001", details: "private payload", message: "private payload" }, { status: 500 });
	await assert.rejects(provider.savePosition("learner-token", "section", "free", {}), error => error.code === "40001" && !JSON.stringify(error).includes("private payload"));
	response = Response.json([]);
	assert.equal(await provider.readPosition("learner-token", "section", "free"), null);
});

test("SQL-looking values stay in JSON arguments to fixed learner RPC endpoints", async () => {
	const calls = [];
	const provider = createSupabaseProvider({ url: "https://project.supabase.co", publishableKey: "sb_publishable_test", secretKey: "sb_secret_test",
		async fetcher(url, init) { calls.push({ url, ...init }); return Response.json({}); } });
	const value = "'); SELECT pg_sleep(10); DROP TABLE public.learners; --";
	await provider.startQuiz("learner-token", value);
	await provider.saveQuiz("learner-token", value, { answers: { q1: value }, expectedRevision: 0 });
	assert.deepEqual(calls.map(call => call.url), ["https://project.supabase.co/rest/v1/rpc/start_my_quiz", "https://project.supabase.co/rest/v1/rpc/save_my_quiz"]);
	assert.deepEqual(JSON.parse(calls[0].body), { p_topic_key: value });
	assert.deepEqual(JSON.parse(calls[1].body), { p_attempt_id: value, p_answers: { q1: value }, p_expected_revision: 0 });
	for (const call of calls) {
		assert.equal(call.headers.apikey, "sb_publishable_test");
		assert.equal(call.headers.authorization, "Bearer learner-token");
	}
});
