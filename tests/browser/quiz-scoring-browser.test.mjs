import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { startLocalApplication } from "../../server/application.mjs";

async function gradedPage(t, { javaScriptEnabled = true, blocked = false, count = 3, width = 390 } = {}) {
	const dom = new JSDOM(await readFile("course/priority-hierarchy/quiz/index.html", "utf8"));
	t.after(() => dom.window.close());
	const document = dom.window.document;
	const form = document.querySelector(".quiz-form");
	form.removeAttribute("data-quiz-placeholder");
	form.setAttribute("data-quiz-graded", "");
	form.innerHTML = Array.from({ length: count }, (_, i) => ["stop", "wait", "go"][i % 3]).map((answer, index) => `
		<fieldset class="quiz-question" id="case-${index}" data-correct-answer="${answer}" aria-describedby="prompt-${index}">
			<legend tabindex="-1">שאלה ${index + 1}</legend>
			<p id="prompt-${index}">שאלת בדיקה ${index + 1}</p>
			<div class="quiz-answers">${["stop", "wait", "go"].map(value => `<label><input type="radio" name="case-${index}" value="${value}"><span>${value}</span></label>`).join("")}</div>
			<details class="quiz-feedback" data-quiz-feedback><summary>בדיקת התשובה</summary><p>התשובה הנכונה: ${answer}</p><p>הסבר לבדיקה.</p></details>
		</fieldset>`).join("");
	if (!document.querySelector("[data-quiz-retry]")) {
		const retry = document.createElement("button");
		retry.type = "button";
		retry.setAttribute("data-quiz-retry", "");
		retry.textContent = "ניסיון חדש";
		document.querySelector(".quiz-result-actions").append(retry);
	}
	const app = await startLocalApplication({ provider: null });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ javaScriptEnabled, viewport: { width, height: 844 }, reducedMotion: "reduce" });
	await page.route("**/*", route => {
		const pathname = new URL(route.request().url()).pathname;
		if (blocked && pathname.endsWith("/course/js/quiz.js")) return route.abort();
		if (pathname.endsWith("/scored-fixture.html")) return route.fulfill({ contentType: "text/html", body: dom.serialize() });
		return route.continue();
	});
	await page.goto(app.origin + "/course/priority-hierarchy/quiz/scored-fixture.html");
	return page;
}

