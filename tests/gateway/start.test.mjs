import assert from "node:assert/strict";
import { execFile } from "node:child_process";
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
