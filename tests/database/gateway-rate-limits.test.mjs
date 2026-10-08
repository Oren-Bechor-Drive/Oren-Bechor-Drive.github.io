import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { startDatabase } from "../support/database.mjs";

let database;
before(async () => { database = await startDatabase(); });
after(async () => { await database?.close(); });
const key = n => n.toString(16).padStart(64, "0");
async function consume(client, hash, limit = 3, seconds = 60) {
 return (await client.query("select public.gateway_rate_limit($1,$2,$3) as allowed", [hash, limit, seconds])).rows[0].allowed;
}

test("simultaneous service calls share a single rate window", async () => {
 const clients = await Promise.all(Array.from({ length: 12 }, () => database.connect()));
 try {
  await Promise.all(clients.map(client => client.query("set role service_role")));
  const outcomes = await Promise.all(clients.map(client => consume(client, key(1))));
  assert.equal(outcomes.filter(Boolean).length, 3);
  assert.equal(await consume(clients[0], key(2)), true);
  await database.admin.query("update private.gateway_rate_buckets set expires_at = clock_timestamp() - interval '1 second' where bucket_key=$1", [key(1)]);
  assert.equal(await consume(clients[0], key(1)), true);
 } finally { await Promise.all(clients.map(client => client.end())); }
});

test("browser roles cannot inspect or change gateway rate counters", async () => {
 for (const role of ["anon", "authenticated"]) {
  const client = await database.connect();
  try {
   await client.query(`set role ${role}`);
   await assert.rejects(consume(client, key(3)), { code: "42501" });
   await assert.rejects(client.query("select * from private.gateway_rate_buckets"), { code: "42501" });
  } finally { await client.end(); }
 }
});

test("rate store rejects invalid counters and denies new buckets at capacity", async () => {
 const client = await database.connect();
 try {
  await client.query("set role service_role");
  for (const args of [["raw-ip-address",3,60], [key(4),0,60], [key(4),3,0], [key(4),3,86401]]) await assert.rejects(consume(client,...args), { code: "22023" });
  await database.admin.query("delete from private.gateway_rate_buckets");
  await database.admin.query("insert into private.gateway_rate_buckets(bucket_key,request_count,expires_at) select lpad(to_hex(n),64,'0'),1,clock_timestamp()+interval '1 hour' from generate_series(1,4000) n");
  assert.equal(await consume(client, key(5000)), false);
  assert.equal(await consume(client, key(1)), true);
  assert.equal((await database.admin.query("select count(*)::int as count from private.gateway_rate_buckets")).rows[0].count,4000);
 } finally { await client.end(); }
});

test("scheduled cleanup removes expired counters without a learner request", async () => {
 await database.admin.query("update private.gateway_rate_buckets set expires_at=clock_timestamp()-interval '1 second'");
 const client = await database.connect();
 try {
  await client.query("set role service_role");
  await client.query("select public.sweep_gateway_rate_limits()");
  assert.equal((await database.admin.query("select count(*)::int as count from private.gateway_rate_buckets")).rows[0].count,0);
 } finally { await client.end(); }
});

async function decision(client, hash, limit = 1, seconds = 900) {
 return (await client.query("select public.gateway_rate_limit_decision($1,$2,$3) as decision", [hash, limit, seconds])).rows[0].decision;
}

test("decision RPC reports remaining seconds and shares a single counter with old callers", async () => {
 const clients = await Promise.all(Array.from({ length: 8 }, () => database.connect()));
 try {
  await Promise.all(clients.map(client => client.query("set role service_role")));
  assert.deepEqual(await decision(clients[0], key(7000)), { allowed: true, retryAfterSeconds: 0 });
  const denied = await decision(clients[0], key(7000));
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterSeconds >= 899 && denied.retryAfterSeconds <= 900);
  await database.admin.query("update private.gateway_rate_buckets set expires_at=clock_timestamp()+interval '840 seconds' where bucket_key=$1", [key(7000)]);
  assert.equal((await decision(clients[0], key(7000))).retryAfterSeconds, 840);
  const results = await Promise.all(clients.map((client, i) => i % 2 ? consume(client, key(7001), 3) : decision(client, key(7001), 3)));
  assert.equal(results.filter(item => typeof item === "boolean" ? item : item.allowed).length, 3);
  assert.equal((await database.admin.query("select request_count from private.gateway_rate_buckets where bucket_key=$1", [key(7001)])).rows[0].request_count, 3);
  await database.admin.query("update private.gateway_rate_buckets set expires_at=clock_timestamp()-interval '1 second' where bucket_key=$1", [key(7000)]);
  assert.deepEqual(await decision(clients[0], key(7000)), { allowed: true, retryAfterSeconds: 0 });
 } finally { await Promise.all(clients.map(client => client.end())); }
});

test("decision RPC denies browser roles and reports earliest capacity expiry", async () => {
 for (const role of ["anon", "authenticated"]) {
  const client = await database.connect();
  try { await client.query(`set role ${role}`); await assert.rejects(decision(client, key(7002)), { code: "42501" }); }
  finally { await client.end(); }
 }
 const client = await database.connect();
 try {
  await client.query("set role service_role");
  for (const args of [["raw-address",1,900], [key(1),0,900], [key(1),1,86401]]) await assert.rejects(decision(client, ...args), { code: "22023" });
  await database.admin.query("delete from private.gateway_rate_buckets");
  await database.admin.query("insert into private.gateway_rate_buckets select lpad(to_hex(n),64,'0'),1,clock_timestamp()+interval '37 seconds' from generate_series(1,4000) n");
  const denied = await decision(client, key(7002));
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterSeconds >= 36 && denied.retryAfterSeconds <= 37);
 } finally { await client.end(); }
});
