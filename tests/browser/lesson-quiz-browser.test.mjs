import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const content = await readLearningContent(process.cwd());
test("quiz content is valid before browser journeys are registered", () => {
	assert.deepEqual(content.issues, [], content.issues.join("\n"));
});
const quizzes = content.issues.length ? [] : content.quizzes;

test("learning sections omit source labels", () => {
	for (const lesson of content.lessons) {
		assert.equal(lesson.sourceLabels, 0);
		assert.equal(lesson.sourceLinks, 0);
	}
});

// Placeholder requirements are separate from the interaction module's contract.
for (const quiz of quizzes.filter((quiz) => quiz.placeholder)) {
	test(`${quiz.file} retains the approved 20-question placeholder layout`, () => {
		assert.equal(quiz.questions.length, 20);
		assert.equal(
			quiz.questions.filter((question) => question.videoCount > 0).length,
			0,
		);
		for (const question of quiz.questions)
			assert.equal(question.optionCount, 4);
	});
}

async function selectQuestion(page, index) {
	await page.getByRole("combobox", { name: "מעבר לשאלה" }).click();
	await page.getByRole("option").nth(index).click();
}

test("finishing an incomplete quiz returns to the first unanswered question", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/priority-hierarchy/quiz/");
	await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
	const questions = page.locator(".quiz-question");
	await questions.first().locator("input").first().check();
	await selectQuestion(page, (await questions.count()) - 1);
	await questions.last().locator("input").last().check();
	await page.locator("[data-quiz-next]").focus();
	await page.keyboard.press("Enter");
	assert.equal(await page.locator("[data-quiz-result]").isVisible(), false);
	assert.equal(await questions.nth(1).isVisible(), true);
	assert.equal(
		await questions.nth(1).locator("legend").evaluate((legend) => legend === document.activeElement),
		true,
	);
	assert.equal(
		await page.locator("[data-quiz-validation]").innerText(),
		"יש לענות על כל השאלות לפני סיום השאלון.",
	);
	await page.keyboard.press("Tab");
	assert.equal(
		await questions.nth(1).locator("input").first().evaluate((input) => input.matches(":focus-visible")),
		true,
	);
	await questions.nth(1).locator("label").first().click();
	assert.equal(
		await questions.nth(1).locator("label").first().evaluate((label) => getComputedStyle(label).outlineStyle),
		"none",
	);
});

async function exerciseQuiz(page, count) {
	const questions = page.locator(".quiz-question");
	await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
	assert.equal(await questions.count(), count);
	assert.equal(await page.locator(".quiz-question:visible").count(), 1);
	assert.equal(await page.locator("[data-quiz-previous]").isDisabled(), true);
	await questions.first().locator("input").first().check();
	const last = count - 1;
	if (count > 1) {
		await page.locator("[data-quiz-next]").click();
		await page.locator("[data-quiz-previous]").click();
		assert.equal(
			await questions.first().locator("input").first().isChecked(),
			true,
		);
		await selectQuestion(page, last);
		await questions.last().locator("input").last().check();
	}
	await page.locator("[data-quiz-next]").click();
	if (count > 2) {
		assert.equal(await page.locator("[data-quiz-result]").isVisible(), false);
		assert.equal(await questions.nth(1).isVisible(), true);
		await page.locator(".quiz-form").evaluate((form) => form.requestSubmit());
		assert.equal(await page.locator("[data-quiz-result]").isVisible(), false);
		assert.equal(
			await questions.nth(1).locator("legend").evaluate((legend) => legend === document.activeElement),
			true,
		);
		for (let index = 1; index < last; index++) {
			await questions.nth(index).locator("input").first().check();
			if (index < last - 1) await page.locator("[data-quiz-next]").click();
		}
		assert.equal(await page.locator("[data-quiz-validation]").innerText(), "");
		await selectQuestion(page, last);
		if (count === 5)
			await page.locator(".quiz-form").evaluate((form) => form.requestSubmit());
		else await page.locator("[data-quiz-next]").click();
	}
	assert.equal(await page.locator("[data-quiz-result]").isVisible(), true);
	if (await page.locator(".quiz-form[data-quiz-graded]").count()) {
		const correct = await questions.evaluateAll(items => items.filter(question =>
			question.querySelector("input:checked").value === question.dataset.correctAnswer).length);
		assert.ok((await page.locator("[data-quiz-count]").innerText()).startsWith(
			`עניתם נכון על ${correct} מתוך ${count} שאלות. הציון: ${Math.round(correct / count * 100)}%.`));
	} else {
		assert.equal(await page.locator("[data-quiz-count]").innerText(),
			`סימנתם תשובה ב-${count} מתוך ${count} שאלות.`);
	}
	await page
		.getByRole("button", { name: "חזרה לשאלות", exact: true })
		.click();
	assert.equal(await questions.nth(last).isVisible(), true);
	assert.equal(await questions.nth(last).locator("input:checked").count(), 1);
	await selectQuestion(page, 0);
	assert.equal(
		await questions.first().locator("input").first().isChecked(),
		true,
	);
	assert.equal(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
		true,
	);
}

