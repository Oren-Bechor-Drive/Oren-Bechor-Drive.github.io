import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir, cpus, totalmem, platform, arch } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setImmediate } from "node:timers/promises";
import { chromium } from "playwright";
import { browserClient } from "../tests/helpers/account-gateway.mjs";
import { testSections, testSectionPath } from "../tests/fixtures/test-sections.mjs";
import { quizAnswers } from "../tests/fixtures/protected-quiz.mjs";
import { createPrivateMedia } from "../server/private-media.mjs";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const network = { offline: false, latency: 20, downloadThroughput: 2_500_000, uploadThroughput: 1_000_000 };
const profiles = [
	{ name: "desktop", viewport: { width: 1440, height: 900 }, cpuSlowdown: 1, isMobile: false },
	{ name: "mobile", viewport: { width: 390, height: 844 }, cpuSlowdown: 4, isMobile: true },
];

// Nearest rank is explicit even for even sample counts and small first runs.
export function summarizeSamples(samples) {
	if (!Array.isArray(samples) || [...samples].some(sample => !Number.isFinite(sample) || sample < 0)) throw new Error("Supply finite nonnegative latency samples");
	const sorted = [...samples].sort((a, b) => a - b);
	const rank = percentile => sorted.length ? sorted[Math.ceil(sorted.length * percentile) - 1] : 0;
	return { count: sorted.length, medianMs: rank(0.5), p95Ms: rank(0.95) };
}

function iterationsFrom(options) {
	if (!options || typeof options !== "object" || Object.getPrototypeOf(options) !== Object.prototype || Object.keys(options).some(key => key !== "iterations")) {
		throw new Error("Local benchmark options accept only iterations; external configuration is rejected");
	}
	const iterations = options.iterations === undefined ? 5 : options.iterations;
	if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 20) throw new Error("Supply iterations from 1 to 20");
	return iterations;
}

function requireStatus(status, expected = 200) {
	if (status !== expected) throw Object.assign(new Error("Unexpected local response status"), { status });
}

async function processSnapshot() {
	try {
		// Read names and numeric resources only, never arguments or environment values.
		const { stdout } = await execute("ps", ["-eo", "pid=,ppid=,rss=,pcpu=,comm="], { maxBuffer: 1_000_000 });
		const rows = stdout.trim().split("\n").map(line => {
			const [pid, parent, rss, cpu, name] = line.trim().split(/\s+/);
			return { pid: Number(pid), parent: Number(parent), rssKiB: Number(rss), cpuPercent: Number(cpu), name };
		});
		const owned = new Set([process.pid]);
		for (let previous = -1; previous !== owned.size;) {
			previous = owned.size;
			for (const row of rows) if (owned.has(row.parent)) owned.add(row.pid);
		}
		const summarize = predicate => {
			const processes = rows.filter(row => owned.has(row.pid) && predicate(row.name));
			return { processes: processes.length, rssKiB: processes.reduce((sum, row) => sum + row.rssKiB, 0),
				cpuPercent: Math.round(processes.reduce((sum, row) => sum + row.cpuPercent, 0) * 100) / 100 };
		};
		return { postgres: summarize(name => name === "postgres"), chromium: summarize(name => /chrome|chromium/.test(name)) };
	} catch { return { available: false, reason: "Local process statistics unavailable" }; }
}

async function recordSyntheticVideo(browser, directory) {
	const page = await browser.newPage();
	try {
		const bytes = await page.evaluate(async () => {
			const canvas = document.createElement("canvas");
			canvas.width = 320; canvas.height = 180;
			const drawing = canvas.getContext("2d");
			const stream = canvas.captureStream(10);
			const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 1_000_000 });
			const chunks = [];
			recorder.ondataavailable = event => chunks.push(event.data);
			const stopped = new Promise(resolve => { recorder.onstop = resolve; });
			recorder.start();
			try {
				for (let frame = 0; frame < 20; frame++) {
					for (let cell = 0; cell < 36; cell++) {
						drawing.fillStyle = `hsl(${(frame * 23 + cell * 29) % 360} 50% 50%)`;
						drawing.fillRect((cell % 8) * 40, Math.floor(cell / 8) * 40, 40, 40);
					}
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			} finally { recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop()); }
			return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
		});
		await writeFile(path.join(directory, "synthetic.webm"), Buffer.from(bytes));
		return bytes.length;
	} finally { await page.close(); }
}

async function browserJSON(page, pathname, body) {
	return page.evaluate(async ({ pathname, body }) => {
		let headers;
		if (body !== undefined) {
			const session = await (await fetch("/api/account/session", { cache: "no-store" })).json();
			headers = { "content-type": "application/json", "x-csrf-token": session.csrf };
		}
		const response = await fetch(pathname, { cache: "no-store", method: body === undefined ? "GET" : "POST", headers,
			...(body === undefined ? {} : { body: JSON.stringify(body) }) });
		return { status: response.status, data: await response.json() };
	}, { pathname, body });
}

