import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { readLearningContent } from "../../scripts/learning-content.mjs";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const content = await readLearningContent(process.cwd());
const library = new JSDOM(await readFile("course/index.html", "utf8")).window
	.document;
const normalized = (element) => element.textContent.replace(/\s+/g, " ").trim();

test("library effort and question counts match the authored learning topics", async () => {
	assert.deepEqual(content.issues, []);
	for (const lesson of content.lessons) {
		const subject = library.querySelector(
			`.subject#${lesson.file.split("/")[1]}`,
		);
		const meta = subject.querySelector(".subject-meta");
		const quiz = content.quizzes.find((quiz) => quiz.file === lesson.quizFile);
		assert.equal(Number(meta.dataset.sectionCount), lesson.sections.length);
		assert.equal(
			normalized(meta.querySelector("[data-topic-question-count]")),
			`${quiz.questions.length} שאלות לתרגול`,
		);
		const document = new JSDOM(await readFile(lesson.file, "utf8")).window
			.document;
		assert.equal(
			meta.dataset.readingMinutes,
			document.querySelector(".lesson-meta").dataset.readingMinutes,
		);
		assert.ok(Number(meta.dataset.readingMinutes) > 0);
	}
	assert.equal(
		library.querySelector(".library-start a").getAttribute("href"),
		"learning-foundations/",
	);
});

test("reading sections use compact notes, usable checks and accurate contents labels", async () => {
	for (const lesson of content.lessons) {
		const document = new JSDOM(await readFile(lesson.file, "utf8")).window
			.document;
		assert.equal(
			document.querySelector(".lesson-content").hasAttribute("aria-label"),
			false,
		);
		assert.equal(
			document.querySelector(".lesson-quiz-link").closest(".lesson-section"),
			null,
		);
		assert.equal(
			document.querySelector(".lesson-end a:last-child").textContent.trim(),
			"לכל הנושאים",
		);
		const sections = [...document.querySelectorAll(".lesson-section")];
		assert.equal(
			Boolean(document.querySelector(".lesson-contents")),
			sections.length > 1,
		);
		for (const section of sections) {
			const notes = [
				...section.querySelectorAll(".video-placeholder, .image-placeholder"),
			];
			assert.ok(
				notes.length <= 1,
				`${lesson.file}#${section.id} has one media note at most`,
			);
			for (const note of notes) {
				assert.equal(note.getAttribute("role"), "note");
				assert.equal(note.closest("li"), null);
				assert.ok(normalized(note).length < 105);
			}
			assert.equal(section.querySelectorAll(".lesson-scenario").length, 1);
			assert.equal(
				section.querySelectorAll("details.lesson-self-check").length,
				1,
			);
			if (sections.length > 1) {
				assert.equal(
					normalized(
						document.querySelector(`.lesson-contents a[href="#${section.id}"]`),
					),
					normalized(section.querySelector("h2")),
				);
				assert.equal(
					section.querySelector(".lesson-return-contents").getAttribute("href"),
					"#contents",
				);
			}
		}
	}
	const foundations = new JSDOM(
		await readFile("course/learning-foundations/index.html", "utf8"),
	).window.document;
	assert.equal(
		foundations.querySelectorAll(".lesson-definitions dt").length,
		8,
	);
	const hierarchy = new JSDOM(
		await readFile("course/priority-hierarchy/index.html", "utf8"),
	).window.document;
	assert.equal(hierarchy.querySelectorAll("ol.priority-list > li").length, 4);
});

test("topic search recognizes course spelling and number variants and prioritizes titles", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		const page = await browser.newPage({
			viewport: { width, height: 900 },
			reducedMotion: "reduce",
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/course/");
		const search = page.getByRole("searchbox", { name: "חיפוש נושא" });
		for (const [query, id] of [
			["פניה", "right-of-way"],
			["פניייה", "right-of-way"],
			["פניות", "right-of-way"],
			["הולך רגל", "right-of-way"],
			["מבחן תאוריה", "learning-foundations"],
			["מבחן תיאוריה", "learning-foundations"],
			["תמרור", "signs-and-speed"],
		]) {
			await search.fill(query);
			assert.equal(
				await page
					.locator(`.topic-tab[data-topic="${id}"]:visible, #${id}:visible`)
					.count(),
				1,
				`${query}: ${id}`,
			);
		}
		await search.fill("מעגל");
		assert.equal(
			await page
				.locator(".topic-tab:visible, .subject:visible")
				.first()
				.getAttribute(width >= 900 ? "data-topic" : "id"),
			"roundabouts",
		);
		if (width >= 900)
			assert.equal(
				await page.getByRole("tabpanel").getAttribute("data-subject"),
				"roundabouts",
			);
		await search.fill("vvunknownstem");
		assert.equal(await page.locator(".search-empty").isVisible(), true);
		await page.getByRole("button", { name: "הצגת כל הנושאים" }).click();
		assert.equal(
			await page
				.locator(".topic-tab:visible, .subject:visible")
				.first()
				.getAttribute(width >= 900 ? "data-topic" : "id"),
			"learning-foundations",
		);
		await page.close();
	}
});

