import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startAccountGateway } from "../helpers/account-gateway.mjs";

test("Hebrew login works with server cookies and signs out without browser token storage", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("learner@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("wrong-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.getByRole("alert").filter({ hasText: "לא הצלחנו להתחבר" }).waitFor();
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "הצגת הסיסמה" }).click();
	assert.equal(await page.getByLabel("סיסמה", { exact: true }).getAttribute("type"), "text");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	await page.getByText("learner@example.test", { exact: true }).waitFor();
	assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
	assert.equal(await page.evaluate(() => document.cookie), "");
	const cookies = await context.cookies();
	assert.ok(cookies.every(cookie => cookie.httpOnly));
	assert.ok(cookies.every(cookie => !/access-|refresh-/.test(cookie.value)));
	await page.getByRole("button", { name: "יציאה מהחשבון" }).click();
	await page.waitForURL(/login.html/);
});

test("registration and recovery guide the learner through email confirmation", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage();
	await page.goto(app.origin + "/account/register.html");
	await page.getByLabel("כתובת אימייל").fill("learner@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("Abcdefg1!");
	await page.getByRole("button", { name: "יצירת חשבון חינמי" }).click();
	await page.waitForURL(/verify.html/);
	assert.ok(await page.getByRole("heading", { name: "בדקו את האימייל שלכם" }).isVisible());
	await page.goto(app.origin + "/account/recovery.html");
	await page.getByLabel("כתובת אימייל").fill("learner@example.test");
	await page.getByRole("button", { name: "שליחת קישור לאיפוס" }).click();
	await page.getByRole("status").filter({ hasText: "אם קיים חשבון" }).waitFor();
	const flow = app.provider.calls.find(call => call[0] === "recover")[2];
	await page.goto(`${app.origin}/api/account/callback?state=${flow.state}&code=valid-code`);
	await page.waitForURL(/reset.html/);
	await page.getByLabel("סיסמה חדשה", { exact: true }).fill("new-password-value");
	await page.getByRole("button", { name: "שמירת הסיסמה" }).click();
	await page.waitForURL(/login.html\?status=password-updated/);
	assert.ok(await page.getByRole("status").isVisible());
});

test("account pages preserve Hebrew style, mobile layout and no-JavaScript navigation", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	for (const width of [1440, 390, 320]) {
		const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
		for (const screen of ["login", "register", "recovery", "verify", "reset"]) {
			await page.goto(`${app.origin}/account/${screen}.html`);
			assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			assert.match(await page.locator("body").evaluate(node => getComputedStyle(node).fontFamily), /Varela Round/);
			assert.equal(await page.locator(".account-card").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(255, 255, 255)");
		}
		await page.close();
	}
	const baseline = await browser.newPage({ javaScriptEnabled: false });
	await baseline.goto(app.origin + "/account/login.html");
	assert.ok(await baseline.locator("noscript p").isVisible());
	assert.match(await baseline.locator("noscript p").textContent(), /יש להפעיל JavaScript/);
	await baseline.getByLabel("כתובת אימייל").fill("learner@example.test", { timeout: 1500 });
	await baseline.getByLabel("סיסמה", { exact: true }).fill("correct-password", { timeout: 1500 });
	assert.ok(await baseline.getByRole("button", { name: "כניסה לחשבון", exact: true }).isDisabled());
	await baseline.getByRole("link", { name: "יצירת חשבון חינמי" }).click();
	await baseline.waitForURL(/register.html/);
	assert.ok(await baseline.getByRole("link", { name: "חזרה לדף הבית" }).isVisible());
});

test("recovery clears the previous confirmation while a new request is pending", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage();
	await page.goto(app.origin + "/account/recovery.html");
	await page.getByLabel("כתובת אימייל").fill("learner@example.test");
	await page.getByRole("button", { name: "שליחת קישור לאיפוס" }).click();
	await page.getByRole("status").waitFor();
	let release;
	const pending = new Promise(resolve => { release = resolve; });
	t.after(() => release());
	await page.route("**/api/account/recover", async route => {
		await pending;
		await route.abort();
	});
	await page.getByLabel("כתובת אימייל").fill("another@example.test");
	await page.getByRole("button", { name: "שליחת קישור לאיפוס" }).click();
	assert.ok(await page.getByLabel("כתובת אימייל").isDisabled());
	assert.equal(await page.getByRole("status").isVisible(), false, "The previous email's confirmation must not describe the pending request");
	release();
	await page.getByRole("alert").waitFor();
	assert.equal(await page.getByLabel("כתובת אימייל").inputValue(), "another@example.test");
	assert.ok(await page.getByLabel("כתובת אימייל").isEnabled());
});

test("unconfigured service allows typing while keeping submission disabled", async t => {
	const app = await startAccountGateway({ provider: null });
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	for (const width of [1440, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 900 } });
		for (const screen of ["login", "register", "recovery", "reset"]) {
			await page.goto(`${app.origin}/account/${screen}.html`);
			await page.getByRole("alert").filter({ hasText: "ההתחברות אינה זמינה כרגע" }).waitFor();
			for (const input of await page.locator("input").all()) {
				const value = await input.getAttribute("type") === "email" ? "learner@example.test" : "correct-password";
				await input.fill(value, { timeout: 1500 });
				assert.equal(await input.inputValue(), value);
			}
			assert.ok(await page.locator('button[type="submit"]').isDisabled());
			assert.ok(await page.getByRole("button", { name: "ניסיון נוסף" }).isVisible());
		}
		await page.close();
	}
});

test("typing works during startup and failed bootstrap, and retry preserves entered credentials", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage();
	let release;
	const pending = new Promise(resolve => { release = resolve; });
	t.after(() => release());
	await page.route("**/api/account/session", async route => {
		await pending;
		await route.abort();
	}, { times: 1 });
	let mutations = 0;
	page.on("request", request => { if (request.method() === "POST") mutations++; });
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("learner@example.test", { timeout: 1500 });
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password", { timeout: 1500 });
	assert.ok(await page.locator('button[type="submit"]').isDisabled());
	await page.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
	assert.equal(mutations, 0);
	release();
	await page.getByRole("button", { name: "ניסיון נוסף" }).waitFor();
	await page.getByRole("button", { name: "הצגת הסיסמה" }).click();
	assert.equal(await page.locator("#password").inputValue(), "correct-password");
	await page.getByRole("button", { name: "ניסיון נוסף" }).click();
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
});

test("course profile opens accounts only when the gateway is configured", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage();
	await page.goto(app.origin + "/course/");
	await page.getByRole("link", { name: "כניסה לחשבון" }).click();
	await page.waitForURL(/account\/login.html/);
	for (const contextOptions of [{ javaScriptEnabled: false }, {}]) {
		const fallback = await browser.newPage({ viewport: { width: 390, height: 844 }, ...contextOptions });
		await fallback.route("**/api/account/session", route => route.abort());
		await fallback.goto(app.origin + "/course/");
		assert.ok(await fallback.getByRole("button", { name: "הפרופיל עדיין אינו זמין" }).isDisabled());
		assert.ok(await fallback.locator(".subject summary").first().isVisible());
	}
});

test("expired callback guidance survives initialization and passwords support keyboard entry", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage();
	await page.goto(app.origin + "/account/login.html?status=link-expired");
	await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
	assert.ok(await page.getByRole("alert").isVisible());
	await page.getByLabel("כתובת אימייל").focus();
	await page.keyboard.type("learner@example.test");
	await page.keyboard.press("Tab");
	await page.keyboard.type("correct-password");
	await page.keyboard.press("Enter");
	await page.waitForURL(app.origin + "/account/");
});
