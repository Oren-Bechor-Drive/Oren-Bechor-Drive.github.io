import assert from "node:assert/strict";
import test from "node:test";
import { chromium, firefox, webkit } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const modes = [
	{ name: "enabled", javaScriptEnabled: true, blockEntry: false },
	{ name: "disabled", javaScriptEnabled: false, blockEntry: false },
	{ name: "entry module blocked", javaScriptEnabled: true, blockEntry: true },
];

const browserTypes = [chromium, firefox, webkit];

async function faqRevealState(page) {
	return page.locator("#faq .scroll-reveal-target").evaluateAll((targets) =>
		targets.map((target) => {
			const style = getComputedStyle(target);
			const matrix = new DOMMatrixReadOnly(style.transform);
			return {
				opacity: Number(style.opacity),
				x: matrix.m41,
				y: matrix.m42,
			};
		}),
	);
}

function captureFaqReveal(root) {
	return root.evaluate(
		(section) =>
			new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					observer.disconnect();
					reject(new Error("FAQ reveal did not start"));
				}, 2_000);
				const observer = new MutationObserver(() => {
					if (section.dataset.scrollState !== "visible") return;
					observer.disconnect();
					requestAnimationFrame(() => {
						clearTimeout(timeout);
						resolve(
							[...section.querySelectorAll(".scroll-reveal-target")]
								.flatMap((target) => [...target.getAnimations()])
								.map((animation) => {
									animation.pause();
									const { delay, duration, easing } =
										animation.effect.getTiming();
									return {
										property: animation.transitionProperty,
										delay,
										duration,
										easing,
									};
								}),
						);
					});
				});
				observer.observe(section, {
					attributes: true,
					attributeFilter: ["data-scroll-state"],
				});
				section.scrollIntoView({ behavior: "instant", block: "center" });
			}),
	);
}

test(
	"homepage FAQ navigation and disclosures work across enhancement modes",
	{ timeout: 35_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());

		for (const mode of modes) {
			for (const width of [1440, 390]) {
				const page = await browser.newPage({
					javaScriptEnabled: mode.javaScriptEnabled,
					reducedMotion: "reduce",
					viewport: { width, height: 844 },
				});
				await page.route("**/*", (route) =>
					mode.blockEntry &&
					new URL(route.request().url()).pathname === "/js/script.js"
						? route.abort()
						: serveRoadMedia(route),
				);
				await page.goto("http://gallery.test/");

				const enhanced = mode.name === "enabled";
				if (width < 769 && enhanced) {
					assert.equal(await page.locator(".site-menu").isVisible(), false);
					await page.locator(".menu-toggle").click();
				} else {
					assert.equal(await page.locator(".site-menu").isVisible(), true);
					assert.equal(await page.locator(".menu-toggle").isVisible(), false);
				}

				await page.locator('.site-menu a[href="#faq"]').click();
				assert.equal(new URL(page.url()).hash, "#faq");
				assert.equal(await page.locator("#faq details").count(), 5);
				assert.equal(await page.locator("#faq").isVisible(), true);
				assert.deepEqual(
					await faqRevealState(page),
					Array.from({ length: 2 }, () => ({ opacity: 1, x: 0, y: 0 })),
					`${mode.name} ${width}px FAQ content remains fully visible`,
				);
				if (width < 769 && enhanced) {
					assert.equal(
						await page.locator(".site-menu").getAttribute("data-open"),
						"false",
					);
					await page.locator(".site-menu").waitFor({ state: "hidden" });
				}

				const alignment = await page.evaluate(() => ({
					faqTop: document.querySelector("#faq").getBoundingClientRect().top,
					headerBottom: document
						.querySelector(".site-header")
						.getBoundingClientRect().bottom,
				}));
				const expectedTop = width < 769 && !enhanced ? 0 : alignment.headerBottom;
				assert.ok(
					Math.abs(alignment.faqTop - expectedTop) <= 1,
					`${mode.name} ${width}px FAQ anchor clears the header`,
				);

				const first = page.locator("#faq details").first();
				const firstSummary = first.locator("summary");
				const focusIndicator = () =>
					firstSummary.evaluate((summary) => {
						const item = summary.closest("details");
						const style = getComputedStyle(summary);
						const summaryBounds = summary.getBoundingClientRect();
						const clipBounds = item.getBoundingClientRect();
						return {
							focused: summary.matches(":focus-visible"),
							insetFocus:
								style.boxShadow.includes("inset") &&
								style.boxShadow.includes("rgb(38, 71, 150)"),
							summaryInsideClip:
								summaryBounds.top >= clipBounds.top &&
								summaryBounds.right <= clipBounds.right &&
								summaryBounds.bottom <= clipBounds.bottom &&
								summaryBounds.left >= clipBounds.left,
							open: item.open,
						};
					});
				await firstSummary.focus();
				await page.keyboard.press("Tab");
				await page.keyboard.press("Shift+Tab");
				await firstSummary.evaluate((summary) => {
					for (const animation of summary.getAnimations()) animation.finish();
				});
				await page.screenshot();
				assert.deepEqual(
					await focusIndicator(),
					{
						focused: true,
						insetFocus: true,
						summaryInsideClip: true,
						open: false,
					},
					`${mode.name} ${width}px closed FAQ focus stays inside the card`,
				);
				await page.keyboard.press("Enter");
				assert.equal(await first.getAttribute("open"), "");
				assert.equal(await first.locator("p").isVisible(), true);
				await page.screenshot();
				assert.deepEqual(
					await focusIndicator(),
					{
						focused: true,
						insetFocus: true,
						summaryInsideClip: true,
						open: true,
					},
					`${mode.name} ${width}px open FAQ focus stays inside the card`,
				);
				assert.equal(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
					true,
				);
				await page.close();
			}
		}
	},
);

