import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

for (const width of [1366, 390]) {
	test(`hero entrance stays within reach, settles on focus and runs once per session at ${width}px`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "no-preference" });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		const entering = await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual").evaluateAll(elements => elements.map(element => {
			const animation = element.getAnimations()[0];
			animation.pause();
			animation.currentTime = 0;
			const timing = animation.effect.getTiming();
			const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
			const rect = element.getBoundingClientRect();
			return { x: matrix.m41, y: matrix.m42, opacity: Number(getComputedStyle(element).opacity), duration: timing.duration, delay: timing.delay, iterations: timing.iterations, visible: rect.left < innerWidth && rect.right > 0 && rect.top < innerHeight };
		}));
		assert.ok(entering.length >= 4);
		for (const state of entering) {
			assert.equal(state.x, 0);
			assert.equal(state.y, 16);
			assert.equal(state.opacity, 0);
			assert.equal(state.duration, 280);
			assert.equal(state.delay, 0);
			assert.equal(state.iterations, 1);
			assert.equal(state.visible, true, "entrance geometry remains within the initial viewport");
		}
		await page.locator(".hero-actions a").first().focus();
		assert.deepEqual(await page.evaluate(() => {
			const rect = document.activeElement.getBoundingClientRect();
			return { scrollY, visible: rect.top >= 0 && rect.bottom <= innerHeight, heroScroll: document.querySelector(".hero").scrollTop };
		}), { scrollY: 0, visible: true, heroScroll: 0 });
		assert.ok(await page.locator(".hero-copy > p, .hero-actions").evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === "none" && getComputedStyle(element).opacity === "1")));
		await page.reload();
		assert.equal(await page.locator("html").getAttribute("data-hero-entrance"), "false");
		assert.equal(await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual").evaluateAll(elements => elements.flatMap(element => element.getAnimations()).length), 0, "repeat visits do not replay entrances");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	});

	test(`reduced motion and disabled JavaScript expose settled hero content at ${width}px`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const javaScriptEnabled of [true, false]) {
			const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce", javaScriptEnabled });
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			assert.ok(await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual").evaluateAll(elements => elements.every(element => element.getAnimations().length === 0 && getComputedStyle(element).opacity === "1" && getComputedStyle(element).transform === "none")));
			assert.equal(await page.locator(".hero-actions a").first().getAttribute("href"), "#topics");
			assert.equal(await page.locator(".hero-actions a").last().getAttribute("href"), "#instructor");
			await page.close();
		}
	});
}
