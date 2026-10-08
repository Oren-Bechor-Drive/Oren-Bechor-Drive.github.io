import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { startLocalApplication } from "../../server/application.mjs";

const answers = ["stop", "wait", "go"];
const labels = { stop: "עצירה", wait: "המתנה", go: "התקדמות" };

async function reviewPage(t, { width, mode = "enhanced" }) {
	const dom = new JSDOM(await readFile("course/priority-hierarchy/quiz/index.html", "utf8"));
	t.after(() => dom.window.close());
	const document = dom.window.document;
	document.querySelector(".quiz-form").innerHTML = answers.map((answer, index) => `
		<fieldset class="quiz-question" id="review-case-${index}" data-correct-answer="${answer}" aria-describedby="review-prompt-${index}">
			<legend tabindex="-1">שאלה ${index + 1}</legend>
			<p id="review-prompt-${index}">שאלת בדיקה ${index + 1}</p>
			<div class="quiz-answers">${answers.map(value => `<label><input type="radio" name="review-case-${index}" value="${value}"><span>${labels[value]}</span></label>`).join("")}</div>
			<details class="quiz-feedback" data-quiz-feedback><summary>בדיקת התשובה</summary><p>התשובה הנכונה: ${labels[answer]}</p><p data-quiz-explanation>הסבר לבדיקה.</p></details>
		</fieldset>`).join("");
	document.querySelector(".lesson-intro p").textContent = "3 שאלות בנושא. אפשר לעבור בין השאלות ולשנות תשובות לפני ההגשה. כדי לקבל ציון יש לענות על כולן.";
	document.querySelector("[data-quiz-position]").textContent = "שאלה 1 מתוך 3";
	const app = await startLocalApplication({ provider: null });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		javaScriptEnabled: mode !== "disabled",
		viewport: { width, height: width === 320 ? 568 : 900 },
		reducedMotion: "reduce",
	});
	page.setDefaultTimeout(5000);
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.route("**/*", route => {
		const pathname = new URL(route.request().url()).pathname;
		if (mode === "blocked" && pathname.endsWith("/course/js/quiz.js")) return route.abort();
		if (pathname.endsWith("/review-fixture.html")) return route.fulfill({ contentType: "text/html", body: dom.serialize() });
		return route.continue();
	});
	await page.goto(app.origin + "/course/priority-hierarchy/quiz/review-fixture.html");
	t.after(() => assert.deepEqual(errors, [], "quiz interaction must not throw browser errors"));
	if (mode === "enhanced") await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
	return page;
}

async function assertSelectorStates(page, states) {
	for (const selector of ["#question-jump option", "#question-options [role=option]"]) {
		const options = page.locator(selector);
		assert.equal(await options.count(), states.length);
		for (const [index, state] of states.entries()) {
			assert.equal(await options.nth(index).getAttribute("data-answer-state"), state);
			assert.match(await options.nth(index).textContent(), {
				unanswered: /לא נענתה/,
				answered: /נענתה/,
				correct: /נכונה/,
				incorrect: /שגויה/,
			}[state]);
		}
	}
}

async function submitAnswers(page, selections) {
	for (const [index, answer] of selections.entries()) {
		await page.locator(`#review-case-${index} input[value="${answer}"]`).check();
		await page.locator("[data-quiz-next]").click();
	}
	await page.locator("[data-quiz-submit]").click();
}

async function assertFocusedQuestion(page, index) {
	assert.equal(await page.locator(".quiz-question:visible").getAttribute("id"), `review-case-${index}`);
	assert.equal(await page.locator(`#review-case-${index} legend`).evaluate(element => element === document.activeElement), true);
}

