import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPrivateMedia } from "../../server/private-media.mjs";
import { createStorageMedia } from "../../server/storage-media.mjs";
import { accountProvider, browserClient, startAccountGateway } from "../helpers/account-gateway.mjs";

const descriptor = { id: "video", sectionId: "a524e32d-2640-4d94-a51c-000000000001", contentVersionId: "a524e32d-2640-4d94-a51c-000000000002", file: "video.mp4", type: "video/mp4", title: "סרטון בדיקה" };
const captions = { ...descriptor, id: "captions-he", file: "captions.vtt", type: "text/vtt", title: "כתוביות בדיקה" };
const transcript = { ...descriptor, id: "transcript-he", file: "transcript.txt", type: "text/plain; charset=utf-8", title: "תמלול בדיקה" };
const captionReference = { id: captions.id, language: "he", label: "עברית" };
const transcriptReference = { id: transcript.id, language: "he", label: "תמלול בעברית" };
const accessibleVideo = { ...descriptor, captions: [captionReference], transcript: transcriptReference };
const sidecars = new Map([[captions.file, { type: captions.type, text: "WEBVTT\n\n00:00.000 --> 00:01.000\nכתוביות בדיקה.\n" }],
	[transcript.file, { type: transcript.type, text: "תמלול סינתטי לבדיקה. <script>window.privateTextRan = true</script>" }]]);
