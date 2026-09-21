import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

test("search and answer choices avoid pointer outlines while keeping keyboard focus visible", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		const page = await browser.newPage({
			viewport: { width, height: 900 },
			hasTouch: width === 390,
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/course/");
		const search = page.locator("#topic-search");
		const field = page.locator(".search-field");
		const border = await field.evaluate(
			(element) => getComputedStyle(element).borderColor,
		);
		await search[width === 390 ? "tap" : "click"]();
		assert.equal(
			await field.evaluate(
				(element) => getComputedStyle(element).outlineStyle,
			),
			"none",
		);
		assert.equal(
			await search.evaluate(
				(element) => getComputedStyle(element).outlineStyle,
			),
			"none",
		);
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");
		assert.equal(
			await search.evaluate(
				(element) => element === document.activeElement,
			),
			true,
		);
		assert.notEqual(
			await field.evaluate(
				(element) => getComputedStyle(element).borderColor,
			),
			border,
			"search keeps a visible focus border",
		);
		await page.goto(
			"http://gallery.test/course/priority-hierarchy/quizzes/priority/",
		);
		const answer = page.locator(".quiz-answers label:visible").first();
		await answer[width === 390 ? "tap" : "click"]();
		assert.equal(await answer.locator("input").isChecked(), true);
		assert.equal(
			await answer.evaluate(
				(element) => getComputedStyle(element).outlineStyle,
			),
			"none",
		);
		await page.keyboard.press("ArrowDown");
		const keyboardAnswer = page.locator(
			".quiz-answers label:has(input:focus)",
		);
		assert.equal(
			await keyboardAnswer.evaluate(
				(element) => getComputedStyle(element).outlineStyle,
			),
			"solid",
		);
		assert.equal(
			await keyboardAnswer.evaluate(
				(element) => getComputedStyle(element).outlineWidth,
			),
			"3px",
		);
		await page.close();
	}
});
