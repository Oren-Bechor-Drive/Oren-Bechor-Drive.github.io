import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { endpoint, login, openReader, readerUrl, restoredNear, saveAt } from "./reader-journey-helpers.mjs";

for (const width of [1440, 390]) {
	test(`reader access expires, renews, and stays learner scoped at ${width}px`, async t => {
		const app = await startLessonGateway({ longLesson: true });
		t.after(app.close);
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const first = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 600 });
		const second = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 600 });
		for (const page of [first, second]) page.setDefaultTimeout(10000);
		const email = `journey-${width}@example.test`;
		const otherEmail = `other-journey-${width}@example.test`;
		async function direct(page, access, expectedStatus) {
			const response = await page.request.get(app.origin + endpoint(access));
			assert.equal(response.status(), expectedStatus);
			assert.equal(response.headers()["cache-control"], "private, no-store");
			return response.json();
		}
		async function unavailable(page, message) {
			await page.locator("[data-reader-status]").filter({ hasText: message }).waitFor();
			assert.equal(await page.locator("[data-reading-body]").textContent(), "");
			assert.equal(await page.locator("[data-reading]").isVisible(), false);
			assert.equal(await page.locator("[data-save-position]").isEnabled(), false);
		}

		for (const access of ["free", "paid"]) {
			await first.goto(readerUrl(app.origin, access));
			await unavailable(first, "היכנסו לחשבון");
			assert.deepEqual(await direct(first, access, 401), { error: "session_expired" });
		}
		await login(first, app.origin, email);
		await openReader(first, app.origin);
		await saveAt(first, 0.20);
		await first.goto(readerUrl(app.origin, "paid"));
		await unavailable(first, "אינו זמין לחשבון");
		assert.deepEqual(await direct(first, "paid", 404), { error: "lesson_unavailable" });

		// Cancelling a renewal leaves the finite paid period readable and writable until its end.
		await app.grant(email, new Date(Date.now() + 3_600_000).toISOString());
		await first.getByRole("button", { name: "טעינת השיעור מחדש" }).click();
		await first.locator("[data-reading-body]").filter({ hasText: "תוכן בדיקה בתשלום" }).waitFor();
		await saveAt(first, 0, 200, "paid");
		const saved = await direct(first, "paid", 200);
		assert.equal(saved.position.position, 0);
		await first.reload();
		await first.locator("[data-reading]:visible").waitFor();
		assert.equal((await direct(first, "paid", 200)).position.revision, saved.position.revision);

		// Access ends while the reader remains open. The next save must clear the private text.
		await app.expire(email);
		const failedSave = first.waitForResponse(response => response.url().endsWith(`${endpoint("paid")}/position`) && response.request().method() === "POST");
		await first.locator("[data-save-position]").click();
		assert.equal((await failedSave).status(), 404);
		await unavailable(first, "אינו זמין לחשבון");
		assert.deepEqual(await direct(first, "paid", 404), { error: "lesson_unavailable" });
		await first.reload();
		await unavailable(first, "אינו זמין לחשבון");
		await openReader(first, app.origin);
		await restoredNear(first, 0.20);
		await saveAt(first, 0.50);

		// A lapse longer than the retention window clears old positions before renewal.
		await app.expire(email, 31);
		await first.goto(readerUrl(app.origin, "paid"));
		await unavailable(first, "אינו זמין לחשבון");
		await app.grant(email);
		await first.getByRole("button", { name: "טעינת השיעור מחדש" }).click();
		await first.locator("[data-reading]:visible").waitFor();
		assert.equal((await direct(first, "paid", 200)).position, null);
		await saveAt(first, 0, 200, "paid");

		await login(second, app.origin, otherEmail);
		await second.goto(readerUrl(app.origin, "paid"));
		await unavailable(second, "אינו זמין לחשבון");
		await app.grant(otherEmail);
		await second.getByRole("button", { name: "טעינת השיעור מחדש" }).click();
		await second.locator("[data-reading]:visible").waitFor();
		assert.equal((await direct(second, "paid", 200)).position, null);
		await saveAt(second, 0, 200, "paid");
		await first.reload();
		await first.locator("[data-reading]:visible").waitFor();
		assert.equal((await direct(first, "paid", 200)).position.revision, 1);
		assert.equal((await direct(second, "paid", 200)).position.revision, 1);
		for (const page of [first, second]) {
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
		}
	});
}
