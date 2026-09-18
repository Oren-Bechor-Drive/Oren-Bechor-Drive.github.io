import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

test("course headers match home and remain visible above scrolled content", async t => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 768, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		await page.waitForSelector("html[data-menu-enhanced]");
		const appearance = element => {
			const style = getComputedStyle(element);
			return [element.getBoundingClientRect().height, style.backgroundColor, style.borderBottom, style.backdropFilter];
		};
		const expected = await page.locator(".site-header").evaluate(appearance);
		const brand = await page.locator(".brand").boundingBox();
		for (const path of ["course/", "course/right-of-way/", "course/right-of-way/quizzes/priority/"]) {
			await page.goto(`http://gallery.test/${path}`);
			assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth), "none");
			const header = page.locator(".course-header");
			assert.deepEqual(await header.evaluate(appearance), expected);
			const courseBrand = await page.locator(".course-brand").boundingBox();
			assert.equal(courseBrand.x + courseBrand.width, brand.x + brand.width);
			await page.evaluate(() => window.scrollTo(0, 600));
			assert.equal((await header.boundingBox()).y, 0);
			assert.ok(await page.evaluate(() => window.scrollY > 0));
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		}
		await page.close();
	}
	const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/right-of-way/#priority");
	assert.equal((await page.locator(".course-header").boundingBox()).y, 0);
	assert.ok((await page.locator("#priority").boundingBox()).y >= 66);
});
