import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const types = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
};

for (const [width, late] of [
	[1366, false],
	[390, false],
	[5000, false],
	[1366, true],
	[1366, "resize"],
]) {
	test(`progressive loading keeps position, order and deferred icons at ${width}px${late === "resize" ? " after widening during loading" : late ? " with reduced motion during a pending append" : ""}`, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		t.after(() => release());
		let kitRequests = 0;
		const requestedImages = [];
		await page.route("**/*", async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.hostname === "kit.fontawesome.com") {
				kitRequests++;
				return route.fulfill({ contentType: "text/javascript", body: "" });
			}
			if (url.origin !== "http://gallery.test") return route.abort();
			if (
				request.method() !== "HEAD" &&
				url.pathname.includes("students-pass")
			) {
				requestedImages.push(url.pathname);
				if (
					(late === "resize" ? /\/7\.(png|webp)$/ : /\/15\.(png|webp)$/).test(
						url.pathname,
					)
				)
					await gate;
			}
			try {
				const filename =
					url.pathname === "/" ? "index.html" : url.pathname.slice(1);
				const bytes = await readFile(new URL(filename, root));
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
		await page.goto("http://gallery.test/", { waitUntil: "domcontentloaded" });
		await page.locator('[data-ready="true"]').waitFor();
		await page.waitForFunction(
			(count) =>
				document.querySelector(".road-carousel-group").children.length ===
				count,
			late === "resize" ? 6 : 14,
		);
		if (late === "resize") {
			await page.setViewportSize({ width: 5000, height: 844 });
			await page.waitForTimeout(50);
		}
		assert.equal(await page.locator(".road-loader").isVisible(), false);
		assert.equal(kitRequests, 0);
		const leftBefore = await page.evaluate((late) => {
			if (late === "resize") return null;
			const animation = document
				.querySelector(".road-carousel-track")
				.getAnimations()[0];
			animation.pause();
			animation.currentTime = late
				? Number(animation.effect.getTiming().duration) - 2000
				: 4000;
			return document.querySelector(".road-car").getBoundingClientRect().left;
		}, late);
		release();
		if (late === true) {
			await page.waitForTimeout(50);
			assert.equal(
				await page
					.locator(".road-carousel-group")
					.first()
					.locator(".road-car")
					.count(),
				14,
			);
			await page.emulateMedia({ reducedMotion: "reduce" });
		}
		await page.waitForFunction(
			() =>
				document.querySelector(".road-carousel-group").children.length === 15,
			null,
			{ timeout: 1500 },
		);
		const state = await page.evaluate(() => ({
			left: document.querySelector(".road-car").getBoundingClientRect().left,
			photos: [
				...document
					.querySelector(".road-carousel-group")
					.querySelectorAll(".road-photo img"),
			].map((img) => ({
				src: img.src,
				current: img.currentSrc,
				loaded: img.complete && img.naturalWidth > 0,
			})),
			groups: [...document.querySelectorAll(".road-carousel-group")].map(
				(group) => group.innerHTML,
			),
		}));
		if (!late)
			assert.ok(
				Math.abs(state.left - leftBefore) < 1,
				"appending must not move the visible cars",
			);
		assert.deepEqual(
			state.photos.map((photo) => Number(photo.src.match(/\/(\d+)\.png$/)[1])),
			Array.from({ length: 15 }, (_, i) => i + 1),
		);
		assert.ok(
			state.photos.every(
				(photo) => photo.loaded && photo.current.endsWith(".webp"),
			),
		);
		assert.equal(state.groups[0], state.groups[1]);
		assert.ok(
			requestedImages.every((src) => src.endsWith(".webp")),
			"student PNG bodies should not be downloaded",
		);
		await page.locator(".site-footer").scrollIntoViewIfNeeded();
		await page.waitForFunction(
			() => !!document.querySelector('script[src*="kit.fontawesome.com"]'),
		);
		assert.equal(kitRequests, 1);
	});
}