for (const mode of ["enhanced", "disabled", "blocked"]) {
	test(`library descriptions and nearby reading actions remain usable with ${mode} JavaScript`, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 320]) {
			const page = await browser.newPage({
				viewport: { width, height: 900 },
				javaScriptEnabled: mode !== "disabled",
				reducedMotion: "reduce",
			});
			await page.route("**/*", (route) =>
				mode === "blocked" &&
				route.request().url().endsWith("/course/js/course-library.js")
					? route.abort()
					: serveRoadMedia(route),
			);
			await page.goto("http://gallery.test/course/");
			if (width === 320 || mode !== "enhanced") {
				assert.equal(
					await page
						.locator(".subject:not([open]) summary > p:visible")
						.count(),
					10,
				);
				await page.locator("#right-of-way summary").click();
				const description = await page
					.locator("#right-of-way summary > p")
					.boundingBox();
				const button = await page
					.locator("#right-of-way .subject-learn")
					.boundingBox();
				assert.ok(button.y - (description.y + description.height) < 125);
			} else {
				const button = page.locator(".topic-reader > .subject-learn");
				assert.equal(await button.isVisible(), true);
				assert.equal(
					await button.evaluate(
						(node) =>
							node.compareDocumentPosition(
								document.querySelector(".topic-reader .subject-outline"),
							) & Node.DOCUMENT_POSITION_FOLLOWING,
					),
					4,
				);
				assert.equal(
					await page
						.locator(".topic-reader")
						.evaluate((node) => getComputedStyle(node).minHeight),
					"360px",
				);
			}
			assert.equal(await page.locator(".course-profile").isVisible(), false);
			assert.equal(
				await page.locator(".course-library-link").isVisible(),
				true,
			);
			assert.equal(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
				true,
			);
			await page.close();
		}
	});
}

test("reading contents, checks and endings work on phones and with reduced motion", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const javaScriptEnabled of [true, false]) {
		const page = await browser.newPage({
			viewport: { width: 320, height: 900 },
			reducedMotion: "reduce",
			javaScriptEnabled,
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/course/right-of-way/");
		assert.deepEqual(
			await page
				.locator(".lesson-section")
				.first()
				.evaluate((node) => ({
					padding: getComputedStyle(node).paddingInlineStart,
					shellMargin: document.querySelector("main").getBoundingClientRect()
						.left,
				})),
			{ padding: "16px", shellMargin: 16 },
		);
		const contents = await page
			.locator(".lesson-contents ul")
			.evaluate((node) => getComputedStyle(node).gridTemplateColumns);
		assert.equal(contents.split(" ").length, 1);
		await page.locator('.lesson-contents a[href="#right-turn"]').click();
		await page.locator("#right-turn .lesson-self-check summary").click();
		assert.equal(
			await page.locator("#right-turn .lesson-self-check p").isVisible(),
			true,
		);
		await page.locator("#right-turn .lesson-return-contents").click();
		assert.equal(new URL(page.url()).hash, "#contents");
		assert.equal(await page.locator(".lesson-quiz-link").isVisible(), true);
		assert.equal(
			await page.locator(".lesson-next").getAttribute("href"),
			"../priority-hierarchy/",
		);
		assert.equal(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
			true,
		);
		await page.close();
	}
});

test("library search keeps pointer editing and a visible keyboard focus indicator", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/");
	const search = page.getByRole("searchbox");
	const outline = () =>
		page
			.locator(".search-field")
			.evaluate((node) => getComputedStyle(node).outlineStyle);
	await search.click();
	await search.type("מעגל");
	assert.equal(await outline(), "none");
	assert.equal(
		await search.evaluate((node) => node === document.activeElement),
		true,
	);
	await page.keyboard.press("Tab");
	await page.keyboard.press("Shift+Tab");
	assert.equal(await outline(), "solid");
	await search.click();
	assert.equal(await outline(), "none");
});

test("lessons print all reading and self-check text without navigation or media notes", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ javaScriptEnabled: false });
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/right-of-way/");
	await page.emulateMedia({ media: "print" });
	assert.equal(await page.locator(".lesson-section:visible").count(), 4);
	assert.equal(await page.locator(".lesson-self-check p:visible").count(), 4);
	assert.equal(await page.locator(".lesson-contents").isVisible(), false);
	assert.equal(await page.locator(".course-header").isVisible(), false);
	assert.equal(
		await page
			.locator(".video-placeholder:visible, .image-placeholder:visible")
			.count(),
		0,
	);
});

test("mobile library search suppresses tap and label rings while retaining the caret", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 320, height: 900 },
		hasTouch: true,
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/");
	await page.locator('label[for="topic-search"]').tap();
	const search = page.getByRole("searchbox");
	await search.type("מעגל");
	assert.equal(
		await search.evaluate((node) => node === document.activeElement),
		true,
	);
	assert.equal(
		await page
			.locator(".search-field")
			.evaluate((node) => getComputedStyle(node).outlineStyle),
		"none",
	);
	assert.equal(await page.locator(".course-brand small").isVisible(), true);
	assert.equal(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
		true,
	);
});
