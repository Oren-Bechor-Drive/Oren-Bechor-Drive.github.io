import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

test("mobile disclosures animate pointer input without delaying keyboard or focus", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 390, height: 844 },
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	await page.locator(".topic-select").waitFor({ state: "attached" });

	for (const [triggerSelector, surfaceSelector] of [
		[".menu-toggle", ".site-menu"],
		[".topic-select", ".topic-options"],
	]) {
		await t.test(surfaceSelector, async () => {
			const trigger = page.locator(triggerSelector);
			const surface = page.locator(surfaceSelector);
			await trigger.click();
			const opening = await surface.evaluate((element) => {
				const animations = element.getAnimations();
				animations.forEach((animation) => animation.pause());
				return animations.map(
					(animation) => animation.transitionProperty,
				);
			});
			assert.ok(
				opening.includes("opacity"),
				"pointer opening must bridge the visibility change",
			);
			assert.equal(
				await surface.evaluate((element) => element.inert),
				false,
			);
			// Pausing halfway makes the interruption deterministic, without wall-clock sleeps.
			await surface.evaluate((element) => {
				element.getAnimations().forEach((animation) => {
					animation.currentTime = 70;
				});
			});
			await trigger.click();
			assert.equal(
				await surface.evaluate((element) => element.inert),
				true,
				"a fading menu must stop accepting input immediately",
			);
			assert.ok(
				await surface.evaluate((element) =>
					element
						.getAnimations()
						.some(
							(animation) =>
								animation.transitionProperty === "opacity",
						),
				),
				"an interrupted entrance must reverse into an exit",
			);
			await trigger.click();
			assert.equal(await trigger.getAttribute("aria-expanded"), "true");
			assert.equal(
				await surface.evaluate((element) => element.inert),
				false,
			);
			await page.keyboard.press("Escape");
			assert.equal(await surface.isVisible(), false);
			assert.equal(
				await trigger.evaluate(
					(element) => element === document.activeElement,
				),
				true,
			);
			await page.keyboard.press("Enter");
			assert.equal(await surface.isVisible(), true);
			assert.equal(
				await surface.evaluate(
					(element) => element.getAnimations().length,
				),
				0,
				"keyboard opening must be immediate",
			);
			await page.keyboard.press("Escape");
			await trigger.hover();
			await page.mouse.down();
			assert.ok(
				await trigger.evaluate(
					(element) => element.getAnimations().length > 0,
				),
				"pointer press must provide feedback",
			);
			await page.mouse.up();
			await page.keyboard.press("Escape");
			await trigger.click();
			await surface.evaluate(async (element) => {
				await Promise.all(
					element
						.getAnimations()
						.map((animation) => animation.finished),
				);
			});
			await trigger.click();
			await surface.waitFor({ state: "hidden" });
			assert.equal(
				await surface.evaluate((element) => element.inert),
				true,
			);
		});
	}

	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.locator(".topic-select").click();
	assert.equal(
		await page
			.locator(".topic-options")
			.evaluate((element) => getComputedStyle(element).transform),
		"none",
	);
	assert.equal(
		await page
			.locator(".topic-options")
			.evaluate((element) =>
				getComputedStyle(element)
					.transitionDuration.split(",")[0]
					.trim(),
			),
		"0.08s",
	);
	await page.keyboard.press("Escape");
	await page.locator(".topic-select").hover();
	await page.mouse.down();
	const reducedPress = await page
		.locator(".topic-select")
		.evaluate((element) => {
			element.getAnimations().forEach((animation) => animation.finish());
			return {
				transform: getComputedStyle(element).transform,
				opacity: getComputedStyle(element).opacity,
			};
		});
	assert.deepEqual(reducedPress, { transform: "none", opacity: "0.92" });
	await page.mouse.up();
	await page.keyboard.press("Escape");
	for (const [triggerSelector, surfaceSelector] of [
		[".menu-toggle", ".site-menu"],
		[".topic-select", ".topic-options"],
	]) {
		await page.locator(triggerSelector).click();
		await page.locator(surfaceSelector).evaluate(async (element) => {
			await Promise.all(
				element.getAnimations().map((animation) => animation.finished),
			);
		});
		await page.locator(triggerSelector).click();
		assert.ok(
			await page
				.locator(surfaceSelector)
				.evaluate(
					(element) =>
						element.inert &&
						element
							.getAnimations()
							.some(
								(animation) =>
									animation.transitionProperty === "opacity",
							),
				),
			"reduced-motion closing must retain the gentle fade while immediately blocking input",
		);
		await page.locator(surfaceSelector).waitFor({ state: "hidden" });
	}
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.waitForFunction(
		() => !document.querySelector(".site-menu").inert,
	);
	assert.equal(await page.locator(".site-menu").isVisible(), true);
	assert.equal(
		await page.locator(".site-menu").evaluate((element) => element.inert),
		false,
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForFunction(
		() => document.querySelector(".site-menu").inert,
	);
	assert.equal(await page.locator(".site-menu").isVisible(), false);
	assert.equal(await page.locator(".topic-options").isVisible(), false);
});

test("touch selection closes the list immediately and canceled presses release feedback", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true,
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	const trigger = page.locator(".topic-select");
	await trigger.tap();
	await page.locator(".topic-option").nth(1).tap();
	assert.equal(await trigger.getAttribute("aria-expanded"), "false");
	assert.equal(
		await page
			.locator(".topic-options")
			.evaluate((element) => element.inert),
		true,
	);
	assert.equal(
		await trigger.textContent(),
		await page
			.locator(".topic-card")
			.nth(1)
			.textContent()
			.then((text) => text.trim()),
	);
	assert.equal(
		await trigger.evaluate((element) => element === document.activeElement),
		true,
	);
	await trigger.dispatchEvent("pointerdown", {
		isPrimary: true,
		button: 0,
		pointerType: "touch",
	});
	await trigger.dispatchEvent("pointercancel", { pointerType: "touch" });
	assert.equal(await trigger.getAttribute("data-pressed"), null);
});
