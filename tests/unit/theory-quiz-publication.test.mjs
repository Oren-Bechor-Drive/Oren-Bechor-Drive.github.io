import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const load = async file => JSON.parse(await readFile(`docs/reference/${file}`, "utf8"));
const normalize = text => text.replace(/\s+/g, " ").trim();

test("every selected theory question is published once in its assigned topic with its answer intact", async () => {
	const bank = await load("theory-quiz-content.json");
	const initial = await load("theory-question-candidates-2026-09-25.json");
	const { quizzes, issues } = await readLearningContent(process.cwd());
	assert.deepEqual(issues, []);
	const expectedIds = bank.questions.map(question => question.officialId);
	assert.equal(new Set(expectedIds).size, expectedIds.length);
	for (const original of [...initial.questions, ...initial.imageDependentCandidates])
		assert.ok(expectedIds.includes(original.officialId), `retains initial question ${original.officialId}`);
	assert.ok(bank.questions.length > initial.questions.length + initial.imageDependentCandidates.length, "gap research supplies additional questions");
	const published = quizzes.flatMap(quiz => {
		assert.equal(quiz.graded, true, quiz.file);
		assert.equal(quiz.placeholder, false, quiz.file);
		return quiz.questions.map(question => ({ ...question, file: quiz.file }));
	});
	assert.deepEqual(published.map(question => question.officialId).sort(), expectedIds.sort());
	for (const source of bank.questions) {
		const authored = published.find(question => question.officialId === source.officialId);
		assert.equal(authored.file, `course/${source.topicId}/quiz/index.html`);
		assert.equal(authored.prompt, normalize(source.question), source.officialId);
		assert.deepEqual(authored.choices.map(choice => choice.text), source.options.map(normalize), source.officialId);
		assert.equal(authored.correctAnswer, String(source.correctOptionIndex), source.officialId);
		assert.equal(normalize(authored.explanation), normalize(source.explanation), source.officialId);
	}
});

test("every reviewed explanation link reaches its selected authored topic and section", async () => {
	const bank = await load("theory-quiz-content.json");
	const { lessons, issues } = await readLearningContent(process.cwd());
	assert.deepEqual(issues, []);
	for (const topic of bank.topics) {
		const quizFile = `course/${topic.id}/quiz/index.html`;
		const dom = new JSDOM(await readFile(quizFile, "utf8"));
		try {
			for (const question of bank.questions.filter(question => question.topicId === topic.id)) {
				const targetTopic = question.lessonTopicId ?? question.topicId;
				const link = dom.window.document.querySelector(`#question-${question.officialId} [data-quiz-lesson-link]`);
				assert.ok(link, question.officialId);
				const destination = new URL(link.getAttribute("href"), `https://example.test/course/${topic.id}/quiz/`);
				assert.equal(destination.pathname, `/course/${targetTopic}/`, question.officialId);
				assert.equal(destination.hash, `#${question.lessonSectionId}`, question.officialId);
				const targetLesson = lessons.find(lesson => lesson.file === `course/${targetTopic}/index.html`);
				assert.ok(targetLesson.sections.some(section => section.id === question.lessonSectionId), question.officialId);
			}
		} finally { dom.window.close(); }
	}
});

test("every question diagram has an inspected local original with matching provenance", async () => {
	const bank = await load("theory-quiz-content.json");
	const { images } = await load("theory-media.json");
	for (const url of new Set(bank.questions.flatMap(question => question.imageUrls))) {
		const image = images.find(image => image.sourceUrl === url);
		assert.ok(image, url);
		assert.ok(image.alt && image.width > 0 && image.height > 0, url);
		const bytes = await readFile(image.path);
		assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256, image.path);
	}
});