// Literal provider responses keep expected seek arithmetic independent of production policy.
const partials = new Map([
	["bytes=2-5", ["2345", "bytes 2-5/10"]], ["bytes=-3", ["789", "bytes 7-9/10"]],
	["bytes=8-", ["89", "bytes 8-9/10"]], ["bytes=8-100", ["89", "bytes 8-9/10"]],
	["bytes=-20", ["0123456789", "bytes 0-9/10"]],
]);
async function factory(t, kind) {
	if (kind === "file") {
		const root = await mkdtemp(path.join(tmpdir(), "oren-media-contract-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(path.join(root, descriptor.file), "0123456789");
		await writeFile(path.join(root, "סרטון.mp4"), "0123456789");
		for (const [file, { text }] of sidecars) await writeFile(path.join(root, file), text);
		return entries => createPrivateMedia({ root, entries });
	}
	return entries => createStorageMedia({ url: "https://test-project.supabase.co", secretKey: "sb_secret_test", bucket: "private-lessons", entries,
		fetcher: async (url, { headers }) => {
			const sidecar = sidecars.get(url.split("/").at(-1));
			if (sidecar) return new Response(sidecar.text, { headers: { "content-type": sidecar.type, "content-length": String(Buffer.byteLength(sidecar.text)) } });
			const partial = partials.get(headers.range);
			if (headers.range && !partial) return new Response(null, { status: 416, headers: { "content-range": "bytes */10" } });
			const body = partial?.[0] ?? "0123456789";
			return new Response(body, { status: partial ? 206 : 200, headers: { "content-type": "video/mp4", "content-length": String(body.length), ...(partial ? { "content-range": partial[1] } : {}) } });
		},
	});
}

for (const kind of ["file", "storage"]) {
	test(`${kind} private video sidecars stay nested, immutable and individually authorized`, async t => {
		const create = await factory(t, kind);
		const input = structuredClone(accessibleVideo);
		const media = await create([input, captions, transcript]);
		input.captions[0].label = "changed";
		input.transcript.id = "changed";
		assert.equal(media.lookup("video").captions[0].label, "עברית");
		assert.throws(() => { media.lookup("video").captions.push(captionReference); });
		assert.throws(() => { media.lookup("video").transcript.label = "changed"; });
		const expected = [{ id: "video", title: descriptor.title, type: descriptor.type, url: "/api/media/video",
			captions: [{ ...captionReference, url: "/api/media/captions-he" }], transcript: { ...transcriptReference, url: "/api/media/transcript-he" } }];
		assert.deepEqual(media.forSection(descriptor.sectionId, descriptor.contentVersionId), expected);
		const listing = media.forSection(descriptor.sectionId, descriptor.contentVersionId);
		listing[0].captions[0].label = "changed";
		assert.deepEqual(media.forSection(descriptor.sectionId, descriptor.contentVersionId), expected);
		const provider = accountProvider();
		let version = descriptor.contentVersionId;
		provider.readSection = async () => ({ id: version });
		const app = await startAccountGateway({ provider, media });
		t.after(app.close);
		const client = browserClient(app.origin);
		await client.request();
		await client.request("login", { email: "sidecars@example.test", password: "correct-password" });
		for (const entry of [captions, transcript]) {
			for (const method of ["GET", "HEAD"]) {
				const url = `${app.origin}/api/media/${entry.id}`;
				assert.equal((await fetch(url, { method })).status, 401);
				const response = await fetch(url, { method, headers: { cookie: client.cookie } });
				assert.equal(response.status, 200);
				assert.equal(response.headers.get("content-type"), entry.type);
				assert.equal(response.headers.get("x-content-type-options"), "nosniff");
				assert.equal(response.headers.get("cache-control"), "private, no-store");
				assert.equal(await response.text(), method === "HEAD" ? "" : sidecars.get(entry.file).text);
			}
		}
		version = "a524e32d-2640-4d94-a51c-000000000003";
		for (const entry of [captions, transcript]) assert.equal((await fetch(`${app.origin}/api/media/${entry.id}`, { headers: { cookie: client.cookie } })).status, 404);
	});

	test(`${kind} private sidecars reject invalid references and orphaned text`, async t => {
		const create = await factory(t, kind);
		const invalid = [
			[captions], [transcript],
			[{ ...accessibleVideo, type: "image/png" }, captions, transcript],
			[{ ...accessibleVideo, captions: {} }, captions, transcript],
			[{ ...accessibleVideo, captions: [{ ...captionReference, id: "missing" }] }, captions, transcript],
			[{ ...accessibleVideo, captions: [captionReference, captionReference] }, captions, transcript],
			[{ ...accessibleVideo, transcript: captionReference }, captions, transcript],
			[accessibleVideo, { ...captions, sectionId: "a524e32d-2640-4d94-a51c-000000000003" }, transcript],
			[accessibleVideo, captions, { ...transcript, contentVersionId: "a524e32d-2640-4d94-a51c-000000000003" }],
			[accessibleVideo, { ...captions, type: "text/plain; charset=utf-8" }, transcript],
			[accessibleVideo, captions, { ...transcript, type: "text/plain" }],
			[accessibleVideo, { ...captions, extra: "unexpected" }, transcript],
			[accessibleVideo, captions, { ...transcript, captions: [] }],
			[accessibleVideo, { ...descriptor, id: "another", captions: [captionReference] }, captions, transcript],
		];
		for (const patch of [{ language: "en" }, { language: ["he"] }, { label: "" }, { label: "x".repeat(301) }, { extra: true }, { url: "https://evil.test/" }]) {
			invalid.push([{ ...accessibleVideo, captions: [{ ...captionReference, ...patch }] }, captions, transcript]);
			invalid.push([{ ...accessibleVideo, transcript: { ...transcriptReference, ...patch } }, captions, transcript]);
		}
		for (const entries of invalid) await assert.rejects(async () => create(entries), /Invalid private media/);
	});

	test(`${kind} media rejects coercible identities and keeps an immutable opaque catalog`, async t => {
		const create = await factory(t, kind);
		for (const patch of [{ id: 123 }, { id: ["video"] }, { sectionId: [descriptor.sectionId] }, { contentVersionId: [descriptor.contentVersionId] }, { id: "../video" }, { sectionId: "wrong" }, { contentVersionId: "wrong" }, { type: "text/html" }, { title: "" }]) {
			await assert.rejects(async () => create([{ ...descriptor, ...patch }]));
		}
		await assert.rejects(async () => create([descriptor, descriptor]));
		await assert.rejects(async () => create({}));
		const input = { ...descriptor, secret: "must not survive" };
		const media = await create([input]);
		input.title = "changed";
		assert.deepEqual(media.lookup("video"), descriptor);
		for (const [entry, method] of [[{ ...descriptor }, "GET"], [undefined, "GET"], [media.lookup("video"), "POST"]]) {
			await assert.rejects(media.send({ method, headers: {} }, {}, entry), { status: kind === "file" ? 404 : 503 });
		}
		assert.throws(() => { media.lookup("video").file = "other.mp4"; });
		const expected = [{ id: "video", title: descriptor.title, type: "video/mp4", url: "/api/media/video" }];
		const publicEntries = media.forSection(descriptor.sectionId, descriptor.contentVersionId);
		assert.deepEqual(publicEntries, expected);
		publicEntries[0].title = "changed";
		assert.deepEqual(media.forSection(descriptor.sectionId, descriptor.contentVersionId), expected);
		assert.deepEqual(media.forSection(descriptor.sectionId, "a524e32d-2640-4d94-a51c-000000000003"), []);
		if (kind === "file") assert.equal((await create([{ ...descriptor, file: "סרטון.mp4" }])).lookup("video").file, "סרטון.mp4");
		else await assert.rejects(async () => create([{ ...descriptor, file: "סרטון.mp4" }]));
	});

	test(`${kind} media returns consistent GET, HEAD and strict single-range responses`, async t => {
		const create = await factory(t, kind);
		const media = await create([descriptor]);
		const provider = accountProvider();
		provider.readSection = async () => ({ id: descriptor.contentVersionId });
		const app = await startAccountGateway({ provider, media });
		t.after(app.close);
		const client = browserClient(app.origin);
		await client.request();
		await client.request("login", { email: "media@example.test", password: "correct-password" });
		for (const method of ["GET", "HEAD"]) {
			for (const [range, body, contentRange, status] of [
				[undefined, "0123456789", null, 200],
				...[...partials].map(([range, [body, contentRange]]) => [range, body, contentRange, 206]),
				...["", "bytes=", "bytes=0-1,4-5", "items=0-1", "bytes=20-30", "bytes=5-2", "bytes=-0", "bytes=9007199254740992-", `bytes=${"0".repeat(201)}-1`].map(range => [range, "", "bytes */10", 416]),
			]) {
				const response = await fetch(app.origin + "/api/media/video", { method, headers: { cookie: client.cookie, ...(range === undefined ? {} : { range }) } });
				assert.equal(response.status, status, `${method} ${JSON.stringify(range)}`);
				assert.equal(response.headers.get("content-range"), contentRange);
				assert.equal(response.headers.get("cache-control"), "private, no-store");
				assert.equal(response.headers.get("x-content-type-options"), "nosniff");
				if (status !== 416) {
					assert.equal(response.headers.get("content-length"), String(body.length));
					assert.equal(response.headers.get("content-type"), "video/mp4");
					assert.equal(response.headers.get("accept-ranges"), "bytes");
					assert.equal(response.headers.get("content-disposition"), "inline");
					assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
				}
				assert.equal(await response.text(), method === "HEAD" ? "" : body);
			}
		}
	});
}
