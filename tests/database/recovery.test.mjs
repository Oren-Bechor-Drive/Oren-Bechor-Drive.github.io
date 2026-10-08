import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { startDatabase } from "../support/database.mjs";
import { createFixtureRecovery } from "../support/database-recovery.mjs";
import { rehearseLocalRecovery } from "../../scripts/rehearse-local-recovery.mjs";

let source;
before(async () => {
	source = await startDatabase();
	const user = randomUUID();
	await source.admin.query("insert into auth.users(id,email_confirmed_at) values ($1,now())", [user]);
	await source.admin.query("select public.provision_learner($1)", [user]);
	// PostgreSQL bigint JSON must remain exact across the archive.
	await source.admin.query("update private.gateway_session_control set generation=9007199254740993");
});
after(async () => source?.close());
const unpack = bytes => JSON.parse(new TextDecoder().decode(bytes));
const pack = archive => new TextEncoder().encode(JSON.stringify(archive));
const execute = promisify(execFile);
async function target(t) {
	const database = await startDatabase();
	t.after(() => database.close());
	return database;
}

test("recovery preserves raw PostgreSQL integers and accepts only an empty migrated fixture", async t => {
	const destination = await target(t), bytes = await source.dumpData();
	await destination.restoreData(bytes);
	assert.equal((await destination.admin.query("select generation::text from private.gateway_session_control")).rows[0].generation, "9007199254740993");
	assert.deepEqual(unpack(await destination.dumpData()), unpack(bytes));
	await assert.rejects(destination.restoreData(bytes), /empty migrated fixture/);
});

test("corrupt archives roll back every table when a referenced learner is missing", async t => {
	const destination = await target(t);
	const before = unpack(await destination.dumpData()), archive = unpack(await source.dumpData());
	archive.relations.find(relation => relation.schema === "public" && relation.name === "learners").rows = [];
	await assert.rejects(destination.restoreData(pack(archive)), /Foreign key/);
	assert.deepEqual(unpack(await destination.dumpData()), before);
	assert.equal((await destination.admin.query("show session_replication_role")).rows[0].session_replication_role, "origin");
	await destination.restoreData(await source.dumpData());
});

test("recovery rejects migration and relation manifests before writing", async t => {
	const destination = await target(t), original = unpack(await source.dumpData());
	for (const change of [
		archive => { archive.migrations[0].sha256 = "0".repeat(64); },
		archive => { archive.relations[0].name = 'users"; drop schema public cascade; --'; },
		archive => { archive.relations[0].columns[0].name = "unknown_column"; },
		archive => { archive.relations.push(archive.relations[0]); },
	]) {
		const archive = structuredClone(original);
		change(archive);
		await assert.rejects(destination.restoreData(pack(archive)), /manifest/);
	}
	await destination.restoreData(pack(original));
});

test("recovery rejects unknown row columns and malformed row JSON atomically", async t => {
	const destination = await target(t), original = unpack(await source.dumpData());
	for (const row of ['{"id":"00000000-0000-4000-8000-000000000000","unexpected":true}', '{"id":']) {
		const archive = structuredClone(original);
		archive.relations.find(relation => relation.schema === "auth" && relation.name === "users").rows = [row];
		await assert.rejects(destination.restoreData(pack(archive)));
		assert.equal((await destination.admin.query("select count(*) from auth.users")).rows[0].count, "0");
	}
	await destination.restoreData(pack(original));
});

test("changed target schema and changed migration seed data are refused", async t => {
	const destination = await target(t), bytes = await source.dumpData();
	await destination.admin.query("alter table auth.users add column unexpected text");
	await assert.rejects(destination.restoreData(bytes), /schema manifest/);
	await destination.admin.query("alter table auth.users drop column unexpected");
	await destination.admin.query("update private.gateway_session_control set generation=1");
	await assert.rejects(destination.restoreData(bytes), /empty migrated fixture/);
});

test("recovery cannot register a URL, forged fixture or second baseline", async () => {
	let connections = 0;
	await assert.rejects(createFixtureRecovery("postgres://remote.example/database"), /startDatabase-owned/);
	await assert.rejects(createFixtureRecovery({ connect: () => { connections++; } }), /startDatabase-owned/);
	await assert.rejects(createFixtureRecovery({ ...source }), /startDatabase-owned/);
	await assert.rejects(createFixtureRecovery(source), /already initialized/);
	assert.equal(connections,0);
});

