import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startAccountGateway } from "../helpers/account-gateway.mjs";

async function resetSession(page, app) {
	const session = await (await page.request.get(app.origin + "/api/account/session")).json();
	await page.request.post(app.origin + "/api/account/recover", { headers: { Origin: app.origin, "X-CSRF-Token": session.csrf }, data: { email: "learner@example.test" } });
	const flow = app.provider.calls.findLast(call => call[0] === "recover")[2];
	await page.goto(`${app.origin}/api/account/callback?state=${flow.state}&code=valid-code`);
	await page.waitForURL(/reset.html/);
}

test("registration and reset report completion of the same length-only rule in Hebrew", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
	for (const screen of ["register", "reset"]) {
		if (screen === "reset") await resetSession(page, app);
		else await page.goto(app.origin + "/account/register.html");
		const password = page.locator("#password");
		const meter = page.getByRole("meter");
		assert.equal(await password.getAttribute("maxlength"), "72");
		assert.match(await page.locator("#password-hint").textContent(), /לפחות 12 תווים, עד 72 תווים באנגלית/);
		assert.match(await password.getAttribute("aria-describedby"), /password-size-hint/);
		for (const [value, count] of [["", 0], ["abcdefghijk", 0], ["abcdefghijkl", 1], ["אבגדהוזחטיכל", 1], ["1".repeat(12), 1], [" ".repeat(12), 1], ["a".repeat(72), 1], ["a".repeat(73), 0], ["א".repeat(36), 1], ["א".repeat(37), 0], ["😀".repeat(6), 0], ["😀".repeat(6) + "a".repeat(5), 0], ["😀".repeat(12), 1], ["😀".repeat(18), 1], ["😀".repeat(19), 0], ["a\u0301".repeat(6), 1], ["a\u0301".repeat(24), 1], ["a\u0301".repeat(25), 0], ["א".repeat(34) + "aaaa", 1], ["א".repeat(34) + "aaaaa", 0], ["", 0]]) {
			await password.fill("");
			// Exercise canonical validation even when native typing caps ASCII at 72.
			if (value.length > 72) await password.evaluate((node, value) => { node.value = value; node.dispatchEvent(new Event("input", { bubbles: true })); }, value);
			else await password.fill(value);
			assert.equal(await password.inputValue(), value);
			assert.equal(await meter.getAttribute("aria-valuenow"), String(count));
			assert.equal(await password.evaluate(node => node.checkValidity()), Boolean(count));
		}
		if (screen === "register") await page.getByLabel("כתובת אימייל").fill("learner@example.test");
		const beforeInvalid = app.provider.calls.length;
		await password.fill("א".repeat(37));
		await page.locator('button[type="submit"]').click();
		assert.equal(await password.getAttribute("aria-invalid"), "true");
		assert.match(await page.locator("#password-error").textContent(), /ארוכה מדי/);
		assert.equal(await meter.getAttribute("aria-valuetext"), await page.locator("#password-error").textContent());
		assert.equal(app.provider.calls.length, beforeInvalid);
		await password.fill("😀".repeat(6));
		await page.locator('button[type="submit"]').click();
		assert.equal(await password.getAttribute("aria-invalid"), "true");
		assert.match(await page.locator("#password-error").textContent(), /12 תווים, הזנתם 6/);
		assert.equal(await password.evaluate(node => node === document.activeElement), true);
		await password.fill("😀".repeat(12));
		assert.equal(await password.getAttribute("aria-invalid"), "false");
		assert.match(await meter.getAttribute("aria-valuetext"), /עומדת בכל הדרישות/);
		await page.locator('button[type="submit"]').click();
		await page.waitForURL(screen === "register" ? /verify.html/ : /login.html\?status=password-updated/);
	}
});

test("login submits long Unicode passwords intact and rejects more than 128 characters", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage();
	await page.goto(app.origin + "/account/login.html");
	await page.locator("#email").fill("learner@example.test");
	const password = page.locator("#password");
	await password.fill("😀".repeat(128));
	assert.equal(await password.inputValue(), "😀".repeat(128));
	await page.locator('button[type="submit"]').click();
	await page.getByRole("alert").waitFor();
	assert.equal(app.provider.calls.filter(call => call[0] === "password").length, 1);
	assert.equal(await password.getAttribute("aria-invalid"), "false");
	await password.fill("");
	await password.fill("a".repeat(129));
	await page.locator('button[type="submit"]').click();
	assert.equal(await password.getAttribute("aria-invalid"), "true");
	assert.match(await page.locator("#password-error").textContent(), /עד 128 תווים/);
	assert.equal(app.provider.calls.filter(call => call[0] === "password").length, 1);
});

test("password completion fill remains anchored in RTL and settles immediately with reduced motion", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	for (const width of [1440, 375]) {
		const page = await browser.newPage({ viewport: { width, height: 667 }, reducedMotion: "no-preference" });
		await page.goto(app.origin + "/account/register.html");
		await page.locator("#password").fill("abcdefghijk");
		const result = await page.locator(".password-strength-fill").evaluate(fill => {
			fill.getAnimations().forEach(animation => animation.finish());
			const input = document.querySelector("#password");
			const track = fill.parentElement.getBoundingClientRect();
			const update = value => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); };
			update("abcdefghijkl");
			const animations = fill.getAnimations();
			for (const animation of animations) { animation.pause(); animation.currentTime = animation.effect.getTiming().duration / 2; }
			const middle = fill.getBoundingClientRect();
			update("abcdefghijk");
			const reversed = fill.getBoundingClientRect();
			fill.getAnimations().forEach(animation => animation.finish());
			return { count: animations.length, width: middle.width / track.width, right: middle.right - track.right, continuity: reversed.width - middle.width, end: fill.getBoundingClientRect().width };
		});
		assert.equal(result.count, 2);
		assert.ok(result.width > 0 && result.width < 1);
		assert.ok(Math.abs(result.right) < 1);
		assert.ok(Math.abs(result.continuity) < 1);
		assert.equal(result.end, 0);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.locator("#password").fill("abcdefghijkl");
		assert.ok(await page.locator(".password-strength-fill").evaluate(fill => Math.abs(fill.getBoundingClientRect().width - fill.parentElement.getBoundingClientRect().width) < 1));
		await page.close();
	}
});

test("Hebrew field errors persist, describe fields and never invoke native validation popups", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
	await page.goto(app.origin + "/account/login.html");
	await page.evaluate(() => { window.invalidEvents = 0; document.addEventListener("invalid", () => window.invalidEvents++, true); });
	await page.getByLabel("כתובת אימייל").fill("learner@");
	await page.locator('button[type="submit"]').click();
	assert.match(await page.locator("#email-error").textContent(), /שאחרי ה-@/);
	assert.equal(await page.locator("#email").getAttribute("aria-invalid"), "true");
	assert.equal(await page.locator("#email").getAttribute("aria-describedby"), "email-error");
	assert.equal(await page.evaluate(() => window.invalidEvents), 0);
	assert.equal(app.provider.calls.length, 0);
	await page.locator("#email").fill("learner@example.test");
	assert.equal(await page.locator("#email-error").isVisible(), false);
	await page.locator("#password").fill("wrong-password");
	await page.locator('button[type="submit"]').click();
	await page.getByRole("alert").waitFor();
	assert.equal(await page.locator(".account-card").evaluate(node => node.scrollHeight <= node.clientHeight + 1), true);
	await page.getByRole("link", { name: "יצירת חשבון חינמי", exact: true }).scrollIntoViewIfNeeded();
	assert.equal(await page.locator("html").evaluate(node => getComputedStyle(node).overflowY), "visible");
});
