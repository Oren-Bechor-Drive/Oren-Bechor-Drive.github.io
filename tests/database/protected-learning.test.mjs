import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { startDatabase, actAs } from "../support/database.mjs";
import { quizAnswers, quizQuestions } from "../fixtures/protected-quiz.mjs";

let database;
before(async () => { database = await startDatabase(); });
after(async () => database?.close());

async function fixture({ paid = true } = {}) {
	const user = randomUUID(), session = randomUUID();
	await database.admin.query("insert into auth.users(id,email_confirmed_at) values ($1,now())", [user]);
	await database.admin.query("insert into auth.sessions(id,user_id) values ($1,$2)", [session,user]);
	const learner = (await database.admin.query("select public.provision_learner($1) as id",[user])).rows[0].id;
	const topic = `fixture-${randomUUID()}`;
	const version = (await database.admin.query("select public.publish_quiz($1,'תרגול לבדיקה',$2,'synthetic-only') as id",[topic,JSON.stringify(quizQuestions())])).rows[0].id;
	const entitlement = randomUUID();
	if (paid) await database.admin.query("insert into public.entitlements(id,learner_id,starts_at,ends_at,source_reference) values ($1,$2,now()-interval '1 month',now()+interval '1 day',$3)",[entitlement,learner,entitlement]);
	return {user,session,learner,topic,version,entitlement};
}
async function actor(f, run, role = "authenticated") {
	const db = await database.connect();
	try {
		await db.query("begin");
		await actAs(db,f.user,f.session,role);
		const result = await run(db);
		await db.query("commit");
		return result;
	} catch (error) { await db.query("rollback"); throw error; }
	finally { await db.end(); }
}
const rpc = async (db,name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as value`,args)).rows[0].value;
const start = (f) => actor(f,db=>rpc(db,"start_my_quiz",[f.topic]));
async function submit(f, score=20) {
	const draft = await start(f);
	const saved = await actor(f,db=>rpc(db,"save_my_quiz",[draft.id,JSON.stringify(quizAnswers(score)),draft.revision]));
	return actor(f,db=>rpc(db,"submit_my_quiz",[draft.id,saved.revision]));
}
async function rejected(f,name,args,code="42501",role="authenticated") {
	await assert.rejects(actor(f,db=>rpc(db,name,args),role),{code});
}
async function ageData(f, days=11) {
	await database.admin.query("update public.quiz_attempts set created_at=now()-($2::text||' days')::interval where learner_id=$1",[f.learner,days+1]);
	await database.admin.query("update public.section_progress set updated_at=now()-($2::text||' days')::interval where learner_id=$1",[f.learner,days+1]);
}
async function expire(f, days=11) {
	await ageData(f,days);
	await database.admin.query("update public.entitlements set ends_at=now()-($2::text||' days')::interval where id=$1",[f.entitlement,days]);
}
async function position(f) {
	const section = randomUUID();
	await database.admin.query("select public.publish_section($1,$2,0,'הגדרה לבדיקה.','טקסט לבדיקה.')",[section,section]);
	const versions = (await database.admin.query("select id,access_level from public.section_versions where section_id=$1",[section])).rows;
	for (const v of versions) await actor(f,db=>rpc(db,"save_my_position",[section,v.access_level,v.id,1200,0]));
	return {section,versions};
}

test("publication validates all question shapes and approval, and only service may publish", async () => {
	const f = await fixture();
	await rejected(f,"publish_quiz",[f.topic,"בדיקה",JSON.stringify(quizQuestions()),"approval"]);
	const invalid = [null,{},[],quizQuestions().slice(1)];
	for (const mutate of [
		qs=>qs[1].id=qs[0].id,
		qs=>qs[0].options=[qs[0].options[0]],
		qs=>qs[0].options=[qs[0].options[0],qs[0].options[0]],
		qs=>qs[0].options=Array.from({length:7},(_,i)=>({id:`o${i}`,text:"בדיקה"})),
		qs=>qs[0].correctOptionId="missing",
		qs=>qs[0].explanation=" ", qs=>qs[0].prompt=null, qs=>qs[0].id=3,
		qs=>qs[0].options[0].text={}, qs=>qs[0].options=null,
	]) { const qs=quizQuestions(); mutate(qs); invalid.push(qs); }
	for (const qs of invalid) await rejected(f,"publish_quiz",[f.topic,"בדיקה",JSON.stringify(qs),"approval"],"22023","service_role");
	await rejected(f,"publish_quiz",[f.topic,"בדיקה",JSON.stringify(quizQuestions())," "],"22023","service_role");
	assert.ok(await actor(f,db=>rpc(db,"publish_quiz",[f.topic,"בדיקה",JSON.stringify(quizQuestions()),"synthetic-only"]),"service_role"));
});

test("drafts expose only safe questions, resume after publication and isolate learners", async () => {
	const f=await fixture(), other=await fixture(), draft=await start(f);
	assert.equal(draft.questions.length,20);
	assert.equal(draft.revision,0);
	assert.equal(draft.score,null);
	assert.equal(draft.passed,false);
	assert.equal(draft.status,"draft");
	assert.equal(draft.results,undefined);
	for (const q of draft.questions) { assert.deepEqual(Object.keys(q).sort(),["id","options","prompt"]); for (const o of q.options) assert.deepEqual(Object.keys(o).sort(),["id","text"]); }
	assert.deepEqual(await start(f),draft);
	const changed=quizQuestions(); changed[0].prompt="שאלה חדשה לבדיקה."; changed[0].correctOptionId="b";
	await database.admin.query("select public.publish_quiz($1,'מהדורה חדשה',$2,'synthetic-only')",[f.topic,JSON.stringify(changed)]);
	assert.deepEqual(await start(f),draft);
	await rejected(other,"read_my_attempt",[draft.id]);
	await rejected(other,"save_my_quiz",[draft.id,"{}",0]);
	await rejected(other,"submit_my_quiz",[draft.id,0]);
	assert.equal((await actor(other,db=>db.query("select * from public.quiz_attempts where id=$1",[draft.id]))).rowCount,0);
	const passed=await submit(f);
	assert.equal(passed.score,20);
	assert.equal((await start(f)).questions[0].prompt,changed[0].prompt);
	await assert.rejects(database.admin.query("update private.quiz_versions set title='edited' where id=$1",[f.version]),{code:"55000"});
	await assert.rejects(database.admin.query("delete from private.quiz_versions where id=$1",[f.version]),{code:"55000"});
});

test("server grades 16,17,20 correctly and completion is explicit and idempotent", async () => {
	for (const score of [16,17,20]) {
		const f=await fixture(), result=await submit(f,score);
		assert.equal(result.score,score); assert.equal(result.passed,score>=17);
		assert.equal(result.results.filter(r=>r.correct).length,score);
		assert.equal(result.results[0].correctOptionId,"a");
		assert.match(result.results[0].explanation,/בדיקה/);
		const library=await actor(f,db=>rpc(db,"my_learning"));
		assert.equal(library.topics.find(t=>t.key===f.topic).completedAt,null);
		if(score<17) await rejected(f,"complete_my_topic",[f.topic]);
		else {
			const complete=await actor(f,db=>rpc(db,"complete_my_topic",[f.topic]));
			assert.ok(complete.completedAt);
			assert.deepEqual(await actor(f,db=>rpc(db,"complete_my_topic",[f.topic])),complete);
		}
		assert.deepEqual(await actor(f,db=>rpc(db,"submit_my_quiz",[result.id,result.revision-1])),result);
		await rejected(f,"save_my_quiz",[result.id,JSON.stringify(quizAnswers()),result.revision],"40001");
	}
});

test("saves validate answer membership and revision, retries are idempotent, submission requires 20 answers", async () => {
	const f=await fixture(), draft=await start(f);
	await rejected(f,"submit_my_quiz",[draft.id,0],"22023");
	for(const answers of [null,[],{foreign:"a"},{q1:"foreign"},{q1:1},{q1:null}]) await rejected(f,"save_my_quiz",[draft.id,JSON.stringify(answers),0],"22023");
	const save=await actor(f,db=>rpc(db,"save_my_quiz",[draft.id,'{"q1":"a"}',0]));
	assert.equal(save.revision,1);
	assert.deepEqual(await actor(f,db=>rpc(db,"save_my_quiz",[draft.id,'{"q1":"a"}',0])),save);
	await rejected(f,"save_my_quiz",[draft.id,'{"q1":"b"}',0],"40001");
	await rejected(f,"save_my_quiz",[draft.id,'{"q1":"a"}',99],"40001");
	await rejected(f,"submit_my_quiz",[draft.id,0],"40001");
	await rejected(f,"submit_my_quiz",[draft.id,1],"22023");
});

test("free, revoked, expired and unavailable accounts cannot invoke protected operations", async () => {
	const f=await fixture(), draft=await start(f);
	const calls=[["start_my_quiz",[f.topic]],["read_my_attempt",[draft.id]],["save_my_quiz",[draft.id,"{}",0]],["submit_my_quiz",[draft.id,0]],["my_quiz_history",[f.topic]],["complete_my_topic",[f.topic]]];
	await database.admin.query("update public.entitlements set revoked_at=now() where id=$1",[f.entitlement]);
	for(const [name,args] of calls) await rejected(f,name,args);
	assert.equal((await actor(f,db=>rpc(db,"my_learning"))).paidAccess,false);
	assert.equal((await actor(f,db=>db.query("select * from public.quiz_attempts"))).rowCount,0);
	await database.admin.query("update public.entitlements set revoked_at=null,ends_at=now()-interval '1 second' where id=$1",[f.entitlement]);
	for(const [name,args] of calls) await rejected(f,name,args);
	await database.admin.query("update public.entitlements set ends_at=now()+interval '1 day' where id=$1",[f.entitlement]);
	for(const unavailable of ["update auth.users set banned_until=now()+interval '1 hour' where id=$1","update auth.users set banned_until=null,deleted_at=now() where id=$1"]) {
		await database.admin.query(unavailable,[f.user]); for(const [name,args] of calls) await rejected(f,name,args);
	}
	await rejected(f,"my_learning",[]);
});

test("all tables use RLS and learner roles cannot read keys, mutate learning, sweep or use private helpers", async () => {
	const f=await fixture();
	for(const table of ["private.quiz_topics","private.quiz_versions","private.learning_retention","public.quiz_attempts","public.topic_completions"]) {
		assert.equal((await database.admin.query("select relrowsecurity as enabled from pg_class where oid=$1::regclass",[table])).rows[0].enabled,true);
		for(const role of ["anon","authenticated","service_role"]) for(const privilege of ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","TRIGGER","REFERENCES"]) {
			const allowed=role==="authenticated" && table.startsWith("public.") && privilege==="SELECT";
			assert.equal((await database.admin.query("select has_table_privilege($1,$2,$3) as allowed",[role,table,privilege])).rows[0].allowed,allowed,`${role} ${table} ${privilege}`);
		}
	}
	await rejected(f,"my_learning",[],"42501","anon");
	await rejected(f,"sweep_expired_learning",[]);
	for(const sql of ["select * from private.quiz_versions","select private.learning_cutoff($1)","select private.clean_learning($1)","select private.require_learning(true)","select private.save_position_after_retention(null,null,null,null,null)"]) {
		await assert.rejects(actor(f,db=>db.query(sql,sql.includes("$1")?[f.learner]:[])),{code:"42501"});
	}
	const funcs=(await database.admin.query("select n.nspname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prorettype <> 'event_trigger'::regtype")).rows;
	for(const fn of funcs) { assert.equal(fn.anon,false); assert.ok(fn.proconfig.includes('search_path=""')); if(fn.nspname==="public") assert.equal(fn.prosecdef,false); }
});

test("history paginates all attempts beyond 50 and rejects foreign cursors", async () => {
	const f=await fixture(), other=await fixture();
	const ids=[];
	for(let i=0;i<53;i++) ids.push((await submit(f,i%21)).id);
	const first=await actor(f,db=>rpc(db,"my_quiz_history",[f.topic]));
	assert.equal(first.attempts.length,50); assert.equal(first.hasMore,true); assert.equal(first.nextCursor,first.attempts.at(-1).id);
	const second=await actor(f,db=>rpc(db,"my_quiz_history",[f.topic,first.nextCursor]));
	assert.equal(second.attempts.length,3); assert.equal(second.hasMore,false); assert.equal(second.nextCursor,null);
	assert.deepEqual([...first.attempts,...second.attempts].map(a=>a.id),ids.reverse());
	await rejected(other,"my_quiz_history",[f.topic,first.nextCursor],"22023");
});

test("renewal before ten days preserves positions and attempts; late renewal clears them but keeps completion", async () => {
	for(const days of [9,11]) {
		const f=await fixture(); await position(f); const result=await submit(f); await actor(f,db=>rpc(db,"complete_my_topic",[f.topic])); await start(f);
		await expire(f,days);
		await database.admin.query("update public.entitlements set ends_at=now()+interval '1 month' where id=$1",[f.entitlement]);
		const attempts=await actor(f,db=>rpc(db,"my_quiz_history",[f.topic]));
		assert.equal(attempts.attempts.length,days===9?1:0);
		const progress=await actor(f,db=>db.query("select * from public.section_progress")); assert.equal(progress.rowCount,days===9?2:0);
		const library=await actor(f,db=>rpc(db,"my_learning")); assert.ok(library.topics.find(t=>t.key===f.topic).completedAt);
		if(days===9) assert.equal(attempts.attempts[0].id,result.id);
		else await rejected(f,"read_my_attempt",[result.id]);
	}
});

test("natural deadline hides direct reads before sweep, free read requests clean, and sweeps are idempotent", async () => {
	const f=await fixture(); const pos=await position(f); await submit(f); await actor(f,db=>rpc(db,"complete_my_topic",[f.topic]));
	await ageData(f,12);
	// Clock passage is simulated by setting the grant just before its deadline,
	// without bypassing production triggers or teaching cleanup a test-only clock.
	await database.admin.query("update public.entitlements set ends_at=clock_timestamp()-interval '10 days'+interval '0.15 seconds' where id=$1",[f.entitlement]);
	assert.equal((await database.admin.query("select * from public.quiz_attempts where learner_id=$1",[f.learner])).rowCount,1);
	await new Promise(resolve=>setTimeout(resolve,180));
	assert.equal((await actor(f,db=>db.query("select * from public.section_progress"))).rowCount,0);
	assert.equal((await actor(f,db=>db.query("select * from public.topic_completions"))).rowCount,1);
	await actor(f,db=>db.query("select * from public.read_my_position($1,'free')",[pos.section]));
	assert.equal((await database.admin.query("select * from public.quiz_attempts where learner_id=$1",[f.learner])).rowCount,0);
	assert.equal(await actor(f,db=>rpc(db,"sweep_expired_learning"),"service_role"),0);
	// New free reading after cleanup is preserved by subsequent sweeps.
	const free=pos.versions.find(v=>v.access_level==="free");
	await actor(f,db=>rpc(db,"save_my_position",[pos.section,"free",free.id,200,0]));
	assert.equal(await actor(f,db=>rpc(db,"sweep_expired_learning"),"service_role"),0);
	assert.equal((await actor(f,db=>db.query("select * from public.section_progress"))).rowCount,1);
});

test("separate renewal grants, overlaps, and future grants respect the lapse deadline", async () => {
	for(const scenario of ["before","late","overlap","future"]) {
		const f=await fixture(); await submit(f); await ageData(f,15);
		if(scenario==="overlap") await database.admin.query("insert into public.entitlements(learner_id,starts_at,ends_at,source_reference) values ($1,now()-interval '20 days',now()+interval '1 day',$2)",[f.learner,randomUUID()]);
		await database.admin.query("update public.entitlements set ends_at=now()-interval '9 days' where id=$1",[f.entitlement]);
		if(scenario==="late") await database.admin.query("update public.entitlements set ends_at=now()-interval '11 days' where id=$1",[f.entitlement]);
		await database.admin.query(`insert into public.entitlements(learner_id,starts_at,ends_at,source_reference) values ($1,now()+interval '${scenario==="future"?"2 days":"0 days"}',now()+interval '1 month',$2)`,[f.learner,randomUUID()]);
		if(scenario==="future") {
			await rejected(f,"start_my_quiz",[f.topic]);
			await database.admin.query("update public.entitlements set ends_at=now()-interval '11 days' where id=$1",[f.entitlement]);
			assert.equal((await database.admin.query("select * from public.quiz_attempts where learner_id=$1",[f.learner])).rowCount,0);
		} else assert.equal((await actor(f,db=>rpc(db,"my_quiz_history",[f.topic]))).attempts.length,scenario==="late"?0:1);
	}
});

test("simultaneous starts, saves and submits serialize per learner", async () => {
	const f=await fixture();
	const drafts=await Promise.all([start(f),start(f)]); assert.equal(drafts[0].id,drafts[1].id);
	const saved=await Promise.allSettled(["a","b"].map(answer=>actor(f,db=>rpc(db,"save_my_quiz",[drafts[0].id,JSON.stringify({q1:answer}),0]))));
	assert.equal(saved.filter(r=>r.status==="fulfilled").length,1);
	assert.equal(saved.find(r=>r.status==="rejected").reason.code,"40001");
	const complete=await actor(f,db=>rpc(db,"save_my_quiz",[drafts[0].id,JSON.stringify(quizAnswers()),1]));
	const results=await Promise.all([1,2].map(()=>actor(f,db=>rpc(db,"submit_my_quiz",[complete.id,complete.revision])))); assert.deepEqual(results[0],results[1]);
});

test("a request waiting behind entitlement revocation rechecks paid access after the lock", async () => {
	const f=await fixture(), draft=await start(f), db=await database.connect();
	try {
		await db.query("begin");
		await db.query("update public.entitlements set revoked_at=now() where id=$1",[f.entitlement]);
		let finished=false;
		const waiting=actor(f,client=>rpc(client,"save_my_quiz",[draft.id,'{"q1":"a"}',0])).then(()=>{finished=true;return null;},error=>{finished=true;return error;});
		await new Promise(resolve=>setTimeout(resolve,30)); assert.equal(finished,false);
		await db.query("commit"); assert.equal((await waiting).code,"42501");
	} finally { await db.query("rollback"); await db.end(); }
});

test("renewal waiting for the learner lock cannot revive data after the wall-clock deadline", async () => {
	const f=await fixture(); await submit(f); await ageData(f,12);
	await database.admin.query("update public.entitlements set ends_at=clock_timestamp()-interval '10 days'+interval '0.18 seconds' where id=$1",[f.entitlement]);
	const lock=await database.connect(), renewal=await database.connect();
	try {
		await lock.query("begin"); await lock.query("select pg_advisory_xact_lock(hashtextextended('learning:'||$1,0))",[f.learner]);
		const pending=renewal.query("update public.entitlements set ends_at=now()+interval '1 month' where id=$1",[f.entitlement]);
		await new Promise(resolve=>setTimeout(resolve,220)); await lock.query("commit"); await pending;
		assert.equal((await actor(f,db=>rpc(db,"my_quiz_history",[f.topic]))).attempts.length,0);
	} finally { await lock.query("rollback"); await lock.end(); await renewal.end(); }
});

test("trusted sweep deletes due positions, drafts and submissions, preserving completions and identity", async () => {
	const f=await fixture(); await position(f); await submit(f); await actor(f,db=>rpc(db,"complete_my_topic",[f.topic])); await start(f);
	await ageData(f,12);
	await database.admin.query("update public.entitlements set ends_at=clock_timestamp()-interval '10 days'+interval '0.12 seconds' where id=$1",[f.entitlement]);
	await new Promise(resolve=>setTimeout(resolve,150));
	assert.equal(await actor(f,db=>rpc(db,"sweep_expired_learning"),"service_role"),1);
	assert.equal(await actor(f,db=>rpc(db,"sweep_expired_learning"),"service_role"),0);
	for(const table of ["quiz_attempts","section_progress"]) assert.equal((await database.admin.query(`select * from public.${table} where learner_id=$1`,[f.learner])).rowCount,0);
	for(const [table,column] of [["public.topic_completions","learner_id"],["public.entitlements","learner_id"],["private.learner_identities","learner_id"],["public.learners","id"]]) {
		assert.equal((await database.admin.query(`select * from ${table} where ${column}=$1`,[f.learner])).rowCount,1);
	}
});

test("the exact ten-day deadline clears data and direct table access cannot restore or forge it", async () => {
	const f=await fixture(); await submit(f); await ageData(f,12);
	await database.admin.query("update public.entitlements set ends_at=statement_timestamp()-interval '10 days' where id=$1",[f.entitlement]);
	assert.equal((await database.admin.query("select * from public.quiz_attempts where learner_id=$1",[f.learner])).rowCount,0);
	for(const sql of ["insert into public.quiz_attempts default values","update public.quiz_attempts set score=20","delete from public.quiz_attempts","insert into public.topic_completions default values"]) {
		await assert.rejects(actor(f,db=>db.query(sql)),{code:"42501"});
	}
	await assert.rejects(database.admin.query("delete from public.entitlements where id=$1",[f.entitlement]),{code:"55000"});
	const other=await fixture();
	await assert.rejects(database.admin.query("update public.entitlements set learner_id=$2 where id=$1",[f.entitlement,other.learner]),{code:"55000"});
});

test("a concurrent sweep waits for timely renewal, then retains learning", async () => {
	const f=await fixture(); await submit(f); await ageData(f,12);
	await database.admin.query("update public.entitlements set ends_at=clock_timestamp()-interval '10 days'+interval '0.2 seconds' where id=$1",[f.entitlement]);
	const renewal=await database.connect();
	try {
		await renewal.query("begin");
		await renewal.query("update public.entitlements set ends_at=now()+interval '1 month' where id=$1",[f.entitlement]);
		const sweeping=actor(f,db=>rpc(db,"sweep_expired_learning"),"service_role");
		await new Promise(resolve=>setTimeout(resolve,250));
		await renewal.query("commit");
		assert.equal(await sweeping,0);
		assert.equal((await actor(f,db=>rpc(db,"my_quiz_history",[f.topic]))).attempts.length,1);
	} finally { await renewal.query("rollback"); await renewal.end(); }
});

test("a request waiting for a naturally expiring entitlement rechecks wall-clock access", async () => {
	const f=await fixture(), draft=await start(f), lock=await database.connect();
	await database.admin.query("update public.entitlements set ends_at=clock_timestamp()+interval '0.15 seconds' where id=$1",[f.entitlement]);
	try {
		await lock.query("begin"); await lock.query("select pg_advisory_xact_lock(hashtextextended('learning:'||$1,0))",[f.learner]);
		const waiting=actor(f,db=>rpc(db,"save_my_quiz",[draft.id,'{"q1":"a"}',0])).then(()=>null,error=>error);
		await new Promise(resolve=>setTimeout(resolve,190)); await lock.query("commit");
		assert.equal((await waiting).code,"42501");
	} finally { await lock.query("rollback"); await lock.end(); }
});

test("live quiz authorization rejects suspended identities and revoked or foreign sessions", async () => {
	const f=await fixture(), other=await fixture(), draft=await start(f);
	for(const session of [null,"malformed",other.session,randomUUID()]) await rejected({...f,session},"read_my_attempt",[draft.id]);
	await database.admin.query("update public.learners set state='suspended' where id=$1",[f.learner]);
	await rejected(f,"my_learning",[]);
	await database.admin.query("update public.learners set state='active' where id=$1",[f.learner]);
	await database.admin.query("delete from auth.sessions where id=$1",[f.session]);
	await rejected(f,"read_my_attempt",[draft.id]);
});

test("section catalog exposes accessible current titles only and publication is atomic", async () => {
	const paid=await fixture(), free=await fixture({paid:false}), mixed=randomUUID(), paidOnly=randomUUID();
	const publish=(f,id,revision,title,freeBody,paidBody,role="service_role")=>actor(f,db=>rpc(db,"publish_learning_section",[id,id,revision,title,freeBody,paidBody]),role);
	assert.equal(await publish(paid,mixed,0,"הגדרה והסבר לבדיקה","הגדרה חינמית לבדיקה.","הסבר בתשלום לבדיקה."),1);
	assert.equal(await publish(paid,paidOnly,0,"כותרת פרטית לבדיקה",null,"תוכן פרטי לבדיקה."),1);
	const catalog=await actor(free,db=>rpc(db,"read_my_sections"));
	assert.deepEqual(catalog.sections.filter(s=>[mixed,paidOnly].includes(s.id)),[{id:mixed,title:"הגדרה והסבר לבדיקה",accessLevel:"free"}]);
	const full=await actor(paid,db=>rpc(db,"read_my_sections"));
	assert.equal(full.sections.filter(s=>s.id===mixed).length,2);
	assert.equal(full.sections.filter(s=>s.id===paidOnly).length,1);
	assert.equal((await actor(free,db=>db.query("select title from public.learning_sections where id=$1",[paidOnly]))).rowCount,0);
	for(const section of full.sections) assert.deepEqual(Object.keys(section).sort(),["accessLevel","id","title"]);
	await assert.rejects(publish(free,mixed,1,"כותרת מזויפת",null,"תוכן" ,"authenticated"),{code:"42501"});
	await assert.rejects(publish(paid,mixed,0,"כותרת שגויה",null,"תוכן"),{code:"40001"});
	await assert.rejects(publish(paid,mixed,1," ",null,"תוכן"),{code:"22023"});
	assert.equal((await database.admin.query("select title from public.learning_sections where id=$1",[mixed])).rows[0].title,"הגדרה והסבר לבדיקה");
	assert.equal(await publish(paid,mixed,1,"כותרת חדשה לבדיקה",null,"מהדורה פרטית חדשה."),2);
	assert.equal((await actor(free,db=>rpc(db,"read_my_sections"))).sections.filter(s=>[mixed,paidOnly].includes(s.id)).length,0);
	assert.equal((await actor(free,db=>db.query("select * from public.read_section($1,'free')",[mixed]))).rowCount,0);
	assert.equal((await database.admin.query("select * from public.section_versions where section_id=$1",[mixed])).rowCount,3);
	await database.admin.query("update public.entitlements set ends_at=now() where id=$1",[paid.entitlement]);
	assert.equal((await actor(paid,db=>rpc(db,"read_my_sections"))).sections.filter(s=>[mixed,paidOnly].includes(s.id)).length,0);
	await database.admin.query("update public.learners set state='suspended' where id=$1",[free.learner]);
	await rejected(free,"read_my_sections",[]);
	await rejected(paid,"read_my_sections",[],"42501","anon");
});

test("a free position first saved after waiting across the retention deadline survives reads and sweeps", async () => {
	const f=await fixture(), section=randomUUID();
	await database.admin.query("select public.publish_section($1,$2,0,'הגדרה לבדיקה.',null)",[section,section]);
	const version=(await database.admin.query("select id from public.section_versions where section_id=$1",[section])).rows[0].id;
	const blocker=await database.connect(), writer=await database.connect();
	let pending;
	try {
		await blocker.query("begin");
		await blocker.query("select pg_advisory_xact_lock(hashtextextended('learning:'||$1,0))",[f.learner]);
		await writer.query("begin"); await actAs(writer,f.user,f.session);
		const pid=(await writer.query("select pg_backend_pid() as pid")).rows[0].pid;
		pending=writer.query("select * from public.save_my_position($1,'free',$2,4500,0)",[section,version]).then(result=>({result}),error=>({error}));
		const deadline=await waitingDeadline(pid);
		await blocker.query("update public.entitlements set ends_at=$2::timestamptz-interval '10 days' where id=$1",[f.entitlement,deadline]);
		await blocker.query("select pg_sleep(greatest(0,extract(epoch from $1::timestamptz-clock_timestamp())))",[deadline]);
		await blocker.query("commit");
		const saved=await pending;
		assert.ifError(saved.error);
		assert.equal(saved.result.rows[0].position,4500);
		await writer.query("commit");
		assert.equal((await actor(f,db=>db.query("select * from public.section_progress where section_id=$1",[section]))).rowCount,1);
		assert.equal((await database.admin.query("select updated_at>$2::timestamptz as retained from public.section_progress where learner_id=$1",[f.learner,deadline])).rows[0].retained,true);
		await actor(f,db=>rpc(db,"sweep_expired_learning"),"service_role");
		assert.equal((await actor(f,db=>db.query("select * from public.read_my_position($1,'free')",[section]))).rows[0].position,4500);
	} finally {
		await blocker.query("rollback");
		await pending;
		await writer.query("rollback");
		await blocker.end(); await writer.end();
	}
});

test("a quiz request rechecks session expiry after waiting for the learner lock", async () => {
	const f=await fixture(), blocker=await database.connect(), writer=await database.connect();
	let pending;
	try {
		await blocker.query("begin");
		await blocker.query("select pg_advisory_xact_lock(hashtextextended('learning:'||$1,0))",[f.learner]);
		await writer.query("begin"); await actAs(writer,f.user,f.session);
		const pid=(await writer.query("select pg_backend_pid() as pid")).rows[0].pid;
		pending=writer.query("select public.start_my_quiz($1)",[f.topic]).then(result=>({result}),error=>({error}));
		const deadline=await waitingDeadline(pid);
		await blocker.query("update auth.sessions set not_after=$2 where id=$1",[f.session,deadline]);
		await blocker.query("select pg_sleep(greatest(0,extract(epoch from $1::timestamptz-clock_timestamp())))",[deadline]);
		await blocker.query("commit");
		assert.equal((await pending).error?.code,"42501");
	} finally {
		await blocker.query("rollback"); await pending; await writer.query("rollback");
		await blocker.end(); await writer.end();
	}
});

// Observe the actual blocked statement, then place expiry after its start time.
// This proves the time boundary was crossed without depending on timer speed.
async function waitingDeadline(pid) {
	const timeout=Date.now()+5000;
	while(Date.now()<timeout) {
		const waiting=(await database.admin.query("select (query_start+interval '1 millisecond')::text as deadline from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[pid])).rows[0];
		if(waiting) return waiting.deadline;
		await new Promise(resolve=>setTimeout(resolve,5));
	}
	assert.fail("Request did not wait for the expected lock");
}


test("upgrading legacy sections preserves long machine keys without publishing them as titles", async () => {
	const name=`learning_upgrade_${randomUUID().replaceAll("-","")}`;
	await database.admin.query(`create database ${name}`);
	const upgrade=new database.admin.constructor({...database.admin.connectionParameters,password:database.admin.connectionParameters.password,database:name});
	try {
		await upgrade.connect();
		const bootstrap=await readFile(new URL("../../supabase/tests/database/auth-bootstrap.sql",import.meta.url),"utf8");
		// Roles belong to the disposable cluster and already exist. All schema and
		// migration operations below run in this separate, initially empty database.
		await upgrade.query(bootstrap.replace(/^create role .+;$/gm,""));
		const migrations=new URL("../../supabase/migrations/",import.meta.url);
		const protectedMigration="20260925090715_protected_learning.sql";
		for(const file of (await readdir(migrations)).filter(file=>file.endsWith(".sql") && file<protectedMigration).sort()) {
			await upgrade.query(await readFile(new URL(file,migrations),"utf8"));
		}
		const sections=[{id:randomUUID(),key:"machine-only-section"},{id:randomUUID(),key:"legacy-"+"x".repeat(350)}];
		for(const section of sections) await upgrade.query("select public.publish_section($1,$2,0,'הגדרה לבדיקה.',null)",[section.id,section.key]);
		const versions=(await upgrade.query("select * from public.section_versions order by id")).rows;
		await upgrade.query(await readFile(new URL(protectedMigration,migrations),"utf8"));
		assert.deepEqual((await upgrade.query("select * from public.section_versions order by id")).rows,versions);
		assert.deepEqual((await upgrade.query("select id,source_key as key,title from public.learning_sections order by source_key")).rows,
			sections.map(section=>({...section,title:null})).sort((a,b)=>a.key.localeCompare(b.key)));
		const user=randomUUID(), session=randomUUID();
		await upgrade.query("insert into auth.users(id,email_confirmed_at) values ($1,now())",[user]);
		await upgrade.query("insert into auth.sessions(id,user_id) values ($1,$2)",[session,user]);
		await upgrade.query("select public.provision_learner($1)",[user]);
		await upgrade.query("begin"); await actAs(upgrade,user,session);
		assert.deepEqual(await rpc(upgrade,"read_my_sections"),{sections:[]});
		await upgrade.query("rollback");
		await upgrade.query("begin"); await actAs(upgrade,undefined,undefined,"service_role");
		assert.equal(await rpc(upgrade,"publish_learning_section",[sections[0].id,sections[0].key,1,"כותרת מאושרת לבדיקה","הגדרה חדשה לבדיקה.",null]),2);
		await upgrade.query("commit");
		await upgrade.query("begin"); await actAs(upgrade,user,session);
		assert.deepEqual(await rpc(upgrade,"read_my_sections"),{sections:[{id:sections[0].id,title:"כותרת מאושרת לבדיקה",accessLevel:"free"}]});
		await upgrade.query("rollback");
	} finally {
		await upgrade.end();
		await database.admin.query(`drop database ${name}`);
	}
});

test("direct learner RPCs treat SQL-looking topic keys and answers as data", async () => {
	const f = await fixture();
	const draft = await start(f);
	for (const value of ["' OR '1'='1", `${f.topic}'; DROP TABLE public.quiz_attempts; --`, "' UNION SELECT payload FROM private.gateway_sessions --"]) {
		await rejected(f, "start_my_quiz", [value]);
		await rejected(f, "my_quiz_history", [value, null]);
		await rejected(f, "complete_my_topic", [value]);
		await rejected(f, "save_my_quiz", [draft.id, JSON.stringify({ q1: value }), 0], "22023");
	}
	const unchanged = await actor(f, db => rpc(db, "read_my_attempt", [draft.id]));
	assert.deepEqual(unchanged.answers, {});
	assert.equal(unchanged.revision, 0);
	const saved = await actor(f, db => rpc(db, "save_my_quiz", [draft.id, JSON.stringify({ q1: "a" }), 0]));
	assert.deepEqual(saved.answers, { q1: "a" });
	assert.equal(saved.revision, 1);
});
