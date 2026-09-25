import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { JSDOM } from "jsdom";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const command = path.join(repository, "scripts/publish-theory-quizzes.mjs");
const execute = promisify(execFile);
const contentFile = "docs/reference/theory-quiz-content.json";
const mediaFile = "docs/reference/theory-media.json";

async function fixture(t) {
	const root = await mkdtemp(path.join(os.tmpdir(), "theory-publisher-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bank = JSON.parse(await readFile(path.join(repository, contentFile), "utf8"));
	const { images } = JSON.parse(await readFile(path.join(repository, mediaFile), "utf8"));
	const pages = ["course/index.html", ...bank.topics.flatMap(({ id }) => [
		`course/${id}/index.html`, `course/${id}/quiz/index.html`,
	])];
	for (const file of [contentFile, mediaFile, ...pages, ...images.map(image => image.path)]) {
		await mkdir(path.dirname(path.join(root, file)), { recursive: true });
		await cp(path.join(repository, file), path.join(root, file));
	}
	return {
		root, bank, pages,
		read: file => readFile(path.join(root, file), "utf8"),
		write: (file, value) => writeFile(path.join(root, file), value),
		snapshot: () => Promise.all(pages.map(file => readFile(path.join(root, file), "utf8"))),
		cli: (...args) => execute(process.execPath, [command, ...args], { cwd: root }),
	};
}

const firstQuiz = "course/learning-foundations/quiz/index.html";
const lastQuiz = "course/licensing-and-points/quiz/index.html";
const lastLesson = "course/licensing-and-points/index.html";

test("CLI check detects stale description regardless of attribute order and never writes", async t => {
	const f = await fixture(t);
	await f.write(firstQuiz, (await f.read(firstQuiz)).replace(
		/name="description"\s+content="[^"]*"/, 'content = "stale"\n name = "description"',
	));
	const before = await f.snapshot();
	await assert.rejects(f.cli("--check"), error => {
		assert.equal(error.code, 1);
		assert.match(error.stderr, /Outdated authored quiz:.*course\/learning-foundations\/quiz\/index.html/s);
		return true;
	});
	assert.deepEqual(await f.snapshot(), before);
});

test("CLI repairs reordered attributes while preserving unrelated bytes and publishes idempotently", async t => {
	const f = await fixture(t);
	const original = await f.snapshot();
	await f.write(firstQuiz, (await f.read(firstQuiz)).replace(
		/name="description"\s+content="[^"]*"/, 'content = "stale"\n name = "description"',
	).replace('class="lesson-intro"', "class = 'lesson-intro'")
	.replace('class="quiz-form" data-quiz-graded', "data-quiz-graded class = 'quiz-form'")
	.replace('class="quiz-result"\n\t\t\t\tdata-quiz-result', "data-quiz-result class = 'quiz-result'")
	.replace('</main>', '<!-- preserved after results -->\n\t\t</main>'));
	await f.cli();
	const published = await f.read(firstQuiz);
	assert.match(published, /content = "תרגול בנושא יסודות הנהיגה והלמידה/);
	assert.ok(published.includes('<!-- preserved after results -->\n\t\t</main>'));
	const after = await f.snapshot();
	assert.deepEqual(after.slice(0, 2), original.slice(0, 2));
	assert.deepEqual(after.slice(3), original.slice(3));
	await f.cli();
	await f.cli("--check");
	assert.deepEqual(await f.snapshot(), after);
});

test("a malformed late shell prevents all earlier publication writes", async t => {
	const f = await fixture(t);
	await f.write(firstQuiz, (await f.read(firstQuiz)).replace('שאלה 1 מתוך 9', 'שאלה 1 מתוך 999'));
	await f.write(lastLesson, (await f.read(lastLesson)).replace(/<small>\d+ שאלות בנושא[^<]*<\/small>/, ''));
	const before = await f.snapshot();
	await assert.rejects(f.cli(), error => {
		assert.match(error.stderr, /course\/licensing-and-points\/index.html.*lesson-quiz.*small/s);
		return true;
	});
	assert.deepEqual(await f.snapshot(), before);
});

async function publisher() {
	return (await import("../../scripts/publish-theory-quizzes.mjs")).publishTheoryQuizzes;
}

function removeOrDuplicate(html, selector, duplicate) {
	const dom = new JSDOM(html, { includeNodeLocations: true });
	try {
		const { startOffset, endOffset } = dom.nodeLocation(dom.window.document.querySelector(selector));
		return html.slice(0, startOffset) + (duplicate ? html.slice(startOffset, endOffset).repeat(2) : "") + html.slice(endOffset);
	} finally {
		dom.window.close();
	}
}

test("missing or duplicate publication regions fail with their file before any writes", async t => {
	const f = await fixture(t);
	const publish = await publisher();
	await f.write(firstQuiz, (await f.read(firstQuiz)).replace('שאלה 1 מתוך 9', 'שאלה 1 מתוך 999'));
	for (const [file, selector] of [
		[lastQuiz, '.lesson-intro'], [lastQuiz, '[data-quiz-fallback]'],
		[lastQuiz, 'form.quiz-form'], [lastQuiz, '[data-quiz-position]'],
		[lastQuiz, '[data-quiz-result]'], [lastQuiz, '.quiz-attribution'],
		[lastQuiz, 'meta[name="description"]'], [lastLesson, '.lesson-quiz small'],
	]) {
		const original = await f.read(file);
		for (const duplicate of [false, true]) {
			await t.test(`${duplicate ? "duplicate" : "missing"} ${selector}`, async () => {
				await f.write(file, removeOrDuplicate(original, selector, duplicate));
				const before = await f.snapshot();
				await assert.rejects(publish(f.root), error => {
					assert.ok(error.message.includes(file), error.message);
					assert.match(error.message, /exactly one/);
					return true;
				});
				assert.deepEqual(await f.snapshot(), before);
			});
		}
		await f.write(file, original);
	}
});

test("missing main closing tag and invalid retained return links fail during preparation", async t => {
	const f = await fixture(t);
	const publish = await publisher();
	await f.write(firstQuiz, (await f.read(firstQuiz)).replace('שאלה 1 מתוך 9', 'שאלה 1 מתוך 999'));
	const original = await f.read(lastQuiz);
	for (const [name, html, diagnostic] of [
		['main closing anchor', original.replace('</main>', ''), /closing tag.*main/],
		['retained return link', original.replace('href="../#topic"', 'href="../#missing"'), /return link must target/],
	]) {
		await t.test(name, async () => {
			await f.write(lastQuiz, html);
			const before = await f.snapshot();
			await assert.rejects(publish(f.root), error => {
				assert.ok(error.message.includes(lastQuiz), error.message);
				assert.match(error.message, diagnostic);
				return true;
			});
			assert.deepEqual(await f.snapshot(), before);
		});
	}
});

test("root-scoped publication preserves reviewed source fidelity, escaping, media and adaptation labels", async t => {
	const f = await fixture(t);
	const publish = await publisher();
	const question = f.bank.questions.find(question => question.officialId === '0010');
	question.question = 'האם "ימין" < שמאל & סימן $1 נשמר?';
	question.options[0] = "כן, <strong>כמו מקור</strong> & 'ציטוט'.";
	question.explanation = 'הסבר עם <script>דוגמה</script>, "מירכאות" & $&.';
	question.topicId = 'licensing-and-points';
	await f.write(contentFile, JSON.stringify(f.bank));
	const result = await publish(f.root);
	assert.equal(result.questionCount, 140);
	assert.equal(result.topics.find(topic => topic.id === 'learning-foundations').questionCount, 8);
	assert.equal(result.topics.find(topic => topic.id === 'licensing-and-points').questionCount, 18);
	assert.deepEqual(result.changedFiles.sort(), [firstQuiz, 'course/learning-foundations/index.html', lastQuiz, lastLesson].sort());
	const { quizzes, issues } = await readLearningContent(f.root);
	assert.deepEqual(issues, []);
	const published = quizzes.flatMap(quiz => quiz.questions.map(question => ({ ...question, file: quiz.file })));
	assert.equal(published.length, 140);
	assert.equal(new Set(published.map(question => question.officialId)).size, 140);
	const normalize = text => text.replace(/\s+/g, ' ').trim();
	for (const source of f.bank.questions) {
		const actual = published.find(question => question.officialId === source.officialId);
		assert.equal(actual.file, `course/${source.topicId}/quiz/index.html`);
		assert.equal(actual.prompt, normalize(source.question));
		assert.deepEqual(actual.choices.map(choice => choice.text), source.options.map(normalize));
		assert.equal(actual.correctAnswer, String(source.correctOptionIndex));
		assert.equal(normalize(actual.explanation), normalize(source.explanation));
	}
	const { images } = JSON.parse(await f.read(mediaFile));
	for (const topic of f.bank.topics) {
		const dom = new JSDOM(await f.read(`course/${topic.id}/quiz/index.html`));
		try {
			for (const source of f.bank.questions.filter(question => question.topicId === topic.id)) {
				const fieldset = dom.window.document.getElementById(`question-${source.officialId}`);
				assert.equal(normalize(fieldset.querySelector('.quiz-source').textContent),
					`${source.adaptation ? 'עיבוד לשאלת המקור' : 'שאלת מקור'} ${source.officialId} ממאגר משרד התחבורה.`);
				assert.equal(fieldset.querySelectorAll('script, strong').length, 0);
				const media = [...fieldset.querySelectorAll('img')];
				assert.equal(media.length, source.imageUrls.length);
				for (const [index, url] of source.imageUrls.entries()) {
					const expected = images.find(image => image.sourceUrl === url);
					assert.equal(media[index].getAttribute('src'), `../../../${expected.path}`);
					assert.equal(media[index].alt, expected.alt);
				}
			}
		} finally { dom.window.close(); }
	}
	const after = await f.snapshot();
	assert.deepEqual((await publish(f.root)).changedFiles, []);
	assert.deepEqual((await publish(f.root, { check: true })).changedFiles, []);
	assert.deepEqual(await f.snapshot(), after);
});

test("invalid reviewed input and media provenance are rejected before authored writes", async t => {
	const f = await fixture(t);
	const publish = await publisher();
	const originalBank = await f.read(contentFile);
	const originalMedia = await f.read(mediaFile);
	const cases = [
		['duplicate topic', bank => bank.topics.push(bank.topics[0]), /topic/],
		['unsafe topic path', bank => bank.topics[0].id = '../outside', /topic/],
		['blank choice', bank => bank.questions[0].options[0] = ' ', /0003/],
		['unknown source reference', bank => bank.questions[0].sourceIds.push('missing-source'), /0003.*source/],
		['missing publisher provenance', bank => delete bank.source, /source/],
		['unsupported attribution license', bank => bank.source.licenseId = 'unlicensed', /license/],
		['unlabelled adaptation', bank => delete bank.questions.find(q => q.adaptation).adaptation, /0004.*adaptation/],
		['unsupported adaptation label', bank => bank.questions.find(q => q.adaptation).adaptation.label = 'unreviewed', /0004.*adaptation/],
		['missing original source', bank => delete bank.questions.find(q => q.adaptation).originalSource, /0004.*originalSource/],
	];
	for (const [name, mutate, diagnostic] of cases) {
		await t.test(name, async () => {
			const bank = JSON.parse(originalBank);
			mutate(bank);
			await f.write(contentFile, JSON.stringify(bank));
			const before = await f.snapshot();
			await assert.rejects(publish(f.root), error => {
				assert.ok(error.message.includes(contentFile), error.message);
				assert.match(error.message, diagnostic);
				return true;
			});
			assert.deepEqual(await f.snapshot(), before);
		});
	}
	await f.write(contentFile, originalBank);
	for (const [name, mutate, diagnostic] of [
		['duplicate media URL', media => media.images.push(media.images[0]), /duplicate/],
		['incorrect image ownership', media => media.images[0].officialIds = [], /0387/],
		['incorrect original hash', media => media.images[0].sha256 = '0'.repeat(64), /TQ_PIC_3387.jpg.*hash/],
		['incorrect original dimensions', media => media.images[0].width = 1, /TQ_PIC_3387.jpg.*dimensions/],
		['unsafe media path', media => media.images[0].path = '../outside.jpg', /path/],
	]) {
		await t.test(name, async () => {
			const media = JSON.parse(originalMedia);
			mutate(media);
			await f.write(mediaFile, JSON.stringify(media));
			const before = await f.snapshot();
			await assert.rejects(publish(f.root), error => {
				assert.ok(error.message.includes(mediaFile), error.message);
				assert.match(error.message, diagnostic);
				return true;
			});
			assert.deepEqual(await f.snapshot(), before);
		});
	}
});

test("malformed JSON input identifies its source file without changing authored pages", async t => {
	const f = await fixture(t);
	const publish = await publisher();
	for (const file of [contentFile, mediaFile]) {
		const original = await f.read(file);
		await f.write(file, '{"unfinished":');
		const before = await f.snapshot();
		await assert.rejects(publish(f.root), error => {
			assert.ok(error.message.includes(file), error.message);
			return true;
		});
		assert.deepEqual(await f.snapshot(), before);
		await f.write(file, original);
	}
});
