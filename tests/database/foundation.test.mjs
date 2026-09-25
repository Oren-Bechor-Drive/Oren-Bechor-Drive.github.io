import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { actAs, startDatabase } from "../support/database.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const users = { free: uuid(1), paid: uuid(2), unverified: uuid(3), anonymous: uuid(4), suspended: uuid(5) };
const sessions = Object.fromEntries(Object.entries(users).map(([name], i) => [name, uuid(101 + i)]));
const section = uuid(201);
const draft = uuid(202);
let database;
let versions;
let learners;

before(async () => {
	database = await startDatabase();
	const db = database.admin;
	for (const [name, id] of Object.entries(users)) {
		await db.query("insert into auth.users(id,email_confirmed_at,is_anonymous) values ($1,now(),false)", [id]);
		await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [sessions[name], id]);
		await db.query("select public.provision_learner($1)", [id]);
	}
	await db.query("update auth.users set email_confirmed_at=null where id=$1", [users.unverified]);
	await db.query("update auth.users set is_anonymous=true where id=$1", [users.anonymous]);
	learners = Object.fromEntries((await db.query("select auth_user_id,learner_id from private.learner_identities")).rows.map((row) => [row.auth_user_id, row.learner_id]));
	await db.query("update public.learners set state='suspended' where id=$1", [learners[users.suspended]]);
	await db.query("insert into public.entitlements(learner_id,starts_at,ends_at,source_reference) values ($1,now()-interval '1 day',now()+interval '1 day','fixture-paid')", [learners[users.paid]]);
	await db.query("select public.publish_section($1,'fixture-section',0,'תוכן בדיקה חינמי ישן.','תוכן בדיקה בתשלום ישן.')", [section]);
	await db.query("select public.publish_section($1,'fixture-section',1,'תוכן בדיקה חינמי.','תוכן בדיקה בתשלום.')", [section]);
	await db.query("insert into public.learning_sections(id,source_key) values ($1,'fixture-draft')", [draft]);
	await db.query("insert into public.section_versions(section_id,access_level,revision,body_text) values ($1,'free',1,'טיוטת בדיקה.')", [draft]);
	versions = (await db.query("select * from public.section_versions where section_id=$1", [section])).rows;
}, { timeout: 30000 });
after(async () => { await database?.close(); });

async function transaction(actor, run) {
	const client = await database.connect();
	try {
		await client.query("begin");
		await actAs(client, users[actor], sessions[actor]);
		return await run(client);
	} finally {
		await client.query("rollback");
		await client.end();
	}
}
async function admin(client, sql, values = []) {
	await client.query("reset role");
	try { return await client.query(sql, values); }
	finally { await client.query("set local role authenticated"); }
}
async function denied(client, sql, values = [], code = "42501") {
	await client.query("savepoint denied_operation");
	await assert.rejects(client.query(sql, values), (error) => error.code === code);
	await client.query("rollback to savepoint denied_operation");
}
const current = (level) => versions.find((v) => v.access_level === level && v.revision === 2).id;
async function save(client, level, position, revision = 0, version = current(level)) {
	return (await client.query("select * from public.save_my_position($1,$2,$3,$4,$5)", [section, level, version, position, revision])).rows[0];
}
async function visible(client) {
	return (await client.query("select access_level from public.section_versions order by access_level")).rows.map((r) => r.access_level);
}

test("all application tables have RLS and no anonymous table privileges", async () => {
	const tables = (await database.admin.query("select c.oid,n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'")).rows;
	assert.deepEqual(tables.map(table => `${table.nspname}.${table.relname}`).sort(), [
		"private.gateway_sessions", "private.gateway_session_control", "private.gateway_rate_buckets",
		"private.learner_identities", "private.learning_retention", "private.quiz_topics", "private.quiz_versions",
		"public.entitlements", "public.learners", "public.learning_sections", "public.quiz_attempts",
		"public.section_progress", "public.section_versions", "public.topic_completions",
	].sort());
	for (const table of tables) {
		assert.equal(table.relrowsecurity, true, table.relname);
		for (const role of ["anon", "authenticated"]) {
			for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
				const result = await database.admin.query("select has_table_privilege($1,$2::oid,$3) as allowed", [role, table.oid, privilege]);
				assert.equal(result.rows[0].allowed, role === "authenticated" && table.nspname === "public" && privilege === "SELECT",
					`${role} ${privilege} on ${table.nspname}.${table.relname}`);
			}
		}
	}
	const functions = await database.admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.prorettype <> 'event_trigger'::regtype");
	assert.equal(functions.rowCount, 0);
});

