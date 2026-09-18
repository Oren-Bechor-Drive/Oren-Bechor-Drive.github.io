import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

test("question dropdown supports keyboard exploration, cancellation and selection", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	await page.route("**/*", serveRoadMedia);
	await page.goto(
		"http://gallery.test/course/right-of-way/quizzes/priority/",
	);
	const trigger = page.getByRole("combobox", { name: "מעבר לשאלה" });
	await trigger.focus();
	await page.keyboard.press("ArrowDown");
	assert.equal(await trigger.getAttribute("aria-expanded"), "true");
	await page.keyboard.press("End");
	assert.equal(
		await trigger.getAttribute("aria-activedescendant"),
		"question-option-19",
	);
	assert.equal(
		await page.locator(".quiz-question").first().isVisible(),
		true,
	);
	assert.equal(
		await trigger.evaluate((element) => element === document.activeElement),
		true,
	);
	assert.equal(
		await page
			.locator(".question-options")
			.evaluate((element) => element.getAnimations().length),
		0,
	);
	await page.keyboard.press("Escape");
	assert.equal(await trigger.getAttribute("aria-expanded"), "false");
	await page.keyboard.press("ArrowUp");
	await page.keyboard.press("End");
	await page.keyboard.press("ArrowUp");
	await page.keyboard.press("Enter");
	assert.equal(
		await page.locator(".quiz-question").nth(18).isVisible(),
		true,
	);
	assert.equal(
		await page
			.locator(".quiz-question")
			.nth(18)
			.locator("legend")
			.evaluate((element) => element === document.activeElement),
		true,
	);
	await trigger.focus();
	await page.keyboard.press("Space");
	await page.keyboard.press("Home");
	await page.keyboard.press("Space");
	assert.equal(
		await page.locator(".quiz-question").first().isVisible(),
		true,
	);
	await trigger.focus();
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Tab");
	assert.equal(await trigger.getAttribute("aria-expanded"), "false");
});

for (const width of [1440, 390]) {
	test(`question dropdown animates pointer changes and stays contained at ${width}px`, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({
			viewport: { width, height: 720 },
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto(
			"http://gallery.test/course/right-of-way/quizzes/priority/",
		);
		const trigger = page.getByRole("combobox", { name: "מעבר לשאלה" });
		const list = page.locator(".question-options");
		await trigger.click();
		await page.waitForFunction(
			() =>
				document.querySelector(".question-options").getAnimations()
					.length > 0,
		);
		await list.evaluate((element) =>
			Promise.all(
				element.getAnimations().map((animation) => animation.finished),
			),
		);
		const bounds = await list.boundingBox();
		assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
		assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 720);
		assert.equal(
			await list.evaluate(
				(element) => element.scrollHeight > element.clientHeight,
			),
			true,
		);
		await page.getByRole("option").last().click();
		assert.equal(
			await page.locator(".quiz-question").last().isVisible(),
			true,
		);
		await trigger.click();
		await page.locator("h1").click();
		assert.equal(await trigger.getAttribute("aria-expanded"), "false");
		assert.equal(await list.evaluate((element) => element.inert), true);
		await trigger.click();
		await page.keyboard.press("ArrowDown");
		assert.equal(
			await list.evaluate((element) => element.getAnimations().length),
			0,
		);
		await trigger.click();
		await trigger.click();
		await page.emulateMedia({ reducedMotion: "reduce" });
		assert.equal(
			await list.evaluate((element) => element.getAnimations().length),
			0,
		);
		await trigger.click();
		assert.equal(await list.isVisible(), false);
		assert.equal(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
			true,
		);
	});
}
