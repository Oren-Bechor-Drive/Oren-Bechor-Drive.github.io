import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";

test("test lessons read through the gateway with real database access checks on desktop and mobile", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
		const page = await context.newPage();
		const email = `learner-${width}@example.test`;
		await page.goto(app.origin + "/account/test-lessons.html");
		await page.getByRole("status").filter({ hasText: "היכנסו לחשבון" }).waitFor();
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		await page.getByRole("link", { name: "כניסה לחשבון", exact: true }).click();
		await page.getByLabel("כתובת אימייל").fill(email);
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(app.origin + "/account/");
		await page.getByRole("link", { name: "לשיעורי הבדיקה" }).click();
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה חינמי" }).waitFor();
		await page.getByRole("link", { name: "שיעור בדיקה בתשלום", exact: true }).click();
		await page.getByRole("status").filter({ hasText: "אינו זמין לחשבון" }).waitFor();
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		await app.grant(email);
		await page.getByRole("button", { name: "ניסיון נוסף" }).click();
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה בתשלום" }).waitFor();
		assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
		await page.keyboard.press("Tab");
		await page.getByRole("link", { name: "שיעור בדיקה חינמי", exact: true }).focus();
		assert.notEqual(await page.locator(":focus").evaluate(node => getComputedStyle(node).outlineStyle), "none");
		await page.keyboard.press("Enter");
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה חינמי" }).waitFor();
		await page.route("**/api/lessons/*", route => route.abort());
		await page.reload();
		await page.getByRole("status").filter({ hasText: "לא הצלחנו לטעון" }).waitFor();
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		await page.unroute("**/api/lessons/*");
		await page.getByRole("button", { name: "ניסיון נוסף" }).click();
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה חינמי" }).waitFor();
		await context.close();
	}
});

test("test lesson shell has usable baseline navigation and no embedded lesson body", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const javaScriptEnabled of [false, true]) {
		const page = await browser.newPage({ javaScriptEnabled, viewport: { width: 320, height: 640 } });
		if (javaScriptEnabled) await page.route("**/test-lessons.js", route => route.abort());
		const response = await page.goto(app.origin + "/account/test-lessons.html");
		assert.doesNotMatch(await response.text(), /תוכן בדיקה חינמי|תוכן בדיקה בתשלום/);
		assert.ok(await page.getByRole("status").isVisible());
		assert.ok(await page.getByRole("link", { name: "כניסה לחשבון", exact: true }).isVisible());
		await page.getByRole("link", { name: "שיעור בדיקה בתשלום", exact: true }).click();
		await page.waitForURL(/lesson=paid/);
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		assert.ok(await page.getByRole("link", { name: "לנושאי הקורס" }).isVisible());
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.close();
	}
});
