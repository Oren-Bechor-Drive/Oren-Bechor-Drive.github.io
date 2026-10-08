import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startDatabase, actAs } from "../tests/support/database.mjs";
import { quizAnswers, quizQuestions } from "../tests/fixtures/protected-quiz.mjs";
import { createSupabaseSessions } from "../server/session-store.mjs";
import { createDatabaseSessionFetch, databaseSessionConfiguration } from "../tests/support/database-session-fetch.mjs";

async function asLearner(database, learner, query, values = []) {
	const client = await database.connect();
	try {
		await client.query("begin");
		await actAs(client, learner.user, learner.session);
		const result = await client.query(query, values);
		await client.query("commit");
		return result;
	} catch (error) { await client.query("rollback"); throw error; }
	finally { await client.end(); }
}
const rpc = async (database, learner, name, values = []) => (await asLearner(database, learner,
	`select to_jsonb(public.${name}(${values.map((_, index) => `$${index + 1}`).join(",")})) as value`, values)).rows[0].value;

function sessionStore(database, secret) {
	return createSupabaseSessions({ ...databaseSessionConfiguration, secret, fetchImpl: createDatabaseSessionFetch(database) });
}

async function signInSession(sessions, tokens, user, learner) {
	const anonymous = await sessions.rotate(null,"anonymous");
	const record = await sessions.get(anonymous.token);
	return sessions.run(record, () => sessions.rotate(record,"authenticated",tokens,user,learner));
}

async function identity(database, { paid = true } = {}) {
	const user = randomUUID(), session = randomUUID(), entitlement = randomUUID();
	await database.admin.query("insert into auth.users(id,email_confirmed_at) values ($1,now())", [user]);
	await database.admin.query("insert into auth.sessions(id,user_id) values ($1,$2)", [session,user]);
	const learner = (await database.admin.query("select public.provision_learner($1) as id", [user])).rows[0].id;
	if (paid) await database.admin.query(`insert into public.entitlements(id,learner_id,starts_at,ends_at,source_reference)
		values ($1,$2,now()-interval '30 days',now()+interval '1 day',$3)`, [entitlement,learner,entitlement]);
	return { user, session, learner, entitlement };
}
async function submit(database, learner, topic, correct = 3) {
	const draft = await rpc(database, learner, "start_my_quiz", [topic]);
	const saved = await rpc(database, learner, "save_my_quiz", [draft.id,JSON.stringify(quizAnswers(correct,3)),draft.revision]);
	return rpc(database, learner, "submit_my_quiz", [draft.id,saved.revision]);
}
async function ageAndExpire(database, learner, days) {
	await database.admin.query("update public.quiz_attempts set created_at=now()-interval '20 days' where learner_id=$1", [learner.learner]);
	await database.admin.query("update public.section_progress set updated_at=now()-interval '20 days' where learner_id=$1", [learner.learner]);
	await database.admin.query("update public.entitlements set ends_at=now()-($2::text||' days')::interval where id=$1", [learner.entitlement,days]);
}
async function countOwned(database, table, learner) {
	return (await database.admin.query(`select count(*) from public.${table} where learner_id=$1`, [learner.learner])).rows[0].count;
}
async function seed(database) {
	const active = await identity(database), neverPaid = await identity(database,{ paid:false });
	const grace = await identity(database), cleared = await identity(database);
	const topic = `recovery-${randomUUID()}`, section = randomUUID();
	await database.admin.query("select public.publish_learning_section($1,$2,0,'כותרת לבדיקה','הגדרה לבדיקה.','טקסט פרטי לבדיקה.')", [section,`recovery-${section}`]);
	const versions = (await database.admin.query("select id,access_level from public.section_versions where section_id=$1", [section])).rows;
	for (const learner of [active,grace,cleared]) {
		for (const version of versions) await rpc(database, learner, "save_my_position", [section,version.access_level,version.id,1200,0]);
	}
	const paidVersion = versions.find(version => version.access_level === "paid");
	await rpc(database, active, "save_my_position", [section,"paid",paidVersion.id,7400,1]);
	await database.admin.query("select public.publish_quiz($1,'תרגול לבדיקה',$2,'synthetic-recovery-only')", [topic,JSON.stringify(quizQuestions(3))]);
	const passed = await submit(database,active,topic);
	await rpc(database, active, "complete_my_topic", [topic]);
	await submit(database,cleared,topic);
	await rpc(database, cleared, "complete_my_topic", [topic]);
	await submit(database,grace,topic,2);
	await database.admin.query("select public.publish_quiz($1,'תרגול מעודכן לבדיקה',$2,'synthetic-recovery-only-v2')", [topic,JSON.stringify(quizQuestions(3))]);
	await submit(database,active,topic,2);
	await ageAndExpire(database,grace,9);
	await ageAndExpire(database,cleared,11);
	const withdrawalLearner = await identity(database), withdrawalTopic = `withdrawal-${randomUUID()}`;
	const withdrawalVersion = (await database.admin.query("select public.publish_quiz($1,'תרגול להפסקה לבדיקה',$2,'synthetic-withdrawal-only') as id",
		[withdrawalTopic,JSON.stringify(quizQuestions(3))])).rows[0].id;
	const withdrawnDraft = await rpc(database,withdrawalLearner,"start_my_quiz",[withdrawalTopic]);
	await rpc(database,withdrawalLearner,"save_my_quiz",[withdrawnDraft.id,'{"q1":"a"}',0]);
	const withdrawalSubmitted = await submit(database,active,withdrawalTopic);
	await database.admin.query("select public.withdraw_quiz_version($1,'synthetic-withdrawal-review')",[withdrawalVersion]);
	await rpc(database,withdrawalLearner,"start_my_quiz",[withdrawalTopic]);
	return { active,neverPaid,grace,cleared,topic,section,paidVersion,passed,
		withdrawalLearner,withdrawalTopic,withdrawalVersion,withdrawnDraft,withdrawalSubmitted };
}

