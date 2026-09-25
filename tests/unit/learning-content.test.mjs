import assert from "node:assert/strict";
import test from "node:test";
import { readLearningContent } from "../../scripts/learning-content.mjs";

test("authored learning content has valid section, quiz and return relationships", async () => {
	const { lessons, quizzes, issues } = await readLearningContent(process.cwd());
	assert.deepEqual(issues, [], issues.join("\n"));
	const topics = [
		"driving-test", "learning-foundations", "licensing-and-points",
		"overtaking", "priority-hierarchy", "right-of-way",
		"roads-and-lanes", "roundabouts", "signs-and-speed", "trip-planning",
	];
	assert.deepEqual(lessons.map(({ file }) => file).sort(), topics.map((topic) => `course/${topic}/index.html`).sort());
	assert.deepEqual(quizzes.map(({ file }) => file).sort(), topics.map((topic) => `course/${topic}/quiz/index.html`).sort());
	for (const lesson of lessons) {
		assert.equal(lesson.topicAnchor, "topic");
		assert.equal(lesson.quizFile, lesson.file.replace(/index\.html$/, "quiz/index.html"));
		assert.ok(lesson.title);
		assert.ok(lesson.sections.length);
		for (const section of lesson.sections) {
			assert.equal("format" in section, false);
			assert.equal("quizFile" in section, false);
		}
		const quiz = quizzes.find(({ file }) => file === lesson.quizFile);
		assert.equal(quiz.lessonFile, lesson.file);
		assert.equal(quiz.topicAnchor, "topic");
		assert.ok(quiz.questions.length > 0);
	}
});
