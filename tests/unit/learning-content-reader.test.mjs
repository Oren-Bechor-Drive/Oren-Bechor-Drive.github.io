import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const lesson = `<main class="lesson-content"><nav class="lesson-contents"><a href="#turn">פנייה</a></nav><section class="lesson-section" id="turn" aria-labelledby="turn-title"><h3 id="turn-title">פנייה</h3><a class="lesson-quiz-link" href="practice.html">תרגול</a></section></main>`;
const quiz = `<html lang="he" dir="rtl"><head><title>שאלון: פנייה - תרגול</title><meta name="robots" content="noindex"></head><body><h1>שאלון: פנייה</h1><a class="lesson-back" data-lesson-link href="lesson.html#turn">חזרה</a><form class="quiz-form"><fieldset class="quiz-question" id="scenario" aria-describedby="prompt"><legend>מצב בדרך</legend><p id="prompt">מה עושים?</p><label><input type="radio" name="turn-choice" value="stop">עוצרים</label><label><input type="radio" name="turn-choice" value="wait">ממתינים</label></fieldset></form></body></html>`;

async function fixture(t, changes = {}) {
	const root = await mkdtemp(path.join(os.tmpdir(), "learning-content-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = {
		"course/index.html":
			'<a class="subject-learn" href="../lesson.html">ללמידה</a>',
		"lesson.html": lesson,
		"practice.html": quiz,
		...changes,
	};
	for (const [file, content] of Object.entries(files)) {
		if (content === null) continue;
		await mkdir(path.dirname(path.join(root, file)), { recursive: true });
		await writeFile(path.join(root, file), content);
	}
	return root;
}

for (const index of ["", "index.html"]) {
	test(`nested learning pages resolve directory and explicit index links: ${index || "directory"}`, async (t) => {
		const root = await fixture(t, {
			"lesson.html": null,
			"practice.html": null,
			"course/index.html": `<a class="subject-learn" href="topic/${index}">ללמידה</a>`,
			"course/topic/index.html": lesson.replace(
				'href="practice.html"',
				`href="quizzes/turn/${index}"`,
			),
			"course/topic/quizzes/turn/index.html": quiz.replace(
				'href="lesson.html#turn"',
				`href="../../${index}#turn"`,
			),
			"docs/example.html": quiz,
			".hidden/example.html": quiz,
		});
		const content = await readLearningContent(root);
		assert.deepEqual(content.issues, []);
		assert.equal(content.lessons.length, 1);
		assert.equal(content.quizzes.length, 1);
		assert.equal(content.lessons[0].file, "course/topic/index.html");
		assert.equal(
			content.quizzes[0].file,
			"course/topic/quizzes/turn/index.html",
		);
	});
}

test("malformed nested returns report the quiz file and intended lesson anchor", async (t) => {
	const root = await fixture(t, {
		"lesson.html": null,
		"practice.html": null,
		"course/index.html":
			'<a class="subject-learn" href="topic/">ללמידה</a>',
		"course/topic/index.html": lesson.replace(
			'href="practice.html"',
			'href="quizzes/turn/"',
		),
		"course/topic/quizzes/turn/index.html": quiz.replace(
			'href="lesson.html#turn"',
			'href="../../#missing"',
		),
	});
	const { issues } = await readLearningContent(root);
	assert.deepEqual(issues, [
		"course/topic/quizzes/turn/index.html: return link must target course/topic/index.html#turn",
	]);
});

test("learning content interprets declared headings and arbitrary quiz questions once", async (t) => {
	const content = await readLearningContent(await fixture(t));
	assert.deepEqual(content.issues, []);
	assert.equal(
		content.lessons[0].sections[0].title,
		"פנייה",
		"aria-labelledby, not an h2 assumption, names the section",
	);
	assert.equal(content.lessons[0].sections[0].quizFile, "practice.html");
	assert.equal(content.quizzes[0].lessonFile, "lesson.html");
	assert.equal(content.quizzes[0].sectionId, "turn");
	assert.equal(content.quizzes[0].questions[0].id, "scenario");
	assert.equal(content.quizzes[0].questions[0].optionCount, 2);
	assert.equal(content.quizzes[0].placeholder, false);
});

for (const [name, changes, expected] of [
	[
		"missing heading",
		{ "lesson.html": lesson.replace('<h3 id="turn-title">פנייה</h3>', "") },
		/lesson\.html#turn:.*heading/,
	],
	[
		"missing quiz link",
		{
			"lesson.html": lesson.replace(
				'class="lesson-quiz-link"',
				'class="removed"',
			),
		},
		/lesson\.html#turn:.*quiz link/,
	],
	[
		"missing quiz file",
		{ "practice.html": null },
		/lesson\.html#turn:.*practice\.html/,
	],
	[
		"duplicate section ID",
		{
			"lesson.html": lesson.replace(
				"</main>",
				'<p id="turn">duplicate</p></main>',
			),
		},
		/lesson\.html:.*duplicate ID.*turn/,
	],
	[
		"incorrect return",
		{
			"practice.html": quiz.replace(
				'href="lesson.html#turn"',
				'href="lesson.html#missing"',
			),
		},
		/practice\.html:.*return.*lesson\.html#turn/,
	],
	[
		"missing contents link",
		{ "lesson.html": lesson.replace('href="#turn"', 'href="#missing"') },
		/lesson\.html:.*contents/,
	],
	[
		"external destination",
		{
			"lesson.html": lesson.replace(
				'href="practice.html"',
				'href="https:\/\/example.com\/practice.html"',
			),
		},
		/lesson\.html#turn:.*local.*quiz/,
	],
	[
		"wrong quiz title",
		{
			"practice.html": quiz.replace(
				"<h1>שאלון: פנייה</h1>",
				"<h1>שם אחר</h1>",
			),
		},
		/practice\.html:.*title/,
	],
	[
		"empty quiz",
		{ "practice.html": quiz.replace(/<fieldset[\s\S]*?<\/fieldset>/, "") },
		/practice\.html:.*question/,
	],
	[
		"missing question legend",
		{ "practice.html": quiz.replace("<legend>מצב בדרך</legend>", "") },
		/practice\.html#scenario:.*legend/,
	],
	[
		"unlabeled choice",
		{
			"practice.html": quiz.replace(
				'<label><input type="radio" name="turn-choice" value="wait">ממתינים</label>',
				'<input type="radio" name="turn-choice" value="wait">',
			),
		},
		/practice\.html#scenario:.*label/,
	],
]) {
	test(`learning content reports ${name} with file context instead of throwing`, async (t) => {
		const content = await readLearningContent(await fixture(t, changes));
		assert.ok(
			content.issues.some((issue) => expected.test(issue)),
			content.issues.join("\n"),
		);
	});
}

test("newly added sections are discovered and cannot share a quiz destination", async (t) => {
	const second =
		'<section class="lesson-section" id="another" aria-labelledby="another-title"><h2 id="another-title">עוד נושא</h2><a class="lesson-quiz-link" href="practice.html">תרגול</a></section>';
	const content = await readLearningContent(
		await fixture(t, {
			"lesson.html": lesson
				.replace("</nav>", '<a href="#another">עוד נושא</a></nav>')
				.replace("</main>", `${second}</main>`),
		}),
	);
	assert.equal(content.lessons[0].sections.length, 2);
	assert.ok(
		content.issues.some((issue) => /another.*already.*quiz/.test(issue)),
		content.issues.join("\n"),
	);
});

test("unreadable library destinations and partial lesson markup produce diagnostics", async (t) => {
	const content = await readLearningContent(
		await fixture(t, {
			"course/index.html":
				'<a class="subject-learn" href="missing.html">ללמידה</a>',
			"lesson.html": lesson.replace(
				'class="lesson-content"',
				'class="other"',
			),
		}),
	);
	assert.ok(
		content.issues.some((issue) =>
			/course\/index\.html:.*missing\.html/.test(issue),
		),
	);
	assert.ok(
		content.issues.some((issue) =>
			/lesson\.html:.*lesson-content/.test(issue),
		),
	);
});
