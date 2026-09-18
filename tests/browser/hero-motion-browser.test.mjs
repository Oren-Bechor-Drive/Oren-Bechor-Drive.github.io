import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

import { serveRoadMedia } from "../helpers/road-media.mjs";

test("early hero focus keeps the button visible without scrolling the page", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1366, 390]) {
		await t.test(`${width}px`, async () => {
			const page = await browser.newPage({
				viewport: { width, height: 844 },
				reducedMotion: "no-preference",
			});
			t.after(() => page.close());
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			// Make native focus scrolling immediate so a smooth-scroll delay cannot hide it.
			const startsBelowViewport = await page.evaluate(() => {
				document.documentElement.style.scrollBehavior = "auto";
				for (const element of document.querySelectorAll(
					".hero-copy > *",
				)) {
					const animation = element.getAnimations()[0];
					animation.pause();
					animation.currentTime = 0;
				}
				return (
					document
						.querySelector(".hero-actions a")
						.getBoundingClientRect().top >= innerHeight
				);
			});
			assert.equal(
				startsBelowViewport,
				true,
				"focus must exercise the off-screen entrance even on a slow load",
			);
			await page.locator(".hero-actions a").first().focus();
			const state = await page.evaluate(() => {
				const bounds = document.activeElement.getBoundingClientRect();
				return {
					scrollY,
					visible: bounds.top >= 0 && bounds.bottom <= innerHeight,
				};
			});
			assert.deepEqual(state, { scrollY: 0, visible: true });
		});
	}
});

test("stop sign enters from the left, overshoots, and corrects back once", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1366, 769, 768, 390]) {
		await t.test(`${width}px`, async () => {
			const page = await browser.newPage({
				viewport: { width, height: 844 },
				reducedMotion: "no-preference",
			});
			t.after(() => page.close());
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			const sample = (time) =>
				page.locator(".hero-visual").evaluate((element, time) => {
					const animation = element.getAnimations()[0];
					animation.pause();
					animation.currentTime = time;
					const style = getComputedStyle(element);
					const matrix = new DOMMatrixReadOnly(style.transform);
					return {
						x: matrix.m41,
						angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
						right: element.getBoundingClientRect().right,
						opacity: Number(style.opacity),
						overflow:
							document.documentElement.scrollWidth > innerWidth,
					};
				}, time);
			const start = await sample(0);
			assert.ok(
				start.right < 0,
				"the complete tilted sign starts beyond the left edge",
			);
			const mobile = width <= 768;
			const afterDelay = await sample(400);
			if (mobile) {
				assert.equal(
					afterDelay.x,
					start.x,
					"mobile sign waits off screen during its added delay",
				);
			} else {
				assert.ok(
					afterDelay.x > start.x,
					"desktop entrance starts without the mobile delay",
				);
			}
			const arrival = await sample(1200);
			assert.ok(
				arrival.x > 0 && arrival.angle < 0,
				"sign passes its resting point while leaning left",
			);
			const correction = await sample(mobile ? 1320 : 1380);
			assert.ok(
				correction.x > 0 &&
					correction.x < arrival.x &&
					correction.angle > 0,
				"sign moves back while tilting right",
			);
			const returning = await sample(mobile ? 1340 : 1410);
			assert.ok(
				returning.x > 0 &&
					returning.x < correction.x &&
					returning.angle < correction.angle,
				"the final correction returns position and angle together",
			);
			for (const time of [mobile ? 1360 : 1440, 3000, 6000]) {
				const settled = await sample(time);
				assert.equal(
					settled.x,
					0,
					"sign stays at its resting point after the final correction",
				);
				assert.equal(
					settled.angle,
					0,
					"sign remains upright without replaying",
				);
				assert.equal(
					settled.opacity,
					1,
					"production entrance never fades for a loop reset",
				);
			}
			assert.ok(
				[start, arrival, correction, returning].every(
					(state) => !state.overflow,
				),
				"entrance and overshoot do not create horizontal scrolling",
			);
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.waitForFunction(
				() =>
					document.querySelector(".hero-visual").getAnimations()
						.length === 0,
			);
			assert.deepEqual(
				await page.locator(".hero-visual").evaluate((element) => ({
					animations: element.getAnimations().length,
					transform: getComputedStyle(element).transform,
				})),
				{ animations: 0, transform: "none" },
			);
		});
	}
});

