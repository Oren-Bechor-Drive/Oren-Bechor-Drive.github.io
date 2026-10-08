import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkLocalPilotReadiness } from "../../scripts/check-pilot-readiness.mjs";

const execute = promisify(execFile);
const dependencies = ["instructor approval", "real media and rights", "contact and support",
	"privacy and deletion decisions", "hosted provider configuration", "backup and alert ownership",
	"authorized deployment", "owner/Oren pilot", "physical-device and screen-reader checks"];

test("the real local readiness report retains hosted gates without revealing synthetic identities or keys", { timeout: 60000 }, async t => {
	const original = globalThis.fetch;
	t.mock.method(globalThis, "fetch", (input, ...args) => {
		assert.equal(new URL(input).hostname, "127.0.0.1", "all requests stay on the owned loopback gateway");
		return original(input, ...args);
	});
	const report = await checkLocalPilotReadiness();
	assert.equal(report.scope, "local");
	assert.match(report.checkout, /^[0-9a-f]{40}$/);
	assert.ok(report.migrations.includes("20261008134150_protected_quiz_withdrawal.sql"));
	assert.deepEqual(report.migrations, [...report.migrations].sort());
	assert.deepEqual(report.externalDependencies, dependencies);
	assert.ok(report.checks.length >= 9);
	assert.ok(report.checks.every(check => check.passed), JSON.stringify(report.checks));
	assert.ok(report.checks.some(check => /defaults/.test(check.name)));
	assert.ok(report.checks.some(check => /withdrawal/.test(check.name)));
	assert.ok(report.checks.some(check => /captions/.test(check.name)));
	assert.doesNotMatch(JSON.stringify(report), /@example\.test|SESSION_SECRET|access-\d|refresh-\d|csrf|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});

test("the check accepts no externally supplied target or configuration", async () => {
	for (const target of [{ url: "https://secret-token@example.test" }, { origin: "http://127.0.0.1:99" }, null, "--hosted"]) {
		await assert.rejects(checkLocalPilotReadiness(target), /no arguments/i);
	}
});

test("unsupported CLI targets fail without echoing credentials or starting a check", async () => {
	for (const args of [[], ["--hosted"], ["--deploy"], ["--local", "--url", "https://secret-token@example.test"],
		["--local", "--credentials=private-key"], ["--local", "--local"]]) {
		await assert.rejects(execute(process.execPath, ["scripts/check-pilot-readiness.mjs", ...args], { timeout: 5000 }), error => {
			assert.equal(error.code, 1);
			assert.equal(error.stdout, "");
			assert.match(error.stderr, /only --local/);
			assert.doesNotMatch(error.stderr, /secret-token|example\.test|private-key/);
			return true;
		});
	}
});

test("CLI success ignores environment targets and keeps a local-only sanitized report", { timeout: 60000 }, async () => {
	const { stdout, stderr } = await execute(process.execPath, ["scripts/check-pilot-readiness.mjs", "--local"], {
		timeout: 60000, env: { ...process.env, APP_ORIGIN: "https://secret-origin.example.test",
			SUPABASE_URL: "https://secret-project.example.test", SUPABASE_SECRET_KEY: "private-environment-key",
			SESSION_SECRET: "private-session-key", REGISTRATION_MODE: "public", GOOGLE_AUTH_ENABLED: "true" },
	});
	const report = JSON.parse(stdout);
	assert.equal(report.scope, "local");
	assert.ok(report.checks.every(check => check.passed));
	assert.deepEqual(report.externalDependencies, dependencies);
	assert.equal(stderr, "");
	assert.doesNotMatch(stdout, /secret-origin|secret-project|private-environment-key|private-session-key/);
});

test("an actual local HTTP failure is reported safely and closes owned resources", { timeout: 60000 }, async t => {
	const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith("oren-pilot-readiness-")));
	const original = globalThis.fetch;
	let origin;
	t.mock.method(globalThis, "fetch", async (input, ...args) => {
		const url = new URL(input);
		if (url.pathname === "/api/sections/a524e32d-2640-4d94-a51c-000000000001/free") {
			origin = url.origin;
			return new Response("private synthetic diagnostic", { status: 503 });
		}
		return original(input, ...args);
	});
	const report = await checkLocalPilotReadiness();
	assert.ok(origin, "the failure occurred after a real owned gateway was allocated");
	assert.ok(report.checks.some(check => !check.passed));
	assert.deepEqual(report.externalDependencies, dependencies);
	assert.doesNotMatch(JSON.stringify(report), /private synthetic diagnostic|@example\.test/);
	await assert.rejects(original(origin + "/api/account/session"));
	assert.deepEqual((await readdir(tmpdir())).filter(name => name.startsWith("oren-pilot-readiness-") && !before.has(name)), []);
});

test("CLI returns a nonzero exit for a confirmed local check failure and retains unresolved gates", { timeout: 60000 }, async t => {
	const directory = await mkdtemp(path.join(tmpdir(), "oren-pilot-cli-failure-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const preload = path.join(directory, "failure.mjs");
	await writeFile(preload, `const original = globalThis.fetch;
globalThis.fetch = (input, ...args) => new URL(input).pathname.endsWith('/free')
 ? Promise.resolve(new Response('private failure details', { status: 503 })) : original(input, ...args);
`);
	await assert.rejects(execute(process.execPath, ["--import", preload, "scripts/check-pilot-readiness.mjs", "--local"], { timeout: 60000 }), error => {
		assert.equal(error.code, 1);
		const report = JSON.parse(error.stdout);
		assert.equal(report.scope, "local");
		assert.ok(report.checks.some(check => !check.passed));
		assert.deepEqual(report.externalDependencies, dependencies);
		assert.match(error.stderr, /Local pilot readiness checks failed/);
		assert.doesNotMatch(error.stdout + error.stderr, /private failure details|@example\.test/);
		return true;
	});
});
