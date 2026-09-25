import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startLessonGateway } from "../helpers/test-lessons.mjs";

test("test lessons read through the gateway with real database access checks on desktop and mobile", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce", hasTouch: width < 600 });
		const page = await context.newPage();
		const email = `learner-${width}@example.test`;
		await page.goto(app.origin + "/account/test-lessons.html");
		await page.getByRole("status").filter({ hasText: "היכנסו לחשבון" }).waitFor();
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		await page.getByRole("link", { name: "כניסה לחשבון", exact: true }).click();
		await page.getByLabel("כתובת אימייל").fill(email);
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(app.origin + "/account/");
		await page.getByRole("link", { name: "לשיעורי הבדיקה" }).click();
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה חינמי" }).waitFor();
		const position = page.getByLabel("מיקום הקריאה באחוזים");
		const save = page.getByRole("button", { name: "שמירת מיקום", exact: true });
		const outline = control => control.evaluate(node => getComputedStyle(node).outlineStyle);
		assert.equal(await position.evaluate(node => node === document.activeElement), false, "No automatic field focus");
		if (width < 600) await position.tap();
		else await position.click();
		assert.equal(await position.evaluate(node => node === document.activeElement), true, "Pointer input must preserve editing focus");
		assert.equal(await outline(position), "none", "Clicks and taps must not show a focus ring");
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.type("50");
		assert.equal(await position.inputValue(), "50");
		assert.equal(await outline(position), "none", "Typing after a click must not show a focus ring");
		await page.keyboard.press("Tab");
		assert.equal(await save.evaluate(node => node === document.activeElement), true);
		assert.notEqual(await outline(save), "none", "Keyboard button focus must stay visible");
		await page.keyboard.press("Shift+Tab");
		assert.notEqual(await outline(position), "none", "Keyboard field focus must stay visible");
		await page.locator('label[for="reading-position"]').click();
		assert.equal(await outline(position), "none", "Label clicks must return to pointer styling");
		await page.keyboard.press("Tab");
		await save.click();
		await page.locator("[data-position-status]").filter({ hasText: "המיקום נשמר" }).waitFor();
		assert.equal(await outline(save), "none", "A clicked button must not retain a keyboard ring");

		await page.getByRole("link", { name: "שיעור בדיקה בתשלום", exact: true }).click();
		await page.getByRole("status").filter({ hasText: "אינו זמין לחשבון" }).waitFor();
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		await app.grant(email);
		await page.getByRole("button", { name: "ניסיון נוסף" }).click();
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה בתשלום" }).waitFor();
		assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
		await page.keyboard.press("Tab");
		await page.getByRole("link", { name: "שיעור בדיקה חינמי", exact: true }).focus();
		assert.notEqual(await page.locator(":focus").evaluate(node => getComputedStyle(node).outlineStyle), "none");
		await page.keyboard.press("Enter");
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה חינמי" }).waitFor();
		await page.route("**/api/lessons/*", route => route.abort());
		await page.reload();
		await page.getByRole("status").filter({ hasText: "לא הצלחנו לטעון" }).waitFor();
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		await page.unroute("**/api/lessons/*");
		await page.getByRole("button", { name: "ניסיון נוסף" }).click();
		await page.locator("[data-lesson-body]").filter({ hasText: "תוכן בדיקה חינמי" }).waitFor();
		await context.close();
	}
});

test("test lesson shell has usable baseline navigation and no embedded lesson body", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const javaScriptEnabled of [false, true]) {
		const page = await browser.newPage({ javaScriptEnabled, viewport: { width: 320, height: 640 } });
		if (javaScriptEnabled) await page.route("**/test-lessons.js", route => route.abort());
		const response = await page.goto(app.origin + "/account/test-lessons.html");
		assert.doesNotMatch(await response.text(), /תוכן בדיקה חינמי|תוכן בדיקה בתשלום/);
		assert.ok(await page.getByRole("status").isVisible());
		assert.ok(await page.getByRole("link", { name: "כניסה לחשבון", exact: true }).isVisible());
		await page.getByRole("link", { name: "שיעור בדיקה בתשלום", exact: true }).click();
		await page.waitForURL(/lesson=paid/);
		assert.equal(await page.locator("[data-lesson-body]").textContent(), "");
		assert.ok(await page.getByRole("link", { name: "לנושאי הקורס" }).isVisible());
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.close();
	}
});

