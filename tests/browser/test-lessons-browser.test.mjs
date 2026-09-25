import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { accountProvider, startAccountGateway } from "../helpers/account-gateway.mjs";
import { createSupabaseProvider } from "../../server/supabase.mjs";
import { endpoint, login, openReader, readerUrl, restoredNear, saveAt, scrollToFraction, sections } from "./reader-journey-helpers.mjs";

for (const width of [1440, 390]) {
	test(`synthetic sections use the actual reader at ${width}px`, async t => {
	const app = await startLessonGateway({ longLesson: true });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 600, reducedMotion: "reduce" });
	page.setDefaultTimeout(10000);
	await page.goto(readerUrl(app.origin));
	await page.locator("[data-reader-status]").filter({ hasText: "היכנסו לחשבון" }).waitFor();
	assert.equal(await page.locator("[data-reading-body]").textContent(), "");
	const email = `reader-journey-${width}@example.test`;
	await login(page, app.origin, email);
	await page.goto(app.origin + "/account/learning.html");
	await page.getByRole("link", { name: "הגדרה לבדיקה - הגדרה" }).click();
	await page.locator("[data-reading-body]").filter({ hasText: "פסקת בדיקה" }).waitFor();
	await saveAt(page, 0.35);
	assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
	await page.reload();
	await restoredNear(page, 0.35);
	const save = page.locator("[data-save-position]");
	await save.click();
	assert.equal(await save.evaluate(node => getComputedStyle(node).outlineStyle), "none");
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");
	assert.notEqual(await page.locator(":focus").evaluate(node => getComputedStyle(node).outlineStyle), "none");
	await page.goto(readerUrl(app.origin, "paid"));
	await page.locator("[data-reader-status]").filter({ hasText: "אינו זמין לחשבון" }).waitFor();
	assert.equal(await page.locator("[data-reading-body]").textContent(), "");
	await app.grant(email);
	await page.getByRole("button", { name: "טעינת השיעור מחדש" }).click();
	await page.locator("[data-reading-body]").filter({ hasText: "תוכן בדיקה בתשלום" }).waitFor();
	await page.route(`**${endpoint()}`, route => route.abort());
	await page.goto(readerUrl(app.origin));
	await page.locator("[data-reader-status]").filter({ hasText: "לא הצלחנו" }).waitFor();
	assert.equal(await page.locator("[data-reading-body]").textContent(), "");
	await page.unroute(`**${endpoint()}`);
	await page.getByRole("button", { name: "טעינת השיעור מחדש" }).click();
	await page.locator("[data-reading-body]").filter({ hasText: "פסקת בדיקה" }).waitFor();
});
}

test("reader shell retains navigation when JavaScript is disabled or its module fails", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const javaScriptEnabled of [false, true]) {
		const page = await browser.newPage({ javaScriptEnabled, viewport: { width: 320, height: 640 } });
		if (javaScriptEnabled) await page.route("**/account/reader.js", route => route.abort());
		const response = await page.goto(readerUrl(app.origin));
		assert.doesNotMatch(await response.text(), /תוכן בדיקה חינמי|תוכן בדיקה בתשלום/);
		assert.ok(await page.getByRole("link", { name: "חזרה ללמידה שלכם" }).isVisible());
		assert.ok(await page.getByRole("link", { name: "כניסה לחשבון" }).isVisible());
		assert.equal(await page.locator("[data-reading-body]").textContent(), "");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.close();
	}
});

test("two browsers resume, reject stale saves, and retry failed saves", async t => {
	const app = await startLessonGateway({ longLesson: true });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		const email = `reader-conflict-${width}@example.test`;
		const contexts = await Promise.all([browser.newContext({ viewport: { width, height: 844 } }), browser.newContext({ viewport: { width, height: 844 } })]);
		const [first, second] = await Promise.all(contexts.map(context => context.newPage()));
		for (const page of [first, second]) { page.setDefaultTimeout(10000); await login(page, app.origin, email); }
		await openReader(first, app.origin);
		await saveAt(first, 0.35);
		await openReader(second, app.origin);
		await restoredNear(second, 0.35);
		await saveAt(first, 0.60);
		await scrollToFraction(second, 0.80);
		const conflictResponse = second.waitForResponse(response => response.url().endsWith(`${endpoint()}/position`) && response.request().method() === "POST");
		await second.locator("[data-save-position]").evaluate(button => button.click());
		assert.equal((await conflictResponse).status(), 409);
		await second.locator("[data-position-status]").filter({ hasText: "בחלון אחר" }).waitFor();
		assert.equal(await second.locator("[data-save-position]").isEnabled(), false);
		await second.getByRole("button", { name: "טעינת השיעור מחדש" }).click();
		await restoredNear(second, 0.60);
		await second.route(`**${endpoint()}/position`, route => route.abort());
		await scrollToFraction(second, 0.75);
		await second.locator("[data-save-position]").evaluate(button => button.click());
		await second.locator("[data-position-status]").filter({ hasText: "לא הצלחנו" }).waitFor();
		await second.unroute(`**${endpoint()}/position`);
		await saveAt(second, 0.75);
		await first.reload();
		await restoredNear(first, 0.75);
		assert.equal(await first.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		assert.equal(await first.evaluate(() => localStorage.length + sessionStorage.length), 0);
		for (const context of contexts) await context.close();
	}
});

test("a single-row RPC result reaches the reader and restores its saved scroll", async t => {
	const version = "11111111-1111-4111-8111-111111111111";
	let stored = null;
	const adapter = createSupabaseProvider({ url: "https://fixture.test", publishableKey: "public", secretKey: "secret",
		async fetcher(url, options) {
			const path = new URL(url).pathname;
			if (path === "/rest/v1/rpc/save_my_position") {
				const input = JSON.parse(options.body);
				stored = { content_version_id: input.p_content_version_id, position: input.p_position, revision: (stored?.revision ?? 0) + 1 };
				return Response.json(stored);
			}
			assert.equal(path, "/rest/v1/rpc/read_my_position");
			return Response.json(stored ? [stored] : []);
		} });
	const provider = accountProvider();
	provider.readSections = async () => ({ sections: [{ id: sections.free, accessLevel: "free", title: "הגדרה לבדיקה" }] });
	provider.readSection = async (_token, sectionId, accessLevel) => ({ id: version, section_id: sectionId, access_level: accessLevel, revision: 1,
		body_text: Array.from({ length: 80 }, (_, i) => `פסקת בדיקה ${i + 1}. טקסט לבדיקת שמירת מיקום הקריאה.`).join("\n\n") });
	provider.readPosition = adapter.readPosition;
	provider.savePosition = adapter.savePosition;
	const app = await startAccountGateway({ provider });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
	page.setDefaultTimeout(10000);
	await login(page, app.origin, "response-shape@example.test");
	await openReader(page, app.origin);
	const response = await saveAt(page, 0.425);
	assert.ok(Math.abs((await response.json()).position.position - 4250) < 120);
	await page.reload();
	await restoredNear(page, 0.425);
});
