import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { roadPhotoSources } from "../js/road-photo-sources.js";
import { inspectImage } from "../scripts/road-media-integrity.mjs";

const photoCount = Object.keys(roadPhotoSources).length;
const root = new URL("../", import.meta.url);
const types = {
	".html": "text/html", ".js": "text/javascript", ".css": "text/css",
	".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
	".woff2": "font/woff2",
};

test("the LCP background and text fonts download before stylesheets arrive", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const viewport of [{ width: 1366, height: 940 }, { width: 390, height: 844 }]) {
		await t.test(`${viewport.width}px`, async () => {
			const page = await browser.newPage({ viewport, javaScriptEnabled: false });
			t.after(() => page.close());
			const session = await page.context().newCDPSession(page);
			await session.send("Network.enable");
			const roadRequests = [];
			const fontRequests = [];
			const externalRequests = [];
			session.on("Network.requestWillBeSent", ({ request }) => {
				if (request.url.endsWith("/assets/images/road.jpg")) roadRequests.push(request);
				if (request.url.endsWith(".woff2")) fontRequests.push(request);
				if (new URL(request.url).origin !== "http://gallery.test") externalRequests.push(request.url);
			});
			let releaseStyles;
			const stylesReady = new Promise(resolve => { releaseStyles = resolve; });
			await page.route("**/*", async route => {
				const url = new URL(route.request().url());
				if (url.origin !== "http://gallery.test") return route.abort();
				const filename = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
				if (filename.endsWith(".css")) await stylesReady;
				await route.fulfill({
					contentType: types[path.extname(filename)],
					body: await readFile(new URL(filename, root)),
				});
			});
			const criticalResponses = Promise.all([
				"/assets/images/road.jpg",
				"/assets/fonts/varela-round-v21-hebrew.woff2",
				"/assets/fonts/varela-round-v21-latin.woff2",
			].map(asset => page.waitForResponse(response => response.url().endsWith(asset), { timeout: 3000 })));
			try {
				await page.goto("http://gallery.test/", { waitUntil: "commit" });
				await Promise.all((await criticalResponses).map(response => response.finished()));
				assert.equal(roadRequests.length, 1);
				assert.equal(roadRequests[0].initialPriority, "High");
			} finally {
				releaseStyles();
				await page.waitForLoadState("load");
			}
			const background = await page.locator("#hero-road").evaluate(element => getComputedStyle(element).backgroundImage);
			assert.equal(background, `url("${roadRequests[0].url}")`);
			assert.equal(roadRequests.length, 1, "CSS must reuse the preloaded image");
			const loadedFonts = await page.evaluate(async () => {
				await document.fonts.ready;
				return [...document.fonts].filter(font => font.status === "loaded").map(font => font.family);
			});
			assert.deepEqual(loadedFonts, ["Varela Round", "Varela Round"], "Hebrew and Latin must decode and render");
			assert.equal(fontRequests.length, 2, "CSS must reuse both font preloads without fetching unused subsets");
			assert.deepEqual(externalRequests, [], "initial rendering must not depend on a font provider");
		});
	}
});

test("responsive delivery reduces desktop and mobile bytes and preserves density, cropping and fallback", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const scenario of [
		{ width: 1366, height: 940, deviceScaleFactor: 1 },
		{ width: 1366, height: 940, deviceScaleFactor: 2 },
		{ width: 390, height: 844, deviceScaleFactor: 2 },
		{ width: 412, height: 823, deviceScaleFactor: 1.75 },
		{ width: 1366, height: 940, deviceScaleFactor: 1, javaScriptEnabled: false },
	]) {
		await t.test(JSON.stringify(scenario), async () => {
			const page = await browser.newPage({
				viewport: { width: scenario.width, height: scenario.height },
				deviceScaleFactor: scenario.deviceScaleFactor,
				javaScriptEnabled: scenario.javaScriptEnabled,
			});
			const downloaded = new Map();
			await page.route("**/*", async (route) => {
				const request = route.request();
				const url = new URL(request.url());
				if (url.origin !== "http://gallery.test") return route.abort();
				const filename = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
				try {
					const bytes = await readFile(new URL(filename, root));
					if (request.method() !== "HEAD" && /\.(png|webp|jpg)$/.test(filename))
						downloaded.set(filename, bytes.length);
					await route.fulfill({
						contentType: types[path.extname(filename)],
						headers: { "content-length": String(bytes.length) },
						body: request.method() === "HEAD" ? "" : bytes,
					});
				} catch (error) {
					if (error.code !== "ENOENT") throw error;
					await route.fulfill({ status: 404, body: "" });
				}
			});
			await page.goto("http://gallery.test/");
			if (scenario.javaScriptEnabled !== false) {
				await page.waitForFunction(count => document.querySelector(".road-carousel-group").children.length === count, photoCount);
			}
			await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
			const images = await page.locator(".brand-mark, .hero-visual img, .road-loader img, .road-carousel-group:first-child img").evaluateAll(images => images.map(img => ({
				src: new URL(img.src).pathname.slice(1), current: new URL(img.currentSrc).pathname.slice(1),
				width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height,
				photo: !!img.closest(".road-photo"), sizes: img.sizes,
			})));
			const total = [...downloaded.values()].reduce((sum, bytes) => sum + bytes, 0);
			t.diagnostic(`${scenario.width}px @${scenario.deviceScaleFactor}x: ${(total / 1024).toFixed(1)} KiB of unique image bodies`);
			assert.ok(images.every(img => img.current.endsWith(".webp")), "every displayed image should use WebP");
			assert.ok(!downloaded.has("assets/icons/course-icon.png"), "the full-size logo must not load as a favicon");
			assert.ok([...downloaded.keys()].every(src => !/\/(cars|students-pass)\/.*\.png$/.test(src)), "original car/photo bodies should not download");
			if (scenario.deviceScaleFactor === 1)
				assert.ok(total < (115 + 9 * photoCount) * 1024, `desktop image budget exceeded: ${total}`);
			if (scenario.width <= 412 && scenario.deviceScaleFactor <= 2) {
				assert.ok(total < (120 + 12 * photoCount) * 1024, `mobile image budget exceeded: ${total}`);
				assert.ok(downloaded.get("assets/images/optimized/wheel-256.webp") <= 13 * 1024,
					"high-density wheel exceeds its compression budget");
			}
			if (scenario.deviceScaleFactor === 1 && scenario.javaScriptEnabled !== false) {
				for (const [source, budget] of [
					["assets/images/optimized/wheel.webp", 6 * 1024],
					["assets/images/optimized/students-pass/11.webp", 8 * 1024],
				]) {
					if (source.includes("students-pass/11.") && !roadPhotoSources[11]) continue;
					assert.ok(downloaded.has(source), `missing desktop image: ${source}`);
					assert.ok(downloaded.get(source) <= budget, `${source} exceeds its compression budget`);
				}
			}
			for (const img of images) {
				const source = inspectImage(await readFile(new URL(img.src, root)));
				const delivered = inspectImage(await readFile(new URL(img.current, root)));
				assert.ok(Math.abs(delivered.height - delivered.width * source.height / source.width) <= 1, `aspect ratio changed: ${img.current}`);
				const required = Math.min(source.width, Math.max(img.width, img.photo ? img.height * source.width / source.height : 0) * scenario.deviceScaleFactor);
				assert.ok(delivered.width >= required - 2, `${img.current}: ${delivered.width}px cannot cover ${required}px`);
				if (img.photo && scenario.width === 412)
					assert.ok(delivered.width <= required * 1.2, `${img.current}: oversized for ${required}px mobile photo`);
			}
			await page.close();
		});
	}
});
