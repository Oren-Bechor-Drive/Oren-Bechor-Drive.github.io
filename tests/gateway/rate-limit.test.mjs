import assert from "node:assert/strict";
import test from "node:test";
import { createDatabaseRateLimit } from "../../server/rate-limit.mjs";
const options = { url: "https://project.supabase.co", serviceKey: "sb_secret_private", secret: Buffer.alloc(32, 7).toString("base64"), scope: "requests", limit: 150, windowSeconds: 60 };

test("persistent limits hash addresses and share keys across independent instances", async () => {
 const requests = [];
 const fetchImpl = async (url, init) => { requests.push({ url, ...init }); return Response.json(true); };
 const first = createDatabaseRateLimit({ ...options, fetchImpl });
 const second = createDatabaseRateLimit({ ...options, fetchImpl });
 assert.equal(await first("192.0.2.1"), true);
 assert.equal(await second("192.0.2.1"), true);
 await createDatabaseRateLimit({ ...options, scope: "mutations", fetchImpl })("192.0.2.1");
 const bodies = requests.map(request => JSON.parse(request.body));
 assert.match(bodies[0].p_bucket_key, /^[0-9a-f]{64}$/);
 assert.deepEqual(bodies[0], bodies[1]);
 assert.notEqual(bodies[0].p_bucket_key, bodies[2].p_bucket_key);
 assert.equal(bodies[0].p_limit, 150);
 assert.equal(bodies[0].p_window_seconds, 60);
 assert.doesNotMatch(JSON.stringify(requests), /192\.0\.2\.1/);
 assert.equal(requests[0].redirect,"error");
 assert.equal(requests[0].headers.apikey,options.serviceKey);
 assert.equal(requests[0].headers.Authorization,undefined);
 assert.equal(await first(undefined),false);
});

test("quota denial and provider failure never fall back to process-local counters", async () => {
 assert.equal(await createDatabaseRateLimit({ ...options, fetchImpl: async () => Response.json(false) })("::1"),false);
 for (const fetchImpl of [async () => Response.json({ allowed:true }),async () => new Response("private provider details",{status:500}),async () => { throw new Error("private token"); }]) {
  await assert.rejects(createDatabaseRateLimit({ ...options, fetchImpl })("::1"), error => error.status === 503 && error.message === "unavailable");
 }
 assert.throws(() => createDatabaseRateLimit({ ...options, secret:"bad" }));
 assert.throws(() => createDatabaseRateLimit({ ...options, url:"https://user:password@project.supabase.co" }));
});

test("HTTP gateway awaits shared limits before creating sessions or calling Auth", async t => {
 const { startAccountGateway, browserClient } = await import("../helpers/account-gateway.mjs");
 let generalAllowed = false, mutationAllowed = false;
 const app = await startAccountGateway({
  requestLimiter:async () => { await Promise.resolve(); return generalAllowed; },
  mutationLimiter:async () => { await Promise.resolve(); return mutationAllowed; },
 });
 t.after(() => app.close());
 const browser = browserClient(app.origin);
 assert.equal((await browser.request("session")).response.status,429);
 generalAllowed = true;
 assert.equal((await browser.request("session")).response.status,200);
 assert.equal((await browser.request("login",{email:"learner@example.test",password:"correct-password"})).response.status,429);
 mutationAllowed = true;
 assert.equal((await browser.request("login",{email:"learner@example.test",password:"correct-password"})).response.status,200);
});
