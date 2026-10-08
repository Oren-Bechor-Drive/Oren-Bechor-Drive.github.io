import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { discoverSitePages } from "../../scripts/site-pages.mjs";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const courseRoot = fileURLToPath(new URL("../../course/", import.meta.url));

test("every course page hides the unavailable profile control and keeps public navigation usable", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const pages = (await discoverSitePages(courseRoot)).map((file) => `course/${file}`);
	assert.ok(pages.length > 0, "the authored course pages are discovered");

	for (const width of [1280, 390]) {
		const page = await browser.newPage({
			viewport: { width, height: 844 },
			reducedMotion: "reduce",
		});
		await page.route("**/*", serveRoadMedia);
		for (const path of pages) {
			await page.goto(`http://gallery.test/${path}`);
			const profile = page.locator(".course-profile");
			assert.equal(await profile.count(), 1, `${path} has one profile control`);
			assert.equal(await profile.isDisabled(), true, `${path} keeps profile unavailable`);
			assert.equal(
				await profile.getAttribute("aria-label"),
				"הפרופיל עדיין אינו זמין",
				`${path} explains the unavailable action`,
			);
			const icon = profile.locator(".course-profile-icon");
			assert.match(
				await icon.evaluate((element) => getComputedStyle(element).maskImage),
				/user\.svg/,
				`${path} uses the local profile icon`,
			);
			assert.equal(await profile.isVisible(), false, `${path} hides the unconfigured account action`);
			const library = page.locator(".course-library-link");
			assert.equal(await library.isVisible(), true, `${path} retains public topic navigation`);
			assert.equal(new URL(await library.getAttribute("href"), page.url()).pathname, "/course/");
			assert.ok((await library.boundingBox()).height >= 44);
		}
		await page.close();
	}
});

test("course pages use the same canvas as the home page and keep reading surfaces clear", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const homePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	await homePage.route("**/*", serveRoadMedia);
	await homePage.goto("http://gallery.test/");
	const homeCanvas = await homePage.locator("body").evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			backgroundColor: style.backgroundColor,
			backgroundImage: style.backgroundImage,
		};
	});
	await homePage.close();

	for (const [path, surface] of [
		["course/", ".topic-reader"],
		["course/right-of-way/", ".lesson-section"],
		["course/priority-hierarchy/quiz/", ".quiz-question"],
	]) {
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
		await page.route("**/*", serveRoadMedia);
		await page.goto(`http://gallery.test/${path}`);
		const canvas = await page.locator("body").evaluate((element) => {
			const style = getComputedStyle(element);
			const before = getComputedStyle(element, "::before");
			return {
				backgroundColor: style.backgroundColor,
				backgroundImage: style.backgroundImage,
				beforeContent: before.content,
				beforeBackgroundImage: before.backgroundImage,
				beforeAnimationName: before.animationName,
			};
		});
		assert.deepEqual(
			{
				backgroundColor: canvas.backgroundColor,
				backgroundImage: canvas.backgroundImage,
			},
			homeCanvas,
			`${path} inherits the shared home-page canvas`,
		);
		assert.equal(canvas.beforeContent, "none");
		assert.equal(canvas.beforeBackgroundImage, "none");
		assert.equal(canvas.beforeAnimationName, "none");
		assert.deepEqual(
			await page.locator(surface).first().evaluate((element) => ({
				opacity: getComputedStyle(element).opacity,
				background: getComputedStyle(element).backgroundColor,
			})),
			{ opacity: "1", background: "rgb(255, 255, 255)" },
			`${path} keeps its primary reading surface visible and white`,
		);
		assert.equal(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			true,
			`${path} has no horizontal overflow`,
		);
		await page.close();
	}
});

test("lesson subsection headings use plain text color at desktop and mobile widths", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1280, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/course/right-of-way/");
		const headings = page.locator(".lesson-content h2");
		assert.ok((await headings.count()) > 1);
		const textColor = await page.locator("body").evaluate(element => getComputedStyle(element).color);
		for (const heading of await headings.all()) {
			assert.deepEqual(await heading.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					line: style.textDecorationLine,
					color: style.color,
					beforeContent: getComputedStyle(element, "::before").content,
				};
			}), {
				line: "none",
				color: textColor,
				beforeContent: "none",
			});
		}
		await page.close();
	}
});
