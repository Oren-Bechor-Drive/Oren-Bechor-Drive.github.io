import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";

for (const width of [1440, 390]) {
	test(`protected quiz resumes, grades and completes at ${width}px`, async t => {
		const app = await startLessonGateway({ quiz: true });
		t.after(app.close);
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		page.setDefaultTimeout(10_000);
		await page.goto(app.origin + "/account/learning.html");
		await page.getByRole("heading", { name: "הלמידה שלכם", exact: true }).waitFor();
		await page.locator("[data-learning-status]").filter({ hasText: "היכנסו לחשבון" }).waitFor();
		const email = `quiz-${width}@example.test`;
		await page.goto(app.origin + "/account/login.html");
		await page.getByLabel("כתובת אימייל").fill(email);
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(app.origin + "/account/");
		await app.grant(email);
		await page.goto(app.origin + "/account/learning.html");
		await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
		const question = i => page.locator("[data-questions] fieldset").nth(i);
		await question(0).waitFor();
		assert.equal(await page.locator("[data-questions] fieldset").count(), 20);
		await question(0).getByRole("radio").first().check();
		await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
		await page.reload();
		await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
		assert.equal(await question(0).getByRole("radio").first().isChecked(), true);
		await page.getByRole("button", { name: "הגשת התרגול", exact: true }).click();
		await page.locator("[data-save-status]").filter({ hasText: "כל 20" }).waitFor();
		assert.equal(await page.locator("[data-results]").isVisible(), false);
		for (let i = 1; i < 20; i++) {
			await question(i).getByRole("radio").nth(i < 17 ? 0 : 1).check();
			await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
		}
		await page.getByRole("button", { name: "הגשת התרגול", exact: true }).click();
		await page.locator("[data-score]").filter({ hasText: "17/20" }).waitFor();
		assert.equal(await page.locator("[data-results] li").count(), 20);
		await page.getByRole("button", { name: "סימון הנושא כהושלם", exact: true }).click();
		await page.locator("[data-topics]").filter({ hasText: "הושלם" }).waitFor();
		await page.getByRole("button", { name: "תרגול נוסף", exact: true }).click();
		await page.locator("[data-results]").waitFor({ state: "hidden" });
		assert.equal(await question(0).getByRole("radio").first().isChecked(), false);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
		await app.expire(email);
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		assert.equal(await page.locator("[data-questions]").textContent(), "");
		assert.equal(await page.locator("#quiz-heading").textContent(), "");
		assert.equal(await page.locator("[data-score]").textContent(), "");
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: false });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await page.locator("[data-learning-status]").filter({ hasText: "מנוי פעיל" }).waitFor();
		assert.match(await page.locator("[data-topics]").textContent(), /הושלם/);
	});
}

test("autosave keeps native keyboard focus and preserves an unsaved draft across tab revalidation", async t => {
	const app = await startLessonGateway({ quiz: true });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	page.setDefaultTimeout(10000);
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("draft-retry@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	await app.grant("draft-retry@example.test");
	await page.goto(app.origin + "/account/learning.html");
	await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
	const radios = page.locator("[data-questions] fieldset").first().getByRole("radio");
	await radios.first().focus();
	await page.keyboard.press("ArrowLeft");
	await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
	assert.equal(await page.locator(":focus").getAttribute("type"), "radio");
	await page.keyboard.press("ArrowRight");
	await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
	assert.equal(await radios.first().isChecked(), true);
	assert.equal(await page.locator(":focus").getAttribute("type"), "radio");
	await page.route("**/api/attempts/*/save", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
	await radios.nth(1).check();
	await page.locator("[data-save-status]").filter({ hasText: "בדקו את החיבור" }).waitFor();
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: true });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	assert.equal(await page.locator("[data-questions]").textContent(), "");
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: false });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await page.locator("[data-attempt]").waitFor();
	assert.equal(await radios.nth(1).isChecked(), true);
	await page.unroute("**/api/attempts/*/save");
	await page.getByRole("button", { name: "שמירת תשובות", exact: true }).click();
	await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
	await page.reload();
	await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
	assert.equal(await radios.nth(1).isChecked(), true);
	// A second tab changes the saved attempt while this tab has an unsaved edit.
	await page.route("**/api/attempts/*/save", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
	await radios.first().check();
	await page.locator("[data-save-status]").filter({ hasText: "בדקו את החיבור" }).waitFor();
	const overview = await (await page.request.get(app.origin + "/api/learning")).json();
	const headers = { origin: app.origin, "x-csrf-token": overview.csrf };
	const current = await (await page.request.post(app.origin + "/api/quizzes/synthetic-topic/start", { headers, data: {} })).json();
	const changed = await page.request.post(`${app.origin}/api/attempts/${current.id}/save`, { headers, data: { answers: { ...current.answers, q2: "a" }, expectedRevision: current.revision } });
	assert.equal(changed.status(), 200);
	for (let cycle = 0; cycle < 2; cycle++) {
		await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
		await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
		await page.locator("[data-reload-attempt]").waitFor();
		assert.equal(await radios.first().isDisabled(), true);
		assert.match(await page.locator("[data-save-status]").textContent(), /עודכן בחלון אחר/);
	}
	await page.unroute("**/api/attempts/*/save");
	await page.getByRole("button", { name: "טעינת הניסיון השמור", exact: true }).click();
	await page.locator("[data-reload-attempt]").waitFor({ state: "hidden" });
	assert.equal(await radios.nth(1).isChecked(), true);
});

