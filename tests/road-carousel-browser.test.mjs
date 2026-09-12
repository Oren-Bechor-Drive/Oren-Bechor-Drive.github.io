import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const contentTypes = {
	".html": "text/html", ".css": "text/css", ".js": "text/javascript",
	".png": "image/png", ".jpg": "image/jpeg",
};

test("real gallery styles keep animation working across viewport changes", { timeout: 30000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
	// Serve the actual project files without a dev server or external font requests.
	await page.route("**/*", async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== "http://gallery.test") return route.abort();
		const filename = path.join(rootDir, url.pathname === "/" ? "index.html" : url.pathname);
		try {
			const bytes = await readFile(filename);
			await route.fulfill({
				contentType: contentTypes[path.extname(filename)] ?? "application/octet-stream",
				body: route.request().method() === "HEAD" ? "" : bytes,
			});
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
			await route.fulfill({ status: 404, body: "" });
		}
	});
	await page.goto("http://gallery.test/");
	await page.locator('[data-road-carousel][data-ready="true"]').waitFor();

	for (const [name, width, secondsPerCar] of [
		["desktop", 1440, 11.111111],
		["phone", 390, 9.462366],
		["desktop after resize", 1440, 11.111111],
	]) {
		await t.test(name, async () => {
			await page.setViewportSize({ width, height: 900 });
			// Wait for the resize event and its style update to finish.
			await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			const state = await page.locator("[data-road-carousel]").evaluate(root => {
				const group = root.querySelector(".road-carousel-group");
				const track = root.querySelector(".road-carousel-track");
				const animation = track.getAnimations().find(animation => animation.animationName === "road-scroll");
				return {
					cadence: Number(getComputedStyle(root).getPropertyValue("--road-seconds-per-car")),
					duration: parseFloat(getComputedStyle(track).animationDuration),
					carStep: group.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(group).columnGap),
					distance: group.getBoundingClientRect().width,
					playState: animation?.playState,
				};
			});
			assert.equal(state.cadence, secondsPerCar, "production CSS must supply the approved cadence");
			assert.equal(state.playState, "running", "production styles must create a running road animation");
			assert.ok(state.duration > 0, "the loop must have a usable duration");
			assert.ok(Math.abs(state.duration - state.distance / state.carStep * secondsPerCar) < 0.001);
		});
	}

	await t.test("reduced motion", async () => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		assert.equal(await page.locator(".road-carousel-track").evaluate(track => track.getAnimations().length), 0);
		assert.equal(await page.locator('.road-carousel-group[aria-hidden="true"]').isVisible(), false);
	});
});
