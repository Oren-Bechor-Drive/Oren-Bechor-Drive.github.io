import assert from "node:assert/strict";
import test from "node:test";
import { createDiagnostics } from "../../server/diagnostics.mjs";
import { accountProvider, browserClient, startAccountGateway } from "../helpers/account-gateway.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("diagnostics whitelist fields and ignore arbitrary private data and caller counts", () => {
	const lines = [];
	const diagnostics = createDiagnostics({ write: line => lines.push(line) });
	diagnostics.emit({ category: "configuration", operation: "startup", status: 503, field: "APP_ORIGIN", reason: "missing",
		token: "do-not-log", message: "private learner text", count: 9000 });
	assert.deepEqual(JSON.parse(lines[0]), { category: "configuration", operation: "startup", status: 503, field: "APP_ORIGIN", reason: "missing" });
	assert.doesNotMatch(lines.join("\n"), /do-not-log|private learner|9000/);
	for (const input of [{ category: "secret", operation: "account", status: 503 }, { category: "dependency", operation: "/private/path", status: 503 }, { category: "dependency", operation: "account", status: "503" }]) diagnostics.emit(input);
	assert.equal(lines.length, 1);
});

test("registration configuration diagnostics name fields while discarding tester and mode values", () => {
	const lines = [];
	const diagnostics = createDiagnostics({ write: line => lines.push(JSON.parse(line)) });
	for (const field of ["REGISTRATION_MODE", "PILOT_EMAILS"]) {
		diagnostics.emit({ category: "configuration", operation: "startup", status: 503, field, reason: "invalid",
			value: "private-tester@example.test", testers: ["private-tester@example.test"], message: "private invalid mode", stack: "private stack" });
	}
	assert.deepEqual(lines, ["REGISTRATION_MODE", "PILOT_EMAILS"].map(field =>
		({ category: "configuration", operation: "startup", status: 503, field, reason: "invalid" })));
	assert.doesNotMatch(JSON.stringify(lines), /private|@|testers|value|message|stack/);
});

test("duplicate suppression reports only internally counted events after the window", () => {
	let time = 0;
	const lines = [];
	const diagnostics = createDiagnostics({ write: line => lines.push(JSON.parse(line)), now: () => time });
	const event = { category: "dependency", operation: "account", status: 503 };
	diagnostics.emit(event);
	for (let i = 0; i < 3; i++) { time += 10_000; diagnostics.emit({ ...event, count: 1000 }); }
	assert.equal(lines.length, 1);
	time = 60_000; diagnostics.emit(event);
	assert.deepEqual(lines[1], { ...event, count: 4 });
	time = 120_000; diagnostics.emit(event);
	assert.deepEqual(lines[2], event);
	assert.doesNotThrow(() => createDiagnostics({ write: () => { throw new Error("secret"); } }).emit(event));
});

test("distinct response statuses have separate suppression counts", () => {
	let time = 0;
	const lines = [];
	const diagnostics = createDiagnostics({ write: line => lines.push(JSON.parse(line)), now: () => time });
	const event = { category: "dependency", operation: "account" };
	diagnostics.emit({ ...event, status: 500 });
	diagnostics.emit({ ...event, status: 503 });
	diagnostics.emit({ ...event, status: 500 });
	assert.deepEqual(lines, [{ ...event, status: 500 }, { ...event, status: 503 }]);
	time = 60_000;
	diagnostics.emit({ ...event, status: 503 });
	diagnostics.emit({ ...event, status: 500 });
	assert.deepEqual(lines.slice(2), [{ ...event, status: 503 }, { ...event, status: 500, count: 2 }]);
});

test("local startup failure reports safe configuration without values or stacks", async () => {
	const run = promisify(execFile);
	await assert.rejects(run(process.execPath, ["server/start.mjs"], { env: { PATH: process.env.PATH, APP_ORIGIN: "private invalid origin", SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", SUPABASE_SECRET_KEY: "sb_secret_synthetic" } }), error => {
		assert.equal(error.code, 1);
		assert.deepEqual(JSON.parse(error.stderr.split("\n")[0]), { category: "configuration", operation: "startup", status: 503, field: "APP_ORIGIN", reason: "invalid" });
		assert.doesNotMatch(error.stderr, /private|sb_secret|sb_publishable| at /);
		return true;
	});
});

test("gateway dependency categories preserve generic responses and public availability", async t => {
	for (const operation of ["account", "learning", "position", "media", "rate_limit", "unexpected"]) {
		const lines = [];
		const diagnostics = createDiagnostics({ write: line => lines.push(JSON.parse(line)) });
		const provider = accountProvider();
		const failure = () => { throw Object.assign(new Error("private token learner body"), { status: 503 }); };
		const media = { lookup: () => ({ id: "opaque", sectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", contentVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), send: failure };
		provider.readSection = async () => ({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
		const app = await startAccountGateway({ provider, media, diagnostics });
		t.after(app.close);
		const client = browserClient(app.origin);
		await client.request();
		await client.request("login", { email: "learner@example.test", password: "correct-password" });
		let path = "/api/account/session", body;
		if (operation === "account") provider.identity = failure;
		if (operation === "unexpected") { provider.myLearning = () => { throw new Error("private stack"); }; path = "/api/learning"; }
		if (operation === "learning") { provider.myLearning = failure; path = "/api/learning"; }
		if (operation === "position") {
			provider.savePosition = failure;
			path = "/api/sections/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/free/position";
			body = { contentVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", position: 20, expectedRevision: 0 };
		}
		if (operation === "media") path = "/api/media/opaque";
		if (operation === "rate_limit") provider.identity = failure;
		// A persistent limit failure is exercised through its injected production seam.
		const limited = operation === "rate_limit" ? await startAccountGateway({ diagnostics, requestLimiter: failure }) : app;
		if (limited !== app) t.after(limited.close);
		const response = await fetch(limited.origin + path, {
			method: body === undefined ? "GET" : "POST", headers: { cookie: client.cookie, origin: limited.origin, "content-type": "application/json", "x-csrf-token": client.csrf },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		const result = { response, data: await response.json() };
		assert.equal(result.response.status, 503, operation);
		assert.deepEqual(result.data, { error: "unavailable" });
		assert.equal((await fetch(app.origin + "/")).status, 200);
		assert.deepEqual(lines.at(-1), { category: operation === "unexpected" ? "unexpected" : "dependency", operation: operation === "unexpected" ? "learning" : operation, status: 503 });
		assert.doesNotMatch(JSON.stringify(lines), /private|token|learner|opaque|aaaa/);
	}
});
