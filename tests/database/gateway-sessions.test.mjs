import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { startDatabase } from "../support/database.mjs";
import { createSupabaseSessions } from "../../server/session-store.mjs";
import { createLearnerAccounts } from "../../server/learner-accounts.mjs";
import { accountProvider } from "../helpers/account-gateway.mjs";

let database;
const secret = randomBytes(32).toString("base64");
const credentials = { email: "learner@example.test", password: "correct-password" };
before(async () => { database = await startDatabase(); }, { timeout: 30000 });
after(async () => { await database?.close(); });
beforeEach(async () => {
	await database.admin.query("truncate private.gateway_sessions; update private.gateway_session_control set generation=0, reset_key=null,reset_lease=null,reset_user_key=null");
});

// Exercise the production REST adapter and the actual service-role SQL function.
// Only HTTP transport is replaced; every RPC commits in an independent connection.
async function fetchDatabase(url, options) {
	const client = await database.connect();
	try {
		assert.equal(new URL(url).pathname, "/rest/v1/rpc/gateway_session");
		assert.equal(options.headers.apikey, "sb_secret_fixture");
		assert.equal(options.headers.authorization, undefined);
		const { p_action, p_key = null, p_lease = null, p_data = {} } = JSON.parse(options.body);
		await client.query("set role service_role");
		const result = await client.query("select public.gateway_session($1,$2,$3,$4) as result", [p_action, p_key, p_lease, p_data]);
		return Response.json(result.rows[0].result);
	} finally { await client.end(); }
}
async function store(settings = {}) {
	return createSupabaseSessions({
		url: "https://project.supabase.co", serviceKey: "sb_secret_fixture", secret, fetchImpl: fetchDatabase, ...settings,
	});
}
async function accounts(provider = accountProvider(), settings = {}) {
	return createLearnerAccounts({ origin: "https://example.test", provider, sessions: await store(settings) });
}
async function login(account) {
	const anonymous = await account.session();
	return account.perform(anonymous.cookie.token, "login", credentials);
}

test("signed-in sessions survive a new account instance without plaintext credentials in storage", async () => {
	const provider = accountProvider();
	const first = await accounts(provider);
	const signed = await login(first);
	const second = await accounts(provider);
	const restored = await second.session(signed.cookie.token);
	assert.deepEqual(restored.data.user, { email: credentials.email, displayName: "" });
	assert.equal(restored.cookie, undefined);
	assert.equal(await second.acceptsRequest(signed.cookie.token, signed.data.csrf), true);
	const rows = await database.admin.query("select * from private.gateway_sessions");
	assert.doesNotMatch(JSON.stringify(rows.rows), /access-|refresh-|learner@example|"csrf"|"verifier"/);
	assert.doesNotMatch(JSON.stringify(restored), /access-|refresh-|verifier/);
});

async function recovery(account, provider) {
	const anonymous = await account.session();
	await account.perform(anonymous.cookie.token, "recover", { email: credentials.email });
	const flow = provider.calls.filter(call => call[0] === "recover").at(-1)[2];
	return account.completeCallback(anonymous.cookie.token, { state: flow.state, code: "valid-code" });
}

test("two instances serialize refresh and both observe the new provider token", async () => {
	const provider = accountProvider();
	const password = provider.password;
	provider.password = async (...args) => ({ ...await password(...args), expires_in: 1 });
	const a = await accounts(provider), b = await accounts(provider);
	const signed = await login(a);
	const results = await Promise.all([a.session(signed.cookie.token), b.session(signed.cookie.token)]);
	for (const result of results) assert.equal(result.data.user.email, credentials.email);
	assert.equal(provider.calls.filter(call => call[0] === "refresh").length, 1);
	assert.equal((await (await accounts(provider)).session(signed.cookie.token)).data.user.email, credentials.email);
});

test("two instances cannot rotate the same browser token into two live sessions", async () => {
	const provider = accountProvider();
	const a = await accounts(provider), b = await accounts(provider);
	const initial = await a.session();
	const results = await Promise.allSettled([
		a.perform(initial.cookie.token, "login", credentials), b.perform(initial.cookie.token, "login", credentials),
	]);
	assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
	assert.equal(results.find(result => result.status === "rejected").reason.status, 401);
	assert.equal(await b.acceptsRequest(initial.cookie.token, initial.data.csrf), false);
	assert.equal((await database.admin.query("select count(*) from private.gateway_sessions where mode='authenticated'")).rows[0].count, "1");
});

test("logout removes cross-instance authority before waiting for the provider", async t => {
	const provider = accountProvider();
	const a = await accounts(provider), b = await accounts(provider);
	const signed = await login(a);
	const entered = Promise.withResolvers(), release = Promise.withResolvers();
	t.after(() => release.resolve());
	provider.logout = async () => { entered.resolve(); await release.promise; };
	const logout = a.perform(signed.cookie.token, "logout", {});
	await entered.promise;
	assert.equal((await b.session(signed.cookie.token)).data.user, null);
	await assert.rejects(b.perform(signed.cookie.token, "login", credentials), { status: 401 });
	release.resolve();
	assert.equal((await logout).data.ok, true);
});

