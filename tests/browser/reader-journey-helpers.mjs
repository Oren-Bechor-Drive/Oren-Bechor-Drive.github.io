import assert from "node:assert/strict";

import { testSections as sections, testSectionPath } from "../fixtures/test-sections.mjs";
export { sections };

export const readerUrl = (origin, access = "free") => `${origin}/account/reader.html?section=${sections[access]}&access=${access}`;
export const endpoint = (access = "free") => testSectionPath(access);

export async function login(page, origin, email) {
	await page.goto(origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill(email);
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(origin + "/account/");
}

export async function openReader(page, origin, access = "free") {
	await page.goto(readerUrl(origin, access));
	await page.locator("[data-reading]:visible").waitFor();
}

export async function scrollToFraction(page, fraction) {
	await page.evaluate(fraction => {
		const body = document.querySelector("[data-reading-body]");
		window.scrollTo({ top: scrollY + body.getBoundingClientRect().top + fraction * Math.max(0, body.offsetHeight - innerHeight) - 20, behavior: "instant" });
	}, fraction);
	await page.waitForFunction(fraction => {
		const body = document.querySelector("[data-reading-body]");
		const current = Math.max(0, Math.min(1, (20 - body.getBoundingClientRect().top) / Math.max(1, body.offsetHeight - innerHeight)));
		return Math.abs(current - fraction) < 0.03;
	}, fraction);
}

export async function saveAt(page, fraction, expectedStatus = 200, access = "free") {
	await scrollToFraction(page, fraction);
	const responsePromise = page.waitForResponse(response => response.url().endsWith(`${endpoint(access)}/position`) && response.request().method() === "POST");
	await page.locator("[data-save-position]").evaluate(button => button.click());
	const response = await responsePromise;
	assert.equal(response.status(), expectedStatus);
	assert.equal(response.headers()["cache-control"], "private, no-store");
	if (expectedStatus === 200) {
		const data = await response.json();
		assert.ok(Math.abs(data.position.position - fraction * 10000) < 120, `Saved ${data.position.position}, expected ${fraction * 10000}`);
		await page.locator("[data-position-status]").filter({ hasText: "מיקום הקריאה נשמר" }).waitFor();
	}
	return response;
}

export async function restoredNear(page, fraction) {
	await page.locator("[data-reading]:visible").waitFor();
	await page.waitForFunction(fraction => {
		const body = document.querySelector("[data-reading-body]");
		const current = Math.max(0, Math.min(1, (20 - body.getBoundingClientRect().top) / Math.max(1, body.offsetHeight - innerHeight)));
		return Math.abs(current - fraction) < 0.04;
	}, fraction);
}