test("anonymous requests cannot read tables or invoke learner/admin functions", async () => transaction("free", async (db) => {
	await actAs(db, undefined, undefined, "anon");
	await denied(db, "select * from public.section_versions");
	await denied(db, "select public.read_section($1,'free')", [section]);
	await denied(db, "select public.provision_learner($1)", [users.free]);
}));

test("free learners see only current published free content through reads, joins, and RPC", async () => transaction("free", async (db) => {
	assert.deepEqual(await visible(db), ["free"]);
	assert.equal((await db.query("select v.* from public.learning_sections s join public.section_versions v on v.section_id=s.id")).rowCount, 1);
	assert.equal((await db.query("select * from public.read_section($1,'paid')", [section])).rowCount, 0);
	assert.equal((await db.query("select * from public.read_section($1,'free')", [section])).rowCount, 1);
	assert.equal((await db.query("select * from public.section_versions where revision=1 or section_id=$1", [draft])).rowCount, 0);
	await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({sub: users.free, session_id: sessions.free, user_metadata: {plan:"paid"}, app_metadata: {plan:"paid"}})]);
	assert.deepEqual(await visible(db), ["free"]);
}));

test("paid learners see both current bodies but cannot see another learner's records", async () => transaction("paid", async (db) => {
	assert.deepEqual(await visible(db), ["free", "paid"]);
	assert.equal((await db.query("select * from public.learners")).rowCount, 1);
	assert.equal((await db.query("select * from public.learners where id=$1", [learners[users.free]])).rowCount, 0);
	assert.equal((await db.query("select * from public.entitlements")).rowCount, 1);
	await denied(db, "select * from private.learner_identities");
}));

for (const actor of ["unverified", "anonymous", "suspended"]) {
	test(`${actor} learners have no content, account, or progress access`, async () => transaction(actor, async (db) => {
		assert.deepEqual(await visible(db), []);
		assert.equal((await db.query("select * from public.learners")).rowCount, 0);
		assert.equal((await db.query("select * from public.section_progress")).rowCount, 0);
		await assert.rejects(save(db, "free", 100), {code:"42501"});
	}));
}

test("missing, malformed, expired, revoked, and other-user sessions fail closed", async () => transaction("free", async (db) => {
	for (const session of [undefined, "not-a-uuid", sessions.paid, uuid(999)]) {
		await actAs(db, users.free, session);
		assert.deepEqual(await visible(db), []);
	}
	await actAs(db, "not-a-uuid", sessions.free);
	assert.deepEqual(await visible(db), []);
	await actAs(db, users.free, sessions.free);
	await admin(db, "update auth.sessions set not_after=statement_timestamp() where id=$1", [sessions.free]);
	assert.deepEqual(await visible(db), []);
	await admin(db, "delete from auth.sessions where id=$1", [sessions.free]);
	assert.deepEqual(await visible(db), []);
	await assert.rejects(save(db, "free", 100), {code:"42501"});
}));

test("current Auth bans and learner lifecycle state take effect without refreshing claims", async () => transaction("paid", async (db) => {
	await admin(db, "update auth.users set banned_until=now()+interval '1 day' where id=$1", [users.paid]);
	assert.deepEqual(await visible(db), []);
	await admin(db, "update auth.users set banned_until=now()-interval '1 day' where id=$1", [users.paid]);
	assert.deepEqual(await visible(db), ["free", "paid"]);
	for (const state of ["suspended", "deletion_pending", "deleted"]) {
		await admin(db, "update public.learners set state=$1 where id=$2", [state, learners[users.paid]]);
		assert.deepEqual(await visible(db), []);
	}
}));

