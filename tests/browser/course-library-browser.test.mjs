import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const { lessons, issues } = await readLearningContent(process.cwd());

test("library learning content has contextual validation diagnostics", () => assert.deepEqual(issues, []));

test("course preview preserves the welcome page's seven topic descriptions", async () => {
	const read = async path => new JSDOM(await readFile(new URL(`../../${path}`, import.meta.url), "utf8")).window.document;
	const welcome = await read("index.html");
	const course = await read("course/index.html");
	const descriptions = [...welcome.querySelectorAll("[data-topic-summaries] section")].map(section => [section.querySelector("h3").textContent, section.querySelector("p").textContent]);
	assert.deepEqual([...course.querySelectorAll(".subject summary")].map(summary => [summary.querySelector("h3").textContent, summary.querySelector("p").textContent]), descriptions);
	assert.equal(course.documentElement.lang, "he");
	assert.equal(course.documentElement.dir, "rtl");
	assert.equal(course.querySelector('meta[name="robots"]').content, "noindex");
	assert.match(course.querySelector(".course-preview-note").textContent, /עדיין אינם זמינים/);
});

test("course headers reserve blank profile space and only link the brand to home", async () => {
	for (const file of ["course/index.html", ...lessons.map(lesson => lesson.file)]) {
		const document = new JSDOM(await readFile(new URL(`../../${file}`, import.meta.url), "utf8")).window.document;
		const header = document.querySelector(".course-header");
		assert.equal(header.querySelectorAll("a").length, 1);
		assert.equal(new URL(header.querySelector("a").getAttribute("href"), `https://site.test/${file}`).pathname, "/index.html");
		const profile = header.querySelector(".course-profile-slot");
		assert.equal(profile.getAttribute("aria-hidden"), "true");
		assert.equal(profile.textContent.trim(), "");
		assert.equal(profile.querySelector("button, a, [tabindex]"), null);
	}
});

for (const mode of ["enhanced", "disabled", "blocked module"]) {
	test(`learner can open the learning page and jump to any section with ${mode} JavaScript`, { timeout: 20_000 }, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390, 320]) {
			const page = await browser.newPage({ viewport: { width, height: 900 }, javaScriptEnabled: mode !== "disabled", reducedMotion: "reduce" });
			await page.route("**/*", route => mode === "blocked module" && route.request().url().endsWith("/course/js/course-library.js") ? route.abort() : serveRoadMedia(route));
			await page.goto("http://gallery.test/course/");
			assert.equal(await page.getByRole("link", { name: "ללמידה: זכויות קדימה ופניות" }).isVisible(), false);
			await page.locator("#right-of-way summary").focus();
			await page.keyboard.press("Enter");
			await page.getByRole("link", { name: "ללמידה: זכויות קדימה ופניות" }).click();
			assert.equal(new URL(page.url()).pathname, "/course/right-of-way/");
			assert.equal(await page.locator("h1").innerText(), "זכויות קדימה ופניות");
			for (const lesson of lessons) {
				await page.goto(`http://gallery.test/${lesson.file}`);
				for (const { id } of [...lesson.sections].reverse()) {
					await page.locator(`.lesson-contents a[href="#${id}"]`).click();
					assert.equal(new URL(page.url()).hash, `#${id}`);
					const top = await page.locator(`#${id}`).evaluate(element => element.getBoundingClientRect().top);
					assert.ok(top >= 0 && top < 200, `${id} is reachable independently at ${width}px`);
				}
				assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
				assert.equal(await page.locator(".course-brand img").evaluate(image => image.complete && image.naturalWidth > 0), true);
				await page.getByRole("link", { name: "חזרה לנושאי הלימוד", exact: true }).click();
				assert.equal(new URL(page.url()).pathname, "/course/");
			}
			await page.locator(".course-brand").click();
			assert.equal(new URL(page.url()).pathname, "/index.html");
			await page.close();
		}
	});
}

test("library supports search, reset, arbitrary topic selection and return visits", { timeout: 30_000 }, async t => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390, 320]) {
		const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/course/");
		assert.equal(await page.locator(".last-topic").isVisible(), false, "no invented history on the first visit");
		const search = page.getByRole("searchbox");
		await search.fill("כיכר");
		assert.equal(await page.locator(".subject:visible").count(), 1);
		assert.equal(await page.locator("#roundabouts").isVisible(), true);
		await page.locator("#roundabouts summary").focus();
		await page.keyboard.press("Enter");
		assert.equal(await page.locator("#roundabouts .subject-outline").isVisible(), true);
		await page.waitForFunction(() => localStorage.getItem("oren-course:last-topic") === "roundabouts");
		await search.fill("zzz");
		assert.equal(await page.locator(".subject:visible").count(), 0);
		assert.equal(await page.locator(".search-empty").isVisible(), true);
		await page.getByRole("button", { name: "הצגת כל הנושאים" }).click();
		assert.equal(await page.locator(".subject:visible").count(), 7);
		assert.equal(await search.evaluate(element => element === document.activeElement), true);
		await search.fill("  פנייה   שמאלה  ");
		assert.equal(await page.locator("#right-of-way").isVisible(), true);
		await page.reload();
		assert.equal(await page.locator(".last-topic").isVisible(), true);
		assert.match(await page.locator("[data-last-topic-name]").innerText(), /מעגלי תנועה/);
		await search.fill("zzz");
		await page.locator("[data-last-topic-link]").click();
		await page.locator("#roundabouts .subject-outline").waitFor({ state: "visible" });
		assert.equal(await page.locator("#roundabouts .subject-outline").isVisible(), true);
		assert.equal(await search.inputValue(), "");
		assert.equal(await page.locator("#roundabouts summary").evaluate(element => element === document.activeElement), true);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}px`);
		assert.equal(await page.locator(".course-brand img").evaluate(image => image.complete && image.naturalWidth > 0), true);
		assert.deepEqual(errors, []);
		await page.close();
	}
});

for (const failure of ["disabled", "blocked module", "blocked storage", "stale storage"]) {
	test(`topic browsing survives ${failure}`, { timeout: 20_000 }, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 320]) {
			const page = await browser.newPage({ javaScriptEnabled: failure !== "disabled", viewport: { width, height: 900 } });
			if (failure === "blocked storage") await page.addInitScript(() => {
				Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
			});
			if (failure === "stale storage") await page.addInitScript(() => localStorage.setItem("oren-course:last-topic", "removed-topic"));
			await page.route("**/*", route => failure === "blocked module" && route.request().url().endsWith("/course/js/course-library.js") ? route.abort() : serveRoadMedia(route));
			await page.goto("http://gallery.test/course/");
			assert.equal(await page.locator(".subject:visible").count(), 7);
			assert.equal(await page.locator(".last-topic").isVisible(), false);
			if (["disabled", "blocked module"].includes(failure)) assert.equal(await page.getByRole("searchbox").isVisible(), false);
			await page.locator("#driving-test summary").focus();
			await page.keyboard.press("Enter");
			assert.equal(await page.locator("#driving-test .subject-outline").isVisible(), true, "last topic opens without completing earlier ones");
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			await page.getByRole("link", { name: "חזרה לדף הבית", exact: true }).click();
			assert.equal(new URL(page.url()).pathname, "/index.html");
			await page.close();
		}
	});
}