test("an export uses one snapshot while other connections publish later rows", async () => {
	const blocker = await source.connect();
	let pending;
	try {
		await blocker.query("begin; lock auth.sessions in access exclusive mode");
		pending = source.dumpData();
		const timeout = Date.now()+3000;
		let waiting = false;
		while (Date.now()<timeout) {
			waiting = (await source.admin.query(`select 1 from pg_stat_activity
				where wait_event_type='Lock' and query like '%row_to_json%auth%sessions%'`)).rowCount>0;
			if (waiting) break;
			await new Promise(resolve => setTimeout(resolve,5));
		}
		assert.equal(waiting,true,"Export did not reach the blocked table");
		const section = randomUUID();
		await source.admin.query("select public.publish_section($1,$2,0,'הגדרה לבדיקה.',null)",[section,section]);
		await blocker.query("commit");
		const snapshot = unpack(await pending);
		assert.deepEqual(snapshot.relations.find(relation => relation.schema === "public" && relation.name === "learning_sections").rows,[]);
		const current = unpack(await source.dumpData());
		assert.equal(current.relations.find(relation => relation.schema === "public" && relation.name === "learning_sections").rows.length,1);
	} finally {
		await blocker.query("rollback");
		await pending;
		await blocker.end();
	}
});

test("fixture cleanup closes connections and removes its files after failed recovery", async () => {
	const destination = await startDatabase();
	const client = await destination.connect();
	const directory = path.dirname((await client.query("show data_directory")).rows[0].data_directory);
	await assert.rejects(async () => {
		try { await destination.restoreData(new TextEncoder().encode("broken")); }
		finally { await destination.close(); }
	});
	await assert.rejects(access(directory), { code: "ENOENT" });
	await assert.rejects(client.query("select 1"));
	await assert.rejects(destination.dumpData(), /closed/);
	await destination.close();
	await assert.rejects(startDatabase("postgres://remote.example/database"), /arguments/);
});

test("both fixture directories and connections close after a synthetic assertion fails", async () => {
	const fixtures = [];
	await assert.rejects(async () => {
		try {
			for (let index=0;index<2;index++) {
				const database = await startDatabase();
				fixtures.push({ database });
				const owned = fixtures.at(-1);
				owned.client = await database.connect();
				owned.directory = path.dirname((await owned.client.query("show data_directory")).rows[0].data_directory);
			}
			await fixtures[1].database.restoreData(await fixtures[0].database.dumpData());
			assert.fail("Synthetic assertion after restoration");
		} finally { await Promise.all(fixtures.map(fixture => fixture.database.close())); }
	}, /Synthetic assertion/);
	for (const fixture of fixtures) {
		await assert.rejects(access(fixture.directory),{ code:"ENOENT" });
		await assert.rejects(fixture.client.query("select 1"));
	}
});

test("the local rehearsal proves learner state, session behavior and separate media bytes", async () => {
	const report = await rehearseLocalRecovery();
	assert.equal(report.scope, "local");
	assert.ok(report.migrations.length > 0);
	assert.ok(report.durationMs > 0);
	for (const check of report.checks) assert.equal(check.passed, true, check.name);
	for (const name of ["access and learner isolation", "history and completions", "withdrawn drafts and unchanged submitted history", "position revisions", "retention cleanup", "atomic corrupt-archive rollback", "stable-key session restoration", "key rotation requires sign-in", "invalidated session requires sign-in", "separate private-media copy and hash"]) {
		assert.ok(report.checks.some(check => check.name === name), name);
	}
	assert.doesNotMatch(JSON.stringify(report), /payload|ciphertext|secret|token|password|postgres:\/\//);
});

test("recovery CLI rejects external targets with a nonzero exit and no supplied values", async () => {
	await assert.rejects(execute(process.execPath,["scripts/rehearse-local-recovery.mjs","--url","postgres://private-credential@example.test/database"],{ timeout:5000 }),error => {
		assert.equal(error.code,1);
		assert.equal(error.stdout,"");
		assert.match(error.stderr,/Local recovery rehearsal failed/);
		assert.doesNotMatch(error.stderr,/private-credential|example\.test|postgres:/);
		return true;
	});
});

test("recovery CLI closes allocated fixtures before its failure exit", { timeout:60000 }, async t => {
	const directory = await mkdtemp(path.join(tmpdir(),"oren-recovery-cli-failure-"));
	t.after(() => rm(directory,{ recursive:true,force:true }));
	const preload = path.join(directory,"failure.mjs"), captured = path.join(directory,"captured.json");
	await writeFile(preload,`import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.mkdtemp, directories = [];
fs.mkdtemp = async (...args) => {
 const directory = await original(...args);
 if (directory.includes('oren-database-test-')) {
  directories.push(directory);
  await fs.writeFile(${JSON.stringify(captured)},JSON.stringify(directories));
 }
 return directory;
};
syncBuiltinESMExports();
assert.deepEqual = () => { throw new Error('private synthetic assertion details'); };
`);
	await assert.rejects(execute(process.execPath,["--import",preload,"scripts/rehearse-local-recovery.mjs"],{ timeout:60000 }),error => {
		assert.equal(error.code,1);
		assert.equal(error.stdout,"");
		assert.match(error.stderr,/Local recovery rehearsal failed/);
		assert.doesNotMatch(error.stderr,/private synthetic assertion details/);
		return true;
	});
	const fixtures = JSON.parse(await readFile(captured,"utf8"));
	assert.equal(fixtures.length,2,"the synthetic assertion follows allocation of both actual databases");
	for (const fixture of fixtures) await assert.rejects(access(fixture),{ code:"ENOENT" });
});
