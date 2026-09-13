import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

import { serveRoadMedia } from "./helpers/road-media.mjs";

test("hero slides title from the right and description with buttons from below at full opacity", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1366, 390]) {
		await t.test(`${width}px`, async () => {
			const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "no-preference" });
			t.after(() => page.close());
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			const timings = await page.locator(".hero-copy > *").evaluateAll(elements =>
				elements.map(element => element.getAnimations()[0].effect.getComputedTiming()));
			const duration = timings[0].duration;
			const delay = timings[1].delay;
			const end = Math.max(...timings.map(timing => timing.endTime));
			assert.ok(delay > 0, "lower content follows the title");
			const sample = async (time) => page.locator(".hero-copy > *").evaluateAll((elements, time) =>
				elements.map(element => {
					const animation = element.getAnimations()[0];
					animation.pause();
					animation.currentTime = time;
					const style = getComputedStyle(element);
					const transform = new DOMMatrixReadOnly(style.transform);
					return { opacity: Number(style.opacity), x: transform.m41, y: transform.m42 };
				}), time);
			const start = await sample(0);
			const initialBounds = await page.locator(".hero-copy > *").evaluateAll(elements =>
				elements.map(element => {
					const rect = element.getBoundingClientRect();
					return { left: rect.left, top: rect.top };
				}));
			assert.ok(initialBounds[0].left >= width, "title starts completely beyond the right edge");
			assert.ok(initialBounds[1].top >= 844, "description starts completely below the viewport");
			assert.ok(initialBounds[2].top >= 844, "buttons start completely below the viewport");
			assert.ok(start[0].x > 0, "title starts to the right");
			assert.equal(start[0].y, 0);
			assert.ok(start[1].y > 0, "description starts below its resting position");
			for (const time of [0, duration / 6, delay + duration / 6, duration * 5 / 6, end]) {
				const state = await sample(time);
				assert.deepEqual(state.map(element => element.opacity), [1, 1, 1], "content stays fully opaque");
				assert.deepEqual(state[1], state[2], "description and buttons move together");
				assert.equal(state[0].y, 0, "title moves horizontally only");
				assert.equal(state[1].x, 0, "description and buttons move vertically only");
				assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
					"entrances must not introduce horizontal scrolling");
			}
			const early = await sample(duration / 6);
			assert.ok(early[0].x > 0 && early[0].x < start[0].x / 2, "title covers most of its distance early");
			assert.equal((await sample(delay / 2))[1].y, start[1].y, "lower content waits for its entrance");
			const middle = await sample(delay + duration / 6);
			assert.ok(middle[1].y > 0 && middle[1].y < start[1].y / 2, "lower content also starts quickly");
			const late = await sample(duration * 5 / 6);
			const settled = await sample(end);
			assert.ok(start[0].x - early[0].x > late[0].x - settled[0].x, "motion slows as it finishes");
			assert.deepEqual(settled, Array.from({ length: 3 }, () => ({ opacity: 1, x: 0, y: 0 })));
			const roadCoversEntrances = await page.evaluate(() => {
				const road = document.querySelector(".hero-road");
				const roadRect = road.getBoundingClientRect();
				// Enable hit testing only for this paint-order check; the road stays noninteractive in production.
				road.style.pointerEvents = "auto";
				try {
					return [...document.querySelectorAll(".hero-copy > p, .hero-actions")].map(element => {
						const animation = element.getAnimations()[0];
						const { delay, duration } = animation.effect.getTiming();
						for (let step = 1; step < 20; step++) {
							animation.currentTime = delay + duration * step / 20;
							const rect = element.getBoundingClientRect();
							const top = Math.max(rect.top, roadRect.top);
							const bottom = Math.min(rect.bottom, roadRect.bottom);
							if (bottom > top) {
								return road.contains(document.elementFromPoint(rect.left + rect.width / 2, (top + bottom) / 2));
							}
						}
						return false;
					});
				} finally {
					road.style.removeProperty("pointer-events");
				}
			});
			assert.deepEqual(roadCoversEntrances, [true, true], "description and buttons must pass behind the road");
			await sample(0);
			await page.locator(".hero-actions a").first().focus();
			const focusState = await page.evaluate(() => ({
				scrollTop: document.querySelector(".hero").scrollTop,
				positions: [...document.querySelectorAll(".hero-copy > p, .hero-actions")].map(element =>
					new DOMMatrixReadOnly(getComputedStyle(element).transform).m42),
			}));
			assert.equal(focusState.scrollTop, 0, "focusing an entering button must not scroll the hero internally");
			assert.deepEqual(focusState.positions, [0, 0], "focus settles the description and buttons immediately");
			await page.locator(".hero-actions a").last().focus();
			assert.equal(await page.locator(".hero-actions").evaluate(element =>
				new DOMMatrixReadOnly(getComputedStyle(element).transform).m42), 0, "moving focus must not restart the entrance");
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.waitForFunction(() => [...document.querySelectorAll(".hero-copy > *")]
				.every(element => element.getAnimations().length === 0 && getComputedStyle(element).opacity === "1"
					&& getComputedStyle(element).transform === "none"));
		});
	}
});