test("hero slides title from the right and description with buttons from below at full opacity", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1366, 390]) {
		await t.test(`${width}px`, async () => {
			const page = await browser.newPage({
				viewport: { width, height: 844 },
				reducedMotion: "no-preference",
			});
			t.after(() => page.close());
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			const timings = await page
				.locator(".hero-copy > *")
				.evaluateAll((elements) =>
					elements.map((element) =>
						element.getAnimations()[0].effect.getComputedTiming(),
					),
				);
			const duration = timings[0].duration;
			const delay = timings[1].delay;
			const end = Math.max(...timings.map((timing) => timing.endTime));
			assert.ok(delay > 0, "lower content follows the title");
			const sample = async (time) =>
				page.locator(".hero-copy > *").evaluateAll(
					(elements, time) =>
						elements.map((element) => {
							const animation = element.getAnimations()[0];
							animation.pause();
							animation.currentTime = time;
							const style = getComputedStyle(element);
							const transform = new DOMMatrixReadOnly(
								style.transform,
							);
							return {
								opacity: Number(style.opacity),
								x: transform.m41,
								y: transform.m42,
							};
						}),
					time,
				);
			const start = await sample(0);
			const initialBounds = await page
				.locator(".hero-copy > *")
				.evaluateAll((elements) =>
					elements.map((element) => {
						const rect = element.getBoundingClientRect();
						return { left: rect.left, top: rect.top };
					}),
				);
			assert.ok(
				initialBounds[0].left >= width,
				"title starts completely beyond the right edge",
			);
			assert.ok(
				initialBounds[1].top >= 844,
				"description starts completely below the viewport",
			);
			assert.ok(
				initialBounds[2].top >= 844,
				"buttons start completely below the viewport",
			);
			assert.ok(start[0].x > 0, "title starts to the right");
			assert.equal(start[0].y, 0);
			assert.ok(
				start[1].y > 0,
				"description starts below its resting position",
			);
			for (const time of [
				0,
				duration / 6,
				delay + duration / 6,
				(duration * 5) / 6,
				end,
			]) {
				const state = await sample(time);
				assert.deepEqual(
					state.map((element) => element.opacity),
					[1, 1, 1],
					"content stays fully opaque",
				);
				assert.deepEqual(
					state[1],
					state[2],
					"description and buttons move together",
				);
				assert.equal(state[0].y, 0, "title moves horizontally only");
				assert.equal(
					state[1].x,
					0,
					"description and buttons move vertically only",
				);
				assert.equal(
					await page.evaluate(
						() =>
							document.documentElement.scrollWidth <= innerWidth,
					),
					true,
					"entrances must not introduce horizontal scrolling",
				);
			}
			const early = await sample(duration / 6);
			assert.ok(
				early[0].x > 0 && early[0].x < start[0].x / 2,
				"title covers most of its distance early",
			);
			assert.equal(
				(await sample(delay / 2))[1].y,
				start[1].y,
				"lower content waits for its entrance",
			);
			const middle = await sample(delay + duration / 6);
			assert.ok(
				middle[1].y > 0 && middle[1].y < start[1].y / 2,
				"lower content also starts quickly",
			);
			const late = await sample((duration * 5) / 6);
			const settled = await sample(end);
			assert.ok(
				start[0].x - early[0].x > late[0].x - settled[0].x,
				"motion slows as it finishes",
			);
			assert.deepEqual(
				settled,
				Array.from({ length: 3 }, () => ({ opacity: 1, x: 0, y: 0 })),
			);
			await sample(0);
			const attemptedScroll = await page
				.locator(".hero")
				.evaluate((element) => {
					// Exercise scrollability directly instead of relying on focus/animation timing.
					element.scrollTop = 1;
					const scrollTop = element.scrollTop;
					element.scrollTop = 0;
					return scrollTop;
				});
			assert.equal(
				attemptedScroll,
				0,
				"off-screen entrances must not make the hero internally scrollable",
			);
			await page.locator(".hero-actions a").first().focus();
			const focusState = await page.evaluate(() => ({
				scrollTop: document.querySelector(".hero").scrollTop,
				buttonVisible: (() => {
					const bounds =
						document.activeElement.getBoundingClientRect();
					return bounds.top >= 0 && bounds.bottom <= innerHeight;
				})(),
				positions: [
					...document.querySelectorAll(
						".hero-copy > p, .hero-actions",
					),
				].map(
					(element) =>
						new DOMMatrixReadOnly(
							getComputedStyle(element).transform,
						).m42,
				),
			}));
			assert.equal(
				focusState.scrollTop,
				0,
				"focusing an entering button must not scroll the hero internally",
			);
			assert.equal(
				focusState.buttonVisible,
				true,
				"focus must keep the settled button in the viewport",
			);
			assert.deepEqual(
				focusState.positions,
				[0, 0],
				"focus settles the description and buttons immediately",
			);
			await page.locator(".hero-actions a").last().focus();
			assert.equal(
				await page
					.locator(".hero-actions")
					.evaluate(
						(element) =>
							new DOMMatrixReadOnly(
								getComputedStyle(element).transform,
							).m42,
					),
				0,
				"moving focus must not restart the entrance",
			);
			await page
				.locator(".hero-actions a")
				.last()
				.evaluate((element) => element.blur());
			assert.deepEqual(
				await page
					.locator(".hero-copy > p, .hero-actions")
					.evaluateAll((elements) =>
						elements.map(
							(element) =>
								new DOMMatrixReadOnly(
									getComputedStyle(element).transform,
								).m42,
						),
					),
				[0, 0],
				"leaving the hero must not restart its finished entrances",
			);
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.waitForFunction(() =>
				[...document.querySelectorAll(".hero-copy > *")].every(
					(element) =>
						element.getAnimations().length === 0 &&
						getComputedStyle(element).opacity === "1" &&
						getComputedStyle(element).transform === "none",
				),
			);
		});
	}
});
