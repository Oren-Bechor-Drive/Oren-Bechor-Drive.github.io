import assert from "node:assert/strict";
import test from "node:test";
import { createDatabaseRateLimit } from "../../server/rate-limit.mjs";
const options = { url: "https://project.supabase.co", serviceKey: "sb_secret_private", secret: Buffer.alloc(32, 7).toString("base64"), scope: "requests", limit: 150, windowSeconds: 60 };

test("persistent limits hash addresses and share keys across independent instances", async () => {
 const requests = [];
 const fetchImpl = async (url, init) => { requests.push({ url, ...init }); return Response.json({ allowed: true, retryAfterSeconds: 0 }); };
 const first = createDatabaseRateLimit({ ...options, fetchImpl });
 const second = createDatabaseRateLimit({ ...options, fetchImpl });
 assert.deepEqual(await first("192.0.2.1"), { allowed: true, retryAfterSeconds: 0 });
 assert.deepEqual(await second("192.0.2.1"), { allowed: true, retryAfterSeconds: 0 });
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
 await assert.rejects(first(undefined), error => error.status === 400);
 for (const address of ["not-an-address", "127.0.0.1/private", "2001:db8::invalid", "192.0.2.999"]) await assert.rejects(first(address), error => error.status === 400 && error.code === "invalid_input");
 assert.equal(requests.length, 3, "Invalid addresses cannot consume persistent buckets.");
});

test("quota denial and provider failure never fall back to process-local counters", async () => {
 assert.deepEqual(await createDatabaseRateLimit({ ...options, fetchImpl: async () => Response.json({ allowed: false, retryAfterSeconds: 840 }) })("::1"), { allowed: false, retryAfterSeconds: 840 });
 for (const fetchImpl of [...[true, false, { allowed:true }, { allowed:true, retryAfterSeconds:1 }, { allowed:false, retryAfterSeconds:0 }, { allowed:false, retryAfterSeconds:86401 }, { allowed:false, retryAfterSeconds:37, secret:"private" }].map(data => async () => Response.json(data)),async () => new Response("private provider details",{status:500}),async () => { throw new Error("private token"); }]) {
  await assert.rejects(createDatabaseRateLimit({ ...options, fetchImpl })("::1"), error => error.status === 503 && error.message === "unavailable");
 }
 assert.throws(() => createDatabaseRateLimit({ ...options, secret:"bad" }));
 assert.throws(() => createDatabaseRateLimit({ ...options, url:"https://user:password@project.supabase.co" }));
});

test("HTTP gateway awaits shared limits before creating sessions or calling Auth", async t => {
 const { startAccountGateway, browserClient } = await import("../helpers/account-gateway.mjs");
 let generalAllowed = false, mutationAllowed = false;
 const app = await startAccountGateway({
  requestLimiter:async () => { await Promise.resolve(); return { allowed: generalAllowed, retryAfterSeconds: generalAllowed ? 0 : 57 }; },
  mutationLimiter:async () => { await Promise.resolve(); return { allowed: mutationAllowed, retryAfterSeconds: mutationAllowed ? 0 : 840 }; },
 });
 t.after(() => app.close());
 const browser = browserClient(app.origin);
 const generalDenied = await browser.request("session");
 assert.equal(generalDenied.response.status,429);
 assert.equal(generalDenied.response.headers.get("retry-after"),"57");
 generalAllowed = true;
 assert.equal((await browser.request("session")).response.status,200);
 const mutationDenied = await browser.request("login",{email:"learner@example.test",password:"correct-password"});
 assert.equal(mutationDenied.response.status,429);
 assert.equal(mutationDenied.response.headers.get("retry-after"),"840");
 mutationAllowed = true;
 assert.equal((await browser.request("login",{email:"learner@example.test",password:"correct-password"})).response.status,200);
});

test("provider throttling without known metadata emits no fabricated retry window", async t => {
 const { startAccountGateway, browserClient, accountProvider } = await import("../helpers/account-gateway.mjs");
 const provider = accountProvider();
 provider.password = async () => { throw Object.assign(new Error("private detail"), { status: 429 }); };
 const app = await startAccountGateway({ provider });
 t.after(app.close);
 const client = browserClient(app.origin);
 await client.request();
 const result = await client.request("login", { email: "learner@example.test", password: "correct-password" });
 assert.equal(result.response.status, 429);
 assert.equal(result.response.headers.get("retry-after"), null);
 assert.deepEqual(result.data, { error: "rate_limited" });
});
