import assert from "node:assert/strict";
import test from "node:test";
import { firefox, webkit } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const engines = [
	["Firefox", firefox],
	["WebKit", webkit],
];

async function openPage(page, pathname) {
	const response = await page.goto(`http://gallery.test${pathname}`);
	assert.equal(response?.status(), 200, `${pathname} loads successfully`);
	assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
	assert.equal(await page.locator("h1").first().isVisible(), true);
}

async function assertNoHorizontalOverflow(page) {
	assert.equal(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
		true,
	);
}

async function finishQuizAfterMissingAnswers(page) {
	const questions = page.locator(".quiz-question");
	const count = await questions.count();
	await page.locator("[data-quiz-next]").click();
	assert.equal(await page.locator("[data-quiz-result]").isVisible(), false);
	assert.equal(await questions.nth(1).isVisible(), true);
	assert.equal(
		await page.locator("[data-quiz-validation]").innerText(),
		"יש לענות על כל השאלות לפני סיום השאלון.",
	);
	for (let index = 1; index < count - 1; index++) {
		await questions.nth(index).locator("input").first().check();
		await page.locator("[data-quiz-next]").click();
	}
	assert.equal(await page.locator("[data-quiz-validation]").innerText(), "");
	await page.locator("[data-quiz-next]").click();
	assert.equal(await page.locator("[data-quiz-result]").isVisible(), true);
	assert.match(await page.locator("[data-quiz-count]").innerText(),
		new RegExp(`עניתם נכון על \\d+ מתוך ${count} שאלות\\. הציון: \\d+%`));
}

function trackPageErrors(page) {
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	return () => assert.deepEqual(errors, [], errors.join("\n"));
}

async function exerciseDesktopJourney(browser) {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 900 },
		reducedMotion: "reduce",
	});
	await page.route("**/*", serveRoadMedia);
	const assertNoPageErrors = trackPageErrors(page);

	await openPage(page, "/");
	await page.locator('.site-menu a[href="#about"]').click();
	assert.equal(new URL(page.url()).hash, "#about");
	await page.locator(".topic-card").last().click();
	assert.equal(
		await page.locator("[data-topic-panel-title]").innerText(),
		"טעויות נפוצות בטסט",
	);
	await assertNoHorizontalOverflow(page);

	await openPage(page, "/course/");
	await page.locator("#topic-search").fill("מדרג");
	assert.equal(
		await page.locator("[data-search-status]").innerText(),
		"נמצאו 1 נושאים",
	);
	await page
		.locator('.topic-tab[data-topic="priority-hierarchy"]')
		.click();
	await page.locator(".topic-reader .subject-learn").click();
	assert.equal(new URL(page.url()).pathname, "/course/priority-hierarchy/");

	await page.locator('.lesson-contents a[href="#priority"]').click();
	assert.equal(new URL(page.url()).hash, "#priority");
	assert.equal(await page.locator("#priority").isVisible(), true);
	await page.locator(".lesson-content > .lesson-quiz .lesson-quiz-link").click();
	assert.equal(
		new URL(page.url()).pathname,
		"/course/priority-hierarchy/quiz/",
	);

	await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
	await page.locator(".quiz-question:visible input").first().check();
	await page.getByRole("combobox", { name: "מעבר לשאלה" }).focus();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.locator(".quiz-question:visible input").last().check();
	await finishQuizAfterMissingAnswers(page);
	await assertNoHorizontalOverflow(page);
	assertNoPageErrors();
	await page.close();
}

