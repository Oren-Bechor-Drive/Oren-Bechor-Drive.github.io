import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";

for (const width of [1440, 390]) {
	test(`test lesson cancellation, expiry, renewal and learner isolation at ${width}px`, async t => {
		const app = await startLessonGateway();
		t.after(app.close);
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const first = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 600 });
		const second = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 600 });
		for (const page of [first, second]) page.setDefaultTimeout(10_000);
		const email = `journey-${width}@example.test`;
		const otherEmail = `other-journey-${width}@example.test`;
		const input = page => page.getByLabel("מיקום הקריאה באחוזים");
		const body = page => page.locator("[data-lesson-body]");
		const positionStatus = page => page.locator("[data-position-status]");
		const status = page => page.locator("[role=status]").first();
		const open = (page, key) => page.goto(`${app.origin}/account/test-lessons.html?lesson=${key}`);
		async function login(page, account) {
			await page.goto(app.origin + "/account/login.html");
			await page.getByLabel("כתובת אימייל").fill(account);
			await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
			await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
			await page.waitForURL(app.origin + "/account/");
		}
		async function save(page, percentage, expectedStatus = 200) {
			await input(page).fill(String(percentage));
			const pending = page.waitForResponse(response => response.url().endsWith("/position") && response.request().method() === "POST");
			await page.getByRole("button", { name: "שמירת מיקום", exact: true }).click();
			const response = await pending;
			assert.equal(response.status(), expectedStatus);
			assert.equal(response.headers()["cache-control"], "private, no-store");
			if (expectedStatus === 200) await positionStatus(page).filter({ hasText: `המיקום נשמר: ${percentage}` }).waitFor();
			else assert.deepEqual(await response.json(), { error: "lesson_unavailable" });
		}
		async function direct(page, path, expectedStatus) {
			const response = await page.request.get(`${app.origin}/api/lessons/${path}`);
			assert.equal(response.status(), expectedStatus);
			assert.equal(response.headers()["cache-control"], "private, no-store");
			return response.json();
		}
		async function unavailable(page, message) {
			await status(page).filter({ hasText: message }).waitFor();
			assert.equal(await body(page).textContent(), "");
			assert.equal(await page.locator("[data-lesson-content]").isVisible(), false);
			assert.equal(await input(page).isEnabled(), false);
			assert.equal(await page.getByRole("button", { name: "שמירת מיקום", exact: true }).isVisible(), false);
		}

		for (const key of ["free", "paid"]) {
			await open(first, key);
			await unavailable(first, "היכנסו לחשבון");
			assert.deepEqual(await direct(first, key, 401), { error: "session_expired" });
		}
		await login(first, email);
		await open(first, "free");
		await save(first, 20);
		await open(first, "paid");
		await unavailable(first, "אינו זמין לחשבון");
		assert.deepEqual(await direct(first, "paid", 404), { error: "lesson_unavailable" });

		// A cancelled renewal leaves this finite paid period readable and writable.
		await app.grant(email, new Date(Date.now() + 3_600_000).toISOString());
		await first.getByRole("button", { name: "ניסיון נוסף" }).click();
		await body(first).filter({ hasText: "תוכן בדיקה בתשלום" }).waitFor();
		await save(first, 37.5);
		const saved = await direct(first, "paid/position", 200);
		await first.reload();
		await positionStatus(first).filter({ hasText: "המיקום השמור נטען: 37.5" }).waitFor();
		assert.equal(await input(first).inputValue(), "37.5");

		// Expiry occurs while the paid text and save form are already open.
		await app.expire(email);
		await save(first, 80, 404);
		await unavailable(first, "לא ניתן לשמור כרגע");
		assert.deepEqual(await direct(first, "paid", 404), { error: "lesson_unavailable" });
		assert.deepEqual(await direct(first, "paid/position", 200), saved);
		await first.reload();
		await unavailable(first, "אינו זמין לחשבון");
		await first.getByRole("link", { name: "שיעור בדיקה חינמי", exact: true }).click();
		await positionStatus(first).filter({ hasText: "המיקום השמור נטען: 20" }).waitFor();
		await save(first, 50);

		await app.expire(email, 31);
		await open(first, "paid");
		await unavailable(first, "אינו זמין לחשבון");
		assert.deepEqual(await direct(first, "paid/position", 200), saved);
		await app.grant(email);
		await first.getByRole("button", { name: "ניסיון נוסף" }).click();
		await positionStatus(first).filter({ hasText: "המיקום השמור נטען: 37.5" }).waitFor();
		assert.equal(await input(first).inputValue(), "37.5");
		await save(first, 80);

		await login(second, otherEmail);
		await open(second, "paid");
		await unavailable(second, "אינו זמין לחשבון");
		assert.deepEqual(await direct(second, "paid/position", 200), { position: null });
		await app.grant(otherEmail);
		await second.getByRole("button", { name: "ניסיון נוסף" }).click();
		await positionStatus(second).filter({ hasText: "עדיין לא נשמר מיקום" }).waitFor();
		assert.equal(await input(second).inputValue(), "0");
		await save(second, 10);
		await first.reload();
		await positionStatus(first).filter({ hasText: "המיקום השמור נטען: 80" }).waitFor();
		assert.equal(await input(first).inputValue(), "80");
		await save(first, 90);
		await second.reload();
		await positionStatus(second).filter({ hasText: "המיקום השמור נטען: 10" }).waitFor();
		assert.equal(await input(second).inputValue(), "10");
		for (const page of [first, second]) {
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
		}
	});
}