for (const quiz of quizzes) {
	test(
		`${quiz.file} supports arbitrary question navigation, answer review and return`,
		{ timeout: 20_000 },
		async (t) => {
			const browser = await chromium.launch();
			t.after(() => browser.close());
			for (const width of [1440, 390]) {
				const page = await browser.newPage({
					viewport: { width, height: 900 },
					reducedMotion: "reduce",
				});
				await page.route("**/*", serveRoadMedia);
				await page.goto(
					`http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.topicAnchor}`,
				);
				await page
					.locator(`.lesson-content[id="${quiz.topicAnchor}"] > .lesson-quiz .lesson-quiz-link`)
					.click();
				assert.equal(await page.locator("h1").innerText(), quiz.title);
				await exerciseQuiz(page, quiz.questions.length);
				// Visit each video question wherever the author placed it.
				for (const [index, question] of quiz.questions.entries()) {
					if (!question.videoCount) continue;
					await selectQuestion(page, index);
					assert.equal(
						await page
							.locator(".quiz-question")
							.nth(index)
							.locator(".video-placeholder")
							.first()
							.isVisible(),
						true,
					);
				}
				await page.locator(".lesson-back").click();
				assert.equal(
					page.url(),
					`http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.topicAnchor}`,
				);
				await page.goto(
					`http://gallery.test/${quiz.file}?subject=unrelated`,
				);
				await page
					.locator("[data-quiz-controls]")
					.waitFor({ state: "visible" });
				assert.equal(await page.locator("h1").innerText(), quiz.title);
				assert.equal(
					await page
						.locator(".lesson-back")
						.evaluate((link) => link.href),
					`http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.topicAnchor}`,
				);
				await page.close();
			}
		},
	);

	for (const failure of ["disabled", "blocked"]) {
		test(
			`${quiz.file} title, questions and return link work with JavaScript ${failure}`,
			{ timeout: 20_000 },
			async (t) => {
				const browser = await chromium.launch();
				t.after(() => browser.close());
				for (const width of [1440, 320]) {
					const page = await browser.newPage({
						javaScriptEnabled: failure !== "disabled",
						viewport: { width, height: 844 },
						reducedMotion: "reduce",
					});
					await page.route("**/*", (route) =>
						failure === "blocked" &&
						route.request().url().endsWith("/course/js/quiz.js")
							? route.abort()
							: serveRoadMedia(route),
					);
					await page.goto(`http://gallery.test/${quiz.file}`);
					assert.equal(
						await page.locator("h1").innerText(),
						quiz.title,
					);
					assert.equal(
						await page.locator(".quiz-question:visible").count(),
						quiz.questions.length,
					);
					const lastChoice = page
						.locator(".quiz-question")
						.last()
						.locator("input")
						.last();
					await lastChoice.check();
					assert.equal(await lastChoice.isChecked(), true);
					assert.equal(
						await page.locator("[data-quiz-controls]").isVisible(),
						false,
					);
					assert.equal(
						await page.evaluate(
							() =>
								document.documentElement.scrollWidth <=
								innerWidth,
						),
						true,
					);
					await page.locator(".lesson-back").click();
					assert.equal(
						page.url(),
						`http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.topicAnchor}`,
					);
					await page.close();
				}
			},
		);
	}
}

