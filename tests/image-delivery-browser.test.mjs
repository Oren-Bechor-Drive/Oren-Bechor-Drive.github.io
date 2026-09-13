import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { inspectImage } from "../scripts/road-media-integrity.mjs";

const root = new URL("../", import.meta.url);
const types = {
	".html": "text/html", ".js": "text/javascript", ".css": "text/css",
	".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
};

test("the LCP road background downloads at high priority before stylesheets arrive", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const viewport of [{ width: 1366, height: 940 }, { width: 390, height: 844 }]) {
		await t.test(`${viewport.width}px`, async () => {
			const page = await browser.newPage({ viewport, javaScriptEnabled: false });
			t.after(() => page.close());
			const session = await page.context().newCDPSession(page);
			await session.send("Network.enable");
			const roadRequests = [];
			session.on("Network.requestWillBeSent", ({ request }) => {
				if (request.url.endsWith("/assets/images/road.jpg")) roadRequests.push(request);
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
			const roadResponse = page.waitForResponse(response => response.url().endsWith("/assets/images/road.jpg"), { timeout: 3000 });
			try {
				await page.goto("http://gallery.test/", { waitUntil: "commit" });
				await (await roadResponse).finished();
				assert.equal(roadRequests.length, 1);
				assert.equal(roadRequests[0].initialPriority, "High");
			} finally {
				releaseStyles();
				await page.waitForLoadState("load");
			}
			const background = await page.locator("#hero-road").evaluate(element => getComputedStyle(element).backgroundImage);
			assert.equal(background, `url("${roadRequests[0].url}")`);
			assert.equal(roadRequests.length, 1, "CSS must reuse the preloaded image");
		});
	}
});

test("responsive delivery reduces desktop bytes and preserves density, cropping and fallback", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const scenario of [
		{ width: 1366, height: 940, deviceScaleFactor: 1 },
		{ width: 1366, height: 940, deviceScaleFactor: 2 },
		{ width: 390, height: 844, deviceScaleFactor: 2 },
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
				await page.waitForFunction(() => document.querySelector(".road-carousel-group").children.length === 15);
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
				assert.ok(total < 250 * 1024, `desktop image budget exceeded: ${total}`);
			if (scenario.deviceScaleFactor === 1 && scenario.javaScriptEnabled !== false) {
				for (const [source, budget] of [
					["assets/images/optimized/wheel.webp", 6 * 1024],
					["assets/images/optimized/students-pass/11.webp", 8 * 1024],
				]) {
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
			}
			await page.close();
		});
	}
});