test("reading positions reload, resume in a second browser and resolve conflicts explicitly", async t => {
	const app = await startLessonGateway();
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		const email = `position-${width}@example.test`;
		const contexts = await Promise.all([browser.newContext({ viewport: { width, height: 844 } }), browser.newContext({ viewport: { width, height: 844 } })]);
		const pages = await Promise.all(contexts.map(context => context.newPage()));
		for (const page of pages) page.setDefaultTimeout(10_000);
		for (const page of pages) {
			await page.goto(app.origin + "/account/login.html");
			await page.getByLabel("כתובת אימייל").fill(email);
			await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
			await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
			await page.waitForURL(app.origin + "/account/");
		}
		await app.grant(email);
		for (const key of ["free", "paid"]) {
			const [first, second] = pages;
			const open = page => page.goto(app.origin + `/account/test-lessons.html?lesson=${key}`);
			const input = page => page.getByLabel("מיקום הקריאה באחוזים");
			const save = page => page.getByRole("button", { name: "שמירת מיקום", exact: true }).click();
			const saved = page => page.locator("[data-position-status]").filter({ hasText: "המיקום נשמר" }).waitFor();
			await open(first);
			await input(first).fill("37.5");
			await save(first);
			await saved(first);
			await first.reload();
			await first.locator("[data-position-status]").filter({ hasText: "37.5" }).waitFor();
			assert.equal(await input(first).inputValue(), "37.5");
			await open(second);
			await second.locator("[data-position-status]").filter({ hasText: "37.5" }).waitFor();
			assert.equal(await input(second).inputValue(), "37.5");
			await input(first).fill("60");
			await save(first);
			await saved(first);
			await input(second).fill("80");
			await save(second);
			await second.locator("[data-position-status]").filter({ hasText: "בדפדפן אחר" }).waitFor();
			assert.equal(await second.getByRole("button", { name: "שמירת מיקום", exact: true }).isEnabled(), false);
			assert.equal(await input(second).inputValue(), "80");
			await second.getByRole("button", { name: "טעינת המיקום השמור" }).click();
			await second.locator("[data-position-status]").filter({ hasText: "60" }).waitFor();
			assert.equal(await input(second).inputValue(), "60");
			await input(second).fill("100");
			await second.route("**/api/lessons/*/position", route => route.request().method() === "POST" ? route.abort() : route.continue());
			await save(second);
			await second.locator("[data-position-status]").filter({ hasText: "לא הצלחנו לשמור" }).waitFor();
			assert.equal(await input(second).inputValue(), "100");
			await second.unroute("**/api/lessons/*/position");
			await save(second);
			await saved(second);
			await first.reload();
			await first.locator("[data-position-status]").filter({ hasText: "100" }).waitFor();
			assert.equal(await input(first).inputValue(), "100");
			assert.equal(await first.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			await input(first).focus();
			await first.keyboard.press("Tab");
			await first.keyboard.press("Shift+Tab");
			assert.notEqual(await first.locator(":focus").evaluate(node => getComputedStyle(node).outlineStyle), "none");
			assert.equal(await first.evaluate(() => localStorage.length + sessionStorage.length), 0);
		}
		for (const context of contexts) await context.close();
	}
});

test("a successful single-row RPC save shows success immediately and restores the same percentage", async t => {
	const { createSupabaseProvider } = await import("../../server/supabase.mjs");
	const { accountProvider, startAccountGateway } = await import("../helpers/account-gateway.mjs");
	const version = "11111111-1111-4111-8111-111111111111";
	let stored = null;
	// PostgREST's single-composite RPC response is an object; table reads are arrays.
	// Contract: PostgREST test/spec/Feature/Query/RpcSpec.hs, "returns single row from table".
	const adapter = createSupabaseProvider({ url: "https://fixture.test", publishableKey: "public", secretKey: "secret",
		async fetcher(url, options) {
			if (new URL(url).pathname === "/rest/v1/rpc/save_my_position") {
				const input = JSON.parse(options.body);
				stored = { content_version_id: input.p_content_version_id, position: input.p_position, revision: (stored?.revision ?? 0) + 1 };
				return Response.json(stored);
			}
			assert.equal(new URL(url).pathname, "/rest/v1/rpc/read_my_position");
			return Response.json(stored ? [stored] : []);
		} });
	const provider = accountProvider();
	provider.readSection = async (_token, sectionId, accessLevel) => ({ id: version, section_id: sectionId, access_level: accessLevel, revision: 1, body_text: "טקסט לבדיקת שמירת מיקום." });
	provider.readPosition = adapter.readPosition;
	provider.savePosition = adapter.savePosition;
	const app = await startAccountGateway({ provider });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		page.setDefaultTimeout(5000);
		await page.goto(app.origin + "/account/login.html");
		await page.getByLabel("כתובת אימייל").fill("response-shape@example.test");
		await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
		await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
		await page.waitForURL(app.origin + "/account/");
		await page.goto(app.origin + "/account/test-lessons.html");
		await page.getByLabel("מיקום הקריאה באחוזים").fill("42.5");
		const savedResponse = page.waitForResponse(response => response.url().endsWith("/position") && response.request().method() === "POST");
		await page.getByRole("button", { name: "שמירת מיקום", exact: true }).click();
		const response = await savedResponse;
		assert.equal(response.status(), 200);
		assert.equal((await response.json()).position?.position, 4250, "Committed RPC result must reach the browser");
		await page.locator("[data-position-status]").filter({ hasText: "המיקום נשמר: 42.5" }).waitFor();
		await page.reload();
		await page.locator("[data-position-status]").filter({ hasText: "המיקום השמור נטען: 42.5" }).waitFor();
		assert.equal(await page.getByLabel("מיקום הקריאה באחוזים").inputValue(), "42.5");
		await page.close();
	}
});