async function exerciseMobileJourney(browser) {
	const page = await browser.newPage({
		viewport: { width: 390, height: 844 },
		reducedMotion: "reduce",
	});
	await page.route("**/*", serveRoadMedia);
	const assertNoPageErrors = trackPageErrors(page);

	await openPage(page, "/");
	assert.equal(await page.locator(".site-menu").isVisible(), false);
	await page.locator(".menu-toggle").click();
	await page.locator('.site-menu a[href="#about"]').click();
	await page.locator(".topic-select").click();
	await page.locator(".topic-option").last().click();
	assert.equal(
		await page.locator("[data-topic-panel-title]").innerText(),
		"טעויות נפוצות בטסט",
	);

	await openPage(page, "/course/");
	await page.locator("#priority-hierarchy > summary").click();
	assert.equal(
		await page.locator("#priority-hierarchy .subject-outline").isVisible(),
		true,
	);
	await page.locator("#priority-hierarchy .subject-learn").click();
	await page.locator('.lesson-contents a[href="#priority"]').click();
	assert.equal(new URL(page.url()).hash, "#priority");
	await page.locator(".lesson-content > .lesson-quiz .lesson-quiz-link").click();
	await page.locator("[data-quiz-controls]").waitFor({ state: "visible" });
	const firstAnswer = page.locator(".quiz-question").first().locator("input").first();
	await firstAnswer.check();
	await page.locator("[data-quiz-next]").click();
	await page.locator("[data-quiz-previous]").click();
	assert.equal(await firstAnswer.isChecked(), true);
	await page.getByRole("combobox", { name: "מעבר לשאלה" }).focus();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.locator(".quiz-question:visible input").last().check();
	await finishQuizAfterMissingAnswers(page);
	await assertNoHorizontalOverflow(page);
	assertNoPageErrors();
	await page.close();
}

async function exerciseFallback(browser, mode) {
	const page = await browser.newPage({
		javaScriptEnabled: mode !== "disabled",
		viewport: { width: 390, height: 844 },
		reducedMotion: "reduce",
	});
	await page.route("**/*", async (route) => {
		const pathname = new URL(route.request().url()).pathname;
		if (
			mode === "blocked" &&
			["/js/script.js", "/course/js/course-library.js", "/course/js/quiz.js"].includes(
				pathname,
			)
		)
			return route.abort();
		// Keep the quiz's first layout pending after its document commits.
		if (pathname === "/course/css/quiz.css")
			await new Promise((resolve) => setTimeout(resolve, 500));
		return serveRoadMedia(route);
	});

	await openPage(page, "/");
	assert.equal(await page.locator(".menu-toggle").isVisible(), false);
	assert.equal(await page.locator("[data-topic-summaries]").isVisible(), true);
	await page.locator('.site-menu a[href="#about"]').click();
	assert.equal(new URL(page.url()).hash, "#about");

	await openPage(page, "/course/");
	assert.equal(await page.locator(".subject").count(), 10);
	await page.locator("#priority-hierarchy > summary").click();
	assert.equal(
		await page.locator("#priority-hierarchy .subject-outline").isVisible(),
		true,
	);
	await page.locator("#priority-hierarchy .subject-learn").click();
	await page.locator('.lesson-contents a[href="#priority"]').click();
	assert.equal(new URL(page.url()).hash, "#priority");
	await page.locator(".lesson-content > .lesson-quiz .lesson-quiz-link").click();
	// Firefox can finish the click before render-blocking stylesheets load.
	await page.waitForURL("**/course/priority-hierarchy/quiz/", {
		waitUntil: "load",
	});
	assert.equal(await page.locator(".quiz-question:visible").count(), await page.locator(".quiz-question").count());
	assert.ok(await page.locator(".quiz-question").count() > 0);
	assert.equal(await page.locator("[data-quiz-controls]").isVisible(), false);
	assert.equal(await page.locator("[data-quiz-fallback]").isVisible(), true);
	await assertNoHorizontalOverflow(page);
	await page.close();
}

for (const [name, browserType] of engines) {
	test(
		`${name} supports the representative desktop journey`,
		{ timeout: 30_000 },
		async (t) => {
			const browser = await browserType.launch();
			t.after(() => browser.close());
			await exerciseDesktopJourney(browser);
		},
	);

	test(
		`${name} supports the representative mobile journey`,
		{ timeout: 30_000 },
		async (t) => {
			const browser = await browserType.launch();
			t.after(() => browser.close());
			await exerciseMobileJourney(browser);
		},
	);

	for (const mode of ["disabled", "blocked"]) {
		test(
			`${name} keeps core learning paths usable with JavaScript ${mode}`,
			{ timeout: 30_000 },
			async (t) => {
				const browser = await browserType.launch();
				t.after(() => browser.close());
				await exerciseFallback(browser, mode);
			},
		);
	}
}
