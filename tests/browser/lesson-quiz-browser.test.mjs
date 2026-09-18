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

test("learning sections retain accessible video slots without source labels", () => {
	for (const lesson of content.lessons) {
		assert.equal(lesson.sourceLabels, 0);
		assert.equal(lesson.sourceLinks, 0);
		for (const section of lesson.sections) assert.ok(section.videoCount > 0);
	}
});

// Placeholder requirements are separate from the interaction module's contract.
for (const quiz of quizzes.filter(quiz => quiz.placeholder)) {
	test(`${quiz.file} retains the approved 20-question placeholder layout`, () => {
		assert.equal(quiz.questions.length, 20);
		assert.equal(quiz.questions.filter(question => question.videoCount > 0).length, 6);
		for (const question of quiz.questions) assert.equal(question.optionCount, 4);
	});
}

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
		assert.equal(await questions.first().locator("input").first().isChecked(), true);
		await page.getByLabel("מעבר לשאלה").selectOption(String(last));
		await questions.last().locator("input").last().check();
	}
	await page.locator("[data-quiz-next]").click();
	assert.equal(await page.locator("[data-quiz-result]").isVisible(), true);
	assert.equal(await page.locator("[data-quiz-count]").innerText(), `סימנתם תשובה ב-${Math.min(count, 2)} מתוך ${count} שאלות.`);
	await page.getByRole("button", { name: "חזרה לשאלות", exact: true }).click();
	assert.equal(await questions.nth(last).isVisible(), true);
	assert.equal(await questions.nth(last).locator("input:checked").count(), 1);
	await page.getByLabel("מעבר לשאלה").selectOption("0");
	assert.equal(await questions.first().locator("input").first().isChecked(), true);
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}

for (const quiz of quizzes) {
	test(`${quiz.file} supports arbitrary question navigation, answer review and return`, { timeout: 20_000 }, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390]) {
			const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
			await page.route("**/*", serveRoadMedia);
			await page.goto(`http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.sectionId}`);
			await page.locator(`[id="${quiz.sectionId}"] .lesson-quiz-link`).click();
			assert.equal(await page.locator("h1").innerText(), quiz.title);
			await exerciseQuiz(page, quiz.questions.length);
			// Visit each video question wherever the author placed it.
			for (const [index, question] of quiz.questions.entries()) {
				if (!question.videoCount) continue;
				await page.getByLabel("מעבר לשאלה").selectOption(String(index));
				assert.equal(await page.locator(".quiz-question").nth(index).locator(".video-placeholder").first().isVisible(), true);
			}
			await page.locator(".lesson-back").click();
			assert.equal(page.url(), `http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.sectionId}`);
			await page.goto(`http://gallery.test/${quiz.file}?subject=unrelated`);
			await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
			assert.equal(await page.locator("h1").innerText(), quiz.title);
			assert.equal(await page.locator(".lesson-back").evaluate(link => link.href), `http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.sectionId}`);
			await page.close();
		}
	});

	for (const failure of ["disabled", "blocked"]) {
		test(`${quiz.file} title, questions and return link work with JavaScript ${failure}`, { timeout: 20_000 }, async t => {
			const browser = await chromium.launch();
			t.after(() => browser.close());
			for (const width of [1440, 320]) {
				const page = await browser.newPage({ javaScriptEnabled: failure !== "disabled", viewport: { width, height: 844 }, reducedMotion: "reduce" });
				await page.route("**/*", route => failure === "blocked" && route.request().url().endsWith("/course/js/quiz.js") ? route.abort() : serveRoadMedia(route));
				await page.goto(`http://gallery.test/${quiz.file}`);
				assert.equal(await page.locator("h1").innerText(), quiz.title);
				assert.equal(await page.locator(".quiz-question:visible").count(), quiz.questions.length);
				const lastChoice = page.locator(".quiz-question").last().locator("input").last();
				await lastChoice.check();
				assert.equal(await lastChoice.isChecked(), true);
				assert.equal(await page.locator("[data-quiz-controls]").isVisible(), false);
				assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
				await page.locator(".lesson-back").click();
				assert.equal(page.url(), `http://gallery.test/${quiz.lessonFile.replace(/index\.html$/, "")}#${quiz.sectionId}`);
				await page.close();
			}
		});
	}
}

for (const count of [1, 5]) {
	test(`shared quiz interaction handles ${count} authored questions with arbitrary IDs and video placement`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		// Adapt an actual page's shell. Only fixture questions vary; the real entry module runs.
		const dom = new JSDOM(await readFile("course/right-of-way/quizzes/priority/index.html", "utf8"));
		t.after(() => dom.window.close());
		const document = dom.window.document;
		const template = document.querySelector(".quiz-question").cloneNode(true);
		const video = document.querySelector(".video-placeholder").cloneNode(true);
		const form = document.querySelector(".quiz-form");
		form.removeAttribute("data-quiz-placeholder");
		form.replaceChildren();
		for (let index = 0; index < count; index++) {
			const question = template.cloneNode(true);
			question.id = `scenario-${String.fromCharCode(97 + index)}`;
			question.querySelector("legend").textContent = `מצב בדרך ${index + 1}`;
			question.querySelector("p").id = `${question.id}-prompt`;
			question.setAttribute("aria-describedby", `${question.id}-prompt`);
			for (const input of question.querySelectorAll("input")) input.name = question.id;
			if (index === 0) question.append(video.cloneNode(true));
			form.append(question);
		}
		const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
		await page.route("**/*", route => new URL(route.request().url()).pathname === "/course/right-of-way/quizzes/priority/fixture.html"
			? route.fulfill({ contentType: "text/html", body: dom.serialize() }) : serveRoadMedia(route));
		await page.goto("http://gallery.test/course/right-of-way/quizzes/priority/fixture.html");
		await exerciseQuiz(page, count);
		assert.equal(await page.locator(".quiz-question").first().locator(".video-placeholder").isVisible(), true);
	});
}