// A wrong key comparison, fixed denominator, leaked answers, or stale retry state fails this journey.
test("a graded quiz scores mixed answers, locks review and resets a fresh attempt", async t => {
	const page = await gradedPage(t);
	await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
	assert.equal(await page.locator("[data-quiz-feedback]:visible").count(), 0);
	await page.locator('#case-0 input[value="stop"]').check();
	await page.locator("[data-quiz-next]").click();
	await page.locator('#case-1 input[value="go"]').check();
	await page.locator("[data-quiz-next]").click();
	await page.locator('#case-2 input[value="go"]').check();
	await page.locator("[data-quiz-next]").click();
	await page.locator("[data-quiz-submit]").click();
	assert.match(await page.locator("[data-quiz-count]").innerText(), /2 מתוך 3/);
	assert.equal(await page.locator("[data-quiz-score]").innerText(), "67%");
	assert.equal(await page.locator("#quiz-result-title").evaluate(el => el === document.activeElement), true);
	await page.locator("[data-quiz-review]").click();
	assert.equal(await page.locator("#case-1").isVisible(), true, "review starts at the first mistake");
	await page.locator("[data-quiz-next]").click();
	assert.equal(await page.locator('#case-2 [data-quiz-feedback]').isVisible(), true);
	assert.match(await page.locator('#case-2 summary').innerText(), /תשובה נכונה/);
	assert.equal(await page.locator('#case-2 input[value="go"]').isDisabled(), true);
	assert.match(await page.locator('#case-2 label[data-answer-result="correct"]').innerText(), /התשובה שבחרתם - נכונה/);
	await page.locator("[data-quiz-previous]").click();
	assert.match(await page.locator('#case-1 summary').innerText(), /תשובה שגויה/);
	assert.match(await page.locator('#case-1 [data-quiz-feedback]').innerText(), /wait/);
	const wrong = page.locator('#case-1 label[data-answer-result="incorrect"]');
	const correct = page.locator('#case-1 label[data-answer-result="correct"]');
	assert.match(await wrong.innerText(), /go.*התשובה שבחרתם - שגויה/s);
	assert.match(await correct.innerText(), /wait.*התשובה הנכונה/s);
	assert.notEqual(await wrong.evaluate(el => getComputedStyle(el).borderColor), await correct.evaluate(el => getComputedStyle(el).borderColor));
	await wrong.hover();
	assert.notEqual(await wrong.evaluate(el => getComputedStyle(el).backgroundColor), await correct.evaluate(el => getComputedStyle(el).backgroundColor));
	await page.locator("[data-quiz-next]").click();
	await page.locator("[data-quiz-next]").click();
	await page.locator("[data-quiz-retry]").click();
	assert.equal(await page.locator(".quiz-question:visible").getAttribute("id"), "case-0");
	assert.equal(await page.locator("input:checked").count(), 0);
	assert.equal(await page.locator(".quiz-question input:disabled").count(), 0);
	assert.equal(await page.locator("[data-quiz-feedback]:visible").count(), 0);
	assert.equal(await page.locator("[data-quiz-count]").textContent(), "");
	assert.equal(await page.locator("[data-answer-result], .quiz-answer-state").count(), 0);
	for (const [index, answer] of ["stop", "wait", "go"].entries()) {
		await page.locator(`#case-${index} input[value="${answer}"]`).check();
		await page.locator("[data-quiz-next]").click();
	}
	await page.locator("[data-quiz-submit]").click();
	assert.match(await page.locator("[data-quiz-count]").innerText(), /3 מתוך 3/);
	assert.equal(await page.locator("[data-quiz-score]").innerText(), "100%");
});

for (const mode of ["disabled", "blocked"]) {
	test(`graded questions keep native self-check answers with JavaScript ${mode}`, async t => {
		const page = await gradedPage(t, { javaScriptEnabled: mode !== "disabled", blocked: mode === "blocked" });
		assert.equal(await page.locator(".quiz-question:visible").count(), 3);
		await page.locator('#case-0 summary').click();
		assert.equal(await page.locator('#case-0 details').getAttribute("open"), "");
		assert.match(await page.locator('#case-0 details').innerText(), /stop/);
	});
}

// These cases catch fixed cutoffs, rounding down, and passing a rounded display percentage.
for (const width of [1440, 390]) {
	test(`public quizzes require a rounded-up 85 percent at ${width}px`, async t => {
		for (const [count, minimum] of [[17,15], [20,17], [26,23]]) {
			const page = await gradedPage(t, { count, width });
			for (const score of [minimum - 1, minimum]) {
				await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
				for (let index = 0; index < count; index++) {
					const answer = ["stop", "wait", "go"][(index + (index < score ? 0 : 1)) % 3];
					await page.locator(`#case-${index} input[value="${answer}"]`).check();
					await page.locator("[data-quiz-next]").click();
				}
				await page.locator("[data-quiz-submit]").click();
				const text = await page.locator("#quiz-result-title").innerText() + ". " + await page.locator("[data-quiz-threshold]").innerText();
				assert.match(text, score >= minimum ? /(?:^|\.\s)עברתם את התרגול/ : /לא עברתם את התרגול/);
				assert.ok(text.includes(`${minimum} מתוך ${count}`));
				assert.match(text, /85%/);
				assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
				await page.locator("[data-quiz-retry]").click();
				assert.equal(await page.locator("[data-quiz-count]").textContent(), "");
			}
			await page.close();
		}
	});
}