// There are no destination, credentials, archive-file or URL options. Every
// connection belongs to a loopback fixture; database archives remain in memory.
export async function rehearseLocalRecovery() {
	if (arguments.length) throw new Error("Local recovery rehearsal accepts no arguments");
	const started = performance.now(), checks = [];
	let source, destination, mediaDirectory;
	const check = async (name, operation) => { await operation(); checks.push({ name,passed:true }); };
	try {
		source = await startDatabase();
		destination = await startDatabase();
		const fixture = await seed(source), secret = randomBytes(32).toString("base64");
		const sourceSessions = sessionStore(source,secret);
		const signed = await signInSession(sourceSessions,
			{ access_token:"synthetic-access", refresh_token:"synthetic-refresh", expires_in:3600 },
			{ id:fixture.active.user,email:"recovery@example.test" }, { id:fixture.active.learner });
		const archive = await source.dumpData();
		const decoded = JSON.parse(new TextDecoder().decode(archive));
		await check("atomic corrupt-archive rollback", async () => {
			const empty = await destination.dumpData(), corrupt = structuredClone(decoded);
			corrupt.relations.find(relation => relation.schema === "public" && relation.name === "learners").rows = [];
			await assert.rejects(destination.restoreData(new TextEncoder().encode(JSON.stringify(corrupt))), /Foreign key/);
			assert.deepEqual(await destination.dumpData(),empty);
		});
		await destination.restoreData(archive);
		await check("identical application rows", async () => assert.deepEqual(await destination.dumpData(),archive));
		await check("access and learner isolation", async () => {
			const { active,neverPaid,grace,section,passed,topic } = fixture;
			assert.equal((await asLearner(destination,active,"select * from public.read_section($1,'paid')",[section])).rowCount,1);
			for (const learner of [neverPaid,grace]) {
				assert.equal((await asLearner(destination,learner,"select * from public.read_section($1,'paid')",[section])).rowCount,0);
				assert.equal((await asLearner(destination,learner,"select * from public.read_section($1,'free')",[section])).rowCount,1);
				assert.equal((await rpc(destination,learner,"my_learning")).paidAccess,false);
				await assert.rejects(rpc(destination,learner,"start_my_quiz",[topic]), { code:"42501" });
			}
			await assert.rejects(rpc(destination,neverPaid,"read_my_attempt",[passed.id]), { code:"42501" });
			assert.equal((await asLearner(destination,neverPaid,"select * from public.section_progress where learner_id=$1",[active.learner])).rowCount,0);
			assert.equal((await asLearner(destination,neverPaid,"select * from public.topic_completions where learner_id=$1",[active.learner])).rowCount,0);
		});
		await check("history and completions", async () => {
			for (const learner of [fixture.active,fixture.cleared]) {
				assert.deepEqual(await rpc(destination,learner,"my_learning"),await rpc(source,learner,"my_learning"));
				assert.equal(await countOwned(destination,"topic_completions",learner),"1");
			}
			assert.deepEqual(await rpc(destination,fixture.active,"my_quiz_history",[fixture.topic,null]),
				await rpc(source,fixture.active,"my_quiz_history",[fixture.topic,null]));
			assert.deepEqual(await rpc(destination,fixture.active,"read_my_attempt",[fixture.passed.id]),
				await rpc(source,fixture.active,"read_my_attempt",[fixture.passed.id]));
		});
		await check("withdrawn drafts and unchanged submitted history", async () => {
			const { withdrawalLearner,withdrawalTopic,withdrawnDraft,withdrawalSubmitted,active } = fixture;
			assert.deepEqual(await rpc(destination,withdrawalLearner,"read_my_attempt",[withdrawnDraft.id]),
				{ id:withdrawnDraft.id,topicKey:withdrawalTopic,revision:1,status:"withdrawn" });
			await assert.rejects(rpc(destination,withdrawalLearner,"save_my_quiz",[withdrawnDraft.id,'{"q1":"a"}',1]),{ code:"P4100" });
			await assert.rejects(rpc(destination,withdrawalLearner,"submit_my_quiz",[withdrawnDraft.id,1]),{ code:"P4100" });
			await assert.rejects(rpc(destination,withdrawalLearner,"start_my_quiz",[withdrawalTopic]),{ code:"P4100" });
			assert.equal((await rpc(destination,active,"my_learning")).topics.some(topic => topic.key === withdrawalTopic),false);
			assert.deepEqual(await rpc(destination,active,"read_my_attempt",[withdrawalSubmitted.id]),withdrawalSubmitted);
			assert.deepEqual(await rpc(destination,active,"my_quiz_history",[withdrawalTopic,null]),
				await rpc(source,active,"my_quiz_history",[withdrawalTopic,null]));
		});
		await check("position revisions", async () => {
			const values = [fixture.section,"paid"];
			const current = (await asLearner(destination,fixture.active,"select * from public.read_my_position($1,$2)",values)).rows[0];
			assert.equal(current.position,7400);
			assert.equal(String(current.revision),"2");
			assert.deepEqual(current,(await asLearner(source,fixture.active,"select * from public.read_my_position($1,$2)",values)).rows[0]);
			await assert.rejects(rpc(destination,fixture.active,"save_my_position",[fixture.section,"paid",fixture.paidVersion.id,8000,1]),{ code:"40001" });
			const saved = await rpc(destination,fixture.active,"save_my_position",[fixture.section,"paid",fixture.paidVersion.id,8000,2]);
			assert.equal(String(saved.revision),"3");
		});
		await check("retention cleanup", async () => {
			assert.deepEqual((await destination.admin.query("select learner_id,cleared_through::text from private.learning_retention order by learner_id")).rows,
				(await source.admin.query("select learner_id,cleared_through::text from private.learning_retention order by learner_id")).rows);
			assert.equal(await countOwned(destination,"quiz_attempts",fixture.grace),"1");
			assert.equal(await countOwned(destination,"section_progress",fixture.grace),"2");
			assert.equal(await countOwned(destination,"quiz_attempts",fixture.cleared),"0");
			assert.equal(await countOwned(destination,"section_progress",fixture.cleared),"0");
			await ageAndExpire(destination,fixture.grace,11);
			await rpc(destination,fixture.grace,"my_learning");
			assert.equal(await countOwned(destination,"quiz_attempts",fixture.grace),"0");
			assert.equal(await countOwned(destination,"section_progress",fixture.grace),"0");
			assert.equal(await countOwned(destination,"topic_completions",fixture.cleared),"1");
		});
		const restoredSessions = sessionStore(destination,secret);
		await check("stable-key session restoration", async () => {
			const restored = await restoredSessions.get(signed.token);
			assert.deepEqual(restored.tokens,signed.record.tokens);
			assert.deepEqual(restored.user,signed.record.user);
			assert.equal(restored.csrf,signed.record.csrf);
			await restoredSessions.run(restored, async () => assert.equal(await restoredSessions.live(restored),true));
		});
		await check("key rotation requires sign-in", async () => {
			const rotated = sessionStore(destination,randomBytes(32).toString("base64"));
			assert.equal(await rotated.get(signed.token),null);
			const fresh = await signInSession(rotated,signed.record.tokens,signed.record.user,signed.record.learner);
			assert.equal((await rotated.get(fresh.token)).user.id,fixture.active.user);
		});
		await check("invalidated session requires sign-in", async () => {
			const restored = await restoredSessions.get(signed.token);
			await restoredSessions.run(restored, () => restoredSessions.remove(restored));
			assert.equal(await restoredSessions.get(signed.token),null);
		});
		await check("separate private-media copy and hash", async () => {
			mediaDirectory = await mkdtemp(path.join(tmpdir(),"oren-recovery-media-"));
			const original = path.join(mediaDirectory,"synthetic-source.bin"), restored = path.join(mediaDirectory,"synthetic-restored.bin");
			const bytes = randomBytes(1024);
			await writeFile(original,bytes,{ mode:0o600 });
			await copyFile(original,restored);
			const digest = data => createHash("sha256").update(data).digest("hex");
			assert.equal(digest(await readFile(restored)),digest(bytes));
			assert.deepEqual(await readFile(restored),bytes);
		});
		return { scope:"local",checks,migrations:decoded.migrations.map(migration => migration.file),durationMs:Math.round(performance.now()-started) };
	} finally {
		const cleanup = await Promise.allSettled([source?.close(),destination?.close(),
			mediaDirectory ? rm(mediaDirectory,{ recursive:true,force:true }) : undefined]);
		const failures = cleanup.filter(result => result.status === "rejected");
		if (failures.length) throw new AggregateError(failures.map(result => result.reason),"Local recovery fixture cleanup failed");
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const write = (stream, value) => new Promise((resolve, reject) => stream.write(value+"\n", error => error ? reject(error) : resolve()));
	let exitCode = 0;
	try {
		if (process.argv.length !== 2) throw new Error("Local recovery rehearsal accepts no CLI arguments");
		await write(process.stdout,JSON.stringify(await rehearseLocalRecovery(),null,2));
	} catch {
		await write(process.stderr,"Local recovery rehearsal failed. Run the recovery tests for fixture diagnostics.");
		exitCode = 1;
	}
	// The embedded database's natural-exit hook forces exitCode to zero. Cleanup
	// has finished and output is flushed before this explicit command exit.
	process.exit(exitCode);
}
