import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { roadPhotoSources } from "../../js/road-photo-sources.js";
import { inspectImage } from "../../scripts/road-media-integrity.mjs";

const photoCount = Object.keys(roadPhotoSources).length;
const root = new URL("../../", import.meta.url);
const deliveryImages =
	".brand-mark, .hero-road-car, .hero-visual img, .road-loader img, .road-carousel-group:first-child img, .instructor-photo img";

for (const failure of ["missing delivery copies", "stale original metadata"]) {
	test(`student photos recover to PNG with ${failure}`, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage();
		await page.route("**/*", async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.pathname.includes("students-pass")) {
				if (
					failure === "missing delivery copies" &&
					url.pathname.endsWith(".webp")
				)
					return route.fulfill({ status: 404, body: "" });
				if (
					failure === "stale original metadata" &&
					request.method() === "HEAD"
				)
					return route.fulfill({
						contentType: "image/png",
						headers: { "content-length": "0" },
						body: "",
					});
			}
			await serveRoadMedia(route);
		});
		await page.goto("http://gallery.test/");
		await page.locator("[data-road-carousel]").scrollIntoViewIfNeeded();
		await page.waitForFunction((count) => {
			const root = document.querySelector("[data-road-carousel]");
			return (
				root.dataset.ready === "true" &&
				root.getAttribute("aria-busy") === "false" &&
				root.querySelector(".road-carousel-group").children.length ===
					count
			);
		}, photoCount);
		const photos = await page
			.locator(".road-carousel-group")
			.first()
			.locator(".road-photo img")
			.evaluateAll((images) =>
				images.map((image) => ({
					source: image.currentSrc,
					loaded: image.complete && image.naturalWidth > 0,
				})),
			);
		assert.equal(photos.length, photoCount);
		assert.ok(
			photos.every(
				(photo) => photo.loaded && photo.source.endsWith(".png"),
			),
		);
		assert.equal(await page.locator(".road-loader").isVisible(), false);
	});
}