for (const responseStatus of [200, 503]) {
	test(`quiz ignores a delayed ${responseStatus} save after restoring and saving newer choices`, async t => {
		const app = await startLessonGateway({ quiz: true });
		t.after(app.close);
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
		page.setDefaultTimeout(10000);
		await page.goto(app.origin + "/account/login.html");
		const email = `late-${responseStatus}@example.test`;
		await page.getByLabel("כתובת אימייל").fill(email);
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(app.origin + "/account/");
		await app.grant(email);
		// Hold an already-received response so abort alone cannot prevent acceptance.
		await page.addInitScript(() => {
			const fetch = window.fetch.bind(window);
			window.fetch = async (url, options) => {
				const response = await fetch(url, options);
				if (!String(url).endsWith("/save") || !window.holdSave) return response;
				window.holdSave = false;
				const text = await response.text();
				await new Promise(resolve => { window.releaseSave = resolve; });
				setTimeout(() => { window.saveReleased = true; }, 0);
				return new Response(text, { status: response.status, headers: response.headers });
			};
		});
		await page.goto(app.origin + "/account/learning.html");
		await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
		if (responseStatus === 503) await page.route("**/api/attempts/*/save", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }), { times: 1 });
		await page.evaluate(() => { window.holdSave = true; });
		const fields = page.locator("[data-questions] fieldset");
		await fields.nth(0).getByRole("radio").first().check();
		await page.waitForFunction(() => typeof window.releaseSave === "function");
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		assert.equal(await page.locator("[data-questions]").textContent(), "");
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, value: false });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await page.locator("[data-attempt]").waitFor();
		await fields.nth(1).getByRole("radio").first().check();
		await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
		const feedback = await page.locator("[data-save-status]").textContent();
		await page.evaluate(() => window.releaseSave());
		await page.waitForFunction(() => window.saveReleased);
		assert.equal(await page.locator("[data-save-status]").textContent(), feedback);
		assert.equal(await fields.nth(0).getByRole("radio").first().isChecked(), true);
		assert.equal(await fields.nth(1).getByRole("radio").first().isChecked(), true);
		await page.reload();
		await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
		assert.equal(await fields.nth(1).getByRole("radio").first().isChecked(), true);
	});
}

test("manual reload preserves unsaved quiz answers after a failed tab restore", async t => {
	const app = await startLessonGateway({ quiz: true });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	page.setDefaultTimeout(10000);
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("restore-retry@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	await app.grant("restore-retry@example.test");
	await page.goto(app.origin + "/account/learning.html");
	await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
	const answer = page.locator("[data-questions] fieldset").first().getByRole("radio").nth(1);
	await page.route("**/api/attempts/*/save", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
	await answer.check();
	await page.locator("[data-save-status]").filter({ hasText: "בדקו את החיבור" }).waitFor();
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: true });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await page.route("**/api/learning", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: false });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await page.locator("[data-learning-status]").filter({ hasText: "בדקו את החיבור" }).waitFor();
	await page.unroute("**/api/learning");
	await page.locator("[data-reload]").click();
	await page.waitForFunction(() => !document.querySelector("[data-reload]").disabled);
	assert.equal(await page.locator("[data-questions] fieldset").count(), 20);
	assert.equal(await answer.isChecked(), true);
	await page.unroute("**/api/attempts/*/save");
	await page.getByRole("button", { name: "שמירת תשובות", exact: true }).click();
	await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
	await page.reload();
	await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
	assert.equal(await answer.isChecked(), true);
});

test("choices made during autosave are persisted without moving native focus", async t => {
	const app = await startLessonGateway({ quiz: true });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
	page.setDefaultTimeout(10000);
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("coalesced-edits@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	await app.grant("coalesced-edits@example.test");
	await page.goto(app.origin + "/account/learning.html");
	await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
	let release, entered;
	const held = new Promise(resolve => { release = resolve; });
	const started = new Promise(resolve => { entered = resolve; });
	t.after(() => release());
	await page.route("**/api/attempts/*/save", async route => {
		entered();
		await held;
		await route.continue();
	}, { times: 1 });
	const fields = page.locator("[data-questions] fieldset");
	await fields.nth(0).getByRole("radio").first().check();
	await started;
	await fields.nth(0).getByRole("radio").nth(1).check();
	const second = fields.nth(1).getByRole("radio").first();
	await second.focus();
	await page.keyboard.press("Space");
	release();
	await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
	assert.equal(await second.evaluate(input => input === document.activeElement), true);
	await page.reload();
	await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).click();
	assert.equal(await fields.nth(0).getByRole("radio").nth(1).isChecked(), true);
	assert.equal(await fields.nth(1).getByRole("radio").first().isChecked(), true);
});
