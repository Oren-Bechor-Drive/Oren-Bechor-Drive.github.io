import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { imageSize } from "image-size";
import { readLearningContent } from "./learning-content.mjs";

const contentFile = "docs/reference/theory-quiz-content.json";
const mediaFile = "docs/reference/theory-media.json";

const escape = value => String(value).replace(/[&<>"']/g, c => ({
	"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const indent = (depth, text) => "\t".repeat(depth) + text;
function prose(depth, text) {
	const lines = [];
	let line = "";
	for (const word of escape(text).split(/\s+/)) {
		if (line && line.length + word.length > 72) {
			lines.push(indent(depth, line));
			line = "";
		}
		line += `${line ? " " : ""}${word}`;
	}
	if (line) lines.push(indent(depth, line));
	return lines.join("\n");
}
function renderQuestion(question, index, images) {
	const id = `question-${question.officialId}`;
	const lines = [
		indent(5, "<fieldset"), indent(6, 'class="quiz-question"'),
		indent(6, `id="${id}"`), indent(6, `aria-describedby="${id}-prompt"`),
		indent(6, `data-source-question="${question.officialId}"`),
		indent(6, `data-correct-answer="${question.correctOptionIndex}"`), indent(5, ">"),
		indent(6, `<legend tabindex="-1">שאלה ${index + 1}</legend>`),
		indent(6, `<p id="${id}-prompt">`), prose(7, question.question), indent(6, "</p>"),
	];
	for (const url of question.imageUrls) {
		const image = images.find(image => image.sourceUrl === url);
		lines.push(indent(6, "<img"), indent(7, 'class="quiz-image"'),
			indent(7, `src="../../../${escape(image.path)}"`),
			indent(7, `width="${image.width}"`), indent(7, `height="${image.height}"`),
			indent(7, `alt="${escape(image.alt)}"`), indent(7, 'loading="lazy" decoding="async"'), indent(6, "/>"));
	}
	lines.push(indent(6, '<div class="quiz-answers">'));
	for (const [value, option] of question.options.entries()) {
		lines.push(indent(7, "<label"), indent(8, "><input"), indent(9, 'type="radio"'),
			indent(9, `name="${id}"`), indent(9, `value="${value}"`), indent(8, "/><span>"),
			prose(9, option), indent(8, "</span></label"), indent(7, ">"));
	}
	lines.push(indent(6, "</div>"), indent(6, '<details class="quiz-feedback" data-quiz-feedback>'),
		indent(7, "<summary>בדיקת התשובה</summary>"), indent(7, "<p>"),
		prose(8, `התשובה הנכונה: ${question.options[question.correctOptionIndex]}`), indent(7, "</p>"),
		indent(7, "<p data-quiz-explanation>"), prose(8, question.explanation), indent(7, "</p>"),
		indent(6, "</details>"), indent(6, '<p class="quiz-source">'),
		prose(7, `${question.adaptation?.label ?? "שאלת מקור"} ${question.officialId} ממאגר משרד התחבורה.`),
		indent(6, "</p>"), indent(5, "</fieldset>"));
	return lines.join("\n");
}
async function validateSource(rootDir, bank, images) {
	const invalid = message => { throw new Error(`${contentFile}: ${message}`); };
	const invalidMedia = message => { throw new Error(`${mediaFile}: ${message}`); };
	const text = value => typeof value === "string" && value.trim().length > 0;
	const answer = question => question && text(question.question) &&
		Array.isArray(question.options) && question.options.length === 4 && question.options.every(text) &&
		Number.isInteger(question.correctOptionIndex) && question.correctOptionIndex >= 0 && question.correctOptionIndex < 4;
	const references = ids => Array.isArray(ids) && ids.length > 0 &&
		ids.every(id => text(id) && Object.hasOwn(bank.sourceReferences ?? {}, id) &&
			/^https?:\/\//.test(bank.sourceReferences[id]));
	// The generated attribution specifically identifies this Ministry dataset and license.
	if (!bank?.source || bank.source.datasetUrl !== "https://data.gov.il/he/datasets/ministry_of_transport/tqhe" ||
		bank.source.publisher !== "משרד התחבורה והבטיחות בדרכים")
		invalid("source provenance must identify the Ministry theory dataset");
	if (bank.source.licenseId !== "cc-by") invalid("unsupported source attribution license");
	if (!Array.isArray(bank.topics) || !bank.topics.length) invalid("topics must be a nonempty list");
	const topicIds = new Set();
	for (const topic of bank.topics) {
		if (!topic || typeof topic.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id) || !text(topic.title) || topicIds.has(topic.id))
			invalid(`invalid or duplicate topic ${topic?.id}`);
		topicIds.add(topic.id);
	}
	if (!Array.isArray(bank.questions) || !bank.questions.length) invalid("questions must be a nonempty list");
	const ids = new Set();
	for (const question of bank.questions) {
		const id = question?.officialId;
		if (typeof id !== "string" || !/^\d{4}$/.test(id) || ids.has(id))
			invalid(`invalid or duplicate question ${id}`);
		ids.add(id);
		if (!topicIds.has(question.topicId)) invalid(`${id}: unknown topic ${question.topicId}`);
		if (!answer(question) || !text(question.explanation)) invalid(`${id}: invalid question, choices, answer or explanation`);
		if (!references(question.sourceIds) || !question.sourceIds.includes("bank") ||
			question.explanationSource !== "course-authored") invalid(`${id}: missing or unknown source references`);
		if (!Array.isArray(question.imageUrls) || question.imageUrls.some(url => !text(url)) ||
			new Set(question.imageUrls).size !== question.imageUrls.length) invalid(`${id}: invalid imageUrls`);
		if (question.adaptation || question.originalSource) {
			if (!question.adaptation || question.adaptation.label !== "עיבוד לשאלת המקור" ||
				!text(question.adaptation.note) || !references(question.adaptation.sourceIds))
				invalid(`${id}: adaptation needs the reviewed label, note and source references`);
			if (!answer(question.originalSource)) invalid(`${id}: adaptation needs valid originalSource`);
		}
	}
	for (const topic of bank.topics)
		if (!bank.questions.some(question => question.topicId === topic.id)) invalid(`no questions for topic ${topic.id}`);
	if (!Array.isArray(images)) invalidMedia("images must be a list");
	const byUrl = new Map();
	for (const image of images) {
		if (!image || !text(image.sourceUrl) || byUrl.has(image.sourceUrl)) invalidMedia(`missing or duplicate sourceUrl ${image?.sourceUrl}`);
		byUrl.set(image.sourceUrl, image);
	}
	const inspected = new Set();
	for (const question of bank.questions) {
		for (const url of question.imageUrls) {
			const image = byUrl.get(url);
			if (!image || !Array.isArray(image.officialIds) || !image.officialIds.includes(question.officialId))
				invalidMedia(`${question.officialId}: missing inspected media ownership for ${url}`);
			if (inspected.has(url)) continue;
			inspected.add(url);
			if (!text(image.path) || !image.path.startsWith("assets/") || image.path.includes("\\") ||
				path.posix.normalize(image.path) !== image.path || image.path.includes("..")) invalidMedia(`${url}: invalid local image path`);
			if (!text(image.alt) || !Number.isInteger(image.width) || image.width <= 0 ||
				!Number.isInteger(image.height) || image.height <= 0) invalidMedia(`${image.path}: invalid inspected alt or dimensions`);
			let bytes;
			try { bytes = await readFile(path.join(rootDir, image.path)); }
			catch (error) { invalidMedia(`${image.path}: cannot read original (${error.message})`); }
			if (createHash("sha256").update(bytes).digest("hex") !== image.sha256 || bytes.length !== image.bytes)
				invalidMedia(`${image.path}: original hash or byte count differs from inspected media`);
			let dimensions;
			try { dimensions = imageSize(bytes); }
			catch (error) { invalidMedia(`${image.path}: cannot read image dimensions (${error.message})`); }
			if (dimensions.width !== image.width || dimensions.height !== image.height)
				invalidMedia(`${image.path}: original dimensions differ from inspected media`);
		}
	}
}

// Source locations let us retain all bytes outside the publisher's owned elements.
function editShell(html, file, prepare) {
	const dom = new JSDOM(html, { includeNodeLocations: true });
	const edits = [];
	const fail = message => { throw new Error(`${file}: ${message}`); };
	function one(selector, parent = dom.window.document) {
		const nodes = parent.querySelectorAll(selector);
		if (nodes.length !== 1) fail(`expected exactly one ${selector}; found ${nodes.length}`);
		const node = nodes[0];
		const location = dom.nodeLocation(node);
		if (!location?.startTag || (node.tagName !== "META" && !location.endTag))
			fail(`missing explicit closing tag for ${selector}`);
		return node;
	}
	function replace(node, value, inner = false) {
		const location = dom.nodeLocation(node);
		edits.push({ start: inner ? location.startTag.endOffset : location.startOffset,
			end: inner ? location.endTag.startOffset : location.endOffset, value });
	}
	function attribute(node, name, value) {
		const location = dom.nodeLocation(node).attrs?.[name];
		if (!location) fail(`missing ${name} attribute on ${node.tagName.toLowerCase()}`);
		const authored = html.slice(location.startOffset, location.endOffset);
		const prefix = authored.match(/^[^=]+\s*=\s*/)?.[0];
		if (!prefix) fail(`missing ${name} attribute value`);
		const quote = authored[prefix.length];
		const wrapped = quote === '"' || quote === "'" ? quote : '"';
		edits.push({ start: location.startOffset, end: location.endOffset,
			value: `${prefix}${wrapped}${escape(value)}${wrapped}` });
	}
	try {
		prepare({ one, replace, attribute, fail });
		let previousStart = html.length;
		for (const edit of edits.sort((a, b) => b.start - a.start)) {
			if (edit.end > previousStart) fail("overlapping publication regions");
			html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
			previousStart = edit.start;
		}
		return html;
	} finally {
		dom.window.close();
	}
}

function prepareQuiz(html, file, topic, questions, images) {
	const intro = `\t\t\t<div class="lesson-intro">
\t\t\t\t<h1 data-quiz-title>שאלון: ${escape(topic.title)}</h1>
\t\t\t\t<p>
${prose(5, `${questions.length} שאלות בנושא. אפשר לעבור בין השאלות ולשנות תשובות לפני ההגשה. כדי לקבל ציון יש לענות על כולן.`)}
\t\t\t\t</p>
\t\t\t\t<p class="quiz-note">
${prose(5, 'תרגול על בסיס מאגר התאוריה של משרד התחבורה. בסיום מוצגים הציון, התשובות הנכונות והסברי הקורס.')}
\t\t\t\t</p>
\t\t\t</div>
`;
	const resultHtml = `\t\t\t<section
\t\t\t\tclass="quiz-result"
\t\t\t\tdata-quiz-result
\t\t\t\taria-labelledby="quiz-result-title"
\t\t\t\thidden
\t\t\t>
\t\t\t\t<h2 id="quiz-result-title" tabindex="-1">תוצאות השאלון</h2>
\t\t\t\t<p data-quiz-count></p>
\t\t\t\t<p>אפשר לעבור על התשובות וההסברים או להתחיל ניסיון חדש.</p>
\t\t\t\t<p>זהו תרגול עצמי, ולא מבחן תאוריה רשמי. התוצאה אינה נשמרת בחשבון.</p>
\t\t\t\t<div class="quiz-result-actions">
\t\t\t\t\t<button class="course-button" type="button" data-quiz-review>חזרה לשאלות</button>
\t\t\t\t\t<button class="quiz-previous" type="button" data-quiz-retry>ניסיון חדש</button>
\t\t\t\t\t<a data-lesson-link href="../#topic">חזרה לנושא הלימוד</a>
\t\t\t\t</div>
\t\t\t</section>`;
	const attributionHtml = `\t\t\t<aside class="quiz-attribution" aria-label="מקור השאלות">
\t\t\t\t<p>
\t\t\t\t\tמקור השאלות והתשובות:
\t\t\t\t\t<a href="https://data.gov.il/he/datasets/ministry_of_transport/tqhe">מאגר התאוריה של משרד התחבורה</a>,
\t\t\t\t\tברישיון <a href="https://opendefinition.org/licenses/cc-by/">Creative Commons Attribution</a>.
\t\t\t\t</p>
\t\t\t\t<p>
${prose(5, 'הותאמו העיצוב וסימני הפיסוק. שאלות שנוסחן עודכן מסומנות כעיבוד לשאלת המקור. השיוך לנושאים וההסברים הם של הקורס, ואינם מטעם משרד התחבורה.')}
\t\t\t\t</p>
\t\t\t</aside>
`;
	return editShell(html, file, ({ one, replace, attribute, fail }) => {
		const main = one("main#main");
		const introNode = one(".lesson-intro");
		const fallback = one("[data-quiz-fallback]");
		const session = one("[data-quiz-session]");
		const form = one("form.quiz-form");
		const position = one("[data-quiz-position]");
		const result = one("section[data-quiz-result]");
		const attribution = one("aside.quiz-attribution");
		for (const node of [introNode, fallback, session, result, attribution])
			if (node.parentElement !== main) fail(`publication region ${node.className || node.tagName} must be a direct child of main#main`);
		if (!session.contains(form) || !session.contains(position))
			fail("quiz form and position must be inside [data-quiz-session]");
		one("h1[data-quiz-title]", introNode);
		replace(introNode, intro.trim());
		replace(fallback, `\n${prose(4, 'כל השאלות מוצגות ברצף. אפשר לענות ולפתוח את "בדיקת התשובה" בכל שאלה. חישוב הציון דורש JavaScript.')}\n\t\t\t`, true);
		replace(form, [
			'<form class="quiz-form" data-quiz-graded aria-label="שאלות לתרגול">',
			...questions.map((question, index) => renderQuestion(question, index, images)),
			indent(4, "</form>"),
		].join("\n"));
		const space = position.textContent.match(/^(\s*)[\s\S]*?(\s*)$/);
		replace(position, `${space[1]}שאלה 1 מתוך ${questions.length}${space[2]}`, true);
		replace(result, resultHtml.trim());
		replace(attribution, attributionHtml.trim());
		attribute(one('meta[name="description"]'), "content",
			`תרגול בנושא ${topic.title} עם שאלות ממאגר התאוריה, ציון והסברים לתשובות.`);
	});
}

async function validatePrepared(rootDir, prepared) {
	// Use the existing learning interpreter on prepared files, before publishing any.
	const staging = await mkdtemp(path.join(os.tmpdir(), "theory-publication-"));
	try {
		const pages = [...prepared, { file: "course/index.html",
			html: await readFile(path.join(rootDir, "course/index.html"), "utf8") }];
		for (const { file, html } of pages) {
			await mkdir(path.dirname(path.join(staging, file)), { recursive: true });
			await writeFile(path.join(staging, file), html);
		}
		const { issues } = await readLearningContent(staging);
		if (issues.length) throw new Error(`Invalid prepared learning content:\n${issues.join("\n")}`);
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

async function readSource(rootDir, file) {
	try { return JSON.parse(await readFile(path.join(rootDir, file), "utf8")); }
	catch (error) { throw new Error(`${file}: cannot read JSON (${error.message})`, { cause: error }); }
}

// Maintenance only. Serving the checked-in HTML never invokes this operation.
export async function publishTheoryQuizzes(rootDir, { check = false } = {}) {
	const bank = await readSource(rootDir, contentFile);
	const media = await readSource(rootDir, mediaFile);
	const images = media?.images;
	await validateSource(rootDir, bank, images);
	const prepared = [];
	const topics = [];
	for (const topic of bank.topics) {
		const questions = bank.questions.filter(question => question.topicId === topic.id);
		const file = `course/${topic.id}/quiz/index.html`;
		const before = await readFile(path.join(rootDir, file), "utf8");
		prepared.push({ file, before, html: prepareQuiz(before, file, topic, questions, images) });
		const lessonFile = `course/${topic.id}/index.html`;
		const lesson = await readFile(path.join(rootDir, lessonFile), "utf8");
		const html = editShell(lesson, lessonFile, ({ one, replace }) => {
			one(".lesson-quiz");
			replace(one(".lesson-quiz small"), `${questions.length} שאלות בנושא, עם ציון והסברים לתשובות.`, true);
		});
		prepared.push({ file: lessonFile, before: lesson, html });
		topics.push({ id: topic.id, questionCount: questions.length });
	}
	await validatePrepared(rootDir, prepared);
	const changed = prepared.filter(page => page.before !== page.html);
	if (check && changed.length)
		throw new Error(`Outdated authored quiz: ${changed.map(page => page.file).join(", ")}`);
	if (!check)
		for (const { file, html } of changed) await writeFile(path.join(rootDir, file), html);
	return { questionCount: bank.questions.length, topics, changedFiles: changed.map(page => page.file) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		if (process.argv.slice(2).some(argument => argument !== "--check"))
			throw new Error("Usage: node scripts/publish-theory-quizzes.mjs [--check]");
		const check = process.argv.includes("--check");
		const result = await publishTheoryQuizzes(process.cwd(), { check });
		for (const topic of result.topics) console.log(`${topic.id}: ${topic.questionCount} questions`);
		console.log(`${check ? "Verified" : "Published"} ${result.questionCount} distinct questions across ${result.topics.length} topics.`);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
