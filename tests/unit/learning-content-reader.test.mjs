import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const lesson = `<h1 id="topic-title">פנייה</h1><main class="lesson-content" id="topic" aria-labelledby="topic-title"><nav class="lesson-contents"><a href="#turn">פנייה</a></nav><section class="lesson-section" id="turn" aria-labelledby="turn-title"><h3 id="turn-title">פנייה</h3></section><a class="lesson-quiz-link" href="practice.html">תרגול</a></main>`;
const quiz = `<html lang="he" dir="rtl"><head><title>שאלון: פנייה - תרגול</title><meta name="robots" content="noindex"></head><body><h1>שאלון: פנייה</h1><a class="lesson-back" data-lesson-link href="lesson.html#topic">חזרה</a><form class="quiz-form"><fieldset class="quiz-question" id="scenario" aria-describedby="prompt"><legend>מצב בדרך</legend><p id="prompt">מה עושים?</p><label><input type="radio" name="turn-choice" value="stop">עוצרים</label><label><input type="radio" name="turn-choice" value="wait">ממתינים</label></fieldset></form></body></html>`;

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

for (const [filename, suffix, returnPath] of [
	["index.html", "/", "../"],
	["index.html", "/index.html", "../index.html"],
	["index.htm", "/", "../"],
	["index.htm", "/index.htm", "../index.htm"],
	["index.htm", "", "/course/topic"],
]) {
	test(`nested learning pages resolve ${filename} with links ending in '${suffix}'`, async (t) => {
		const root = await fixture(t, {
			"lesson.html": null,
			"practice.html": null,
			"course/index.html": `<a class="subject-learn" href="topic${suffix}">ללמידה</a>`,
			[`course/topic/${filename}`]: lesson.replace(
				'href="practice.html"',
				`href="quiz${suffix}"`,
			),
			[`course/topic/quiz/${filename}`]: quiz.replace(
				'href="lesson.html#topic"',
				`href="${returnPath}#topic"`,
			),
			"docs/example.html": quiz,
			".hidden/example.html": quiz,
		});
		const content = await readLearningContent(root);
		assert.deepEqual(content.issues, []);
		assert.equal(content.lessons.length, 1);
		assert.equal(content.quizzes.length, 1);
		assert.equal(content.lessons[0].file, `course/topic/${filename}`);
		assert.equal(
			content.quizzes[0].file,
			`course/topic/quiz/${filename}`,
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
			'href="quiz/"',
		),
		"course/topic/quiz/index.html": quiz.replace(
			'href="lesson.html#topic"',
			'href="../#missing"',
		),
	});
	const { issues } = await readLearningContent(root);
	assert.deepEqual(issues, [
		"course/topic/quiz/index.html: return link must target course/topic/index.html#topic",
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
	assert.equal(content.lessons[0].quizFile, "practice.html");
	assert.equal(content.quizzes[0].lessonFile, "lesson.html");
	assert.equal(content.quizzes[0].topicAnchor, "topic");
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
		/lesson\.html#topic:.*quiz link/,
	],
	[
		"missing quiz file",
		{ "practice.html": null },
		/lesson\.html#topic:.*practice\.html/,
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
				'href="lesson.html#topic"',
				'href="lesson.html#missing"',
			),
		},
		/practice\.html:.*return.*lesson\.html#topic/,
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
		/lesson\.html#topic:.*local.*quiz/,
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

test("multiple sections belong to one topic quiz", async (t) => {
	const second =
		'<section class="lesson-section" id="another" aria-labelledby="another-title"><h2 id="another-title">עוד נושא</h2></section>';
	const content = await readLearningContent(
		await fixture(t, {
			"lesson.html": lesson
				.replace("</nav>", '<a href="#another">עוד נושא</a></nav>')
				.replace("</main>", `${second}</main>`),
		}),
	);
	assert.equal(content.lessons[0].sections.length, 2);
	assert.deepEqual(content.issues, []);
	assert.equal(content.lessons[0].quizFile, "practice.html");
});

test("explicit reading-only sections need no fabricated quiz", async (t) => {
	const reading =
		'<section class="lesson-section" id="reading" aria-labelledby="reading-title"><h2 id="reading-title">קריאה מודרכת</h2><p>תוכן לימוד מלא ללא שאלון.</p><a class="official-resource" href="https://www.gov.il/he/pages/example">מידע רשמי</a></section>';
	const content = await readLearningContent(
		await fixture(t, {
			"lesson.html": lesson
				.replace("</nav>", '<a href="#reading">קריאה מודרכת</a></nav>')
				.replace("</main>", `${reading}</main>`),
		}),
	);
	assert.deepEqual(content.issues, []);
	assert.equal("format" in content.lessons[0].sections[1], false);
	assert.equal("quizFile" in content.lessons[0].sections[1], false);
	assert.equal(content.lessons[0].sourceLinks, 0);
});

test("only approved government resources bypass the source-link count", async (t) => {
	const reading =
		'<section class="lesson-section" id="reading" aria-labelledby="reading-title"><h2 id="reading-title">קריאה</h2><a class="official-resource" href="https://example.com/resource">משאב חיצוני</a></section>';
	const content = await readLearningContent(
		await fixture(t, {
			"lesson.html": lesson
				.replace("</nav>", '<a href="#reading">קריאה</a></nav>')
				.replace("</main>", `${reading}</main>`),
		}),
	);
	assert.equal(content.lessons[0].sourceLinks, 1);
});

test("official government-data resources bypass the source-link count", async (t) => {
	const reading =
		'<section class="lesson-section" id="reading" aria-labelledby="reading-title"><h2 id="reading-title">קריאה</h2><a class="official-resource" href="https://data.gov.il/he/datasets/example">מאגר ממשלתי</a></section>';
	const content = await readLearningContent(
		await fixture(t, {
			"lesson.html": lesson
				.replace("</nav>", '<a href="#reading">קריאה</a></nav>')
				.replace("</main>", `${reading}</main>`),
		}),
	);
	assert.equal(content.lessons[0].sourceLinks, 0);
});

for (const [name, change, expected] of [
	["quiz link inside a section", lesson.replace('</section><a class="lesson-quiz-link"', '<a class="lesson-quiz-link"').replace('>תרגול</a></main>', '>תרגול</a></section></main>'), /lesson\.html#topic:.*outside.*section/],
	["duplicate topic quiz link", lesson.replace('</main>', '<a class="lesson-quiz-link" href="practice.html">תרגול</a></main>'), /lesson\.html#topic:.*exactly one quiz link/],
	["missing topic anchor", lesson.replace('id="topic" ', ''), /lesson\.html:.*stable ID/],
	["missing topic heading", lesson.replace('<h1 id="topic-title">פנייה</h1>', ''), /lesson\.html#topic:.*heading/],
	["wrong topic heading reference", lesson.replace('aria-labelledby="topic-title"', 'aria-labelledby="turn-title"'), /lesson\.html#topic:.*heading/],
]) {
	test(`learning content reports ${name}`, async (t) => {
		const content = await readLearningContent(await fixture(t, { "lesson.html": change }));
		assert.ok(content.issues.some((issue) => expected.test(issue)), content.issues.join("\n"));
	});
}

test("two topics cannot assign the same quiz page", async (t) => {
	const content = await readLearningContent(await fixture(t, {
		"course/index.html": '<a class="subject-learn" href="../lesson.html">ללמידה</a><a class="subject-learn" href="../second.html">ללמידה</a>',
		"second.html": lesson.replace('<h1 id="topic-title">פנייה</h1>', '<h1 id="topic-title">פנייה שנייה</h1>').replace('href="practice.html"', 'href="practice.html"'),
	}));
	assert.ok(content.issues.some((issue) => /second\.html#topic:.*already assigned quiz/.test(issue)), content.issues.join("\n"));
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

const gradedQuiz = quiz.replace('class="quiz-form"', 'class="quiz-form" data-quiz-graded')
	.replace('id="scenario"', 'id="scenario" data-correct-answer="wait" data-source-question="1234"')
	.replace('</fieldset>', '<details data-quiz-feedback><summary>בדיקת התשובה</summary><p>ממתינים</p><p data-quiz-explanation>נותנים לתנועה לעבור.</p></details></fieldset>');

test("graded content exposes the authored answer and source identity for publication checks", async t => {
	const content = await readLearningContent(await fixture(t, { "practice.html": gradedQuiz }));
	assert.deepEqual(content.issues, []);
	assert.equal(content.quizzes[0].graded, true);
	assert.equal(content.quizzes[0].questions[0].correctAnswer, "wait");
	assert.equal(content.quizzes[0].questions[0].officialId, "1234");
	assert.deepEqual(content.quizzes[0].questions[0].choices, [
		{ value: "stop", text: "עוצרים" }, { value: "wait", text: "ממתינים" },
	]);
});

for (const [name, authored, expected] of [
	["missing answer", gradedQuiz.replace(' data-correct-answer="wait"', ''), /correct answer/],
	["answer outside the choices", gradedQuiz.replace('data-correct-answer="wait"', 'data-correct-answer="missing"'), /correct answer/],
	["missing self-check disclosure", gradedQuiz.replace(/<details[\s\S]*?<\/details>/, ''), /feedback/],
	["empty explanation", gradedQuiz.replace('נותנים לתנועה לעבור.', ''), /explanation/],
]) {
	test(`graded content reports ${name} with its question location`, async t => {
		const { issues } = await readLearningContent(await fixture(t, { "practice.html": authored }));
		assert.ok(issues.some(issue => issue.startsWith("practice.html#scenario:") && expected.test(issue)), issues.join("\n"));
	});
}