test("grant start is inclusive and end exclusive at the exact server statement boundary", async () => {
	// Both the boundary change and predicate run in the same statement, not a delayed timer test.
	for (const [column, expected] of [["starts_at",true], ["ends_at",false]]) {
		await transaction("paid", async (db) => {
			await admin(db, `do $$ begin
                update public.entitlements set ${column}=statement_timestamp() where source_reference='fixture-paid';
                if private.has_paid_access() is distinct from ${expected} then
                    raise exception 'Incorrect access at exact boundary';
                end if;
            end $$`);
		});
	}
});

test("expiry blocks paid reads and writes, retains progress, and renewal restores access", async () => transaction("paid", async (db) => {
	await save(db, "paid", 4200);
	await admin(db, "update public.entitlements set ends_at=statement_timestamp() where source_reference='fixture-paid'");
	assert.deepEqual(await visible(db), ["free"]);
	assert.equal((await db.query("select position from public.section_progress")).rows[0].position, 4200);
	await denied(db, "select public.save_my_position($1,'paid',$2,4300,1)", [section,current("paid")]);
	await actAs(db, users.free, sessions.free);
	assert.equal((await db.query("select * from public.section_progress")).rowCount, 0);
	await actAs(db, users.paid, sessions.paid);
	await admin(db, "insert into public.entitlements(learner_id,starts_at,ends_at,source_reference) values ($1,now(),now()+interval '1 month','fixture-renewed')", [learners[users.paid]]);
	assert.deepEqual(await visible(db), ["free", "paid"]);
	assert.equal((await save(db,"paid",4300,1)).revision, "2");
}));

test("future and revoked grants deny paid access while overlapping valid grants allow it", async () => transaction("paid", async (db) => {
	await admin(db, "update public.entitlements set starts_at=now()+interval '1 hour' where source_reference='fixture-paid'");
	assert.deepEqual(await visible(db), ["free"]);
	await admin(db, "update public.entitlements set starts_at=now()-interval '1 hour',revoked_at=now() where source_reference='fixture-paid'");
	assert.deepEqual(await visible(db), ["free"]);
	await admin(db, "insert into public.entitlements(learner_id,starts_at,ends_at,source_reference) values ($1,now(),now()+interval '1 day','fixture-overlap')", [learners[users.paid]]);
	assert.deepEqual(await visible(db), ["free", "paid"]);
}));

test("learners can update only their own display name and cannot grant or publish access", async () => transaction("free", async (db) => {
	assert.equal((await db.query("update public.learners set display_name='לומד בדיקה' returning display_name")).rowCount, 1);
	assert.equal((await db.query("update public.learners set display_name='בדיקה' where id=$1", [learners[users.paid]])).rowCount, 0);
	await denied(db, "update public.learners set state='active'");
	await denied(db, "update public.learners set id=$1", [uuid(888)]);
	await denied(db, "update public.entitlements set ends_at=now()+interval '100 years'");
	await denied(db, "insert into public.entitlements(learner_id,starts_at,ends_at,source_reference) select id,now(),now()+interval '1 hour','self-grant' from public.learners");
	await denied(db, "truncate public.section_progress");
	await denied(db, "delete from public.section_progress");
	await denied(db, "insert into public.section_progress default values");
	await denied(db, "update public.section_progress set position=0");
	await denied(db, "select public.provision_learner($1)", [users.free]);
	await denied(db, "select public.publish_section($1,'fixture-section',2,'בדיקה',null)", [section]);
}));