for (const [legacyPath, sectionId] of [
	["priority-hierarchy/quizzes/priority", "priority"],
	["right-of-way/quizzes/left-turn", "left-turn"],
	["right-of-way/quizzes/right-turn", "right-turn"],
	["right-of-way/quizzes/u-turn", "u-turn"],
]) {
	test(`${legacyPath} links to its topic quiz and original reading section with JavaScript disabled`, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ javaScriptEnabled: false });
		await page.route("**/*", serveRoadMedia);
		await page.goto(`http://gallery.test/course/${legacyPath}/`);
		assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
		await page.locator('.lesson-intro a[href="../../quiz/"]').click();
		assert.equal(new URL(page.url()).pathname, `/course/${legacyPath.split("/")[0]}/quiz/`);
		const target = quizzes.find(quiz => quiz.file === `course/${legacyPath.split("/")[0]}/quiz/index.html`);
		assert.equal(await page.locator(".quiz-question").count(), target.questions.length);
		await page.goto(`http://gallery.test/course/${legacyPath}/`);
		await page.locator(".lesson-back").click();
		assert.equal(new URL(page.url()).hash, `#${sectionId}`);
		assert.equal(await page.locator(`[id="${sectionId}"]`).count(), 1);
	});
}

for (const count of [1, 5]) {
	test(`shared quiz interaction handles ${count} authored questions with arbitrary IDs and video placement`, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		// Adapt an actual page's shell. Only fixture questions vary; the real entry module runs.
		const dom = new JSDOM(
			await readFile(
				"course/priority-hierarchy/quiz/index.html",
				"utf8",
			),
		);
		t.after(() => dom.window.close());
		const document = dom.window.document;
		const template = document
			.querySelector(".quiz-question")
			.cloneNode(true);
		const video = document.createElement("div");
		video.className = "video-placeholder";
		video.setAttribute("role", "img");
		video.setAttribute("aria-label", "מקום לסרטון בשאלת התרגול");
		video.textContent = "כאן יופיע סרטון לשאלת התרגול";
		const form = document.querySelector(".quiz-form");
		form.removeAttribute("data-quiz-placeholder");
		form.removeAttribute("data-quiz-graded");
		form.replaceChildren();
		for (let index = 0; index < count; index++) {
			const question = template.cloneNode(true);
			question.removeAttribute("data-correct-answer");
			question.querySelector("[data-quiz-feedback]")?.remove();
			question.id = `scenario-${String.fromCharCode(97 + index)}`;
			question.querySelector("legend").textContent =
				`מצב בדרך ${index + 1}`;
			question.querySelector("p").id = `${question.id}-prompt`;
			question.setAttribute("aria-describedby", `${question.id}-prompt`);
			for (const input of question.querySelectorAll("input"))
				input.name = question.id;
			if (index === 0) question.append(video.cloneNode(true));
			form.append(question);
		}
		const page = await browser.newPage({
			viewport: { width: 390, height: 844 },
		});
		await page.route("**/*", (route) =>
			new URL(route.request().url()).pathname ===
			"/course/priority-hierarchy/quiz/fixture.html"
				? route.fulfill({
						contentType: "text/html",
						body: dom.serialize(),
					})
				: serveRoadMedia(route),
		);
		await page.goto(
			"http://gallery.test/course/priority-hierarchy/quiz/fixture.html",
		);
		await exerciseQuiz(page, count);
		assert.equal(
			await page
				.locator(".quiz-question")
				.first()
				.locator(".video-placeholder")
				.isVisible(),
			true,
		);
	});
}