export async function runLocalBenchmark(options = {}) {
	if (arguments.length > 1) throw new Error("Local benchmark accepts one options object");
	const iterations = iterationsFrom(options);
	const { startLessonGateway } = await import("../tests/helpers/test-lessons.mjs");
	const checkout = await realpath(root);
	const startedAt = new Date().toISOString();
	const cpuStart = process.cpuUsage();
	const began = performance.now();
	const directory = await mkdtemp(path.join(tmpdir(), "oren-local-benchmark-"));
	let app, browser, deliberatelyLimited = false, admittedRequests = 0;
	const scenarios = new Map();
	const publicResources = new Map();
	function record(name, synthetic, ms, bytes, status = 200, error = false, transferMeasurement = "response-body") {
		if (!scenarios.has(name)) scenarios.set(name, { name, synthetic, samples: [], errorCount: 0, rateLimitedCount: 0,
			transferredBytes: 0, transferMeasurement });
		const result = scenarios.get(name);
		result.transferredBytes += bytes;
		if (status === 429) result.rateLimitedCount++;
		else if (error || status >= 400) result.errorCount++;
		else result.samples.push(Math.round(ms * 100) / 100);
	}
	async function nodeRequest(client, pathname, body) {
		const response = await fetch(app.origin + pathname, {
			method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(15000),
			headers: { cookie: client.cookie, ...(body === undefined ? {} : {
				origin: app.origin, "content-type": "application/json", "x-csrf-token": client.csrf,
			}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		const bytes = Buffer.from(await response.arrayBuffer());
		return { status: response.status, bytes: bytes.length, data: JSON.parse(bytes.toString("utf8")) };
	}
	try {
		let media = await createPrivateMedia({ root: directory, entries: [] });
		app = await startLessonGateway({ quiz: true, longLesson: true, authLimit: 10000,
			requestLimiter: () => {
				const allowed = !deliberatelyLimited && ++admittedRequests <= 10000;
				return { allowed, retryAfterSeconds: allowed ? 0 : 60 };
			},
			media: { lookup: (...args) => media.lookup(...args), forSection: (...args) => media.forSection(...args), send: (...args) => media.send(...args) },
		});
		// All identities, Auth sessions, paid grants and teaching here are disposable fixtures.
		const clients = [];
		for (let index = 0; index < 11; index++) {
			const client = browserClient(app.origin);
			const email = `benchmark-${index}@example.test`;
			requireStatus((await client.request()).response.status);
			requireStatus((await client.request("login", { email, password: "correct-password" })).response.status);
			if (index < 10) await app.grant(email);
			clients.push(client);
		}
		browser = await chromium.launch();
		const mediaBytes = await recordSyntheticVideo(browser, directory);
		const lesson = await nodeRequest(clients[0], testSectionPath("paid"));
		requireStatus(lesson.status);
		media = await createPrivateMedia({ root: directory, entries: [{ id: "benchmark-video", file: "synthetic.webm", type: "video/webm",
			title: "סרטון סינתטי לבדיקה", sectionId: testSections.paid, contentVersionId: lesson.data.lesson.id }] });
		const processBefore = await processSnapshot();
		for (const profile of profiles) {
			const context = await browser.newContext({ viewport: profile.viewport, isMobile: profile.isMobile, hasTouch: profile.isMobile,
				deviceScaleFactor: 1, reducedMotion: "reduce", serviceWorkers: "block" });
			try {
				const page = await context.newPage();
				page.setDefaultTimeout(15000);
				const session = await context.newCDPSession(page);
				await session.send("Network.enable");
				await session.send("Network.setBlockedURLs", { urlPatterns: [
					{ urlPattern: app.origin + "/*", block: false }, { urlPattern: "http://*/*", block: true }, { urlPattern: "https://*/*", block: true },
				] });
				await session.send("Network.emulateNetworkConditions", network);
				await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdown });
				let active;
				const requests = new Map();
				session.on("Network.requestWillBeSent", event => requests.set(event.requestId, event.request.url));
				session.on("Network.responseReceived", ({ response }) => {
					if (active && response.status === 429) active.rateLimited = true;
					else if (active && response.status >= 400) active.failed = true;
				});
				session.on("Network.loadingFailed", ({ canceled }) => { if (active && !canceled) active.failed = true; });
				page.on("pageerror", () => { if (active) active.failed = true; });
				session.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
					if (active) {
						active.bytes += encodedDataLength;
						const url = requests.get(requestId);
						if (url) {
							const pathname = new URL(url).pathname;
							if (/^\/(assets|css|js|course)\//.test(pathname)) {
								const key = profile.name + ":" + pathname;
								const old = publicResources.get(key) ?? { profile: profile.name, path: pathname, maxEncodedBytes: 0 };
								old.maxEncodedBytes = Math.max(old.maxEncodedBytes, encodedDataLength);
								publicResources.set(key, old);
							}
						}
					}
					requests.delete(requestId);
				});
				async function measure(name, synthetic, action) {
					active = { bytes: 0, failed: false, rateLimited: false };
					const start = performance.now();
					let value;
					try { value = await action(); } catch (error) {
						active.failed = true;
						if (error.status === 429) active.rateLimited = true;
					}
					const elapsed = performance.now() - start;
					await setImmediate();
					record(profile.name + "/" + name, synthetic, elapsed, active.bytes, active.rateLimited ? 429 : 200, active.failed, "CDP-encoded-data");
					active = undefined;
					return value;
				}
				async function load(pathname, ready) {
					const response = await page.goto(app.origin + pathname, { waitUntil: "load" });
					requireStatus(response.status());
					await ready();
					await page.evaluate(() => document.fonts.ready);
				}
				for (const [name, pathname, selector] of [
					["homepage", "/", "main h1"], ["course", "/course/", ".library-topics"],
					["public-quiz", "/course/right-of-way/quiz/", "form[data-quiz-graded]"],
				]) {
					const ready = () => page.locator(selector).first().waitFor({ state: "visible" });
					for (let index = 0; index < iterations; index++) {
						await session.send("Network.clearBrowserCache");
						await measure(name + "/cold", false, () => load(pathname, ready));
						await measure(name + "/warm", false, () => load(pathname, ready));
					}
				}
				for (const access of ["free", "paid"]) {
					const client = clients[access === "free" ? 10 : 0];
					const [name, value] = client.cookie.split("=");
					await context.addCookies([{ name, value, url: app.origin, httpOnly: true, sameSite: "Lax" }]);
					for (let index = 0; index < iterations; index++) {
						await measure("reader/" + access, true, () => load(`/account/reader.html?section=${testSections[access]}&access=${access}`,
							() => page.locator("[data-reading]").waitFor({ state: "visible" })));
					}
				}
				for (let index = 0; index < iterations; index++) {
					const current = await browserJSON(page, testSectionPath("paid"));
					requireStatus(current.status);
					await measure("position/save", true, async () => {
						const saved = await browserJSON(page, testSectionPath("paid") + "/position", {
							contentVersionId: current.data.lesson.id, expectedRevision: current.data.position?.revision ?? 0, position: (index + 1) * 100,
						});
						requireStatus(saved.status);
						if (saved.data.position?.position !== (index + 1) * 100) throw new Error("Synthetic position was not saved");
					});
					const draft = await browserJSON(page, "/api/quizzes/synthetic-topic/start", {});
					requireStatus(draft.status);
					const saved = await measure("quiz/save", true, async () => {
						const result = await browserJSON(page, `/api/attempts/${draft.data.id}/save`, { answers: quizAnswers(), expectedRevision: draft.data.revision });
						requireStatus(result.status);
						return result.data;
					});
					await measure("quiz/submit", true, async () => {
						if (!saved) throw new Error("No saved synthetic attempt");
						const result = await browserJSON(page, `/api/attempts/${saved.id}/submit`, { expectedRevision: saved.revision });
						requireStatus(result.status);
						if (result.data.status !== "submitted" || result.data.score !== 20) throw new Error("Synthetic grading did not complete");
					});
				}
				for (let index = 0; index < iterations; index++) {
					await measure("private-media/range-and-playback", true, async () => {
						await page.evaluate(async size => {
							for (const range of [`bytes=0-${Math.min(size - 1, 16383)}`, `bytes=${Math.max(0, size - 16384)}-${size - 1}`]) {
								const response = await fetch("/api/media/benchmark-video", { headers: { range }, cache: "no-store" });
								if (response.status !== 206 || !response.headers.get("content-range")?.endsWith("/" + size)) throw new Error("Invalid synthetic media range");
								await response.arrayBuffer();
							}
						const video = document.createElement("video");
						video.muted = true; video.src = "/api/media/benchmark-video";
						document.body.append(video);
						async function bounded(promise) {
							let timeout;
							try { return await Promise.race([promise, new Promise((resolve, reject) => {
								timeout = setTimeout(() => reject(new Error("Synthetic video did not become ready")), 15000);
							})]); }
							finally { clearTimeout(timeout); }
						}
						try {
							await bounded(new Promise((resolve, reject) => {
								video.onloadeddata = resolve; video.onerror = () => reject(new Error("Synthetic video decoding failed"));
							}));
							video.currentTime = 0.5;
							const frame = new Promise(resolve => video.requestVideoFrameCallback(resolve));
							await bounded(video.play()); await bounded(frame); video.pause();
								if (video.currentTime < 0.5) throw new Error("Synthetic video seeking failed");
							} finally { video.removeAttribute("src"); video.load(); video.remove(); }
						}, mediaBytes);
					});
				}
			} finally { await context.close(); }
		}
		for (const concurrency of [1, 5, 10]) {
			const name = `gateway/read-paid/concurrency-${concurrency}`;
			const phaseStart = performance.now();
			for (let round = 0; round < iterations; round++) await Promise.all(clients.slice(0, concurrency).map(async client => {
				const start = performance.now();
				try {
					const response = await nodeRequest(client, testSectionPath("paid"));
					record(name, true, performance.now() - start, response.bytes, response.status);
				} catch { record(name, true, 0, 0, 200, true); }
			}));
			scenarios.get(name).elapsedMs = Math.round((performance.now() - phaseStart) * 100) / 100;
		}
		deliberatelyLimited = true;
		try {
			for (let index = 0; index < iterations; index++) {
				const start = performance.now();
				const response = await nodeRequest(clients[0], "/api/learning");
				requireStatus(response.status, 429);
				record("gateway/deliberate-rate-limit", true, performance.now() - start, response.bytes, response.status);
			}
		} finally { deliberatelyLimited = false; }
		const cpu = process.cpuUsage(cpuStart);
		const memory = process.memoryUsage();
		const revision = (await execute("git", ["rev-parse", "HEAD"], { cwd: checkout })).stdout.trim();
		const dirty = Boolean((await execute("git", ["status", "--porcelain"], { cwd: checkout })).stdout.trim());
		return { scope: "local", checkout, revision, workingTreeDirty: dirty, startedAt, iterations,
			environment: { node: process.version, browser: "Chromium " + browser.version(), viewport: profiles[0].viewport,
				network: "CDP loopback: 20 ms latency, 20 Mbps download, 8 Mbps upload", cpuSlowdown: profiles[0].cpuSlowdown,
				profiles: profiles.map(({ name, viewport, cpuSlowdown }) => ({ name, viewport, cpuSlowdown })), deviceScaleFactor: 1, reducedMotion: "reduce" },
			scenarios: [...scenarios.values()].map(({ samples, ...scenario }) => ({ ...scenario, ...summarizeSamples(samples),
				attemptedCount: samples.length + scenario.errorCount + scenario.rateLimitedCount,
				...(scenario.elapsedMs ? { requestsPerSecond: Math.round(samples.length / (scenario.elapsedMs / 1000) * 100) / 100 } : {}) })),
			resources: { platform: platform(), architecture: arch(), logicalCPUs: cpus().length, totalMemoryBytes: totalmem(),
				nodeRssBytes: memory.rss, nodeHeapUsedBytes: memory.heapUsed, nodeMaxRssKiB: process.resourceUsage().maxRSS,
				nodeUserCpuMs: cpu.user / 1000, nodeSystemCpuMs: cpu.system / 1000, totalElapsedMs: Math.round(performance.now() - began),
				processBefore, processAfter: await processSnapshot(), syntheticVideoBytes: mediaBytes },
			largestPublicResources: [...publicResources.values()].sort((a, b) => b.maxEncodedBytes - a.maxEncodedBytes).slice(0, 12),
			limitations: ["Synthetic local Auth, grants, PostgreSQL and video only", "Node capacity requests use native loopback without browser throttling",
				"CDP bytes include encoded HTTP delivery; Node bytes count response bodies", "Small nearest-rank percentiles are not a load-test capacity forecast",
				"Resources include setup; process CPU percentages are lifetime snapshots, and RSS sums can share pages",
				"No hosted provider quotas, real-media egress, physical phone or screen-reader evidence"] };
	} finally {
		// Close all owners even if an earlier cleanup operation itself fails.
		try { await browser?.close(); }
		finally { try { await app?.close(); } finally { await rm(directory, { recursive: true, force: true }); } }
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const args = process.argv.slice(2);
	try {
		if (args.length && (args.length !== 2 || args[0] !== "--iterations" || !/^\d+$/.test(args[1]))) {
			throw new Error("Local benchmark accepts only --iterations from 1 to 20");
		}
		const report = await runLocalBenchmark(args.length ? { iterations: Number(args[1]) } : {});
		await new Promise(resolve => process.stdout.write(JSON.stringify(report, null, 2) + "\n", resolve));
		// Embedded PostgreSQL's exit hook otherwise forces natural beforeExit to 0.
		process.exit(report.scenarios.some(scenario => scenario.errorCount) ? 1 : 0);
	} catch {
		await new Promise(resolve => process.stderr.write("Local benchmark failed. Accepts only --iterations from 1 to 20; check local PostgreSQL/Chromium dependencies.\n", resolve));
		process.exit(1);
	}
}