test(
	"homepage FAQ reveals once and keyboard navigation settles it immediately",
	{ timeout: 20_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());

		for (const width of [1440, 390]) {
			const page = await browser.newPage({
				reducedMotion: "no-preference",
				viewport: { width, height: 844 },
			});
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			const root = page.locator("#faq");
			await page.waitForFunction(
				() =>
					document.querySelector("#faq")?.dataset.scrollState === "pending",
			);
			assert.deepEqual(await faqRevealState(page), [
				{ opacity: 0, x: 0, y: 8 },
				{ opacity: 0, x: 0, y: 8 },
			]);

			const timing = await captureFaqReveal(root);
			assert.deepEqual(
				timing
					.sort((a, b) => a.property.localeCompare(b.property))
					.map(({ property, delay, duration, easing }) => ({
						property,
						delay,
						duration,
						easing,
					})),
				["opacity", "opacity", "transform", "transform"].map(
					(property) => ({
						property,
						delay: 0,
						duration: 280,
						easing: "cubic-bezier(0.23, 1, 0.32, 1)",
					}),
				),
			);
			await root.locator(".scroll-reveal-target").evaluateAll((targets) => {
				for (const animation of targets.flatMap((target) =>
					target.getAnimations(),
				))
					animation.finish();
			});
			await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
			await root.evaluate((section) =>
				section.scrollIntoView({ behavior: "instant", block: "center" }),
			);
			assert.equal(await root.getAttribute("data-scroll-state"), "visible");
			assert.equal(
				await root
					.locator(".scroll-reveal-target")
					.evaluateAll((targets) =>
						targets.flatMap((target) => target.getAnimations()).length,
					),
				0,
				"the FAQ entrance must not replay",
			);

			await page.goto("http://gallery.test/");
			await page.waitForFunction(
				() =>
					document.querySelector("#faq")?.dataset.scrollState === "pending",
			);
			if (width < 769) await page.locator(".menu-toggle").click();
			await page.locator('.site-menu a[href="#faq"]').focus();
			await page.keyboard.press("Enter");
			await page.waitForFunction(() => location.hash === "#faq");
			assert.deepEqual(
				await root.evaluate((section) => ({
					active: document.activeElement === section,
					state: section.dataset.scrollState,
					animationCount: [
						...section.querySelectorAll(".scroll-reveal-target"),
					].flatMap((target) => target.getAnimations()).length,
				})),
				{ active: true, state: "visible", animationCount: 0 },
			);
			await page.close();
		}

		const reducedPage = await browser.newPage({
			reducedMotion: "reduce",
			viewport: { width: 390, height: 844 },
		});
		await reducedPage.route("**/*", serveRoadMedia);
		await reducedPage.goto("http://gallery.test/");
		const reducedRoot = reducedPage.locator("#faq");
		await reducedPage.waitForFunction(
			() => document.querySelector("#faq")?.dataset.scrollState === "pending",
		);
		assert.deepEqual(
			(await captureFaqReveal(reducedRoot)).map(
				({ property, delay, duration, easing }) => ({
					property,
					delay,
					duration,
					easing,
				}),
			),
			Array.from({ length: 2 }, () => ({
				property: "opacity",
				delay: 0,
				duration: 80,
				easing: "cubic-bezier(0.23, 1, 0.32, 1)",
			})),
		);
		await reducedPage.close();
	},
);

