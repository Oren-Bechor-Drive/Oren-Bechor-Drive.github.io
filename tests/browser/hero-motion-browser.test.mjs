import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

test("hero keeps its two sentences and yellow word underlines", async t => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ reducedMotion: "reduce" });
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	assert.deepEqual(await page.locator(".hero-sentence").allTextContents(), ["להבין את הכביש.", "לקבל החלטות."]);
	assert.deepEqual(await page.locator(".hero-underline").evaluateAll(elements => elements.map(element => ({
		word: element.textContent,
		line: getComputedStyle(element).textDecorationLine,
		color: getComputedStyle(element).textDecorationColor,
	}))), [
		{ word: "להבין", line: "underline", color: "rgb(246, 219, 120)" },
		{ word: "לקבל", line: "underline", color: "rgb(246, 219, 120)" },
	]);
});

test("phone hero fills the viewport below the header and grows for larger text", async t => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ reducedMotion: "reduce" });
	await page.route("**/*", serveRoadMedia);
	for (const viewport of [{ width: 320, height: 667 }, { width: 390, height: 844 }, { width: 412, height: 932 }, { width: 768, height: 390 }]) {
		await page.setViewportSize(viewport);
		await page.goto("http://gallery.test/");
		const layout = await page.evaluate(() => {
			const hero = document.querySelector(".hero").getBoundingClientRect();
			const header = document.querySelector(".site-header").getBoundingClientRect();
			return { top: hero.top, height: hero.height, headerBottom: header.bottom, available: innerHeight - header.bottom };
		});
		assert.equal(layout.top, layout.headerBottom);
		assert.ok(layout.height >= layout.available - 1, `${viewport.width}x${viewport.height}: hero fills the available viewport`);
		if (viewport.height > 500) assert.ok(Math.abs(layout.height - layout.available) <= 1, "portrait hero ends at the viewport bottom");
	}
	await page.setViewportSize({ width: 320, height: 667 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	const enlarged = await page.evaluate(() => {
		const hero = document.querySelector(".hero");
		const content = [...hero.querySelectorAll("h1, p, .hero-actions, .hero-visual")].map(element => element.getBoundingClientRect());
		const bounds = hero.getBoundingClientRect();
		return { height: bounds.height, available: innerHeight - bounds.top, contentInside: content.every(rect => rect.top >= bounds.top && rect.bottom <= bounds.bottom) };
	});
	assert.ok(enlarged.height > enlarged.available, "enlarged content can extend past one viewport");
	assert.equal(enlarged.contentInside, true, "larger text stays inside the naturally growing hero");
});

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
