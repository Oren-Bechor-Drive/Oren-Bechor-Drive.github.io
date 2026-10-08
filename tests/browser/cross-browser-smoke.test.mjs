import assert from "node:assert/strict";
import test from "node:test";
import { firefox, webkit } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { roadPhotoSources } from "../../js/road-photo-sources.js";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { readerUrl, openReader, saveAt, restoredNear } from "./reader-journey-helpers.mjs";

const photoNumbers = Object.keys(roadPhotoSources).map(Number).sort((a, b) => a - b);
const latePhotos = new Set(photoNumbers.slice(-3));

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
	const missing = Array.from({ length: count - 2 }, (_, index) => index + 2);
	assert.equal(await page.locator("[data-quiz-validation]").innerText(),
		`נשארו ${missing.length} שאלות בלי תשובה: ${missing.join(", ")}. אפשר לענות עליהן ואז לסיים.`);
	for (let index = 1; index < count - 1; index++) {
		await questions.nth(index).locator("input").first().check();
		await page.locator("[data-quiz-next]").click();
	}
	assert.equal(await page.locator("[data-quiz-validation]").innerText(), "");
	await page.locator("[data-quiz-next]").click();
	await page.locator("[data-quiz-submit]").click();
	assert.equal(await page.locator("[data-quiz-result]").isVisible(), true);
	assert.match(await page.locator("[data-quiz-count]").innerText(),
		new RegExp(`עניתם נכון על \\d+ מתוך ${count} שאלות`));
	assert.match(await page.locator("[data-quiz-score]").innerText(), /\d+%/);
}

function trackPageErrors(page) {
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	return () => assert.deepEqual(errors, [], errors.join("\n"));
}

async function finishGalleryLoading(page) {
	await page.locator("[data-road-carousel]").scrollIntoViewIfNeeded();
	// Complete this page's image work before navigation cancels its requests.
	await page.waitForFunction(count =>
		document.querySelector(".road-carousel-group").children.length === count,
		photoNumbers.length,
	);
}

