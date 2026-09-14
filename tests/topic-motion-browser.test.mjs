import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "./helpers/road-media.mjs";

test("topic feedback skips unchanged selections and leaves the note still", { timeout: 10_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	const panel = page.locator(".topic-panel");
	await page.locator(".topic-card").first().dispatchEvent("click", { detail: 1 });
	assert.equal(await panel.getAttribute("data-updating"), "false", "reselecting the active topic does nothing");
	await page.locator(".topic-card").nth(1).dispatchEvent("click", { detail: 1 });
	assert.equal(await panel.getAttribute("data-updating"), "true", "pointer selection retains feedback");
	assert.deepEqual(await page.locator(".topic-note").evaluate(element => ({
		opacity: getComputedStyle(element).opacity,
		transform: getComputedStyle(element).transform,
		animations: element.getAnimations().length,
	})), { opacity: "1", transform: "none", animations: 0 });
});

test("keyboard topic selection updates and settles content immediately", { timeout: 15_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1366, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		// Interrupt a pointer update as well as exercising keyboard activation.
		await page.locator(".topic-card").nth(1).dispatchEvent("click", { detail: 1 });
		if (width < 640) {
			await page.locator(".topic-select").focus();
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("End");
		} else await page.locator(".topic-card").last().focus();
		await page.keyboard.press("Enter");
		assert.equal(await page.locator("[data-topic-panel-title]").textContent(),
			(await page.locator(".topic-card").last().textContent()).trim());
		assert.equal(await page.locator(".topic-panel").getAttribute("data-updating"), "false");
		assert.deepEqual(await page.locator(".topic-panel > div").evaluate(element => ({
			opacity: getComputedStyle(element).opacity,
			transform: getComputedStyle(element).transform,
			animations: element.getAnimations().length,
		})), { opacity: "1", transform: "none", animations: 0 });
		await page.close();
	}
});

test("enabling reduced motion settles a pending topic update and affects later selections", { timeout: 10_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ reducedMotion: "no-preference" });
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/");
	await page.clock.install();
	await page.clock.pauseAt(new Date(Date.now() + 1_000));
	await page.locator(".topic-card").nth(1).dispatchEvent("click", { detail: 1 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.waitForFunction(() => document.querySelector(".topic-panel").dataset.updating === "false",
		null, { polling: 10, timeout: 1_000 });
	assert.equal(await page.locator(".topic-panel").getAttribute("data-updating"), "false");
	assert.equal(await page.locator("[data-topic-panel-title]").textContent(),
		(await page.locator(".topic-card").nth(1).textContent()).trim());
	await page.locator(".topic-card").nth(2).dispatchEvent("click", { detail: 1 });
	assert.equal(await page.locator(".topic-panel").getAttribute("data-updating"), "false");
	assert.deepEqual(await page.locator(".topic-panel > div").evaluate(element => ({
		opacity: getComputedStyle(element).opacity,
		transform: getComputedStyle(element).transform,
	})), { opacity: "1", transform: "none" });
});
