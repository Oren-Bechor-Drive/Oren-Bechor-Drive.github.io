import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startAccountGateway, accountProvider } from "../helpers/account-gateway.mjs";

async function fixture(t, settings = {}) {
	let clock = Date.now();
	const app = await startAccountGateway({ authLimit: 100, now: () => clock, ...settings });
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
	const page = await context.newPage();
	page.setDefaultTimeout(5000);
	return { ...app, browser, page, advance: milliseconds => { clock += milliseconds; } };
}
async function register(page, origin) {
	await page.goto(origin + "/account/register.html");
	await page.getByLabel("כתובת אימייל").fill("pending@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "יצירת חשבון חינמי" }).click();
	await page.waitForURL(/verify.html/);
	await page.locator("[data-verification-email]").filter({ hasText: "p***@example.test" }).waitFor();
}

test("same-browser guidance leads verification with no empty form feedback space on desktop and short mobile screens", async t => {
	const { page, origin } = await fixture(t);
	await register(page, origin);
	for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
		await page.setViewportSize(viewport);
		await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
		const heading = await page.getByRole("heading", { name: "פתחו את הקישור באותו דפדפן" }).boundingBox();
		const controls = await page.locator("[data-verification-controls]").boundingBox();
		assert.ok(heading.y + heading.height <= viewport.height, "Same-browser guidance must be visible before scrolling");
		assert.ok(heading.y < controls.y, "Same-browser guidance must lead resend controls");
		assert.equal(await page.locator("[data-verification-feedback]").evaluate(node => node.offsetHeight), 0);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	}
});

test("verification shows masked context, real cooldown, busy feedback and the same conditional acknowledgement after resend", async t => {
	const { page, origin, provider, advance } = await fixture(t);
	await register(page, origin);
	const original = { ...provider.calls.find(call => call[0] === "signup")[2] };
	const button = page.getByRole("button", { name: "שליחת קישור נוסף לאישור" });
	assert.equal(await button.isDisabled(), true);
	assert.match(await page.locator("[data-verification-wait]").textContent(), /בעוד \d+ שניות/);
	assert.equal((await page.locator("body").textContent()).includes("pending@example.test"), false);
	assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	advance(60_000); await page.reload(); await button.waitFor();
	await page.waitForFunction(() => !document.querySelector("[data-verification-resend]").disabled);
	await page.locator("[data-verification-email]").click();
	await button.focus();
	assert.equal(await button.evaluate(node => getComputedStyle(node).outlineStyle), "none");
	await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
	assert.notEqual(await button.evaluate(node => getComputedStyle(node).outlineStyle), "none");
	let release;
	const waiting = new Promise(resolve => { release = resolve; });
	t.after(() => release());
	provider.resend = async (email, flow) => { provider.calls.push(["resend", email, { ...flow }]); await waiting; throw Object.assign(new Error("synthetic provider outage"), { status: 503 }); };
	const sent = page.waitForRequest(request => request.url().endsWith("/api/account/resend"));
	await button.click();
	assert.deepEqual((await sent).postDataJSON(), {});
	await page.getByRole("button", { name: "שולחים..." }).waitFor();
	assert.equal(await page.locator("[data-verification-resend]").isDisabled(), true);
	assert.equal(await page.locator("[data-verification-resend]").evaluate(node => getComputedStyle(node).outlineStyle), "none");
	release();
	await page.getByRole("status").filter({ hasText: "אם אפשר להשלים את ההרשמה" }).waitFor();
	assert.equal(await button.isDisabled(), true);
	const sentFlow = provider.calls.find(call => call[0] === "resend")[2];
	for (const key of ["state", "verifier", "challenge", "expires"]) assert.equal(sentFlow[key], original[key]);
	assert.doesNotMatch(await page.locator("body").textContent(), /synthetic provider outage|pending@example/);
});

test("verification context expires without navigation and clears masked details and resend controls", async t => {
	const { page, origin, advance } = await fixture(t);
	await register(page, origin);
	advance(3_599_000); await page.reload();
	await page.locator("[data-verification-controls]:visible").waitFor();
	await page.locator("[data-verification-missing]:visible").waitFor();
	assert.equal(await page.locator("[data-verification-email]").textContent(), "");
	assert.equal(await page.locator("[data-verification-controls]").isVisible(), false);
	assert.equal(await page.locator("[data-verification-resend]").isDisabled(), true);
});

