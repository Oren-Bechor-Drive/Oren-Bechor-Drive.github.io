import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPrivateMedia } from "../../server/private-media.mjs";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";
import { testSectionPath, testSections } from "../fixtures/test-sections.mjs";

// Synthetic bytes test authenticated delivery, not video decoding.
test("private media requires a live paid version, supports byte ranges and rejects path escapes", async t => {
	const root = await mkdtemp(path.join(tmpdir(), "oren-private-media-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(path.join(root, "video.mp4"), "0123456789");
	await symlink(path.join(root, "video.mp4"), path.join(root, "link.mp4"));
	const sectionId = testSections.paid;
	// Version is discovered from the owned fixture, never accepted from a request.
	let media = await createPrivateMedia({ root, entries: [] });
	// Forward the entire adapter while this fixture discovers its database-owned version.
	const app = await startLessonGateway({ media: {
		lookup: (...args) => media.lookup(...args),
		forSection: (...args) => media.forSection(...args),
		send: (...args) => media.send(...args),
	} });
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "media@example.test", password: "correct-password" });
	await app.grant("media@example.test");
	const lesson = await (await fetch(app.origin + testSectionPath("paid"), { headers: { cookie: client.cookie } })).json();
	// Use a new validated media registry, with server-owned immutable descriptors.
	media = await createPrivateMedia({ root, entries: [{ id: "video", sectionId, contentVersionId: lesson.lesson.id, file: "video.mp4", type: "video/mp4", title: "סרטון בדיקה" }] });
	const configuredLesson = await (await fetch(app.origin + testSectionPath("paid"), { headers: { cookie: client.cookie } })).json();
	assert.deepEqual(configuredLesson.media, [{ id: "video", title: "סרטון בדיקה", type: "video/mp4", url: "/api/media/video" }]);
	const fetchMedia = (headers = {}) => fetch(app.origin + "/api/media/video", { headers });
	assert.equal((await fetchMedia()).status, 401);
	let response = await fetchMedia({ cookie: client.cookie });
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "private, no-store");
	assert.equal(await response.text(), "0123456789");
	response = await fetchMedia({ cookie: client.cookie, range: "bytes=2-5" });
	assert.equal(response.status, 206);
	assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
	assert.equal(await response.text(), "2345");
	assert.equal((await fetchMedia({ cookie: client.cookie, range: "bytes=20-30" })).status, 416);
	assert.equal((await fetch(app.origin + "/video.mp4")).status, 404);
	await app.expire("media@example.test");
	assert.equal((await fetchMedia({ cookie: client.cookie })).status, 404);
	await assert.rejects(createPrivateMedia({ root, entries: [{ id: "bad", sectionId, contentVersionId: lesson.lesson.id, file: "../video.mp4", type: "video/mp4", title: "בדיקה" }] }));
	await assert.rejects(createPrivateMedia({ root, entries: [{ id: "link", sectionId, contentVersionId: lesson.lesson.id, file: "link.mp4", type: "video/mp4", title: "בדיקה" }] }));
});

test("private captions and transcripts recheck learner, entitlement and exact published version on every fetch", async t => {
	const root = await mkdtemp(path.join(tmpdir(), "oren-private-sidecars-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bodies = { "video.webm": "synthetic video bytes", "captions.vtt": "WEBVTT\n\n00:00.000 --> 00:01.000\nכתוביות בדיקה.\n", "transcript.txt": "תמלול סינתטי לבדיקה." };
	for (const [file, body] of Object.entries(bodies)) await writeFile(path.join(root, file), body);
	let media = await createPrivateMedia({ root, entries: [] });
	const app = await startLessonGateway({ media: {
		lookup: (...args) => media.lookup(...args), forSection: (...args) => media.forSection(...args), send: (...args) => media.send(...args),
	} });
	t.after(app.close);
	async function learner(email, grant = true) {
		const client = browserClient(app.origin);
		await client.request();
		await client.request("login", { email, password: "correct-password" });
		if (grant) await app.grant(email);
		return client;
	}
	const revoked = await learner("sidecars-revoked@example.test");
	const expired = await learner("sidecars-expired@example.test");
	const other = await learner("sidecars-other@example.test", false);
	const lesson = await (await fetch(app.origin + testSectionPath("paid"), { headers: { cookie: revoked.cookie } })).json();
	const common = { sectionId: testSections.paid, contentVersionId: lesson.lesson.id };
	const references = { captions: [{ id: "captions-he", language: "he", label: "עברית" }], transcript: { id: "transcript-he", language: "he", label: "תמלול בעברית" } };
	const entries = [{ ...common, ...references, id: "video", file: "video.webm", type: "video/webm", title: "סרטון בדיקה" },
		{ ...common, id: "captions-he", file: "captions.vtt", type: "text/vtt", title: "כתוביות בדיקה" },
		{ ...common, id: "transcript-he", file: "transcript.txt", type: "text/plain; charset=utf-8", title: "תמלול בדיקה" }];
	media = await createPrivateMedia({ root, entries });
	const configured = await (await fetch(app.origin + testSectionPath("paid"), { headers: { cookie: revoked.cookie } })).json();
	assert.deepEqual(configured.media, [{ id: "video", type: "video/webm", title: "סרטון בדיקה", url: "/api/media/video",
		captions: [{ ...references.captions[0], url: "/api/media/captions-he" }], transcript: { ...references.transcript, url: "/api/media/transcript-he" } }]);
	async function denied(client, expected) {
		for (const id of ["captions-he", "transcript-he"]) for (const method of ["GET", "HEAD"]) {
			const response = await fetch(`${app.origin}/api/media/${id}`, { method, headers: client ? { cookie: client.cookie } : {} });
			assert.equal(response.status, expected);
			assert.equal(response.headers.get("cache-control"), "private, no-store");
			if (method === "GET") assert.doesNotMatch(await response.text(), /WEBVTT|תמלול סינתטי|כתוביות בדיקה/);
		}
	}
	await denied(null, 401);
	await denied(other, 404);
	for (const entry of entries.slice(1)) {
		const response = await fetch(`${app.origin}/api/media/${entry.id}`, { headers: { cookie: revoked.cookie } });
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), entry.type);
		assert.equal(response.headers.get("x-content-type-options"), "nosniff");
		assert.equal(await response.text(), bodies[entry.file]);
		assert.equal((await fetch(`${app.origin}/${entry.file}`)).status, 404);
	}
	await app.revoke("sidecars-revoked@example.test");
	await denied(revoked, 404);
	await app.expire("sidecars-expired@example.test");
	await denied(expired, 404);
	const current = await learner("sidecars-current@example.test");
	media = await createPrivateMedia({ root, entries: entries.map(entry => ({ ...entry, contentVersionId: "a524e32d-2640-4d94-a51c-000000000099" })) });
	await denied(current, 404);
	await current.request("logout", {});
	await denied(current, 401);
});
