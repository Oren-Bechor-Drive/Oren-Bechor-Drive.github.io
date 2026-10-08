import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startAccountGateway } from "../helpers/account-gateway.mjs";

async function fixture(t, options) {
	const app = await startAccountGateway(options);
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	return { app, browser };
}

test("unconfigured Google controls stay hidden and reset without recovery exposes a new-link action", async t => {
	const { app, browser } = await fixture(t, { googleEnabled: false });
	const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
	for (const screen of ["login", "register"]) {
		await page.goto(`${app.origin}/account/${screen}.html`);
		await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
		assert.equal(await page.locator("[data-google-controls]").isVisible(), false);
		assert.equal(await page.locator(".account-divider").isVisible(), false);
	}
	await page.goto(app.origin + "/account/reset.html");
	await page.getByRole("alert").waitFor();
	assert.equal(await page.locator("form").isVisible(), false);
	assert.match(await page.locator("[data-new-recovery]").getAttribute("class"), /account-action/);
});

test("recovery confirms generic delivery and resends through the existing same-origin operation", async t => {
	const { app, browser } = await fixture(t);
	const page = await browser.newPage();
	await page.goto(app.origin + "/account/recovery.html");
	await page.getByLabel("כתובת אימייל").fill("absent@example.test");
	await page.locator('button[type="submit"]').click();
	await page.locator("[data-recovery-confirmation]").waitFor();
	assert.equal(await page.locator("form").isVisible(), false);
	await page.getByRole("button", { name: "שליחת קישור נוסף" }).click();
	await page.getByRole("status").filter({ hasText: "קישור נוסף" }).waitFor();
	assert.equal(app.provider.calls.filter(call => call[0] === "recover").length, 2);
	assert.match(await page.locator("[data-recovery-confirmation]").textContent(), /אם קיים חשבון/);
});

test("login busy text is visible and password sign-in returns only to allowed local learner pages", async t => {
	const { app, browser } = await fixture(t);
	for (const [destination, expected] of [["/account/learning.html", "/account/learning.html"], ["https://evil.test/account/learning.html", "/account/"], ["/account/../course/", "/account/"]]) {
		const context = await browser.newContext();
		const page = await context.newPage();
		let release;
		const pending = new Promise(resolve => { release = resolve; });
		t.after(() => release());
		await page.route("**/api/account/login", async route => { await pending; await route.continue(); });
		await page.goto(`${app.origin}/account/login.html?return=${encodeURIComponent(destination)}`);
		await page.getByLabel("כתובת אימייל").fill("learner@example.test");
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.locator('button[type="submit"]').click();
		assert.equal(await page.locator('button[type="submit"]').textContent(), "מתחברים...");
		assert.equal(await page.locator("form").getAttribute("aria-busy"), "true");
		release();
		await page.waitForURL(app.origin + expected);
		await context.close();
	}
});

test("protected-page baselines show guidance and a public library link without inactive controls", async t => {
	const { app, browser } = await fixture(t);
	for (const screen of ["learning", "reader"]) {
		const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
		await page.goto(`${app.origin}/account/${screen}.html`);
		assert.equal(await page.locator("noscript p").isVisible(), true);
		assert.equal(await page.locator("button:visible").count(), 0);
		assert.equal(await page.locator("h2:visible").count(), 0);
		assert.equal(await page.getByRole("link", { name: "לנושאי הלימוד ולתרגול החינמי" }).isVisible(), true);
		await page.close();
	}
});