test("expired operation leases destroy authority and fence stale refreshed state", async t => {
	const provider = accountProvider();
	const password = provider.password;
	provider.password = async (...args) => ({ ...await password(...args), expires_in: 1 });
	const a = await accounts(provider), b = await accounts(provider);
	const signed = await login(a);
	const entered = Promise.withResolvers(), release = Promise.withResolvers();
	t.after(() => release.resolve());
	const refresh = provider.refresh;
	provider.refresh = async token => { const result = await refresh(token); entered.resolve(); await release.promise; return result; };
	const pending = a.session(signed.cookie.token);
	await entered.promise;
	const held = (await database.admin.query("select key,lease from private.gateway_sessions where mode='authenticated'")).rows[0];
	await database.admin.query("update private.gateway_sessions set lease_until=clock_timestamp()-interval '1 second' where key=$1", [held.key]);
	assert.equal((await b.session(signed.cookie.token)).data.user, null);
	release.resolve();
	assert.equal((await pending).data.user, null);
	assert.equal(provider.calls.filter(call => call[0] === "refresh").length, 1);
	const late = await database.admin.query("select public.gateway_session('save',$1,$2,$3) result", [held.key, held.lease, { payload: "stale" }]);
	assert.equal(late.rows[0].result.status, "expired");
	assert.equal((await database.admin.query("select count(*) from private.gateway_sessions where mode='authenticated'")).rows[0].count, "0");
});

test("password reset invalidates existing sessions and unknown pending login across instances", async t => {
	const provider = accountProvider();
	const a = await accounts(provider), b = await accounts(provider);
	const signed = await login(a);
	const reset = await recovery(b, provider);
	const initial = await a.session();
	const entered = Promise.withResolvers(), release = Promise.withResolvers();
	t.after(() => release.resolve());
	const learner = provider.learner;
	provider.learner = async token => { const result = await learner(token); entered.resolve(); await release.promise; return result; };
	const pending = a.perform(initial.cookie.token, "login", credentials);
	const outcome = Promise.allSettled([pending]);
	await entered.promise;
	assert.equal((await b.perform(reset.cookie.token, "reset", { password: "another-password" })).data.ok, true);
	release.resolve();
	assert.equal((await outcome)[0].reason.status, 401);
	assert.equal((await a.session(signed.cookie.token)).data.user, null);
	assert.equal((await a.session(initial.cookie.token)).data.user, null);
});

test("uncertain password updates leave a durable barrier that needs matching operator reconciliation", async () => {
	const provider = accountProvider();
	const a = await accounts(provider);
	const reset = await recovery(a, provider);
	provider.updatePassword = async () => { throw Object.assign(new Error("network outcome unknown"), { status: 503 }); };
	await assert.rejects(a.perform(reset.cookie.token, "reset", { password: "another-password" }), { status: 503 });
	const restarted = await accounts(provider);
	await assert.rejects(login(restarted), { status: 503 });
	const control = (await database.admin.query("select * from private.gateway_session_control")).rows[0];
	assert.ok(control.reset_key);
	const wrong = await database.admin.query("select public.gateway_session('resolve_reset',$1,$2,$3) result", [control.reset_key, "00000000-0000-4000-8000-000000000000", { user_key: control.reset_user_key }]);
	assert.equal(wrong.rows[0].result.status, "expired");
	await database.admin.query("select public.gateway_session('resolve_reset',$1,$2,$3)", [control.reset_key, control.reset_lease, { user_key: control.reset_user_key }]);
	assert.equal((await login(restarted)).data.user.email, credentials.email);
	assert.equal((await restarted.session(reset.cookie.token)).data.recovery, false);
});

test("anonymous capacity reserves space for learners and expiry reclaims storage", async () => {
	const provider = accountProvider();
	const a = await accounts(provider, { limit: 5 });
	const issued = await Promise.all(Array.from({ length: 4 }, () => a.session()));
	await assert.rejects(a.session(), { status: 503 });
	const signed = await a.perform(issued[0].cookie.token, "login", credentials);
	await a.session();
	await assert.rejects(a.session(), { status: 503 });
	await database.admin.query("update private.gateway_sessions set expires_at=clock_timestamp()-interval '1 second' where mode='anonymous'");
	assert.equal((await a.session()).data.user, null);
	assert.equal((await a.session(signed.cookie.token)).data.user.email, credentials.email);
});

test("tampered ciphertext and changed server secrets fail closed", async () => {
	const provider = accountProvider();
	const a = await accounts(provider);
	const signed = await login(a);
	const wrong = await accounts(provider, { secret: randomBytes(32).toString("base64") });
	assert.equal((await wrong.session(signed.cookie.token)).data.user, null);
	await database.admin.query("update private.gateway_sessions set payload=repeat('A',100) where mode='authenticated'");
	await assert.rejects(a.session(signed.cookie.token), { status: 503 });
});