test("position saves are idempotent, revision checked, and validate version relationships", async () => transaction("free", async (db) => {
	const saved = await save(db,"free",100);
	assert.equal(saved.learner_id, learners[users.free]);
	assert.equal(saved.revision,"1");
	assert.deepEqual(await save(db,"free",100), saved);
	assert.equal((await save(db,"free",200,1)).revision,"2");
	await denied(db,"select public.save_my_position($1,'free',$2,300,1)",[section,current("free")],"40001");
	for (const position of [-1,10001,null]) await denied(db,"select public.save_my_position($1,'free',$2,$3,2)",[section,current("free"),position],"22023");
	await denied(db,"select public.save_my_position($1,'free',$2,300,-1)",[section,current("free")],"22023");
	await denied(db,"select public.save_my_position($1,'free',$2,300,2)",[section,current("paid")]);
	await denied(db,"select public.save_my_position($1,'free',$2,300,2)",[section,versions.find((v)=>v.access_level==='free'&&v.revision===1).id]);
	await denied(db,"select public.save_my_position($1,'paid',$2,300,0)",[section,current("paid")]);
}));

test("publishing advances content atomically, preserving immutable versions and saved positions", async () => transaction("paid", async (db) => {
	await save(db,"paid",1000);
	await admin(db,"select public.publish_section($1,'fixture-section',2,'תוכן בדיקה חדש.',null)",[section]);
	assert.deepEqual(await visible(db),["free"]);
	assert.equal((await db.query("select content_version_id from public.section_progress")).rows[0].content_version_id,current("paid"));
	await db.query("reset role");
	await denied(db,"update public.section_versions set body_text='שינוי' where id=$1",[current("free")],"55000");
	await denied(db,"select public.publish_section($1,'fixture-section',3,null,null)",[section],"22023");
	await denied(db,"select public.publish_section($1,'fixture-section',2,'בדיקה',null)",[section],"40001");
	assert.equal((await db.query("select current_revision from public.learning_sections where id=$1",[section])).rows[0].current_revision,3);
}));

test("trusted provisioning is idempotent and refuses unavailable or unverified identities", async () => transaction("free", async (db) => {
	await admin(db, "update auth.users set banned_until=now()+interval '1 day' where id=$1", [users.paid]);
	await actAs(db,undefined,undefined,"service_role");
	assert.equal((await db.query("select public.provision_learner($1) as id",[users.free])).rows[0].id,learners[users.free]);
	for (const id of [users.unverified, users.anonymous, users.paid, uuid(999), null]) {
		await denied(db,"select public.provision_learner($1)",[id]);
	}
}));

test("simultaneous first saves and later edits produce one success and one conflict", async () => {
	for (const expectedRevision of [0,1]) {
		const clients = await Promise.all([database.connect(),database.connect()]);
		try {
			await Promise.all(clients.map(async (db)=> { await db.query("begin"); await actAs(db,users.free,sessions.free); }));
			const results = await Promise.allSettled(clients.map(async (db,i)=> {
				try { const row = await save(db,"free",1000 * (expectedRevision+1) + i,expectedRevision); await db.query("commit"); return row; }
				catch(error) { await db.query("rollback"); throw error; }
			}));
			assert.equal(results.filter((r)=>r.status==='fulfilled').length,1);
			assert.deepEqual(results.filter((r)=>r.status==='rejected').map((r)=>r.reason.code),["40001"]);
		} finally { await Promise.all(clients.map((db)=>db.end())); }
	}
	await database.admin.query("delete from public.section_progress");
});

test("retiring a section blocks both content and new position writes", async () => transaction("paid", async (db) => {
	await save(db,"free",500);
	await admin(db,"update public.learning_sections set state='retired' where id=$1",[section]);
	assert.deepEqual(await visible(db),[]);
	assert.equal((await db.query("select * from public.section_progress")).rowCount,1);
	await assert.rejects(save(db,"free",600,1),{code:"42501"});
}));

test("trusted publishers can publish, and concurrent provisioning creates only one learner", async () => {
	const id = uuid(901);
	await database.admin.query("insert into auth.users(id,email_confirmed_at) values ($1,now())",[id]);
	const clients = await Promise.all([database.connect(),database.connect()]);
	try {
		const results = await Promise.all(clients.map(async (db)=> {
			await db.query("begin");
			await actAs(db,undefined,undefined,"service_role");
			const row = (await db.query("select public.provision_learner($1) as id",[id])).rows[0];
			await db.query("commit");
			return row.id;
		}));
		assert.equal(results[0],results[1]);
		assert.equal((await database.admin.query("select * from private.learner_identities where auth_user_id=$1",[id])).rowCount,1);
	} finally { await Promise.all(clients.map((db)=>db.end())); }
	await transaction("paid", async (db)=> {
		await actAs(db,undefined,undefined,"service_role");
		assert.equal((await db.query("select public.publish_section($1,'fixture-section',2,'פרסום לבדיקה.',null) as revision",[section])).rows[0].revision,3);
	});
});

