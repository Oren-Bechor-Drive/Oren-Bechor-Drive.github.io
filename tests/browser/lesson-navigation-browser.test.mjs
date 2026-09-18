import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

for (const javaScriptEnabled of [true, false]) {
	test(`lesson contents scroll smoothly without focusing sections, JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, { timeout: 15_000 }, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390]) {
			const page = await browser.newPage({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: "no-preference" });
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/course/right-of-way/");
			const link = page.locator('.lesson-contents a[href="#u-turn"]');
			await link.focus();
			const start = await page.evaluate(() => scrollY);
			await page.keyboard.press("Enter");
			// Poll from Node: page animation callbacks do not run with JavaScript disabled.
			const samples = [];
			const deadline = Date.now() + 5000;
			let top;
			do {
				const position = await page.evaluate(() => ({ y: scrollY, top: document.getElementById("u-turn").getBoundingClientRect().top }));
				samples.push(position.y);
				top = position.top;
				if (Math.abs(top - 24) < 2) break;
				await setTimeout(50);
			} while (Date.now() < deadline);
			assert.ok(Math.abs(top - 24) < 2, "the section reaches its scroll offset");
			const state = await page.evaluate(() => ({
				behavior: getComputedStyle(document.documentElement).scrollBehavior,
				focusedSection: document.activeElement.matches(".lesson-section"),
				outlinedSection: document.getElementById("u-turn").matches(":focus-visible"),
				end: scrollY,
			}));
			assert.equal(state.behavior, "smooth");
			assert.ok(samples.some(y => y > start + 5 && y < state.end - 5), "the viewport traverses intermediate positions");
			assert.equal(state.focusedSection, false);
			assert.equal(state.outlinedSection, false);
			assert.equal(new URL(page.url()).hash, "#u-turn");
			await page.emulateMedia({ reducedMotion: "reduce" });
			assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
			await page.goto("http://gallery.test/course/right-of-way/");
			await page.locator('.lesson-contents a[href="#left-turn"]').click();
			const reducedTop = await page.locator("#left-turn").evaluate(element => element.getBoundingClientRect().top);
			assert.ok(Math.abs(reducedTop - 24) < 2, "reduced motion reaches its destination immediately");
			await page.close();
		}
	});
}
