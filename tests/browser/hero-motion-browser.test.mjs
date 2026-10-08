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
	test(`hero entrance stays within reach and settles on focus at ${width}px`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "no-preference" });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		const entering = await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual").evaluateAll(elements => elements.map(element => {
			const animation = element.getAnimations({ subtree: true })[0];
			animation.pause();
			animation.currentTime = 0;
			const timing = animation.effect.getTiming();
			const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
			const rect = element.getBoundingClientRect();
			return { sign: element.classList.contains("hero-visual"), x: matrix.m41, y: matrix.m42, opacity: Number(getComputedStyle(element).opacity), duration: timing.duration, delay: timing.delay, iterations: timing.iterations, visible: rect.left < innerWidth && rect.right > 0 && rect.top < innerHeight };
		}));
		assert.ok(entering.length >= 4);
		for (const state of entering) {
			assert.equal(state.x, width > 768 ? (state.sign ? -36 : 36) : 0);
			assert.equal(state.y, width > 768 ? 0 : 14);
			assert.equal(state.opacity, 0);
			assert.equal(state.duration, 500);
			assert.equal(state.delay, 0);
			assert.equal(state.iterations, 1);
			assert.equal(state.visible, true, "entrance geometry remains within the initial viewport");
		}
		await page.locator(".hero-actions a").first().focus();
		assert.deepEqual(await page.evaluate(() => {
			const rect = document.activeElement.getBoundingClientRect();
			return { scrollY, visible: rect.top >= 0 && rect.bottom <= innerHeight, heroScroll: document.querySelector(".hero").scrollTop };
		}), { scrollY: 0, visible: true, heroScroll: 0 });
		assert.ok(await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual").evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === "none" && getComputedStyle(element).opacity === "1")));
		assert.equal(await page.locator("html").getAttribute("data-hero-entrance"), "false");
		assert.equal(await page.locator(".hero-underline").evaluateAll(elements => elements.flatMap(element => element.getAnimations({ subtree: true })).length), 0, "focus settles the underline sweeps too");
		await page.locator(".brand").focus();
		assert.equal(await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual, .hero-underline").evaluateAll(elements => elements.flatMap(element => element.getAnimations({ subtree: true })).length), 0, "leaving the hero does not restart the sequence");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	});

	test(`hero entrance and underlines replay on every reload at ${width}px`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "no-preference" });
		await page.route("**/*", serveRoadMedia);
		await page.addInitScript(() => { sessionStorage.setItem("hero-seen", "true"); });
		await page.goto("http://gallery.test/");
		for (let visit = 0; visit < 3; visit++) {
			if (visit > 0) await page.reload();
			assert.equal(await page.locator("html").getAttribute("data-hero-entrance"), "true", "previous visits do not suppress the entrance");
			assert.ok(await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual, .hero-underline").evaluateAll(elements => elements.every(element => element.getAnimations({ subtree: true }).length > 0)), "every load includes the entrance and both underline sweeps");
			await page.locator(".hero-actions a").first().focus();
			assert.equal(await page.locator("html").getAttribute("data-hero-entrance"), "false");
		}
	});

	test(`amber underlines sweep from the right after the entrance at ${width}px`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "no-preference" });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		const sweeps = await page.locator(".hero-underline").evaluateAll(elements => elements.map(element => {
			const animation = element.getAnimations({ subtree: true })[0];
			if (!animation) return null;
			animation.pause();
			animation.currentTime = 0;
			const timing = animation.effect.getTiming();
			const style = getComputedStyle(element, "::after");
			return { duration: timing.duration, delay: timing.delay, iterations: timing.iterations, color: style.backgroundColor, origin: parseFloat(style.transformOrigin), width: parseFloat(style.width), scale: new DOMMatrixReadOnly(style.transform).m11 };
		}));
		assert.ok(sweeps.every(Boolean), "both emphasized words have an underline sweep");
		for (const [index, sweep] of sweeps.entries()) {
			assert.equal(sweep.duration, 320);
			assert.equal(sweep.delay, 500 + index * 80, "underlines wait for the entrance, then stagger");
			assert.equal(sweep.iterations, 1);
			assert.equal(sweep.color, "rgb(246, 219, 120)");
			assert.ok(Math.abs(sweep.origin - sweep.width) < 1, "the sweep starts at the word's right edge");
			assert.equal(sweep.scale, 0, "underlines stay hidden before their turn");
		}
		const progress = await page.locator(".hero-underline").evaluateAll(elements => elements.map(element => {
			const before = element.getBoundingClientRect();
			element.getAnimations({ subtree: true })[0].currentTime = 700;
			const after = element.getBoundingClientRect();
			return { scale: new DOMMatrixReadOnly(getComputedStyle(element, "::after").transform).m11, stable: before.x === after.x && before.width === after.width };
		}));
		assert.ok(progress[0].scale > progress[1].scale && progress[1].scale > 0 && progress[0].scale < 1, "the first underline leads the second");
		assert.ok(progress.every(state => state.stable), "the text stays still while its underline grows");
		await page.emulateMedia({ reducedMotion: "reduce" });
		assert.equal(await page.locator(".hero-underline").evaluateAll(elements => elements.flatMap(element => element.getAnimations({ subtree: true })).length), 0);
		assert.ok(await page.locator(".hero-underline").evaluateAll(elements => elements.every(element => getComputedStyle(element).textDecorationColor === "rgb(246, 219, 120)")), "enabling reduced motion restores static amber underlines");
	});

	test(`reduced motion and disabled JavaScript expose settled hero content at ${width}px`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const { javaScriptEnabled, reducedMotion } of [{ javaScriptEnabled: true, reducedMotion: "reduce" }, { javaScriptEnabled: false, reducedMotion: "reduce" }, { javaScriptEnabled: false, reducedMotion: "no-preference" }]) {
			const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion, javaScriptEnabled });
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			assert.ok(await page.locator(".hero-copy > h1, .hero-copy > p, .hero-actions, .hero-visual, .hero-underline").evaluateAll(elements => elements.every(element => element.getAnimations({ subtree: true }).length === 0 && getComputedStyle(element).opacity === "1" && getComputedStyle(element).transform === "none")));
			assert.ok(await page.locator(".hero-underline").evaluateAll(elements => elements.every(element => getComputedStyle(element).textDecorationColor === "rgb(246, 219, 120)")));
			assert.equal(await page.locator(".hero-actions a").first().getAttribute("href"), "#topics");
			assert.equal(await page.locator(".hero-actions a").last().getAttribute("href"), "#instructor");
			await page.close();
		}
	});
}
