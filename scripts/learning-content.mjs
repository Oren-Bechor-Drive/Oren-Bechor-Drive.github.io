import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";

const origin = "https://learning.invalid";

// Development-only interpretation of authored HTML. Runtime pages remain independent.
export async function readLearningContent(rootDir) {
	const issues = [];
	const pages = new Map();
	const lessons = [];
	const quizzes = [];
	const quizOwners = new Map();
	const report = (location, message) => issues.push(`${location}: ${message}`);
	for (const file of (await readdir(rootDir)).filter(file => file.endsWith(".html")).sort()) {
		try {
			pages.set(file, new JSDOM(await readFile(path.join(rootDir, file), "utf8")).window.document);
		} catch (error) {
			report(file, `cannot read HTML (${error.message})`);
		}
	}

	function localPage(href, file) {
		if (!href) return null;
		try {
			const url = new URL(href, `${origin}/${file}`);
			if (url.origin !== origin || url.search || url.hash) return null;
			return decodeURIComponent(url.pathname.slice(1));
		} catch { return null; }
	}

	function checkIds(document, file) {
		const ids = new Set();
		for (const element of document.querySelectorAll("[id]")) {
			if (!element.id || ids.has(element.id)) report(file, `empty or duplicate ID '${element.id}'`);
			ids.add(element.id);
		}
	}

	function readQuiz(file, lessonFile, section) {
		const document = pages.get(file);
		const location = `${lessonFile}#${section.id}`;
		if (!document) {
			report(location, `quiz file '${file}' does not exist among authored root HTML pages`);
			return;
		}
		if (quizOwners.has(file)) {
			report(location, `already assigned quiz '${file}' belongs to ${quizOwners.get(file)}`);
			return;
		}
		quizOwners.set(file, location);
		checkIds(document, file);
		const expectedTitle = `שאלון: ${section.title}`;
		if (document.querySelector("h1")?.textContent.trim() !== expectedTitle || !document.title.startsWith(expectedTitle)) report(file, `quiz title must match '${expectedTitle}'`);
		if (document.documentElement.lang !== "he" || document.documentElement.dir !== "rtl") report(file, "quiz must use Hebrew RTL");
		if (!document.querySelector('meta[name="robots"]')?.content.split(/[\s,]+/).includes("noindex")) report(file, "quiz preview must remain noindex");
		const returns = [...document.querySelectorAll("[data-lesson-link]")];
		if (!returns.length) report(file, `missing return link to ${location}`);
		for (const link of returns) {
			let destination;
			try { destination = new URL(link.getAttribute("href"), `${origin}/${file}`).href; } catch {}
			if (destination !== `${origin}/${location}`) report(file, `return link must target ${location}`);
		}
		const form = document.querySelector(".quiz-form");
		if (!form) report(file, "missing quiz form");
		const questions = [];
		const groups = new Set();
		for (const question of document.querySelectorAll(".quiz-question")) {
			const questionLocation = `${file}#${question.id || "(unnamed question)"}`;
			const legend = question.querySelector("legend");
			if (question.tagName !== "FIELDSET" || !form?.contains(question)) report(questionLocation, "question must be a fieldset inside the quiz form");
			if (!question.id) report(questionLocation, "question needs a stable ID");
			if (!legend?.textContent.trim()) report(questionLocation, "question needs a legend");
			const promptIds = (question.getAttribute("aria-describedby") ?? "").trim().split(/\s+/);
			if (!promptIds[0] || promptIds.some(id => !question.contains(document.getElementById(id)))) report(questionLocation, "question needs a valid prompt reference");
			const options = [...question.querySelectorAll('input[type="radio"]')];
			if (options.length < 2) report(questionLocation, "question needs at least two choices");
			const group = options[0]?.name;
			if (!group || groups.has(group) || options.some(option => option.name !== group)) report(questionLocation, "choices need one radio group unique to this question");
			groups.add(group);
			if (new Set(options.map(option => option.value)).size !== options.length) report(questionLocation, "choice values must be unique");
			if (options.some(option => ![...option.labels].some(label => label.textContent.trim()))) report(questionLocation, "every choice needs a text label");
			questions.push({ id: question.id, title: legend?.textContent.trim() ?? "", optionCount: options.length, videoCount: question.querySelectorAll('.video-placeholder[role="img"][aria-label]').length });
		}
		if (!questions.length) report(file, "quiz needs at least one question");
		quizzes.push({ file, title: expectedTitle, lessonFile, sectionId: section.id, placeholder: form?.hasAttribute("data-quiz-placeholder") ?? false, questions });
	}

	for (const [file, document] of pages) {
		if (!document.querySelector(".lesson-content, .lesson-section, .lesson-contents")) continue;
		if (!document.querySelector(".lesson-content")) report(file, "missing lesson-content container");
		checkIds(document, file);
		const sections = [];
		for (const element of document.querySelectorAll(".lesson-section")) {
			const location = `${file}#${element.id || "(unnamed section)"}`;
			if (!element.id) report(location, "section needs a stable ID");
			const heading = document.getElementById(element.getAttribute("aria-labelledby"));
			const title = heading?.textContent.trim() ?? "";
			if (!title || !element.contains(heading)) report(location, "section needs its declared heading");
			const links = [...element.querySelectorAll(".lesson-quiz-link")];
			if (links.length !== 1) report(location, "section needs exactly one quiz link");
			const quizFile = localPage(links[0]?.getAttribute("href"), file);
			if (links.length && !quizFile) report(location, "expected a local static quiz page without query or fragment");
			const section = { id: element.id, title, quizFile, videoCount: element.querySelectorAll('.video-placeholder[role="img"][aria-label]').length };
			sections.push(section);
			if (quizFile && title) readQuiz(quizFile, file, section);
		}
		if (!sections.length) report(file, "learning page needs at least one section");
		const contents = [...document.querySelectorAll(".lesson-contents a")].map(link => link.getAttribute("href")).sort();
		if (JSON.stringify(contents) !== JSON.stringify(sections.map(section => `#${section.id}`).sort())) report(file, "contents must link to each section exactly once");
		lessons.push({ file, sections, sourceLabels: document.querySelectorAll(".lesson-source").length, sourceLinks: document.querySelectorAll('a[href*="the-idea.pdf"], a[href^="https://"]').length });
	}
	if (!lessons.length) report("course.html", "no learning pages discovered");
	const library = pages.get("course.html");
	if (!library) report("course.html", "missing course library");
	for (const link of library?.querySelectorAll(".subject-learn") ?? []) {
		const file = localPage(link.getAttribute("href"), "course.html");
		if (!lessons.some(lesson => lesson.file === file)) report("course.html", `learning link '${link.getAttribute("href")}' does not name a learning page`);
	}
	for (const [file, document] of pages) {
		if (document.querySelector(".quiz-form") && !quizOwners.has(file)) report(file, "quiz is not linked from a learning section");
		document.defaultView.close();
	}
	return { lessons, quizzes, issues };
}
