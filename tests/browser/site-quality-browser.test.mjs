import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const representativePages = [
	"/",
	"/course/",
	"/course/right-of-way/",
	"/course/right-of-way/quizzes/left-turn/",
];

test("representative pages reflow without horizontal document scrolling", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const path of representativePages) {
		for (const javaScriptEnabled of [true, false]) {
			for (const width of [320, 390, 1440]) {
				const page = await browser.newPage({
					javaScriptEnabled,
					reducedMotion: "reduce",
					viewport: { width, height: 720 },
				});
				await page.route("**/*", serveRoadMedia);
				await page.goto(`http://gallery.test${path}`);
				assert.equal(
					await page.evaluate(
						() =>
							document.documentElement.scrollWidth <=
							document.documentElement.clientWidth,
					),
					true,
					`${path} fits ${width}px with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`,
				);
				await page.close();
			}
		}
	}
});

test("reduced motion shows the skip link without a transition", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		reducedMotion: "reduce",
		viewport: { width: 390, height: 720 },
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	const skipLink = page.locator(".skip-link");
	await skipLink.focus();
	const state = await skipLink.evaluate((link) => ({
		top: link.getBoundingClientRect().top,
		transitionDuration: getComputedStyle(link).transitionDuration,
	}));
	assert.ok(state.top >= 0, "the focused skip link is immediately on screen");
	assert.equal(state.transitionDuration, "0s");
});
