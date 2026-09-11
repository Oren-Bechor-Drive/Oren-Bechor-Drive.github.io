import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("page exposes its Hebrew semantic structure", async () => {
	const html = await read("index.html");
	assert.match(html, /<html[^>]+lang="he"[^>]+dir="rtl"/);

	for (const hook of [
		'id="topics"',
		'id="about"',
		'id="instructor"',
		'class="topic-card',
		"data-menu-toggle",
		"data-topic-panel",
	]) {
		assert.ok(html.includes(hook), `Missing HTML hook: ${hook}`);
	}
});

test("topic controls keep their native button semantics", async () => {
	const html = await read("index.html");
	assert.doesNotMatch(html, /<button[^>]+role="listitem"/);
	const document = new JSDOM(html).window.document;
	assert.equal(document.querySelector(".topic-rail").getAttribute("role"), "group");
});

test("topbar learning action reserves the future account-page destination", async () => {
	const html = await read("index.html");
	const document = new JSDOM(html).window.document;
	const learningAction = document.querySelector("#site-menu .nav-action");

	assert.ok(learningAction, "Missing topbar learning action");
	assert.equal(learningAction.getAttribute("href"), "#");
});

test("styles preserve the supplied design system and responsive contract", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	const stylesheets = [
		...document.querySelectorAll('link[rel="stylesheet"]'),
	];
	assert.ok(stylesheets.length > 0, "Page must load its stylesheets");
	const css = (
		await Promise.all(
			stylesheets.map((link) => read(link.getAttribute("href"))),
		)
	)
		.join("\n")
		.toLowerCase();

	// Palette tokens remain available even when the current page does not use them.
	for (const [name, color] of [
		["--primary-bright", "#6dcdd6"],
		["--secondary-bright", "#f6db78"],
		["--tertiary-bright", "#d96c6c"],
	]) {
		assert.match(
			css,
			new RegExp(`${name}\\s*:\\s*${color}\\s*;`),
			`Missing palette token: ${name}`,
		);
	}

	for (const token of ["prefers-reduced-motion", "max-width: 768px"]) {
		assert.ok(css.includes(token), `Missing CSS contract: ${token}`);
	}
});

test("README records the later welcome-page concepts", async () => {
	const readme = await read("README.md");
	assert.match(readme, /^## Todo$/m);
	assert.match(readme, /Instructor-led welcome/i);
	assert.match(readme, /Course-dashboard preview/i);
	assert.match(readme, /shared course-content module/i);
	assert.match(readme, /visual-system interface/i);
	assert.match(readme, /full browser automation/i);
});
