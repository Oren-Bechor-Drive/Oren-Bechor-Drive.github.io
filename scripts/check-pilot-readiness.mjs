import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createProductionGatewayOptions } from "../server/production.mjs";
import { createPrivateMedia } from "../server/private-media.mjs";
import { publicDirectories, publicTopFiles, publicTypes } from "../server/public-files.mjs";
import { subscriptionOffer } from "../server/subscription-offer.mjs";
import { packageWorkerAssets } from "./package-worker.mjs";
import { startLessonGateway } from "../tests/helpers/test-lessons.mjs";
import { browserClient } from "../tests/helpers/account-gateway.mjs";
import { testSectionPath, testSections } from "../tests/fixtures/test-sections.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
const externalDependencies = ["instructor approval", "real media and rights", "contact and support",
	"privacy and deletion decisions", "hosted provider configuration", "backup and alert ownership",
	"authorized deployment", "owner/Oren pilot", "physical-device and screen-reader checks"];

// No environment target, credentials, output destination or configurable fixture
// enters this command. All HTTP requests use the gateway allocated below.
export async function checkLocalPilotReadiness() {
	if (arguments.length) throw new Error("Local pilot readiness accepts no arguments or external configuration.");
	const { stdout } = await execute("git", ["-C", root, "rev-parse", "HEAD"], { env: { PATH: process.env.PATH } });
	const checkout = stdout.trim();
	assert.match(checkout, /^[0-9a-f]{40}$/);
	const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(file => file.endsWith(".sql")).sort();
	const report = { scope: "local", checkout, migrations, checks: [], externalDependencies: [...externalDependencies] };
	async function check(name, operation) {
		let passed = false;
		try { await operation(); passed = true; } catch { /* Only a fixed label and boolean leave the fixture. */ }
		report.checks.push({ name, passed });
		return passed;
	}
	const temporary = await mkdtemp(path.join(tmpdir(), "oren-pilot-readiness-"));
	let app, media, owner, other, paidLesson;
	const email = "pilot-readiness@example.test", otherEmail = "pilot-readiness-other@example.test";
	const captions = "WEBVTT\n\n00:00.000 --> 00:01.000\nכתוביות סינתטיות לבדיקה.\n";
	const transcript = "תמלול סינתטי לבדיקה. אין כאן חומר הוראה מאושר.";
	async function request(client, pathname, { body, status = 200, method = body === undefined ? "GET" : "POST", headers = {} } = {}) {
		const response = await fetch(app.origin + pathname, { method,
			headers: { ...(client ? { cookie: client.cookie, "x-csrf-token": client.csrf } : {}),
				origin: app.origin, "content-type": "application/json", ...headers },
			...(body === undefined ? {} : { body: JSON.stringify(body) }) });
		assert.equal(response.status, status);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		return response;
	}
	const json = async (...args) => (await request(...args)).json();
	async function login(address) {
		const client = browserClient(app.origin);
		assert.equal((await client.request()).response.status, 200);
		assert.equal((await client.request("login", { email: address, password: "correct-password" })).response.status, 200);
		return client;
	}
	try {
		await check("checked-in closed admission, disabled Google and disabled billing defaults", async () => {
			const configuration = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
			assert.equal(configuration.vars.REGISTRATION_MODE, "closed");
			assert.equal(configuration.vars.GOOGLE_AUTH_ENABLED, "false");
			assert.equal(configuration.workers_dev, false);
			assert.equal(configuration.preview_urls, false);
			assert.ok(!configuration.routes?.length);
			const synthetic = { APP_ORIGIN: "https://pilot.example.invalid", SUPABASE_URL: "https://provider.example.invalid",
				SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-only", SUPABASE_SECRET_KEY: "synthetic-secret-only",
				SESSION_SECRET: randomBytes(32).toString("base64") };
			const options = createProductionGatewayOptions(synthetic, { fetchImpl: () => { throw new Error("Hosted requests are disabled"); } });
			assert.equal(options.admit(email), false);
			assert.equal(options.googleEnabled, false);
			assert.equal(options.media, null);
			assert.equal(subscriptionOffer.checkoutAvailable, false);
			assert.throws(() => createProductionGatewayOptions({ ...synthetic, SESSION_SECRET: "invalid" }));
			assert.throws(() => createProductionGatewayOptions({ ...synthetic, REGISTRATION_MODE: "public" }));
		});
		await check("actual Worker package and public-file allowlist", async () => {
			const { output, files } = await packageWorkerAssets({ root, output: path.join(temporary, "checkout-public") });
			assert.ok(files.includes("index.html"));
			assert.ok(files.includes("account/learning.js"));
			for (const file of files) {
				assert.ok(publicTopFiles.includes(file) || publicDirectories.some(directory => file.startsWith(directory + "/")));
				assert.ok(publicTypes[path.extname(file)]);
				assert.ok(!file.split("/").some(part => part.startsWith(".")));
			}
			assert.deepEqual(await readFile(path.join(output, "index.html")), await readFile(path.join(root, "index.html")));
			assert.match(await readFile(path.join(output, "_headers"), "utf8"), /X-Content-Type-Options: nosniff/);
			for (const file of ["server/worker.mjs", "supabase/development/test-lessons.sql", "tests/fixtures/protected-quiz.mjs", ".env.hosted.local", "docs/OPERATIONS.md"]) {
				await assert.rejects(readFile(path.join(output, file)), { code: "ENOENT" });
			}
		});
		await check("package exclusion of owned private media and draft teaching fixtures", async () => {
			const source = path.join(temporary, "package-source"), output = path.join(temporary, "fixture-public");
			await mkdir(source);
			await writeFile(path.join(source, "index.html"), '<!doctype html><html lang="he" dir="rtl"><title>בדיקת אריזה</title></html>');
			const excluded = [".env.hosted.local", "drafts/unsafe-quiz.html", "docs/draft-lesson.html", "tests/fixtures/private-answer-key.js",
				"server/provider-credentials.js", "supabase/development/grant-test-access.sql", "private-media/captions.vtt", "private-media/transcript.txt"];
			for (const file of excluded) {
				await mkdir(path.dirname(path.join(source, file)), { recursive: true });
				await writeFile(path.join(source, file), "SYNTHETIC_PRIVATE_EXCLUSION_MARKER");
			}
			const { files } = await packageWorkerAssets({ root: source, output });
			assert.deepEqual(files, ["index.html"]);
			for (const file of excluded) await assert.rejects(readFile(path.join(output, file)), { code: "ENOENT" });
			assert.doesNotMatch(await readFile(path.join(output, "index.html"), "utf8"), /SYNTHETIC_PRIVATE_EXCLUSION_MARKER/);
		});
		const initialized = await check("owned loopback synthetic database, gateway and external private media", async () => {
			const mediaRoot = path.join(temporary, "private-media");
			await mkdir(mediaRoot);
			await writeFile(path.join(mediaRoot, "video.mp4"), "synthetic transport bytes");
			await writeFile(path.join(mediaRoot, "captions.vtt"), captions);
			await writeFile(path.join(mediaRoot, "transcript.txt"), transcript);
			media = await createPrivateMedia({ root: mediaRoot, entries: [] });
			app = await startLessonGateway({ quiz: true, quizCount: 3, googleEnabled: false, media: {
				lookup: (...args) => media.lookup(...args), forSection: (...args) => media.forSection(...args), send: (...args) => media.send(...args),
			} });
			assert.equal(new URL(app.origin).hostname, "127.0.0.1");
		});
		if (!initialized) return report;
		await check("synthetic account, free reading and paid denial before fixture grants", async () => {
			owner = await login(email); other = await login(otherEmail);
			const free = await json(owner, testSectionPath("free"));
			assert.ok(free.lesson.body);
			assert.equal(free.position, null);
			await request(owner, testSectionPath("paid"), { status: 404 });
			const overview = await json(owner, "/api/learning");
			assert.equal(overview.paidAccess, false);
			assert.equal(overview.hadPaidAccess, false);
			assert.equal(overview.subscriptionOffer.checkoutAvailable, false);
			await request(owner, "/api/quizzes/synthetic-topic/start", { body: {}, status: 404 });
		});
		await check("fixture-only paid grants, position persistence and learner isolation", async () => {
			await app.grant(email);
			paidLesson = (await json(owner, testSectionPath("paid"))).lesson;
			assert.ok(paidLesson.body);
			const expected = { contentVersionId: paidLesson.id, position: 3750, revision: 1 };
			assert.deepEqual((await json(owner, testSectionPath("paid") + "/position", {
				body: { contentVersionId: paidLesson.id, position: 3750, expectedRevision: 0 },
			})).position, expected);
			owner = await login(email);
			assert.deepEqual((await json(owner, testSectionPath("paid"))).position, expected);
			await request(other, testSectionPath("paid"), { status: 404 });
			assert.equal((await json(other, testSectionPath("free"))).position, null);
			assert.equal((await json(owner, "/api/learning")).paidAccess, true);
			assert.equal((await json(other, "/api/learning")).paidAccess, false);
		});
		let submitted, completion, history;
		await check("synthetic protected quiz save, submit, history and completion", async () => {
			const draft = await json(owner, "/api/quizzes/synthetic-topic/start", { body: {} });
			assert.equal(draft.questions.length, 3);
			const saved = await json(owner, `/api/attempts/${draft.id}/save`, { body: { answers: { q1: "a", q2: "a", q3: "a" }, expectedRevision: 0 } });
			submitted = await json(owner, `/api/attempts/${draft.id}/submit`, { body: { expectedRevision: saved.revision } });
			assert.equal(submitted.status, "submitted");
			assert.equal(submitted.score, 3);
			assert.equal(submitted.passed, true);
			completion = await json(owner, "/api/topics/synthetic-topic/complete", { body: {} });
			assert.ok(completion.completedAt);
			history = await json(owner, "/api/quizzes/synthetic-topic/history");
			assert.equal(history.attempts[0].id, submitted.id);
			await request(other, `/api/attempts/${submitted.id}`, { status: 404 });
		});
		await check("withdrawal and explicit empty corrected-version restart preserve history", async () => {
			const draft = await json(owner, "/api/quizzes/synthetic-topic/start", { body: {} });
			await json(owner, `/api/attempts/${draft.id}/save`, { body: { answers: { q1: "a" }, expectedRevision: 0 } });
			await app.withdrawQuiz("synthetic-topic", "synthetic-pilot-readiness-review");
			const stopped = await json(owner, `/api/attempts/${draft.id}`);
			assert.deepEqual(stopped, { id: draft.id, topicKey: "synthetic-topic", revision: 1, status: "withdrawn", csrf: owner.csrf });
			for (const [suffix, body] of [["save", { answers: { q1: "a" }, expectedRevision: 1 }], ["submit", { expectedRevision: 1 }]]) {
				assert.deepEqual(await json(owner, `/api/attempts/${draft.id}/${suffix}`, { body, status: 410 }), { error: "quiz_withdrawn" });
			}
			assert.equal((await json(owner, "/api/learning")).topics.length, 0);
			assert.deepEqual(await json(owner, `/api/attempts/${submitted.id}`), submitted);
			assert.deepEqual(await json(owner, "/api/quizzes/synthetic-topic/history"), history);
			assert.deepEqual(await json(owner, "/api/topics/synthetic-topic/complete", { body: {} }), completion);
			await app.publishQuiz("synthetic-topic", 4);
			const fresh = await json(owner, "/api/quizzes/synthetic-topic/start", { body: {} });
			assert.notEqual(fresh.id, draft.id);
			assert.equal(fresh.revision, 0);
			assert.deepEqual(fresh.answers, {});
			assert.equal(fresh.questions.length, 4);
		});
		await check("authorized Hebrew captions and transcripts, ranges and private cache controls", async () => {
			const common = { sectionId: testSections.paid, contentVersionId: paidLesson.id };
			media = await createPrivateMedia({ root: path.join(temporary, "private-media"), entries: [
				{ ...common, id: "video", file: "video.mp4", type: "video/mp4", title: "סרטון סינתטי לבדיקה",
					captions: [{ id: "captions-he", language: "he", label: "עברית" }], transcript: { id: "transcript-he", language: "he", label: "תמלול בעברית" } },
				{ ...common, id: "captions-he", file: "captions.vtt", type: "text/vtt", title: "כתוביות סינתטיות לבדיקה" },
				{ ...common, id: "transcript-he", file: "transcript.txt", type: "text/plain; charset=utf-8", title: "תמלול סינתטי לבדיקה" },
			] });
			const descriptor = (await json(owner, testSectionPath("paid"))).media[0];
			assert.equal(descriptor.captions[0].language, "he");
			assert.equal(descriptor.captions[0].url, "/api/media/captions-he");
			assert.equal(descriptor.transcript.language, "he");
			for (const [id, body, type] of [["captions-he", captions, "text/vtt"], ["transcript-he", transcript, "text/plain; charset=utf-8"]]) {
				const response = await request(owner, `/api/media/${id}`);
				assert.equal(response.headers.get("content-type"), type);
				assert.equal(response.headers.get("x-content-type-options"), "nosniff");
				assert.equal(await response.text(), body);
				await request(owner, `/api/media/${id}`, { method: "HEAD" });
				await request(null, `/api/media/${id}`, { status: 401 });
				await request(other, `/api/media/${id}`, { status: 404 });
			}
			const range = await request(owner, "/api/media/video", { status: 206, headers: { range: "bytes=0-8" } });
			assert.equal(await range.text(), "synthetic");
			for (const pathname of ["/captions.vtt", "/transcript.txt", "/server/gateway.mjs", "/tests/fixtures/protected-quiz.mjs", "/supabase/development/test-lessons.sql"]) {
				const response = await fetch(app.origin + pathname);
				assert.equal(response.status, 404);
				assert.doesNotMatch(await response.text(), /WEBVTT|תמלול סינתטי לבדיקה/);
			}
			await app.revoke(email);
			for (const id of ["captions-he", "transcript-he"]) await request(owner, `/api/media/${id}`, { status: 404 });
		});
		return report;
	} finally {
		try { await app?.close(); }
		finally { await rm(temporary, { recursive: true, force: true }); }
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const write = (stream, value) => new Promise((resolve, reject) => stream.write(value + "\n", error => error ? reject(error) : resolve()));
	let exitCode = 0;
	try {
		if (process.argv.length !== 3 || process.argv[2] !== "--local") throw new Error("arguments");
		const report = await checkLocalPilotReadiness();
		await write(process.stdout, JSON.stringify(report, null, 2));
		if (report.checks.some(check => !check.passed)) {
			await write(process.stderr, "Local pilot readiness checks failed. Hosted dependencies remain unverified.");
			exitCode = 1;
		}
	} catch {
		await write(process.stderr, process.argv.length !== 3 || process.argv[2] !== "--local"
			? "Pilot readiness accepts only --local. No target or deployment options are supported."
			: "Local pilot readiness checks failed. Hosted dependencies remain unverified.");
		exitCode = 1;
	}
	// embedded-postgres registers a beforeExit hook that forces a natural exit to
	// zero. The check's finally has closed every resource and both streams flushed.
	process.exit(exitCode);
}
