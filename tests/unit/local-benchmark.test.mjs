import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { runLocalBenchmark, summarizeSamples } from "../../scripts/benchmark-local.mjs";

const execute = promisify(execFile);

test("sample summaries use sorted nearest-rank percentiles without changing input", () => {
	const samples = [50, 10, 40, 20, 30];
	assert.deepEqual(summarizeSamples(samples), { count: 5, medianMs: 30, p95Ms: 50 });
	assert.deepEqual(samples, [50, 10, 40, 20, 30]);
	assert.deepEqual(summarizeSamples([40, 10, 30, 20]), { count: 4, medianMs: 20, p95Ms: 40 });
	assert.deepEqual(summarizeSamples([7]), { count: 1, medianMs: 7, p95Ms: 7 });
	assert.deepEqual(summarizeSamples([]), { count: 0, medianMs: 0, p95Ms: 0 });
	for (const invalid of [[NaN], [Infinity], [-1], ["10"], Array(1), null]) assert.throws(() => summarizeSamples(invalid));
});

test("the benchmark rejects remote configuration and invalid iteration bounds before starting fixtures", async () => {
	for (const options of [{ url: "https://example.test" }, { origin: "http://127.0.0.1:99" }, { iterations: 0 },
		{ iterations: 21 }, { iterations: 1.5 }, { iterations: NaN }, { iterations: null }, null, [], new URL("https://example.test")]) {
		await assert.rejects(runLocalBenchmark(options), /iterations|local|options/i);
	}
});

test("unsupported CLI targets fail without echoing supplied credentials", async () => {
	for (const args of [["--url", "https://secret-token@example.test"], ["--iterations", "0"], ["--deploy"], ["--iterations=1"]]) {
		await assert.rejects(execute(process.execPath, ["scripts/benchmark-local.mjs", ...args], { timeout: 5000 }), error => {
			assert.equal(error.code, 1);
			assert.equal(error.stdout, "");
			assert.doesNotMatch(error.stderr, /secret-token|example\.test/);
			assert.match(error.stderr, /local|iterations/i);
			return true;
		});
	}
});

test("an allocated browser and owned gateway close when later browser setup fails", { timeout: 60000 }, async t => {
	const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith("oren-local-benchmark-")));
	const fetch = globalThis.fetch;
	let origin, browser;
	t.mock.method(globalThis, "fetch", async (url, ...args) => {
		const address = new URL(url);
		if (address.hostname === "127.0.0.1" && address.pathname.startsWith("/api/")) origin = address.origin;
		return fetch(url, ...args);
	});
	const launch = chromium.launch.bind(chromium);
	t.mock.method(chromium, "launch", async (...args) => {
		browser = await launch(...args);
		const newContext = browser.newContext.bind(browser);
		t.mock.method(browser, "newContext", async (...settings) => {
			if (origin) throw new Error("synthetic browser context failure");
			return newContext(...settings);
		});
		return browser;
	});
	await assert.rejects(runLocalBenchmark({ iterations: 1 }), /synthetic browser context failure/);
	assert.ok(origin, "a real owned loopback gateway was allocated before the failure");
	assert.equal(browser.isConnected(), false);
	await assert.rejects(fetch(origin + "/api/account/session"));
	const after = (await readdir(tmpdir())).filter(name => name.startsWith("oren-local-benchmark-") && !before.has(name));
	assert.deepEqual(after, [], "temporary media roots are removed after a failed scenario");
});

test("a measured local report counts successful samples separately from deliberate rate limits", { timeout: 180000 }, async () => {
	const report = await runLocalBenchmark({ iterations: 1 });
	assert.equal(report.scope, "local");
	assert.ok(report.environment.browser);
	assert.ok(report.scenarios.every(scenario => scenario.errorCount === 0), "every measured local journey succeeds");
	assert.ok(report.scenarios.filter(scenario => scenario.name !== "gateway/deliberate-rate-limit")
		.every(scenario => scenario.count > 0 && scenario.rateLimitedCount === 0), "ordinary measurements have successful samples");
	for (const name of ["desktop/homepage/cold", "mobile/public-quiz/warm", "desktop/reader/free", "mobile/reader/paid",
		"desktop/position/save", "mobile/quiz/submit", "desktop/private-media/range-and-playback", "gateway/read-paid/concurrency-10"]) {
		const scenario = report.scenarios.find(item => item.name === name);
		assert.ok(scenario, name);
		assert.equal(scenario.errorCount, 0, name);
		assert.ok(scenario.count > 0, name);
		assert.ok(scenario.transferredBytes > 0, name);
	}
	const limited = report.scenarios.find(item => item.name === "gateway/deliberate-rate-limit");
	assert.equal(limited.count, 0);
	assert.equal(limited.medianMs, 0);
	assert.equal(limited.p95Ms, 0);
	assert.equal(limited.errorCount, 0);
	assert.equal(limited.rateLimitedCount, 1);
	assert.ok(report.scenarios.every(item => Number.isFinite(item.p95Ms) && item.p95Ms >= item.medianMs));
	assert.doesNotMatch(JSON.stringify(report), /correct-password|access-[0-9]|oren_session=|@example\.test/);
});
