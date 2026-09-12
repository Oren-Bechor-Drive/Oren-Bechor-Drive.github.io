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

test("page introduces the instructor after the hero and ends with topics then the footer", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	const sectionIds = [...document.querySelectorAll("main > section")].map(
		(section) => section.id,
	);
	const navigationTargets = [
		...document.querySelectorAll('#site-menu a[href^="#"]'),
	].map((link) => link.getAttribute("href"));

	assert.deepEqual(sectionIds, ["top", "instructor", "about", "topics"]);
	const main = document.querySelector("main");
	assert.equal(main.lastElementChild.id, "topics");
	assert.equal(
		main.nextElementSibling,
		document.querySelector("body > footer"),
	);
	assert.deepEqual(navigationTargets, [
		"#instructor",
		"#about",
		"#topics",
		"#",
	]);
});

test("footer social links remain named and usable without the icon kit", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	assert.equal(document.querySelector('script[src*="fontawesome"]'), null);
	assert.equal(
		document.querySelector(".site-footer").dataset.iconKit,
		"https://kit.fontawesome.com/a138530222.js",
	);
	const links = [...document.querySelectorAll(".site-footer nav a")];
	assert.deepEqual(
		links.map((link) => link.textContent.trim()),
		["אינסטגרם", "טיקטוק", "יוטיוב", "וואטסאפ"],
	);
	for (const link of links) {
		assert.equal(link.getAttribute("href"), "#");
		assert.equal(link.querySelector("i")?.getAttribute("aria-hidden"), "true");
	}
});

test("course icon brands the header and browser tab", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	const iconPath = "assets/icons/course-icon.png";
	const brandIcon = document.querySelector(".brand img");
	const favicon = document.querySelector('link[rel="icon"]');

	assert.ok(brandIcon, "Missing course icon from the header brand");
	assert.equal(brandIcon.getAttribute("src"), iconPath);
	assert.equal(brandIcon.getAttribute("width"), "42");
	assert.equal(brandIcon.getAttribute("height"), "42");
	assert.equal(brandIcon.getAttribute("alt"), "");
	assert.equal(favicon?.getAttribute("href"), iconPath);
	assert.equal(favicon?.getAttribute("type"), "image/png");
});

test("page loads the requested Google Fonts efficiently", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	const connectionHints = [
		...document.querySelectorAll('link[rel="preconnect"]'),
	].map((link) => link.getAttribute("href"));
	const fontStylesheet = [
		...document.querySelectorAll('link[rel="stylesheet"]'),
	].find((link) => link.href.startsWith("https://fonts.googleapis.com/css2"));

	assert.ok(
		connectionHints.includes("https://fonts.googleapis.com"),
		"Missing Google Fonts API preconnect",
	);
	assert.ok(
		connectionHints.includes("https://fonts.gstatic.com"),
		"Missing Google Fonts asset preconnect",
	);
	assert.equal(
		document
			.querySelector('link[rel="preconnect"][href="https://fonts.gstatic.com"]')
			?.getAttribute("crossorigin"),
		"",
	);
	assert.ok(fontStylesheet, "Missing Google Fonts stylesheet");

	const families = new URL(fontStylesheet.href).searchParams.getAll("family");
	assert.deepEqual(families, ["Varela Round"]);
});

test("page uses Varela Round as its global typeface", async () => {
	const css = await read("css/base.css");
	const { window } = new JSDOM(
		`<!doctype html><style>${css}</style><body></body>`,
	);
	const bodyFont = window.getComputedStyle(window.document.body).fontFamily;

	assert.match(bodyFont, /^"Varela Round",/);
});

test("topic controls keep their native button semantics", async () => {
	const html = await read("index.html");
	assert.doesNotMatch(html, /<button[^>]+role="listitem"/);
	const document = new JSDOM(html).window.document;
	assert.equal(
		document.querySelector(".topic-rail").getAttribute("role"),
		"group",
	);
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
		...document.querySelectorAll('link[rel="stylesheet"][href^="css/"]'),
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
