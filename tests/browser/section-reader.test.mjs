import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";

for (const width of [1440, 390]) {
	test(`protected reader saves actual scroll position and preserves keyboard focus at ${width}px`, async t => {
		const app = await startLessonGateway({ longLesson: true });
		t.after(app.close);
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		page.setDefaultTimeout(10000);
		await page.goto(app.origin + "/account/login.html");
		await page.getByLabel("כתובת אימייל").fill(`reader-${width}@example.test`);
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(app.origin + "/account/");
		await page.goto(app.origin + "/account/learning.html");
		await page.getByRole("link", { name: "הגדרה לבדיקה - הגדרה", exact: true }).click();
		await page.locator("[data-reading]").waitFor();
		const pending = page.waitForResponse(response => response.url().endsWith("/position") && response.request().method() === "POST");
		await page.evaluate(() => {
			const body = document.querySelector("[data-reading-body]");
			scrollTo({ top: scrollY + body.getBoundingClientRect().top + 0.45 * (body.offsetHeight - innerHeight) - 20, behavior: "instant" });
		});
		const saved = await pending;
		assert.equal(saved.status(), 200);
		assert.ok(Math.abs((await saved.json()).position.position - 4500) < 100);
		await page.locator("[data-position-status]").filter({ hasText: "מיקום הקריאה נשמר" }).waitFor();
		await page.reload();
		await page.locator("[data-reading]").waitFor();
		await page.waitForFunction(() => scrollY > 1000);
		const fraction = await page.evaluate(() => (20 - document.querySelector("[data-reading-body]").getBoundingClientRect().top) / (document.querySelector("[data-reading-body]").offsetHeight - innerHeight));
		assert.ok(Math.abs(fraction - 0.45) < 0.03);
		const save = page.getByRole("button", { name: "שמירת מיקום הקריאה", exact: true });
		await save.click();
		await page.locator("[data-position-status]").filter({ hasText: "מיקום הקריאה נשמר" }).waitFor();
		assert.equal(await save.evaluate(node => getComputedStyle(node).outlineStyle), "none");
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");
		assert.notEqual(await page.locator(":focus").evaluate(node => getComputedStyle(node).outlineStyle), "none");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.screenshot({ path: `/tmp/oren-reader-${width}.png` });
	});
}

test("reader shows load failures outside the hidden article and retries both catalog and body", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	page.setDefaultTimeout(5000);
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("reader-errors@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	const id = "a524e32d-2640-4d94-a51c-000000000001";
	for (const path of ["/api/sections", `/api/sections/${id}/free`]) {
		await page.route(app.origin + path, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
		await page.goto(`${app.origin}/account/reader.html?section=${id}&access=free`);
		await page.locator("[data-reader-status]").filter({ hasText: "לא הצלחנו" }).waitFor();
		assert.equal(await page.locator("[data-reading]").isVisible(), false);
		await page.unroute(app.origin + path);
		await page.getByRole("button", { name: "טעינת השיעור מחדש", exact: true }).click();
		await page.locator("[data-reading]").waitFor();
	}
});
