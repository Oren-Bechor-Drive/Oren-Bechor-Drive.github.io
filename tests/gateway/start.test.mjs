import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const start = new URL("../../server/start.mjs", import.meta.url);

test("local startup rejects origins that its plain HTTP loopback listener cannot serve", async () => {
	for (const origin of ["https://localhost:0", "https://site.example:0", "http://[::1]:0"]) {
		await assert.rejects(execute(process.execPath, [start.pathname], {
			env: { APP_ORIGIN: origin }, timeout: 1500,
		}), error => error.code === 1 && /APP_ORIGIN must be an exact HTTP origin on localhost or 127\.0\.0\.1/.test(error.stderr), origin);
	}
});

test("local startup refuses production and plaintext provider credentials", async () => {
	await assert.rejects(execute(process.execPath, [start.pathname], {
		env: { NODE_ENV: "production" }, timeout: 1500,
	}), error => error.code === 1 && /persistent session storage/.test(error.stderr));
	await assert.rejects(execute(process.execPath, [start.pathname], {
		env: { SUPABASE_URL: "http://localhost:54321", SUPABASE_PUBLISHABLE_KEY: "test-public", SUPABASE_SECRET_KEY: "test-secret" }, timeout: 1500,
	}), error => error.code === 1 && /SUPABASE_URL must use HTTPS/.test(error.stderr));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
	test(`actual launcher serves the resolved local address and exits on ${signal}`, { timeout: 5000 }, async t => {
		const child = spawn(process.execPath, [start.pathname], {
			env: { APP_ORIGIN: "http://127.0.0.1:0" }, stdio: ["ignore", "pipe", "pipe"],
		});
		t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
		const exited = once(child, "exit");
		let output = "", errors = "";
		child.stderr.on("data", data => { errors += data; });
		const origin = await new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("exit", code => reject(new Error(`Launcher exited ${code}: ${errors}`)));
			child.stdout.on("data", data => {
				output += data;
				const match = output.match(/Local site: (http:\/\/[^/]+)\/account\/login\.html/);
				if (match) resolve(match[1]);
			});
		});
		assert.notEqual(new URL(origin).port, "0");
		const page = await fetch(`${origin}/account/login.html`);
		assert.equal(page.status, 200);
		await page.text();
		const session = await fetch(`${origin}/api/account/session`);
		assert.equal(session.status, 200);
		assert.equal((await session.json()).available, false);
		child.kill(signal);
		assert.deepEqual(await exited, [0, null]);
		assert.equal(errors, "");
	});
}