test("another browser, superseded requests and callback consumption cannot retain verification controls", async t => {
	const { page, origin, browser, provider } = await fixture(t);
	await register(page, origin);
	const other = await browser.newPage();
	await other.goto(origin + "/account/verify.html");
	await other.locator("[data-startup]").waitFor({ state: "hidden" });
	assert.equal(await other.locator("[data-verification-controls]").isVisible(), false);
	assert.equal(await other.locator("[data-verification-email]").textContent(), "");
	const tab = await page.context().newPage();
	await tab.goto(origin + "/account/recovery.html");
	await tab.getByLabel("כתובת אימייל").fill("pending@example.test");
	await tab.getByRole("button", { name: "שליחת קישור לאיפוס" }).click();
	await tab.getByRole("status").waitFor();
	await page.bringToFront();
	await page.evaluate(() => window.dispatchEvent(new Event("focus")));
	await page.locator("[data-verification-missing]:visible").waitFor();
	assert.equal(await page.locator("[data-verification-email]").textContent(), "");
	await register(page, origin);
	const flow = provider.calls.filter(call => call[0] === "signup").at(-1)[2];
	await tab.goto(`${origin}/api/account/callback?state=${flow.state}&code=valid-code`);
	await page.bringToFront();
	await page.evaluate(() => window.dispatchEvent(new Event("focus")));
	await page.waitForURL(origin + "/account/");
	assert.equal(await page.locator("[data-verification-email]").count(), 0);
});

test("known and denied requests use identical masked confirmation and resend messages", async t => {
	const messages = [];
	for (const outcome of ["known", "denied"]) {
		const provider = accountProvider();
		if (outcome === "known") provider.signup = async () => { throw Object.assign(new Error(), { status: 400, code: "user_already_exists" }); };
		const { page, origin, advance } = await fixture(t, { provider, admit: () => outcome !== "denied" });
		await register(page, origin);
		advance(60_000); await page.reload();
		await page.getByRole("button", { name: "שליחת קישור נוסף לאישור" }).click();
		await page.getByRole("status").waitFor();
		messages.push(await page.getByRole("status").textContent());
		assert.equal(provider.calls.some(call => call[0] === "resend"), outcome === "known");
	}
	assert.equal(messages[0], messages[1]);
});

test("verification handles transport failure explicitly and refreshes cooldown after an internal provider failure", async t => {
	const { page, origin, provider, advance } = await fixture(t);
	await register(page, origin); advance(60_000); await page.reload();
	await page.route("**/api/account/resend", route => route.abort(), { times: 1 });
	await page.getByRole("button", { name: "שליחת קישור נוסף לאישור" }).click();
	await page.getByRole("alert").filter({ hasText: "הבקשה לא הושלמה" }).waitFor();
	assert.equal(await page.locator("[data-verification-resend]").isEnabled(), true);
	provider.resend = async () => { throw new Error("private internal secret"); };
	await page.getByRole("button", { name: "שליחת קישור נוסף לאישור" }).click();
	await page.getByRole("alert").filter({ hasText: "אינה זמינה כרגע" }).waitFor();
	assert.equal(await page.locator("[data-verification-resend]").isDisabled(), true);
	assert.doesNotMatch(await page.locator("body").textContent(), /private internal secret/);
});

test("verification baseline preserves same-browser guidance and recovery navigation without JavaScript or a loaded entry module", async t => {
	const { browser, origin } = await fixture(t);
	for (const settings of [{ javaScriptEnabled: false }, {}]) {
		const page = await browser.newPage({ viewport: { width: 360, height: 568 }, ...settings });
		if (settings.javaScriptEnabled !== false) await page.route("**/account/account.js", route => route.abort());
		await page.goto(origin + "/account/verify.html");
		assert.equal(await page.getByRole("heading", { name: "פתחו את הקישור באותו דפדפן" }).isVisible(), true);
		assert.equal(await page.locator("[data-verification-controls]").isVisible(), false);
		assert.equal(await page.locator("[data-verification-missing]").isVisible(), true);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.getByRole("link", { name: "לבקש קישור לאיפוס הסיסמה" }).click();
		await page.waitForURL(/recovery.html/);
	}
});