for (const width of [1440, 320]) {
	test(`missing-answer feedback identifies every unanswered question above the form at ${width}px`, async t => {
		const page = await reviewPage(t, { width });
		await page.locator("[data-quiz-next]").click();
		await page.locator('#review-case-1 input[value="wait"]').check();
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-next]").click();
		const feedback = page.locator("[data-quiz-validation]");
		assert.match(await feedback.innerText(), /נשארו 2 שאלות בלי תשובה: 1, 3\./);
		assert.equal(await feedback.evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector(".quiz-form")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
		const feedbackBounds = await feedback.boundingBox();
		const formBounds = await page.locator(".quiz-form").boundingBox();
		assert.ok(feedbackBounds.y + feedbackBounds.height <= formBounds.y + 1, "feedback must appear above the question card");
		await assertFocusedQuestion(page, 0);
		await assertSelectorStates(page, ["unanswered", "answered", "unanswered"]);
		assert.equal(await page.locator("[data-quiz-result]").isVisible(), false);
		await page.locator('#review-case-0 input[value="stop"]').check();
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-next]").click();
		await page.locator('#review-case-2 input[value="go"]').check();
		await page.locator("[data-quiz-next]").click();
		if (await page.locator("[data-quiz-summary]").isVisible()) await page.locator("[data-quiz-submit]").click();
		await page.locator("[data-quiz-retry]").click();
		assert.equal(await feedback.textContent(), "");
		await assertSelectorStates(page, ["unanswered", "unanswered", "unanswered"]);
	});

	test(`mixed results support mistake review, chosen-answer feedback and a clean retry at ${width}px`, async t => {
		const page = await reviewPage(t, { width });
		const intro = page.locator(".lesson-intro p").first();
		const initialIntro = await intro.textContent();
		assert.equal(await page.locator("[data-quiz-position]").getAttribute("aria-live"), null);
		assert.notEqual(await page.locator("[data-quiz-position]").getAttribute("role"), "status");
		await assertSelectorStates(page, ["unanswered", "unanswered", "unanswered"]);
		await page.locator('#review-case-0 input[value="go"]').check();
		await assertSelectorStates(page, ["answered", "unanswered", "unanswered"]);
		await page.locator("[data-quiz-next]").click();
		await page.locator('#review-case-1 input[value="wait"]').check();
		await page.locator("[data-quiz-next]").click();
		await page.locator('#review-case-2 input[value="stop"]').check();
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-submit]").click();
		assert.match(await page.locator("#quiz-result-title").textContent(), /33%/);
		assert.equal(await page.locator("#quiz-result-title").evaluate(element => element === document.activeElement), true);
		assert.notEqual(await intro.textContent(), initialIntro);
		assert.match(await intro.innerText(), /נעולות|ננעלו/);
		assert.equal(await page.locator("#quiz-mistakes").count(), 1);
		const mistakes = page.locator("#quiz-mistakes [data-review-question]");
		assert.deepEqual(await mistakes.allTextContents(), ["שאלה 1", "שאלה 3"]);
		await assertSelectorStates(page, ["incorrect", "correct", "incorrect"]);
		for (const [index, chosen] of ["go", "wait", "stop"].entries()) {
			const choice = page.locator(`#review-case-${index} [data-quiz-choice]`);
			assert.equal(await choice.count(), 1);
			assert.match(await choice.textContent(), new RegExp(`התשובה שלכם: ${labels[chosen]}`));
		}
		const review = page.locator("[data-quiz-review]");
		await review.focus();
		await page.keyboard.press("Enter");
		await assertFocusedQuestion(page, 0);
		assert.equal(await page.locator('#review-case-0 input[value="go"]').isDisabled(), true);
		assert.match(await page.locator('#review-case-0 [data-answer-result="incorrect"]').innerText(), /התקדמות/);
		assert.match(await page.locator('#review-case-0 [data-answer-result="correct"]').innerText(), /עצירה/);
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-next]").click();
		assert.equal(await page.locator("#quiz-mistakes").count(), 1);
		assert.equal(await page.locator("#quiz-mistakes [data-review-question]").count(), 2);
		assert.equal(await page.locator("[data-quiz-choice]").count(), 3);
		await mistakes.nth(1).focus();
		await page.keyboard.press("Enter");
		await assertFocusedQuestion(page, 2);
		await page.locator("[data-quiz-next]").click();
		if (await page.locator("[data-quiz-summary]").isVisible()) await page.locator("[data-quiz-submit]").click();
		await page.locator("[data-quiz-retry]").click();
		await assertFocusedQuestion(page, 0);
		assert.equal(await intro.textContent(), initialIntro);
		assert.equal(await page.locator("#quiz-mistakes:visible, [data-review-question]").count(), 0);
		assert.equal(await page.locator("[data-quiz-choice], [data-result], [data-answer-result], .quiz-answer-state").count(), 0);
		assert.equal(await page.locator(".quiz-question input:disabled, .quiz-question input:checked").count(), 0);
		assert.equal(await page.locator("[data-quiz-feedback]:visible").count(), 0);
		assert.equal(await page.locator("[data-quiz-count]").textContent(), "");
		assert.equal(await page.locator("[data-quiz-validation]").textContent(), "");
		await assertSelectorStates(page, ["unanswered", "unanswered", "unanswered"]);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	});

	test(`mistake-only review skips correct answers and the selector restores full review at ${width}px`, async t => {
		const page = await reviewPage(t, { width });
		await submitAnswers(page, ["go", "wait", "stop"]);
		const errorsOnly = page.locator("[data-quiz-errors]");
		assert.match(await errorsOnly.innerText(), /לעבור על הטעויות \(2\)/);
		await errorsOnly.focus();
		await page.keyboard.press("Enter");
		await assertFocusedQuestion(page, 0);
		assert.match(await page.locator("[data-quiz-next]").innerText(), /הטעות הבאה/);
		await page.locator("[data-quiz-next]").click();
		await assertFocusedQuestion(page, 2);
		await page.locator("[data-quiz-previous]").click();
		await assertFocusedQuestion(page, 0);
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-next]").click();
		assert.equal(await page.locator("[data-quiz-result]").isVisible(), true);
		await errorsOnly.click();
		const selector = page.getByRole("combobox", { name: "מעבר לשאלה" });
		await selector.focus();
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Home");
		await page.keyboard.press("Enter");
		await assertFocusedQuestion(page, 0);
		await page.locator("[data-quiz-next]").click();
		await assertFocusedQuestion(page, 1);
		assert.match(await page.locator("[data-quiz-next]").innerText(), /השאלה הבאה/);
	});

	test(`all-correct results omit mistakes and review begins at the first question at ${width}px`, async t => {
		const page = await reviewPage(t, { width });
		await submitAnswers(page, answers);
		assert.match(await page.locator("#quiz-result-title").textContent(), /100%/);
		assert.equal(await page.locator("#quiz-mistakes:visible, [data-review-question]").count(), 0);
		assert.equal(await page.locator("[data-quiz-errors]:visible").count(), 0);
		await assertSelectorStates(page, ["correct", "correct", "correct"]);
		await page.locator("[data-quiz-review]").click();
		await assertFocusedQuestion(page, 0);
		assert.match(await page.locator('#review-case-0 [data-quiz-choice]').innerText(), /התשובה שלכם: עצירה/);
	});

	for (const mode of ["disabled", "blocked"]) {
		test(`quiz review enhancements preserve native self-checks with JavaScript ${mode} at ${width}px`, async t => {
			const page = await reviewPage(t, { width, mode });
			assert.equal(await page.locator(".quiz-question:visible").count(), 3);
			assert.equal(await page.locator("[data-quiz-fallback]").isVisible(), true);
			assert.equal(await page.locator("[data-quiz-controls]").isVisible(), false);
			await page.locator('#review-case-1 input[value="wait"]').check();
			await page.locator('#review-case-1 summary').click();
			assert.equal(await page.locator('#review-case-1 details').getAttribute("open"), "");
			assert.match(await page.locator('#review-case-1 details').innerText(), /התשובה הנכונה: המתנה/);
			assert.equal(await page.locator("#quiz-mistakes, [data-quiz-choice]").count(), 0);
			assert.equal(await page.locator(".quiz-question input:disabled").count(), 0);
		});
	}
}
