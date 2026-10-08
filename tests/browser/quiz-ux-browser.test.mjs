import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

async function quizPage(t, { width = 320, javaScriptEnabled = true } = {}) {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width, height: width === 320 ? 568 : 900 },
		javaScriptEnabled,
		reducedMotion: "reduce",
	});
	page.setDefaultTimeout(5000);
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	t.after(() => assert.deepEqual(errors, []));
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/priority-hierarchy/quiz/");
	return page;
}

for (const width of [320, 1440]) {
	test(`quiz start and navigation retain the card, progress and actions at ${width}px`, async t => {
		const page = await quizPage(t, { width });
		await page.locator("[data-quiz-start]").click();
		assert.equal(await page.locator(".lesson-intro > p").first().isVisible(), false);
		assert.equal(await page.locator("[data-quiz-previous]").isVisible(), false);
		assert.equal(await page.locator("[data-quiz-progress]").getAttribute("aria-valuetext"), "0 מתוך 15 שאלות נענו");
		await page.locator(".quiz-question:visible input").first().check();
		assert.equal(await page.locator("[data-quiz-progress]").getAttribute("aria-valuetext"), "1 מתוך 15 שאלות נענו");
		await page.locator("[data-quiz-next]").click();
		const toolbar = await page.locator("[data-quiz-toolbar]").boundingBox();
		const card = await page.locator(".quiz-question:visible").boundingBox();
		const header = await page.locator(".course-header").boundingBox();
		assert.ok(toolbar.y >= header.y + header.height - 1, "sticky progress follows the header");
		assert.ok(card.y >= toolbar.y + toolbar.height - 1, "the focused question starts below progress");
		assert.equal(await page.locator(".quiz-question:visible legend").evaluate(element => element === document.activeElement), true);
		assert.equal(await page.locator(".quiz-question:visible legend").evaluate(element => getComputedStyle(element).outlineStyle), "none", "pointer navigation must not show a focus ring");
		if (width === 320) {
			const previous = await page.locator("[data-quiz-previous]").boundingBox();
			const next = await page.locator("[data-quiz-next]").boundingBox();
			assert.equal(previous.y, next.y, "phone controls fit one row");
			assert.ok(next.y + next.height <= 568, "phone actions stay within the viewport");
			assert.ok((await page.locator(".quiz-question:visible label").first().boundingBox()).y < next.y, "at least one choice appears above the controls");
		}
		await page.keyboard.press("Tab");
		assert.ok(await page.locator(".quiz-question:visible label").evaluateAll(labels => labels.some(label => getComputedStyle(label).outlineStyle !== "none")), "keyboard navigation restores visible focus");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	});

	test(`the submission summary permits edits and leaves answers unlocked until checking at ${width}px`, async t => {
		const page = await quizPage(t, { width });
		const questions = page.locator(".quiz-question");
		const keys = await questions.evaluateAll(items => items.map(question => question.dataset.correctAnswer));
		for (const [index, value] of keys.entries()) {
			await questions.nth(index).locator(`input[value="${value}"]`).check();
			await page.locator("[data-quiz-next]").click();
		}
		assert.equal(await page.locator("[data-quiz-summary]").isVisible(), true);
		assert.equal(await page.locator("[data-quiz-result]").isVisible(), false);
		assert.equal(await page.locator(".quiz-question input:disabled").count(), 0);
		assert.equal(await page.locator("[data-quiz-feedback]:visible").count(), 0);
		await page.locator(".quiz-summary-answers button").first().click();
		const wrong = (Number(keys[0]) + 1) % 4;
		await questions.first().locator(`input[value="${wrong}"]`).check();
		await page.getByRole("combobox", { name: "מעבר לשאלה" }).click();
		await page.getByRole("option").last().click();
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-submit]").click();
		assert.equal(await page.locator("[data-quiz-result]").isVisible(), true);
		assert.match(await page.locator("[data-quiz-count]").innerText(), /14 מתוך 15/);
		assert.equal(await page.locator("[data-quiz-score]").innerText(), "93%");
		assert.equal(await page.locator("[data-quiz-threshold]").innerText(), "סף המעבר: 85%. נדרשות 13 מתוך 15 תשובות נכונות.");
		assert.equal(await page.locator("[data-quiz-summary]").isVisible(), false);
		assert.equal(await page.locator(".quiz-question input:disabled").count(), 60);
		await page.locator("[data-quiz-review]").click();
		assert.equal(await page.locator(".quiz-question:visible [data-quiz-lesson-link]").getAttribute("href"), "../#priority");
		await page.locator(".quiz-question:visible [data-quiz-lesson-link]").click();
		assert.equal(new URL(page.url()).hash, "#priority");
		assert.equal(await page.locator("#priority").isVisible(), true);
	});
}

for (const javaScriptEnabled of [true, false]) {
	test(`quiz printing reveals all questions and self-checks with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, async t => {
		const page = await quizPage(t, { width: 1440, javaScriptEnabled });
		await page.emulateMedia({ media: "print" });
		assert.equal(await page.locator(".quiz-question:visible").count(), 15);
		assert.equal(await page.locator(".quiz-feedback:visible").count(), 15);
		assert.equal(await page.locator("[data-quiz-controls]").isVisible(), false);
		assert.equal(await page.locator("[data-quiz-toolbar]").isVisible(), false);
		const explanation = page.locator("[data-quiz-explanation]").first();
		assert.ok((await explanation.boundingBox()).height > 0, "printed closed self-checks retain their explanation text");
		await page.emulateMedia({ media: "screen" });
		assert.equal(await page.locator(".quiz-question:visible").count(), javaScriptEnabled ? 1 : 15);
		assert.equal(await page.locator("[data-quiz-controls]").isVisible(), javaScriptEnabled);
	});
}