async function exerciseDesktopJourney(browser) {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 900 },
		reducedMotion: "reduce",
	});
	await page.route("**/*", async route => {
		// Keep the lesson's first layout pending after its document commits.
		if (new URL(route.request().url()).pathname === "/course/css/lesson.css")
			await new Promise(resolve => setTimeout(resolve, 500));
		return serveRoadMedia(route);
	});
	const assertNoPageErrors = trackPageErrors(page);

	await openPage(page, "/");
	await finishGalleryLoading(page);
	await page.locator('.site-menu a[href="#about"]').click();
	assert.equal(new URL(page.url()).hash, "#about");
	await page.getByRole("tab", {name:"טעויות נפוצות בטסט המעשי"}).click();
	assert.equal(
		await page.locator("[data-topic-panel-title]").innerText(),
		"טעויות נפוצות בטסט המעשי",
	);
	await assertNoHorizontalOverflow(page);

	await openPage(page, "/course/");
	await page.locator("#topic-search").fill("מדרג");
	assert.equal(
		await page.locator("[data-search-status]").innerText(),
		"נמצא נושא אחד",
	);
	await page
		.locator('.topic-tab[data-topic="priority-hierarchy"]')
		.click();
	await page.locator(".topic-reader .subject-learn").click();
	await page.waitForURL("**/course/priority-hierarchy/", { waitUntil: "load" });
	assert.equal(new URL(page.url()).pathname, "/course/priority-hierarchy/");

	assert.equal(await page.locator("#priority").isVisible(), true);
	await page.locator(".lesson-content > .lesson-quiz .lesson-quiz-link").click();
	await page.waitForURL("**/course/priority-hierarchy/quiz/", { waitUntil: "load" });
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
	await page.route("**/*", async route => {
		const number = Number(new URL(route.request().url()).pathname.match(/students-pass\/(\d+)\.png$/)?.[1]);
		if (route.request().method() === "HEAD" && latePhotos.has(number))
			await new Promise(resolve => setTimeout(resolve, 1000));
		return serveRoadMedia(route);
	});
	const assertNoPageErrors = trackPageErrors(page);

	await openPage(page, "/");
	await finishGalleryLoading(page);
	assert.equal(await page.locator(".site-menu").isVisible(), false);
	await page.locator(".menu-toggle").click();
	await page.locator('.site-menu a[href="#about"]').click();
	assert.equal(await page.locator("[data-topic-summaries] section").count(), 10);
	assert.equal(await page.locator("[data-topic-summaries]").isVisible(), true);
	assert.equal(await page.locator(".topic-select").count(), 0);

	await openPage(page, "/course/");
	await page.locator("#priority-hierarchy > summary").click();
	assert.equal(
		await page.locator("#priority-hierarchy .subject-outline").isVisible(),
		true,
	);
	await page.locator("#priority-hierarchy .subject-learn").click();
	await page.waitForURL("**/course/priority-hierarchy/", { waitUntil: "load" });
	assert.equal(await page.locator("#priority").isVisible(), true);
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
	await page.waitForURL("**/course/priority-hierarchy/", { waitUntil: "load" });
	assert.equal(await page.locator("#priority").isVisible(), true);
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
	test(`${name} signs in to the protected return, restores reading and clears revoked or withdrawn content`, { timeout: 60_000 }, async t => {
		const app = await startLessonGateway({ quiz: true, quizCount: 3, longLesson: true });
		t.after(app.close);
		const browser = await browserType.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
		page.setDefaultTimeout(10000);
		const assertNoPageErrors = trackPageErrors(page);
		const email = `protected-${name.toLowerCase()}@example.test`;
		const destination = readerUrl(app.origin);
		await page.goto(destination);
		await page.locator("[data-reader-status]").filter({ hasText: "היכנסו לחשבון" }).waitFor();
		await page.getByRole("link", { name: "כניסה לחשבון", exact: true }).click();
		assert.equal(new URL(page.url()).searchParams.get("return"), new URL(destination).pathname + new URL(destination).search);
		await page.getByLabel("כתובת אימייל").fill(email);
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(destination);
		await page.locator("[data-reading]").waitFor();
		await saveAt(page, 0.42);
		await page.reload();
		await restoredNear(page, 0.42);
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		assert.equal(await page.locator("[data-reading-body]").textContent(), "");
		assert.equal(await page.locator("[data-reading-media]").textContent(), "");
		assert.equal(await page.locator("#reader-heading").textContent(), "קריאת קטע לימוד");
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: false });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await restoredNear(page, 0.42);
		// Return visibility to the browser before navigating. A permanent fake
		// visible value would make WebKit restore a document while it is leaving.
		await page.evaluate(() => { delete document.hidden; });
		await app.grant(email);
		await page.goto(app.origin + "/account/learning.html");
		await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
		const radios = page.locator("[data-questions] fieldset").first().getByRole("radio");
		await radios.first().check();
		await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
		await app.withdrawQuiz("synthetic-topic");
		await radios.nth(1).check();
		await page.locator('[data-learning-status][data-withdrawn="true"]').waitFor();
		assert.equal(await page.getByRole("alert").textContent(), "גרסת התרגול אינה זמינה עוד. חזרו ללמידה ובחרו גרסה מעודכנת.");
		for (const selector of ["[data-questions]", "#quiz-heading", "[data-score]", "[data-explanations]"]) assert.equal(await page.locator(selector).textContent(), "");
		await app.publishQuiz("synthetic-topic", 3);
		await page.getByRole("button", { name: "חזרה ללמידה וטעינה מחדש", exact: true }).click();
		await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
		await page.getByRole("heading", { name: "תרגול מעודכן לבדיקה", exact: true }).waitFor();
		assert.equal(await page.locator("[data-questions] input:checked").count(), 0);
		await openReader(page, app.origin, "paid");
		await saveAt(page, 0.3, 200, "paid");
		await app.revoke(email);
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		assert.equal(await page.locator("[data-reading-body]").textContent(), "");
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: false });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await page.locator("[data-reader-status]").filter({ hasText: "אינו זמין" }).waitFor();
		assert.equal(await page.locator("[data-reading]").isVisible(), false);
		assert.equal(await page.locator("[data-reading-body]").textContent(), "");
		assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
		await assertNoHorizontalOverflow(page);
		assertNoPageErrors();
	});

	test(
		`${name} supports the representative desktop journey`,
		{ timeout: 90_000 },
		async (t) => {
			const browser = await browserType.launch();
			t.after(() => browser.close());
			await exerciseDesktopJourney(browser);
		},
	);

	test(
		`${name} supports the representative mobile journey`,
		{ timeout: 90_000 },
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
