import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import { inspectImage } from "../../scripts/road-media-integrity.mjs";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("page exposes its Hebrew semantic structure", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	assert.equal(document.documentElement.lang, "he");
	assert.equal(document.documentElement.dir, "rtl");
	assert.equal(document.querySelectorAll("main").length, 1);
	assert.equal(document.querySelectorAll("h1").length, 1);
});

test("page introduces the instructor before the combined learning section", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	const sectionIds = [...document.querySelectorAll("main > section")].map(
		(section) => section.id,
	);
	const navigationTargets = [
		...document.querySelectorAll('#site-menu a[href^="#"]:not(.nav-action)'),
	].map((link) => link.getAttribute("href"));

	assert.deepEqual(sectionIds, ["top", "instructor", "about", "start"]);
	assert.equal(document.querySelectorAll("#about h2").length, 1);
	assert.ok(document.querySelector("#about [data-topic-explorer]"));
	const main = document.querySelector("main");
	assert.equal(main.lastElementChild.id, "start");
	assert.equal(
		main.nextElementSibling,
		document.querySelector("body > footer"),
	);
	assert.deepEqual(navigationTargets, [
		"#instructor",
		"#about",
	]);
});

test("unavailable course and social actions do not pretend to be working links", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	assert.equal(document.querySelector('a[href="#"]'), null);
	for (const selector of [".nav-action", "#start .button"]) {
		const action = document.querySelector(selector);
		assert.equal(action.tagName, "BUTTON");
		assert.equal(action.disabled, true);
		assert.match(action.textContent, /אינה זמינה/);
	}
	assert.equal(document.querySelector("[data-icon-kit]"), null);
	const profiles = [...document.querySelectorAll(".footer-social > span")];
	assert.deepEqual(profiles.map(item => item.textContent.trim()),
		["אינסטגרם", "טיקטוק", "יוטיוב", "וואטסאפ"]);
	for (const profile of profiles) {
		assert.equal(profile.getAttribute("aria-disabled"), "true");
		const image = profile.querySelector("img");
		assert.equal(image.getAttribute("alt"), "");
		assert.ok((await read(image.getAttribute("src"))).includes("<svg"));
	}
	assert.match(document.querySelector("#contact-status").textContent, /יתווספו בהמשך/);
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
	assert.equal(brandIcon.getAttribute("alt"), "לוגו");
	assert.equal(favicon?.getAttribute("href"), "assets/images/optimized/favicon.png?v=2");
	assert.equal(favicon?.getAttribute("type"), "image/png");
});

test("page uses Varela Round as its global typeface", async () => {
	const css = await read("css/base.css");
	const { window } = new JSDOM(
		`<!doctype html><style>${css}</style><body></body>`,
	);
	const bodyFont = window.getComputedStyle(window.document.body).fontFamily;

	assert.match(bodyFont, /^"Varela Round",/);
});

test("mobile and Windows icons reference PNG files at their declared dimensions", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	const touch = document.querySelector('link[rel="apple-touch-icon"]');
	assert.equal(touch?.getAttribute("sizes"), "180x180");
	const manifestLink = document.querySelector('link[rel="manifest"]');
	assert.ok(manifestLink, "mobile browsers need a linked manifest");
	const manifestUrl = new URL(`../../${manifestLink.getAttribute("href")}`, import.meta.url);
	const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
	assert.equal(manifest.lang, "he");
	assert.equal(manifest.dir, "rtl");
	assert.equal(manifest.display, "browser");
	assert.deepEqual(manifest.icons.map(icon => icon.sizes), ["192x192", "512x512"]);
	const tile = document.querySelector('meta[name="msapplication-TileImage"]');
	assert.ok(tile, "Windows tiles need a tile image");
	const icons = [
		[new URL(`../../${touch.getAttribute("href")}`, import.meta.url), 180],
		[new URL(`../../${tile.content}`, import.meta.url), 144],
		...manifest.icons.map(icon => {
			assert.equal(icon.type, "image/png");
			return [new URL(icon.src, manifestUrl), parseInt(icon.sizes)];
		}),
	];
	for (const [url, size] of icons) {
		const image = inspectImage(await readFile(url));
		assert.equal(image.width, size);
		assert.equal(image.height, size);
		assert.equal(image.format, "png");
	}
});

test("topic controls keep their native button semantics", async () => {
	const document = new JSDOM(await read("index.html")).window.document;
	const controls = [...document.querySelectorAll(".topic-card")];
	assert.ok(controls.length > 0, "topic controls must exist");
	for (const control of controls) {
		assert.equal(control.tagName, "BUTTON");
		assert.ok(!control.hasAttribute("role") || control.getAttribute("role") === "button");
	}
	assert.equal(
		document.querySelector(".topic-rail").getAttribute("role"),
		"group",
	);
});
