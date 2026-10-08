import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { startAccountGateway } from "../helpers/account-gateway.mjs";

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
		await page.keyboard.type("מעגל");
		for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
			await page.keyboard.press(key);
			assert.equal(await field.evaluate(element => getComputedStyle(element).outlineStyle), "none", `${key} edits search without a navigation ring`);
			assert.equal(await page.evaluate(() => document.documentElement.dataset.inputMode), "pointer");
		}
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");
		assert.equal(
			await search.evaluate(
				(element) => element === document.activeElement,
			),
			true,
		);
		assert.deepEqual(await field.evaluate(element => {
			const style = getComputedStyle(element);
			return [style.outlineStyle, style.outlineWidth, style.outlineOffset];
		}), ["solid", "3px", "4px"], "keyboard search has the shared focus ring");
		await page.goto(
			"http://gallery.test/course/priority-hierarchy/quiz/",
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
		assert.equal(await keyboardAnswer.locator("input").isChecked(), true, "native radio navigation changes the selection");
		await answer[width === 390 ? "tap" : "click"]();
		assert.equal(await answer.evaluate(element => getComputedStyle(element).outlineStyle), "none", "pointer input hides the keyboard ring again");
		await page.close();
	}
});

test("pointer email caret editing and Enter submission keep account feedback ring-free", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	for (const width of [1440, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 900 } });
		await page.goto(`${app.origin}/account/login.html`);
		await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
		const email = page.locator("#email");
		await email.click();
		await page.keyboard.type("learner@example.test");
		for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
			await page.keyboard.press(key);
			assert.equal(await email.evaluate(element => getComputedStyle(element).outlineStyle), "none", `${key} preserves pointer editing`);
			assert.equal(await page.evaluate(() => document.documentElement.dataset.inputMode), "pointer");
		}
		assert.equal(await email.inputValue(), "learner@example.test");
		const password = page.locator("#password");
		await password.click();
		await page.keyboard.type("wrong-password");
		await page.keyboard.press("Enter");
		const feedback = page.locator('[role="alert"]');
		await feedback.waitFor({ state: "visible" });
		assert.equal(await feedback.evaluate(element => element === document.activeElement), true);
		assert.equal(await feedback.evaluate(element => getComputedStyle(element).outlineStyle), "none", "pointer-origin submission keeps the focused error ring-free");
		assert.equal(await page.evaluate(() => document.documentElement.dataset.inputMode), "pointer");
		await page.close();
	}
});
