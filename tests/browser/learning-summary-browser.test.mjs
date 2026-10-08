import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";

for (const width of [1440, 390]) {
	test(`learning topic summaries load without history requests and history remains on demand at ${width}px`, async t => {
		const app = await startLessonGateway({ quizTopics: Object.freeze(["summary-first", "summary-second"]), quizCount: 3 });
		t.after(app.close);
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
		page.setDefaultTimeout(10000);
		const email = `summary-${width}@example.test`;
		await page.goto(app.origin + "/account/login.html");
		await page.getByLabel("כתובת אימייל").fill(email);
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(app.origin + "/account/");
		await app.grant(email);
		const session = await (await page.request.get(app.origin + "/api/account/session")).json();
		const headers = { origin: app.origin, "x-csrf-token": session.csrf };
		const draft = await (await page.request.post(app.origin + "/api/quizzes/summary-first/start", { headers, data: {} })).json();
		const saved = await (await page.request.post(`${app.origin}/api/attempts/${draft.id}/save`, {
			headers, data: { answers: { q1: "a", q2: "a", q3: "b" }, expectedRevision: draft.revision },
		})).json();
		assert.equal((await page.request.post(`${app.origin}/api/attempts/${draft.id}/submit`, { headers, data: { expectedRevision: saved.revision } })).status(), 200);
		const historyRequests = [];
		page.on("request", request => { if (/\/api\/quizzes\/[^/]+\/history/.test(request.url())) historyRequests.push(request.url()); });
		await page.goto(app.origin + "/account/learning.html");
		const first = page.locator('[data-topic="summary-first"]');
		const second = page.locator('[data-topic="summary-second"]');
		await first.filter({ hasText: "הציון האחרון: 2/3, 67%." }).waitFor();
		await second.filter({ hasText: "עדיין לא הוגש תרגול בנושא זה." }).waitFor();
		await first.getByRole("button", { name: "היסטוריית ניסיונות", exact: true }).waitFor();
		assert.equal(historyRequests.length, 0, "the complete multi-topic overview is supplied by the catalog");
		await first.getByRole("button", { name: "היסטוריית ניסיונות", exact: true }).click();
		await page.locator("[data-history-list] button").filter({ hasText: "2/3" }).waitFor();
		assert.equal(historyRequests.length, 1);
		assert.match(historyRequests[0], /\/summary-first\/history$/);
		await page.locator("[data-history-list] button").filter({ hasText: "2/3" }).click();
		await page.locator("[data-score]").filter({ hasText: "2/3" }).waitFor();
		assert.equal(await page.locator("[data-results] li").count(), 3);
		await app.expire(email);
		await page.reload();
		await page.locator("[data-learning-status]").filter({ hasText: "החשבון החינמי" }).waitFor();
		assert.doesNotMatch(await page.locator("[data-topics]").textContent(), /הציון האחרון|2\/3/);
		assert.equal(historyRequests.length, 1, "expired access never requests retained history");
	});
}
