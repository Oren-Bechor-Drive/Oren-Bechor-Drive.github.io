import assert from "node:assert/strict";
import test from "node:test";
import { createProductionGatewayOptions } from "../../server/production.mjs";
const env = { APP_ORIGIN: "https://course.example.test", SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", SUPABASE_SECRET_KEY: "sb_secret_test", SESSION_SECRET: Buffer.alloc(32, 3).toString("base64") };

test("configuration errors identify only the approved field and missing/invalid reason", () => {
	for (const field of Object.keys(env)) {
		assert.throws(() => createProductionGatewayOptions({ ...env, [field]: "" }), error => error.configurationField === field && error.configurationReason === "missing");
	}
	for (const [field, value] of [["APP_ORIGIN", "https://private-user:private-password@example.test"], ["SUPABASE_URL", "private invalid url"], ["SESSION_SECRET", "private secret"], ["GOOGLE_AUTH_ENABLED", "private value"], ["PRIVATE_MEDIA_ENTRIES", "private JSON"]]) {
		assert.throws(() => createProductionGatewayOptions({ ...env, [field]: value, ...(field === "PRIVATE_MEDIA_ENTRIES" ? { PRIVATE_MEDIA_BUCKET: "course" } : {}) }), error => {
			assert.equal(error.configurationField, field);
			assert.equal(error.configurationReason, "invalid");
			assert.doesNotMatch(error.message, /private/);
			return true;
		});
	}
});

test("admission and Storage configuration errors retain their constructor-owned safe fields", () => {
	for (const [field, value, reason, additional] of [
		["REGISTRATION_MODE", "private invalid mode", "invalid", {}],
		["GOOGLE_AUTH_ENABLED", "false", "invalid", { REGISTRATION_MODE: "public" }],
		["PILOT_EMAILS", undefined, "missing", { REGISTRATION_MODE: "pilot" }],
		["PILOT_EMAILS", "private tester value", "invalid", { REGISTRATION_MODE: "pilot" }],
		["PILOT_EMAILS", {}, "invalid", { REGISTRATION_MODE: "pilot" }],
		["SUPABASE_URL", "https://private.example.test", "invalid", { PRIVATE_MEDIA_BUCKET: "course", PRIVATE_MEDIA_ENTRIES: "[]" }],
		["SUPABASE_SECRET_KEY", "private key value", "invalid", { PRIVATE_MEDIA_BUCKET: "course", PRIVATE_MEDIA_ENTRIES: "[]" }],
		["PRIVATE_MEDIA_BUCKET", "private bucket value", "invalid", { PRIVATE_MEDIA_ENTRIES: "[]" }],
		["PRIVATE_MEDIA_ENTRIES", "{}", "invalid", { PRIVATE_MEDIA_BUCKET: "course" }],
	]) {
		assert.throws(() => createProductionGatewayOptions({ ...env, ...additional, [field]: value }), error => {
			assert.equal(error.configurationField, field);
			assert.equal(error.configurationReason, reason);
			assert.doesNotMatch(error.message, /private (invalid|tester|key|bucket)|private\.example\.test| at /);
			return true;
		}, field);
	}
});

test("production composition requires exact HTTPS origins and server configuration", () => {
 for (const name of Object.keys(env)) assert.throws(() => createProductionGatewayOptions({ ...env, [name]: "" }));
 for (const APP_ORIGIN of ["http://localhost:3000", "https://course.example.test/", "https://user:password@course.example.test", "https://course.example.test/path"]) assert.throws(() => createProductionGatewayOptions({ ...env, APP_ORIGIN }));
 assert.throws(() => createProductionGatewayOptions({ ...env, GOOGLE_AUTH_ENABLED: "yes" }));
 assert.throws(() => createProductionGatewayOptions({ ...env, SESSION_SECRET: "not-a-secret" }));
 assert.throws(() => createProductionGatewayOptions({ ...env, PRIVATE_MEDIA_BUCKET: "course" }));
 assert.throws(() => createProductionGatewayOptions({ ...env, PRIVATE_MEDIA_ENTRIES: "[]" }));
});

test("hosted private media rejects loopback, private-network and non-Supabase provider origins", () => {
	for (const SUPABASE_URL of ["http://127.0.0.1:54321", "https://127.0.0.1", "https://localhost", "https://169.254.169.254",
		"https://metadata.google.internal", "https://private.example.test", "https://project.supabase.co:8443"]) {
		assert.throws(() => createProductionGatewayOptions({ ...env, SUPABASE_URL, PRIVATE_MEDIA_BUCKET: "course", PRIVATE_MEDIA_ENTRIES: "[]" }),
			error => error.configurationField === "SUPABASE_URL" && error.configurationReason === "invalid");
	}
});

test("production uses durable adapters and defaults to closed admission without network calls", async () => {
 let calls = 0;
 const options = createProductionGatewayOptions(env, { fetchImpl: async (url, init) => {
  calls++;
  if (url.endsWith("/gateway_session")) {
   const body = JSON.parse(init.body);
   assert.equal(body.p_action, "create");
   assert.equal(body.p_data.mode, "anonymous");
   assert.match(body.p_data.payload, /^[A-Za-z0-9+/]+=*$/);
   return Response.json({ status: "ok" });
  }
  assert.equal(url, "https://project.supabase.co/rest/v1/rpc/gateway_rate_limit_decision");
  return Response.json({ allowed: true, retryAfterSeconds: 0 });
 } });
 assert.equal(calls, 0);
 assert.equal(options.origin,env.APP_ORIGIN);
 assert.equal(options.googleEnabled,false);
 assert.equal(options.admit("owner@example.test"),false);
 assert.equal(options.media,null);
 const anonymous = await options.sessions.rotate(null, "anonymous");
 assert.match(anonymous.token, /^[A-Za-z0-9_-]{43}$/);
 assert.deepEqual(await options.requestLimiter("192.0.2.1"), { allowed: true, retryAfterSeconds: 0 });
 assert.deepEqual(await options.mutationLimiter("192.0.2.1"), { allowed: true, retryAfterSeconds: 0 });
 assert.equal(calls,3);
 const pilot = createProductionGatewayOptions({ ...env, REGISTRATION_MODE:"pilot", PILOT_EMAILS:"owner@example.test" });
 assert.equal(pilot.admit("owner@example.test"),true);
 assert.equal(pilot.admit("other@example.test"),false);
});