test("browser roles cannot call session RPCs and service role cannot read credentials directly", async () => {
	for (const role of ["anon", "authenticated", "service_role"]) {
		const client = await database.connect();
		try {
			await client.query(`set role ${role}`);
			await assert.rejects(client.query("select * from private.gateway_sessions"), { code: "42501" });
			await assert.rejects(client.query("select * from private.gateway_session_control"), { code: "42501" });
			if (role !== "service_role") {
				await assert.rejects(client.query("select public.gateway_session('generation')"), { code: "42501" });
				await assert.rejects(client.query("select private.gateway_session('generation',null,null,'{}')"), { code: "42501" });
			}
		} finally { await client.end(); }
	}
});

test("an uncertain refresh invalidates the browser session instead of reusing its old refresh token", async () => {
	const provider = accountProvider();
	const password = provider.password;
	provider.password = async (...args) => ({ ...await password(...args), expires_in: 1 });
	const a = await accounts(provider);
	const signed = await login(a);
	let refreshes = 0;
	provider.refresh = async () => { refreshes++; throw Object.assign(new Error("refresh response lost"), { status: 503 }); };
	await assert.rejects(a.session(signed.cookie.token), { status: 503 });
	const restarted = await accounts(provider);
	assert.equal((await restarted.session(signed.cookie.token)).data.user, null);
	assert.equal(refreshes, 1);
});

test("a lost save response never causes reuse of the consumed refresh token", async () => {
	const provider = accountProvider();
	const password = provider.password;
	provider.password = async (...args) => ({ ...await password(...args), expires_in: 1 });
	let loseReply = false;
	const a = await accounts(provider, { fetchImpl: async (url, options) => {
		const response = await fetchDatabase(url, options);
		if (loseReply && JSON.parse(options.body).p_action === "save") { loseReply = false; throw new Error("response lost after commit"); }
		return response;
	} });
	const signed = await login(a);
	loseReply = true;
	await assert.rejects(a.session(signed.cookie.token), { status: 503 });
	assert.equal((await (await accounts(provider)).session(signed.cookie.token)).data.user.email, credentials.email);
	assert.equal(provider.calls.filter(call => call[0] === "refresh").length, 1);
});

test("an uncommitted save leaves a fenced lease that cannot reuse provider credentials", async () => {
	const provider = accountProvider();
	const password = provider.password;
	provider.password = async (...args) => ({ ...await password(...args), expires_in: 1 });
	let failSave = false;
	const a = await accounts(provider, { fetchImpl: async (url, options) => {
		if (failSave && JSON.parse(options.body).p_action === "save") throw new Error("transport failed before commit");
		return fetchDatabase(url, options);
	} });
	const signed = await login(a);
	failSave = true;
	await assert.rejects(a.session(signed.cookie.token), { status: 503 });
	assert.ok((await database.admin.query("select lease from private.gateway_sessions where mode='authenticated'")).rows[0].lease);
	await database.admin.query("update private.gateway_sessions set lease_until=clock_timestamp()-interval '1 second' where mode='authenticated'");
	assert.equal((await (await accounts(provider)).session(signed.cookie.token)).data.user, null);
	assert.equal(provider.calls.filter(call => call[0] === "refresh").length, 1);
});

test("a lost rotation response cannot restore the old browser token", async () => {
	const provider = accountProvider();
	const a = await accounts(provider, { fetchImpl: async (url, options) => {
		const response = await fetchDatabase(url, options);
		if (JSON.parse(options.body).p_action === "rotate") throw new Error("response lost after rotation");
		return response;
	} });
	const initial = await a.session();
	await assert.rejects(a.perform(initial.cookie.token, "login", credentials), { status: 503 });
	assert.equal((await (await accounts(provider)).session(initial.cookie.token)).data.user, null);
});

test("the operation budget invalidates a session even if its external work never completes", async t => {
	const sessions = await store();
	const initial = await sessions.rotate(null, "anonymous");
	const record = await sessions.get(initial.token);
	const entered = Promise.withResolvers(), release = Promise.withResolvers();
	t.after(() => release.resolve());
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const operation = sessions.run(record, async () => { entered.resolve(); await release.promise; });
	const result = Promise.allSettled([operation]);
	await entered.promise;
	t.mock.timers.tick(25000);
	assert.equal((await result)[0].reason.status, 503);
	t.mock.timers.reset();
	assert.equal(await sessions.get(initial.token), null);
});

test("idle cleanup removes expired sessions without clearing an uncertain reset barrier", async () => {
	const provider = accountProvider();
	const a = await accounts(provider);
	const reset = await recovery(a, provider);
	provider.updatePassword = async () => { throw Object.assign(new Error("outcome unknown"), { status: 503 }); };
	await assert.rejects(a.perform(reset.cookie.token, "reset", { password: "another-password" }), { status: 503 });
	await database.admin.query("update private.gateway_sessions set expires_at=clock_timestamp()-interval '1 second'");
	const client = await database.connect();
	try {
		await client.query("set role service_role");
		await client.query("select public.gateway_session('sweep')");
	} finally { await client.end(); }
	assert.equal((await database.admin.query("select count(*) from private.gateway_sessions")).rows[0].count, "0");
	assert.ok((await database.admin.query("select reset_key from private.gateway_session_control")).rows[0].reset_key);
});
