import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

import { serveRoadMedia } from "./helpers/road-media.mjs";

const revealCases = [
	{
		section: "#instructor",
		targets: [".instructor-intro", "blockquote"],
		start: [{ x: 24, y: 0 }, { x: -24, y: 0 }],
		durations: [520, 520],
		delays: [0, 90],
	},
	{
		section: "#about",
		targets: [".about-title-block", ".about-copy", ".road-question"],
		start: [{ x: 0, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 16 }],
		durations: [480, 480, 520],
		delays: [0, 0, 110],
	},
	{
		section: "#topics",
		targets: [".section-heading", ".topic-explorer"],
		start: [{ x: 0, y: 18 }, { x: 0, y: 22 }],
		durations: [420, 500],
		delays: [0, 80],
	},
];

async function motionState(root, targets) {
	return root.locator(targets.join(", ")).evaluateAll(elements =>
		elements.map(element => {
			const style = getComputedStyle(element);
			const matrix = new DOMMatrixReadOnly(style.transform);
			return {
				opacity: Number(style.opacity),
				x: matrix.m41,
				y: matrix.m42,
			};
		}));
}

// Keep capture and its failure deadline together so a missing reveal cannot hang CI.
function captureReveal(root, targets) {
	return root.evaluate((element, selectors) => new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			observer.disconnect();
			reject(new Error(`Reveal did not finish starting for #${element.id}`));
		}, 2_000);
		const observer = new MutationObserver(() => {
			if (element.dataset.scrollState !== "visible") return;
			observer.disconnect();
			requestAnimationFrame(() => {
				clearTimeout(timeout);
				resolve(selectors.flatMap(selector =>
					[...element.querySelector(selector).getAnimations()].map(animation => {
						animation.pause();
						const { delay, duration, easing } = animation.effect.getTiming();
						return { property: animation.transitionProperty, delay, duration, easing };
					})));
			});
		});
		observer.observe(element, { attributes: true, attributeFilter: ["data-scroll-state"] });
		element.scrollIntoView({ behavior: "instant", block: "center" });
	}), targets);
}

test("course sections reveal once as they enter the viewport", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 1366, height: 768 },
		reducedMotion: "no-preference",
	});
	await page.route("**/*", serveRoadMedia);

	for (const { section, targets, start, durations, delays } of revealCases) {
		await t.test(section, async () => {
			await page.goto("http://gallery.test/");
			const root = page.locator(section);
			await page.waitForFunction(
				selector => document.querySelector(selector)?.dataset.scrollState === "pending",
				section,
				{ timeout: 1_000 },
			);
			const startingState = await motionState(root, targets);
			assert.deepEqual(startingState, start.map(({ x, y }) => ({ opacity: 0, x, y })));

			const timing = await captureReveal(root, targets);
			assert.deepEqual(
				timing.filter(({ property }) => property === "opacity")
					.map(({ duration, delay, easing }) => ({ duration, delay, easing })),
				durations.map((duration, index) => ({
					duration,
					delay: delays[index],
					easing: "cubic-bezier(0.23, 1, 0.32, 1)",
				})),
			);
			assert.deepEqual(
				timing.filter(({ property }) => property === "transform")
					.map(({ duration, delay, easing }) => ({ duration, delay, easing })),
				durations.map((duration, index) => ({
					duration,
					delay: delays[index],
					easing: "cubic-bezier(0.23, 1, 0.32, 1)",
				})),
			);
			await root.locator(targets.join(", ")).evaluateAll(async elements => {
				for (const animation of elements.flatMap(element => element.getAnimations())) animation.finish();
			});
			assert.deepEqual(
				await motionState(root, targets),
				Array.from({ length: targets.length }, () => ({ opacity: 1, x: 0, y: 0 })),
			);

			await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
			await root.evaluate(element => element.scrollIntoView({ behavior: "instant", block: "center" }));
			assert.equal(await root.getAttribute("data-scroll-state"), "visible");
			assert.ok(await root.locator(targets.join(", ")).evaluateAll(elements =>
				elements.every(element => element.getAnimations().length === 0)),
			"a completed reveal must not replay");
		});
	}
});

test("the observer waits for 20% visibility above its 12% bottom inset", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	const root = page.locator("#instructor");
	await page.waitForFunction(() => document.querySelector("#instructor")?.dataset.scrollState === "pending");
	const measurement = await root.evaluate(element => {
		const effectiveBottom = innerHeight * 0.88;
		const desiredTop = effectiveBottom - element.offsetHeight * 0.19;
		const distance = element.getBoundingClientRect().top - desiredTop;
		scrollBy({ top: distance, behavior: "instant" });
		return { effectiveBottom, height: element.offsetHeight };
	});
	await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
	assert.equal(await root.getAttribute("data-scroll-state"), "pending",
		"19% visibility inside the reduced observer viewport must not reveal the section");
	await page.evaluate(height => scrollBy({ top: height * 0.02, behavior: "instant" }), measurement.height);
	await page.waitForFunction(() => document.querySelector("#instructor")?.dataset.scrollState === "visible");
	const visibleGeometry = await root.evaluate((element, effectiveBottom) => ({
		ratio: (effectiveBottom - element.getBoundingClientRect().top) / element.offsetHeight,
		viewportBottom: innerHeight,
	}), measurement.effectiveBottom);
	assert.ok(visibleGeometry.ratio >= 0.2 && visibleGeometry.ratio < 0.22);
	assert.ok(measurement.effectiveBottom < visibleGeometry.viewportBottom,
		"the observer viewport must include the 12% bottom inset");
});

