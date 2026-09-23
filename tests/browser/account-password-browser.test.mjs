import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startAccountGateway } from "../helpers/account-gateway.mjs";

test("registration meter tracks requirements, clears on deletion, and blocks incomplete passwords", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
	await page.goto(app.origin + "/account/register.html");
	const password = page.getByLabel("סיסמה", { exact: true });
	const meter = page.getByRole("meter");
	assert.equal(await meter.count(), 1);
	await page.getByLabel("כתובת אימייל").fill("learner@example.test");
	for (const [value, count, valid] of [
		["", 0, false], ["a", 0, false], ["abcdefghi", 1, false],
		["Abcdefghi", 2, false], ["Abcdefgh1", 3, false], ["Abcdefg1!", 4, true],
		["abcdefg1!", 3, false], ["ABCDEFG1!", 3, false], ["Abcdefgh!", 3, false],
		["Abcdefg1 ", 3, false], ["Abcdefg1א", 3, false], ["Abcdef1!", 3, false], ["", 0, false],
	]) {
		await password.fill(value);
		assert.equal(await meter.getAttribute("aria-valuenow"), String(count), value);
		assert.equal(await password.evaluate(node => node.checkValidity()), valid, value);
	}
	assert.equal(await page.locator(".account-card").evaluate(node => node.scrollHeight <= node.clientHeight + 1), true, "Registration should fit a standard phone without internal scrolling");
	await password.fill("Abcdefgh1");
	await page.getByRole("button", { name: "יצירת חשבון חינמי" }).click();
	assert.match(page.url(), /register.html$/);
	assert.equal(app.provider.calls.filter(call => call[0] === "signup").length, 0);
	await password.fill("Abcdefg1!");
	await page.getByRole("button", { name: "יצירת חשבון חינמי" }).click();
	await page.waitForURL(/verify.html$/);
	for (const screen of ["login", "reset"]) {
		await page.goto(`${app.origin}/account/${screen}.html`);
		assert.equal(await page.getByRole("meter").count(), 0);
	}
});

test("password bar animates progress and color, reverses smoothly, and respects reduced motion", async t => {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 667 }]) {
		const page = await browser.newPage({ viewport, reducedMotion: "no-preference" });
		await page.goto(app.origin + "/account/register.html");
		await page.locator("#password").fill("abcdefghi");
		const result = await page.locator(".password-strength-fill").evaluate(fill => {
			fill.getAnimations().forEach(animation => animation.finish());
			const input = document.querySelector("#password");
			const track = fill.parentElement.getBoundingClientRect();
			const read = () => ({ width: fill.getBoundingClientRect().width / track.width, right: fill.getBoundingClientRect().right, color: getComputedStyle(fill).backgroundColor });
			const update = value => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); };
			const start = read();
			update("Abcdefg1!");
			const animations = fill.getAnimations();
			for (const animation of animations) {
				animation.pause();
				animation.currentTime = animation.effect.getTiming().duration / 2;
			}
			const middle = read();
			update("abcdefghi");
			const reversed = read();
			fill.getAnimations().forEach(animation => animation.finish());
			const end = read();
			return { animations: animations.length, start, middle, reversed, end };
		});
		assert.equal(result.animations, 2, "Progress and color should both transition");
		assert.ok(result.middle.width > result.start.width && result.middle.width < 1);
		assert.notEqual(result.middle.color, result.start.color);
		assert.ok(Math.abs(result.middle.right - result.start.right) < 1, "Fill stays anchored on the RTL edge");
		assert.ok(Math.abs(result.reversed.width - result.middle.width) < 0.02, "Deleting characters should reverse from the current width");
		assert.ok(Math.abs(result.end.width - 0.25) < 0.01);
		assert.equal(result.end.color, result.start.color);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.locator("#password").fill("Abcdefg1!");
		assert.ok(await page.locator(".password-strength-fill").evaluate(fill => Math.abs(fill.getBoundingClientRect().width - fill.parentElement.getBoundingClientRect().width) < 1), "Reduced motion settles the width immediately");
		assert.equal(await page.locator(".account-note").count(), 0);
		await page.close();
	}
});
