import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPrivateMedia } from "../../server/private-media.mjs";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { browserClient } from "../helpers/account-gateway.mjs";

// Synthetic bytes test authenticated delivery, not video decoding.
test("private media requires a live paid version, supports byte ranges and rejects path escapes", async t => {
	const root = await mkdtemp(path.join(tmpdir(), "oren-private-media-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(path.join(root, "video.mp4"), "0123456789");
	await symlink(path.join(root, "video.mp4"), path.join(root, "link.mp4"));
	const sectionId = "a524e32d-2640-4d94-a51c-000000000002";
	// Version is discovered from the owned fixture, never accepted from a request.
	const entries = [];
	const media = await createPrivateMedia({ root, entries });
	const app = await startLessonGateway({ media });
	t.after(app.close);
	const client = browserClient(app.origin);
	await client.request();
	await client.request("login", { email: "media@example.test", password: "correct-password" });
	await app.grant("media@example.test");
	const lesson = await (await fetch(app.origin + "/api/lessons/paid", { headers: { cookie: client.cookie } })).json();
	// Use a new validated media registry, with server-owned immutable descriptors.
	const configured = await createPrivateMedia({ root, entries: [{ id: "video", sectionId, contentVersionId: lesson.lesson.id, file: "video.mp4", type: "video/mp4", title: "סרטון בדיקה" }] });
	media.lookup = configured.lookup;
	media.send = configured.send;
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
