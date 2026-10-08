import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium, firefox, webkit } from "playwright";
import { startLocalApplication } from "../../server/application.mjs";

async function gradedPage(t, { javaScriptEnabled = true, blocked = false, count = 3, width = 390, nativeLabels = false, browserType = chromium, hasTouch = false } = {}) {
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
			<div class="quiz-answers">${["stop", "wait", "go"].map(value => {
				const id = `choice-${index}-${value}`;
				const input = `<input type="radio" id="${id}" name="case-${index}" value="${value}">`;
				if (nativeLabels && index === 0) return `<label>${input}${value}</label>`;
				if (nativeLabels && index === 1) return `${input}<label for="${id}">${value}</label>`;
				return `<label>${input}<span>${value}</span></label>`;
			}).join("")}</div>
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
	const browser = await browserType.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ javaScriptEnabled, viewport: { width, height: 844 }, reducedMotion: "reduce", hasTouch });
	await page.route("**/*", route => {
		const pathname = new URL(route.request().url()).pathname;
		if (blocked && pathname.endsWith("/course/js/quiz.js")) return route.abort();
		if (pathname.endsWith("/scored-fixture.html")) return route.fulfill({ contentType: "text/html", body: dom.serialize() });
		return route.continue();
	});
	await page.goto(app.origin + "/course/priority-hierarchy/quiz/scored-fixture.html");
	return page;
}

test("native radio labels retain one keyboard focus ring and hide it for clicks and taps", async t => {
	for (const browserType of [chromium, firefox, webkit]) {
		for (const width of [1440, 390]) {
			await t.test(`${browserType.name()} at ${width}px`, async t => {
				const page = await gradedPage(t, { width, nativeLabels: true, browserType, hasTouch: true });
				await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
				const outlines = input => input.evaluate(input => [input, ...input.labels].map(node => {
					const style = getComputedStyle(node);
					return style.outlineStyle === "none" ? 0 : Number.parseFloat(style.outlineWidth);
				}));
				await page.locator("#choice-0-stop").focus();
				await page.keyboard.press("ArrowDown");
				assert.equal(await page.locator("#choice-0-wait").evaluate(input => input === document.activeElement), true);
				assert.deepEqual(await outlines(page.locator("#choice-0-wait")), [0, 3], "wrapped radios keep their single card outline");
				await page.locator("#case-0 label").first().click();
				assert.deepEqual(await outlines(page.locator("#choice-0-stop")), [0, 0], "wrapped label clicks hide the keyboard outline");
				await page.locator("#case-0 label").last().tap();
				assert.deepEqual(await outlines(page.locator("#choice-0-go")), [0, 0], "wrapped label taps keep the outline hidden");
				await page.locator("[data-quiz-next]").click();
				const stop = page.locator("#choice-1-stop");
				await page.locator('label[for="choice-1-stop"]').click();
				assert.equal(await stop.isChecked(), true, "label clicks retain native activation");
				assert.deepEqual(await outlines(stop), [0, 0]);
				await stop.focus();
				await page.keyboard.press("ArrowDown");
				assert.equal(await page.locator("#choice-1-wait").evaluate(input => input === document.activeElement), true);
				assert.deepEqual(await outlines(page.locator("#choice-1-wait")), [3, 0], "explicitly labelled radios retain the base keyboard outline");
				await page.locator('label[for="choice-1-go"]').tap();
				const go = page.locator("#choice-1-go");
				assert.equal(await go.isChecked(), true, "label taps retain native activation");
				assert.deepEqual(await outlines(go), [0, 0], "touch input hides the keyboard outline");
			});
		}
	}
});

test("explicit radio labels retain baseline keyboard focus without quiz enhancement", async t => {
	for (const width of [1440, 390]) {
		for (const options of [{ javaScriptEnabled: false }, { blocked: true }]) {
			await t.test(`${width}px with ${options.blocked ? "the entry blocked" : "JavaScript disabled"}`, async t => {
				const page = await gradedPage(t, { width, nativeLabels: true, ...options });
				const stop = page.locator("#choice-1-stop");
				await page.locator('label[for="choice-1-stop"]').click();
				await stop.focus();
				await page.keyboard.press("Tab");
				await page.keyboard.press("Shift+Tab");
				assert.equal(await stop.evaluate(input => input === document.activeElement), true);
				assert.equal(await stop.evaluate(input => getComputedStyle(input).outlineStyle), "solid");
				assert.equal(await stop.evaluate(input => getComputedStyle(input).outlineWidth), "3px");
				const go = page.locator("#choice-1-go");
				await page.locator('label[for="choice-1-go"]').click();
				assert.equal(await go.isChecked(), true);
				assert.equal(await go.evaluate(input => getComputedStyle(input).outlineStyle), "none");
			});
		}
	}
});

test("native radio labels support summary, grading, review and a fresh attempt", async t => {
	for (const width of [1440, 390]) {
		const page = await gradedPage(t, { width, nativeLabels: true });
		page.setDefaultTimeout(3000);
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		for (const selected of ["go", "wait"]) {
			for (const [index, answer] of ["stop", selected, "go"].entries()) {
				await page.locator(`#case-${index} input[value="${answer}"]`).check();
				await page.locator("[data-quiz-next]").click();
			}
			assert.deepEqual(errors, [], "accepted native labels must not break the summary");
			assert.deepEqual(await page.locator(".quiz-summary-answers button").allTextContents(), [
				"שאלה 1: stop", `שאלה 2: ${selected}`, "שאלה 3: go",
			]);
			await page.locator("[data-quiz-submit]").click();
			assert.equal(await page.locator("[data-quiz-score]").innerText(), selected === "wait" ? "100%" : "67%");
			await page.locator("[data-quiz-review]").click();
			if (selected === "go") {
				assert.equal(await page.locator('#case-1 [data-quiz-choice]').innerText(), "התשובה שלכם: go");
				assert.match(await page.locator('#case-1 label[for="choice-1-go"]').innerText(), /התשובה שבחרתם - שגויה/);
				assert.match(await page.locator('#case-1 label[for="choice-1-wait"]').innerText(), /התשובה הנכונה/);
			}
			await page.locator(".quiz-form").evaluate(form => form.requestSubmit());
			await page.locator("[data-quiz-retry]").click();
			assert.equal(await page.locator("[data-answer-result], .quiz-answer-state").count(), 0);
			assert.equal(await page.locator("input:checked, input:disabled").count(), 0);
		}
		assert.deepEqual(errors, []);
		await page.close();
	}
});

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
