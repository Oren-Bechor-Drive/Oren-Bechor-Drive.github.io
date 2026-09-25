import assert from "node:assert/strict";
import test from "node:test";
import { createProductionGatewayOptions } from "../../server/production.mjs";
const env = { APP_ORIGIN: "https://course.example.test", SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", SUPABASE_SECRET_KEY: "sb_secret_test", SESSION_SECRET: Buffer.alloc(32, 3).toString("base64") };

test("production composition requires exact HTTPS origins and server configuration", () => {
 for (const name of Object.keys(env)) assert.throws(() => createProductionGatewayOptions({ ...env, [name]: "" }));
 for (const APP_ORIGIN of ["http://localhost:3000", "https://course.example.test/", "https://user:password@course.example.test", "https://course.example.test/path"]) assert.throws(() => createProductionGatewayOptions({ ...env, APP_ORIGIN }));
 assert.throws(() => createProductionGatewayOptions({ ...env, GOOGLE_AUTH_ENABLED: "yes" }));
 assert.throws(() => createProductionGatewayOptions({ ...env, SESSION_SECRET: "not-a-secret" }));
 assert.throws(() => createProductionGatewayOptions({ ...env, PRIVATE_MEDIA_BUCKET: "course" }));
 assert.throws(() => createProductionGatewayOptions({ ...env, PRIVATE_MEDIA_ENTRIES: "[]" }));
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
  assert.equal(url, "https://project.supabase.co/rest/v1/rpc/gateway_rate_limit");
  return Response.json(true);
 } });
 assert.equal(calls, 0);
 assert.equal(options.origin,env.APP_ORIGIN);
 assert.equal(options.googleEnabled,false);
 assert.equal(options.admit("owner@example.test"),false);
 assert.equal(options.media,null);
 const anonymous = await options.sessions.rotate(null, "anonymous");
 assert.match(anonymous.token, /^[A-Za-z0-9_-]{43}$/);
 assert.equal(await options.requestLimiter("192.0.2.1"),true);
 assert.equal(await options.mutationLimiter("192.0.2.1"),true);
 assert.equal(calls,3);
 const pilot = createProductionGatewayOptions({ ...env, REGISTRATION_MODE:"pilot", PILOT_EMAILS:"owner@example.test" });
 assert.equal(pilot.admit("owner@example.test"),true);
 assert.equal(pilot.admit("other@example.test"),false);
});