test(
	"homepage FAQ animates pointer toggles and settles keyboard and reduced-motion input",
	{ timeout: 45_000 },
	async (t) => {
		for (const browserType of browserTypes) {
			await t.test(browserType.name(), async (t) => {
				const browser = await browserType.launch();
				t.after(() => browser.close());
				const page = await browser.newPage({
					viewport: { width: 1440, height: 900 },
				});
				await page.route("**/*", serveRoadMedia);
				await page.goto("http://gallery.test/#faq");
				await page.waitForFunction(
					() =>
						document.querySelector("#faq .faq-item")?.dataset.expanded ===
						"false",
				);

				assert.equal(
					await page
						.locator(".faq-heading")
						.evaluate((heading) => getComputedStyle(heading).position),
					"static",
					"the desktop FAQ heading stays in normal flow",
				);

				const item = page.locator("#faq .faq-item").first();
				const heightAnimationCount = () =>
					item.evaluate(
						(details) =>
							details
								.getAnimations()
								.filter((animation) =>
									animation.effect
										.getKeyframes()
										.some((keyframe) => "height" in keyframe),
								).length,
					);
				const sampleToggle = () =>
					item.evaluate((details) => {
						const before = details.getBoundingClientRect().height;
						details.querySelector("summary").dispatchEvent(
							new MouseEvent("click", {
								bubbles: true,
								cancelable: true,
								detail: 1,
							}),
						);
						const animation = details
							.getAnimations()
							.find((candidate) =>
								candidate.effect
									.getKeyframes()
									.some((keyframe) => "height" in keyframe),
							);
						animation.pause();
						animation.currentTime = 0;
						const start = details.getBoundingClientRect().height;
						animation.currentTime = 80;
						return {
							before,
							start,
							middle: details.getBoundingClientRect().height,
							duration: animation.effect.getTiming().duration,
							open: details.open,
							expanded: details.dataset.expanded,
							chevronDuration: getComputedStyle(
								details.querySelector("summary"),
								"::after",
							).transitionDuration,
						};
					});

				const opening = await sampleToggle();
				assert.ok(Math.abs(opening.before - opening.start) < 1);
				assert.ok(opening.middle > opening.start);
				assert.equal(opening.duration, 220);
				assert.equal(opening.chevronDuration, "0.22s");
				assert.equal(opening.expanded, "true");

				const closing = await sampleToggle();
				assert.ok(
					Math.abs(closing.before - closing.start) < 1,
					"closing starts at the interrupted visible height",
				);
				assert.ok(closing.middle < closing.start);
				assert.equal(
					closing.open,
					true,
					"closing content stays rendered while its card shrinks",
				);
				assert.equal(closing.expanded, "false");

				const reopening = await sampleToggle();
				assert.ok(
					Math.abs(reopening.before - reopening.start) < 1,
					"rapid reopening reverses from the current visible height",
				);
				assert.ok(reopening.middle > reopening.start);

				await item.locator("summary").focus();
				await page.keyboard.press("Enter");
				assert.equal(await item.getAttribute("open"), null);
				assert.equal(
					await heightAnimationCount(),
					0,
					"keyboard activation is immediate",
				);

				await page.emulateMedia({ reducedMotion: "no-preference" });
				await item.locator("summary").click();
				await page.emulateMedia({ reducedMotion: "reduce" });
				await page.waitForFunction(
					(details) =>
						details
							.getAnimations()
							.every((animation) =>
								animation.effect
									.getKeyframes()
									.every((keyframe) => !("height" in keyframe)),
							),
					await item.elementHandle(),
				);
				assert.equal(
					await heightAnimationCount(),
					0,
					"enabling reduced motion settles active FAQ motion",
				);
				await item.locator("summary").click();
				assert.equal(await item.getAttribute("open"), null);
				assert.equal(
					await heightAnimationCount(),
					0,
					"reduced-motion pointer toggles are immediate",
				);
			});
		}
	},
);