test("fonts and the high-priority logo download before stylesheets arrive and are reused", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const viewport of [
		{ width: 1366, height: 940 },
		{ width: 390, height: 844 },
	]) {
		await t.test(`${viewport.width}px`, async () => {
			const page = await browser.newPage({
				viewport,
				javaScriptEnabled: false,
			});
			t.after(() => page.close());
			const session = await page.context().newCDPSession(page);
			await session.send("Network.enable");
			const fontRequests = [];
			const logoRequests = [];
			const externalRequests = [];
			session.on("Network.requestWillBeSent", ({ request }) => {
				if (request.url.endsWith(".woff2")) fontRequests.push(request);
				if (/\/course-icon(?:-\d+)?\.webp$/.test(request.url))
					logoRequests.push(request);
				if (new URL(request.url).origin !== "http://gallery.test")
					externalRequests.push(request.url);
			});
			let releaseStyles;
			const stylesReady = new Promise((resolve) => {
				releaseStyles = resolve;
			});
			await page.route("**/*", async (route) => {
				const url = new URL(route.request().url());
				if (url.pathname.endsWith(".css")) await stylesReady;
				await serveRoadMedia(route);
			});
			const criticalResponses = Promise.all(
				[
					"/assets/fonts/varela-round-v21-hebrew.woff2",
					"/assets/fonts/varela-round-v21-latin.woff2",
					"/assets/images/optimized/course-icon.webp",
				].map((asset) =>
					page.waitForResponse(
						(response) => response.url().endsWith(asset),
						{ timeout: 3000 },
					),
				),
			);
			try {
				await page.goto("http://gallery.test/", {
					waitUntil: "commit",
				});
				await Promise.all(
					(await criticalResponses).map((response) =>
						response.finished(),
					),
				);
			} finally {
				releaseStyles();
				await page.waitForLoadState("load");
			}
			const loadedFonts = await page.evaluate(async () => {
				await document.fonts.ready;
				return [...document.fonts]
					.filter((font) => font.status === "loaded")
					.map((font) => font.family);
			});
			assert.deepEqual(
				loadedFonts,
				["Varela Round", "Varela Round"],
				"Hebrew and Latin must decode and render",
			);
			assert.equal(
				fontRequests.length,
				2,
				"CSS must reuse both font preloads without fetching unused subsets",
			);
			assert.equal(
				logoRequests.length,
				1,
				"the header logo must be discovered without JavaScript or CSS",
			);
			assert.equal(
				logoRequests[0].initialPriority,
				"High",
				"the logo LCP candidate must start at high priority",
			);
			assert.deepEqual(
				externalRequests,
				[],
				"initial rendering must not depend on a font provider",
			);
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
		{ width: 412, height: 823, deviceScaleFactor: 1 },
		{ width: 768, height: 1024, deviceScaleFactor: 2 },
		{
			width: 390,
			height: 844,
			deviceScaleFactor: 2,
			javaScriptEnabled: false,
		},
		{
			width: 1366,
			height: 940,
			deviceScaleFactor: 1,
			javaScriptEnabled: false,
		},
	]) {
		await t.test(JSON.stringify(scenario), async () => {
			const page = await browser.newPage({
				viewport: { width: scenario.width, height: scenario.height },
				deviceScaleFactor: scenario.deviceScaleFactor,
				javaScriptEnabled: scenario.javaScriptEnabled,
			});
			const downloaded = new Map();
			// Keep the startup overlay visible long enough to verify its lazy wheel.
			let releaseDiscovery;
			const wheelLoaded = new Promise((resolve) => {
				releaseDiscovery = resolve;
			});
			t.after(() => releaseDiscovery());
			await page.route("**/*", async (route) => {
				if (route.request().method() === "HEAD") await wheelLoaded;
				const served = await serveRoadMedia(route);
				if (served?.source.match(/\/wheel(?:-\d+)?\.webp$/))
					releaseDiscovery();
				if (
					served?.byteLength &&
					/\.(png|webp|jpg)$/.test(served.source)
				)
					downloaded.set(served.source, served.byteLength);
			});
			await page.goto("http://gallery.test/");
			await page.locator("[data-road-carousel]").scrollIntoViewIfNeeded();
			if (scenario.javaScriptEnabled !== false) {
				await page.waitForFunction(
					(count) =>
						document.querySelector(".road-carousel-group").children
							.length === count,
					photoCount,
				);
			}
			await page.waitForFunction(
				(selector) =>
					[...document.querySelectorAll(selector)]
						.filter(
							(i) =>
								!i.closest(".road-loader") ||
								i.getClientRects().length > 0,
						)
						.every((i) => i.complete && i.naturalWidth > 0),
				deliveryImages,
			);
			// Measure image density after the entrance rotation has settled.
			await page.locator(".hero-visual").evaluate(async (element) => {
				await Promise.all(
					element
						.getAnimations()
						.map((animation) => animation.finished),
				);
			});
			const images = await page
				.locator(deliveryImages)
				.evaluateAll((images) =>
					images
						.filter((img) => img.currentSrc)
						.map((img) => ({
							src: new URL(img.src).pathname.slice(1),
							current: new URL(img.currentSrc).pathname.slice(1),
							width: parseFloat(getComputedStyle(img).width),
							height: parseFloat(getComputedStyle(img).height),
							photo: !!img.closest(".road-photo"),
							cropped:
								getComputedStyle(img).objectFit === "cover",
							sizes: img.sizes,
						})),
				);
			const total = [...downloaded.values()].reduce(
				(sum, bytes) => sum + bytes,
				0,
			);
			const instructorBytes = [...downloaded]
				.filter(([source]) => /\/oren(?:-\d+)?\.webp$/.test(source))
				.reduce((sum, [, bytes]) => sum + bytes, 0);
			assert.ok(
				instructorBytes > 0,
				"the instructor photo uses an optimized copy",
			);
			assert.ok(
				!downloaded.has("assets/images/oren.jpg"),
				"the original instructor photo should not download",
			);
			const instructorBudget =
				scenario.deviceScaleFactor === 1
					? 50
					: scenario.width <= 440
						? 90
						: scenario.width <= 768
							? 300
							: 180;
			assert.ok(
				instructorBytes <= instructorBudget * 1024,
				`instructor image budget exceeded: ${instructorBytes}`,
			);
			const roadMediaBytes = total - instructorBytes;
			t.diagnostic(
				`${scenario.width}px @${scenario.deviceScaleFactor}x: ${(total / 1024).toFixed(1)} KiB of unique image bodies`,
			);
			assert.ok(
				images.every((img) => img.current.endsWith(".webp")),
				"every displayed image should use WebP",
			);
			assert.ok(
				!downloaded.has("assets/icons/course-icon.png"),
				"the full-size logo must not load as a favicon",
			);
			assert.ok(
				[...downloaded.keys()].every(
					(src) => !/\/(cars|students-pass)\/.*\.png$/.test(src),
				),
				"original car/photo bodies should not download",
			);
			if (scenario.deviceScaleFactor === 1)
				assert.ok(
					roadMediaBytes < (115 + 9 * photoCount) * 1024,
					`desktop road image budget exceeded: ${roadMediaBytes}`,
				);
			if (scenario.width <= 412 && scenario.deviceScaleFactor <= 2) {
				assert.ok(
					roadMediaBytes < (120 + 12 * photoCount) * 1024,
					`mobile road image budget exceeded: ${roadMediaBytes}`,
				);
				if (
					scenario.deviceScaleFactor > 1 &&
					scenario.javaScriptEnabled !== false
				)
					assert.ok(
						downloaded.get(
							"assets/images/optimized/wheel-256.webp",
						) <=
							13 * 1024,
						"high-density wheel exceeds its compression budget",
					);
			}
			if (
				scenario.deviceScaleFactor === 1 &&
				scenario.javaScriptEnabled !== false
			) {
				for (const [source, budget] of [
					["assets/images/optimized/wheel.webp", 6 * 1024],
					[
						roadPhotoSources[11]?.srcset
							.split(",")[0]
							.trim()
							.split(" ")[0],
						8 * 1024,
					],
				]) {
					if (!source) continue;
					assert.ok(
						downloaded.has(source),
						`missing desktop image: ${source}`,
					);
					assert.ok(
						downloaded.get(source) <= budget,
						`${source} exceeds its compression budget`,
					);
				}
			}
			for (const img of images) {
				const source = inspectImage(
					await readFile(new URL(img.src, root)),
				);
				const delivered = inspectImage(
					await readFile(new URL(img.current, root)),
				);
				assert.ok(
					Math.abs(
						delivered.height -
							(delivered.width * source.height) / source.width,
					) <= 1,
					`aspect ratio changed: ${img.current}`,
				);
				const required = Math.min(
					source.width,
					Math.max(
						img.width,
						img.cropped
							? (img.height * source.width) / source.height
							: 0,
					) * scenario.deviceScaleFactor,
				);
				// Allow subpixel cover geometry and rounded encoded dimensions, up to half a percent.
				assert.ok(
					delivered.width >= required - Math.max(2, required * 0.005),
					`${img.current}: ${delivered.width}px cannot cover ${required}px`,
				);
				if (
					img.photo &&
					scenario.width === 412 &&
					scenario.deviceScaleFactor > 1
				)
					assert.ok(
						delivered.width <= required * 1.2,
						`${img.current}: oversized for ${required}px mobile photo`,
					);
				if (img.src === "assets/images/oren.jpg")
					assert.ok(
						delivered.width <= required * 1.2,
						`${img.current}: oversized for ${required}px instructor photo`,
					);
			}
			await page.close();
		});
	}
});
