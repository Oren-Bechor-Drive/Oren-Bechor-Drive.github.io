import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

async function gradedPage(t, { javaScriptEnabled = true, blocked = false } = {}) {
	const dom = new JSDOM(await readFile("course/priority-hierarchy/quiz/index.html", "utf8"));
	t.after(() => dom.window.close());
	const document = dom.window.document;
	const form = document.querySelector(".quiz-form");
	form.removeAttribute("data-quiz-placeholder");
	form.setAttribute("data-quiz-graded", "");
	form.innerHTML = ["stop", "wait", "go"].map((answer, index) => `
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
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ javaScriptEnabled, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
	await page.route("**/*", route => {
		const pathname = new URL(route.request().url()).pathname;
		if (blocked && pathname.endsWith("/course/js/quiz.js")) return route.abort();
		if (pathname.endsWith("/scored-fixture.html")) return route.fulfill({ contentType: "text/html", body: dom.serialize() });
		return serveRoadMedia(route);
	});
	await page.goto("http://gallery.test/course/priority-hierarchy/quiz/scored-fixture.html");
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
	assert.match(await page.locator("[data-quiz-count]").innerText(), /2 מתוך 3.*67%/);
	assert.equal(await page.locator("#quiz-result-title").evaluate(el => el === document.activeElement), true);
	await page.locator("[data-quiz-review]").click();
	assert.equal(await page.locator('#case-2 [data-quiz-feedback]').isVisible(), true);
	assert.match(await page.locator('#case-2 summary').innerText(), /תשובה נכונה/);
	assert.equal(await page.locator('#case-2 input[value="go"]').isDisabled(), true);
	await page.locator("[data-quiz-previous]").click();
	assert.match(await page.locator('#case-1 summary').innerText(), /תשובה שגויה/);
	assert.match(await page.locator('#case-1 [data-quiz-feedback]').innerText(), /wait/);
	await page.locator("[data-quiz-next]").click();
	await page.locator("[data-quiz-next]").click();
	await page.locator("[data-quiz-retry]").click();
	assert.equal(await page.locator(".quiz-question:visible").getAttribute("id"), "case-0");
	assert.equal(await page.locator("input:checked").count(), 0);
	assert.equal(await page.locator(".quiz-question input:disabled").count(), 0);
	assert.equal(await page.locator("[data-quiz-feedback]:visible").count(), 0);
	assert.equal(await page.locator("[data-quiz-count]").textContent(), "");
	for (const [index, answer] of ["stop", "wait", "go"].entries()) {
		await page.locator(`#case-${index} input[value="${answer}"]`).check();
		await page.locator("[data-quiz-next]").click();
	}
	assert.match(await page.locator("[data-quiz-count]").innerText(), /3 מתוך 3.*100%/);
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