test("soft-deleted Auth accounts lose access and cannot be provisioned again", async () => transaction("paid", async (db) => {
	await admin(db,"update auth.users set deleted_at=now() where id=$1",[users.paid]);
	assert.deepEqual(await visible(db),[]);
	await actAs(db,undefined,undefined,"service_role");
	await denied(db,"select public.provision_learner($1)",[users.paid]);
}));

test("effective function privileges and search paths restrict every administrative helper", async () => {
	const allowed = {
		anon: [],
		authenticated: [
			"private.active_learner_id", "private.has_paid_access", "private.my_learning_cutoff", "private.section_has_accessible_version",
			"private.save_my_position", "public.read_section", "public.save_my_position", "public.read_my_position",
			...["my_learning", "start_my_quiz", "read_my_attempt", "save_my_quiz", "submit_my_quiz", "my_quiz_history", "complete_my_topic", "read_my_sections"]
				.flatMap(name => [`private.${name}`, `public.${name}`]),
		],
		service_role: ["private.gateway_session", "public.gateway_session", "private.gateway_rate_limit", "public.gateway_rate_limit",
			"private.sweep_gateway_rate_limits", "public.sweep_gateway_rate_limits", "private.provision_learner", "public.provision_learner", "public.publish_section",
			"public.publish_learning_section", "private.publish_quiz", "public.publish_quiz", "private.sweep_expired_learning", "public.sweep_expired_learning"],
	};
	for (const [role,names] of Object.entries(allowed)) {
		const rows = (await database.admin.query("select n.nspname||'.'||p.proname as name, has_function_privilege($1,p.oid,'EXECUTE') as allowed, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')",[role])).rows;
		assert.deepEqual(rows.filter((r)=>r.allowed).map((r)=>r.name).sort(),names.sort());
		for (const row of rows) {
			if (row.name !== 'public.rls_auto_enable') assert.ok(row.proconfig.includes('search_path=""'),row.name);
		}
	}
});

test("save conflicts return only the caller's safe current position and revision", async () => transaction("free", async (db) => {
	await save(db,"free",100);
	await assert.rejects(save(db,"free",200,0), (error) => {
		assert.equal(error.code,"40001");
		assert.deepEqual(JSON.parse(error.detail),{position:100,revision:1,content_version_id:current("free")});
		return true;
	});
}));

test("the existing auto-RLS trigger works without browser execution privileges", async () => transaction("free", async (db) => {
	await denied(db,"select public.rls_auto_enable()");
	await admin(db,"grant create on schema public to authenticated");
	await db.query("create table public.rls_fixture_probe(id integer)");
	const table = await db.query("select relrowsecurity from pg_class where oid='public.rls_fixture_probe'::regclass");
	assert.equal(table.rows[0].relrowsecurity,true);
}));

test("SQL-looking text stays literal and cannot broaden direct learner reads", async () => transaction("free", async db => {
	const text = "x'; DROP TABLE public.learners; --";
	await db.query("update public.learners set display_name=$1 where id=$2", [text, learners[users.free]]);
	assert.equal((await db.query("select display_name from public.learners")).rows[0].display_name, text);
	for (const level of ["free' OR '1'='1", "paid'; SELECT * FROM private.learner_identities; --"]) {
		assert.equal((await db.query("select * from public.read_section($1,$2)", [section, level])).rowCount, 0);
	}
	assert.deepEqual(await visible(db), ["free"]);
	assert.equal((await db.query("select * from public.read_section($1,'free')", [section])).rowCount, 1);
	assert.equal((await db.query("select * from public.read_section($1,'paid')", [section])).rowCount, 0);
}));
