import assert from "node:assert/strict";
import test from "node:test";
import { privateMediaReader as fixture, syntheticTranscript as transcriptText } from "../helpers/private-media.mjs";

for (const width of [1440, 390]) {
	test(`private video exposes Hebrew native captions and a keyboard plaintext transcript at ${width}px`, async t => {
		const r = await fixture(t, { width, reducedMotion: width === 390 ? "reduce" : "no-preference" });
		const requests = [];
		r.page.on("request", request => { if (request.url().endsWith("/api/media/transcript-he")) requests.push(request); });
		await r.open();
		const track = r.page.locator("video track");
		assert.equal(await track.getAttribute("kind"), "captions");
		assert.equal(await track.getAttribute("srclang"), "he");
		assert.equal(await track.getAttribute("label"), "עברית");
		assert.equal(await track.getAttribute("src"), "/api/media/captions-he");
		await r.page.waitForFunction(() => {
			const video = document.querySelector("video");
			const track = video?.querySelector("track");
			return video?.readyState >= 1 && track?.readyState === 2 && video.textTracks[0]?.mode === "showing";
		});
		assert.match(await track.evaluate(node => node.track.cues[0].text), /כתוביות סינתטיות/);
		assert.equal(requests.length, 0, "Transcript is fetched only on disclosure.");
		if (width === 390) await r.summary.tap();
		else await r.summary.click();
		assert.equal(await r.summary.evaluate(node => getComputedStyle(node).outlineStyle), "none");
		await r.transcript.filter({ hasText: "תמלול סינתטי" }).waitFor();
		assert.equal(await r.transcript.textContent(), transcriptText);
		assert.equal(await r.transcript.locator("script, img").count(), 0);
		assert.equal(await r.page.evaluate(() => window.privateTranscriptRan), undefined);
		await r.page.keyboard.press("Enter");
		assert.equal(await r.summary.evaluate(node => node.parentElement.open), false);
		await r.page.keyboard.press("Shift+Tab");
		await r.page.keyboard.press("Tab");
		assert.equal(await r.summary.evaluate(node => node === document.activeElement), true);
		assert.notEqual(await r.summary.evaluate(node => getComputedStyle(node).outlineStyle), "none");
		await r.page.keyboard.press("Enter");
		assert.equal(await r.summary.evaluate(node => node.parentElement.open), true);
		assert.equal(requests.length, 1, "Reopening reuses only the current authorized reading lifetime.");
		assert.equal(await r.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		if (width === 390) await r.summary.tap();
		else await r.summary.click();
		assert.equal(await r.summary.evaluate(node => getComputedStyle(node).outlineStyle), "none", "Pointer input hides a previous keyboard ring.");
		await r.page.emulateMedia({ forcedColors: "active" });
		assert.notEqual(await r.summary.evaluate(node => getComputedStyle(node, "::after").backgroundColor), "rgba(0, 0, 0, 0)");
		await r.page.evaluate(() => {
			window.oldPrivateMedia = { video: document.querySelector("video"), track: document.querySelector("track"),
				details: document.querySelector(".reading-transcript"), text: document.querySelector(".reading-transcript-text") };
			Object.defineProperty(document, "hidden", { configurable: true, value: true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		assert.deepEqual(await r.page.evaluate(() => ({ video: oldPrivateMedia.video.getAttribute("src"), track: oldPrivateMedia.track.getAttribute("src"),
			open: oldPrivateMedia.details.open, text: oldPrivateMedia.text.textContent, connected: oldPrivateMedia.video.isConnected })),
		{ video: null, track: null, open: false, text: "", connected: false });
	});
}

test("revoked transcript access clears every protected reader element", async t => {
	const r = await fixture(t);
	await r.open();
	// Finish native media authorization before this test revokes transcript access.
	await r.page.waitForFunction(() => document.querySelector("video")?.readyState >= 1
		&& document.querySelector("track")?.readyState === 2);
	await r.app.revoke(r.email);
	const denied = r.page.waitForResponse(response => response.url().endsWith("/api/media/transcript-he"));
	await r.summary.click();
	assert.equal((await denied).status(), 404);
	await r.page.locator("[data-reader-status]").filter({ hasText: "אינו זמין" }).waitFor();
	assert.equal(await r.page.locator("[data-reading]").isVisible(), false);
	assert.equal(await r.page.locator("[data-reading-media]").textContent(), "");
	assert.equal(await r.page.locator("[data-reading-body]").textContent(), "");
});

test("a denied native caption request reauthorizes and clears the protected reader", async t => {
	const r = await fixture(t);
	let release, requested;
	const entered = new Promise(resolve => { requested = resolve; });
	const delayed = new Promise(resolve => { release = resolve; });
	await r.page.route("**/api/media/captions-he", async route => {
		requested();
		await delayed;
		const response = await route.fetch();
		await route.fulfill({ response });
	});
	await r.open();
	await entered;
	await r.app.revoke(r.email);
	release();
	await r.page.locator("[data-reader-status]").filter({ hasText: "אינו זמין" }).waitFor();
	assert.equal(await r.page.locator("[data-reading-media]").textContent(), "");
	assert.equal(await r.page.locator("[data-reading-body]").textContent(), "");
});

test("suspension aborts an on-demand transcript and a late reply cannot restore its text", async t => {
	const r = await fixture(t);
	let release, requested, finished;
	const entered = new Promise(resolve => { requested = resolve; });
	const delayed = new Promise(resolve => { release = resolve; });
	const fulfilled = new Promise(resolve => { finished = resolve; });
	await r.page.route("**/api/media/transcript-he", async route => {
		const response = await route.fetch();
		requested();
		await delayed;
		await route.fulfill({ response }).catch(() => {});
		finished();
	});
	await r.open();
	await r.summary.click();
	await entered;
	const aborted = r.page.waitForEvent("requestfailed", { predicate: request => request.url().endsWith("/api/media/transcript-he") });
	await r.page.evaluate(() => {
		window.pendingTranscript = document.querySelector(".reading-transcript-text");
		Object.defineProperty(document, "hidden", { configurable: true, value: true });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await aborted;
	release();
	await fulfilled;
	assert.equal(await r.page.evaluate(() => pendingTranscript.textContent), "");
	assert.equal(await r.page.locator("[data-reading-media]").textContent(), "");
	await r.app.revoke(r.email);
	await r.page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: false });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await r.page.locator("[data-reader-status]").filter({ hasText: "אינו זמין" }).waitFor();
	assert.equal(await r.page.locator("[data-reading-media]").textContent(), "");
});

for (const [name, text] of [["oversized", Buffer.alloc(256 * 1024 + 1, "x")], ["invalid UTF-8", Buffer.from([0xff, 0xfe, 0x61])]]) {
		test(`reader refuses an ${name} transcript without inserting its body`, async t => {
		const r = await fixture(t, { transcript: text });
		await r.open();
		await r.summary.click();
		await r.page.locator(".reading-transcript-status").filter({ hasText: "לא הושלמה" }).waitFor();
		assert.equal(await r.transcript.textContent(), "");
		assert.equal(await r.transcript.locator("*").count(), 0);
		assert.equal(await r.page.locator("[data-reading]").isVisible(), true);
	});
}

test("a transcript without a length header stops reading at the byte limit and cancels its stream", async t => {
	const r = await fixture(t);
	await r.page.addInitScript(() => {
		const original = window.fetch;
		window.fetch = async (url, options) => {
			if (!String(url).endsWith("/api/media/transcript-he")) return original(url, options);
			window.transcriptStream = { chunks: 0, cancelled: false };
			return new Response(new ReadableStream({
				pull(controller) { transcriptStream.chunks++; controller.enqueue(new Uint8Array(64 * 1024).fill(120)); },
				cancel() { transcriptStream.cancelled = true; },
			}), { headers: { "content-type": "text/plain; charset=utf-8" } });
		};
	});
	await r.open();
	await r.summary.click();
	await r.page.locator(".reading-transcript-status").filter({ hasText: "לא הושלמה" }).waitFor();
	assert.equal(await r.transcript.textContent(), "");
	assert.equal(await r.page.evaluate(() => transcriptStream.cancelled), true);
	assert.ok(await r.page.evaluate(() => transcriptStream.chunks <= 6), "The reader stops consuming an unbounded stream.");
});