test("reduced motion keeps the reveal as a short opacity fade", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 390, height: 844 },
		reducedMotion: "reduce",
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	const root = page.locator("#about");
	await page.waitForFunction(() => document.querySelector("#about")?.dataset.scrollState === "pending");
	const targets = revealCases[1].targets;
	assert.ok((await motionState(root, targets)).every(state =>
		state.opacity === 0 && state.x === 0 && state.y === 0));
	const timing = await captureReveal(root, targets);
	assert.deepEqual(
		timing,
		Array.from({ length: 3 }, () => ({
			property: "opacity",
			delay: 0,
			duration: 80,
			easing: "cubic-bezier(0.23, 1, 0.32, 1)",
		})),
	);
});

test("course content stays visible when JavaScript is unavailable", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 844 },
	});
	const page = await context.newPage();
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	for (const { section, targets } of revealCases) {
		assert.deepEqual(
			await motionState(page.locator(section), targets),
			Array.from({ length: targets.length }, () => ({ opacity: 1, x: 0, y: 0 })),
		);
	}
});

test("course content stays visible when IntersectionObserver is unavailable", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
	await page.addInitScript(() => {
		Object.defineProperty(window, "IntersectionObserver", {
			configurable: true,
			value: undefined,
		});
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	for (const { section, targets } of revealCases) {
		const root = page.locator(section);
		assert.equal(await root.getAttribute("data-scroll-state"), null);
		assert.deepEqual(
			await motionState(root, targets),
			Array.from({ length: targets.length }, () => ({ opacity: 1, x: 0, y: 0 })),
		);
	}
});

test("the stacked instructor layout enters upward on phones", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 390, height: 844 },
		reducedMotion: "no-preference",
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	await page.waitForFunction(() => document.querySelector("#instructor")?.dataset.scrollState === "pending");
	assert.deepEqual(
		await motionState(page.locator("#instructor"), revealCases[0].targets),
		[
			{ opacity: 0, x: 0, y: 16 },
			{ opacity: 0, x: 0, y: 16 },
		],
	);
	const root = page.locator("#instructor");
	await root.evaluate(element => element.scrollIntoView({ behavior: "instant", block: "center" }));
	await page.waitForFunction(() => document.querySelector("#instructor")?.dataset.scrollState === "visible");
	await root.locator(revealCases[0].targets.join(", ")).evaluateAll(async elements => {
		for (const animation of elements.flatMap(element => element.getAnimations())) animation.finish();
	});
	assert.deepEqual(
		await motionState(root, revealCases[0].targets),
		[
			{ opacity: 1, x: 0, y: 0 },
			{ opacity: 1, x: 0, y: 0 },
		],
	);
	await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
	await root.evaluate(element => element.scrollIntoView({ behavior: "instant", block: "center" }));
	assert.ok(await root.locator(revealCases[0].targets.join(", ")).evaluateAll(elements =>
		elements.every(element => element.getAnimations().length === 0)),
	"the phone reveal must not replay");
});

test("topic focus immediately settles pending and running reveals", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1366, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		await page.route("**/*", serveRoadMedia);
		for (const running of [false, true]) {
			await page.goto("http://gallery.test/");
			const root = page.locator("#topics");
			await page.waitForFunction(() => document.querySelector("#topics").dataset.scrollMotion === "ready");
			if (running) {
				await root.evaluate(element => element.scrollIntoView({ behavior: "instant" }));
				await page.waitForFunction(() => document.querySelector(".topic-explorer").getAnimations().length > 0);
			}
			const focused = await page.evaluate(() => {
				const control = document.querySelector(innerWidth < 640 ? ".topic-select" : ".topic-card");
				control.focus({ preventScroll: true });
				return control === document.activeElement;
			});
			assert.equal(focused, true);
			assert.deepEqual(await motionState(root, revealCases[2].targets), [
				{ opacity: 1, x: 0, y: 0 },
				{ opacity: 1, x: 0, y: 0 },
			]);
			assert.ok(await root.locator(".scroll-reveal-target").evaluateAll(elements =>
				elements.every(element => element.getAnimations().length === 0)));
		}
		await page.close();
	}
});

test("printing exposes all sections before the learner scrolls", { timeout: 10_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
	await page.route("**/*", serveRoadMedia);
	for (const reducedMotion of ["no-preference", "reduce"]) {
		await page.emulateMedia({ media: "screen", reducedMotion });
		await page.goto("http://gallery.test/");
		await page.waitForFunction(() => document.querySelector("#about").dataset.scrollState === "pending");
		await page.emulateMedia({ media: "print" });
		for (const { section, targets } of revealCases) {
			assert.deepEqual(await motionState(page.locator(section), targets),
				targets.map(() => ({ opacity: 1, x: 0, y: 0 })));
		}
	}
});
