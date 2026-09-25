import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startAccountGateway } from "../helpers/account-gateway.mjs";

async function reader(t, width) {
	const app = await startAccountGateway();
	t.after(app.close);
	const version = "11111111-1111-4111-8111-111111111111";
	let position = null;
	app.provider.readSection = async (_token, section, level) => ({ id: version, section_id: section, access_level: level, revision: 1, body_text: "טקסט לבדיקת קריאה." });
	app.provider.readPosition = async () => position;
	app.provider.savePosition = async (_token, _section, _level, input) => {
		position = { content_version_id: version, position: input.position, revision: (position?.revision ?? 0) + 1 };
		return position;
	};
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width, height: 844 } });
	page.setDefaultTimeout(5000);
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("lifetime@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	// Hold an already-received real response: aborting transport cannot undo its completion.
	// This forces the page's own ownership checks to reject a superseded result.
	await page.addInitScript(() => {
		const fetch = window.fetch.bind(window);
		window.fetch = async (url, options) => {
			const response = await fetch(url, options);
			const kind = String(url).endsWith("/position") && options?.method === "POST" ? "save" : String(url).endsWith("/free") ? "load" : null;
			if (!kind || window.holdReadingResponse !== kind) return response;
			window.holdReadingResponse = null;
			const text = await response.text();
			await new Promise(resolve => { window.releaseReadingResponse = resolve; });
			window.readingResponseReleased = false;
			const result = new Response(text, { status: response.status, headers: response.headers });
			// A later task lets the caller finish JSON parsing and render before assertions.
			setTimeout(() => { window.readingResponseReleased = true; }, 0);
			return result;
		};
	});
	return { app, page, open: () => page.goto(app.origin + "/account/test-lessons.html"),
		input: page.getByLabel("מיקום הקריאה באחוזים"),
		save: page.getByRole("button", { name: "שמירת מיקום", exact: true }),
		body: page.locator("[data-lesson-body]"),
		status: page.locator("[data-position-status]") };
}
async function hold(page, kind) {
	await page.evaluate(kind => { window.holdReadingResponse = kind; window.releaseReadingResponse = null; }, kind);
}
const held = page => page.waitForFunction(() => typeof window.releaseReadingResponse === "function");
async function release(page) {
	await page.evaluate(() => window.releaseReadingResponse());
	await page.waitForFunction(() => window.readingResponseReleased);
}
async function hide(page) {
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: true });
		document.dispatchEvent(new Event("visibilitychange"));
		window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
	});
}
async function restore(page) {
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: false });
		window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
	});
}
async function cleared(reader) {
	assert.equal(await reader.body.textContent(), "");
	assert.equal(await reader.input.isEnabled(), false);
	assert.equal(await reader.page.locator("[data-save-position]").isEnabled(), false);
	assert.equal(await reader.status.textContent(), "");
}

for (const width of [1440, 390]) {
	test(`test lesson opens with one reading request and can save at ${width}px`, async t => {
		const r = await reader(t, width);
		const requests = [];
		r.page.on("request", request => { if (request.url().includes("/api/")) requests.push(new URL(request.url()).pathname); });
		await r.open();
		await r.input.fill("42.5");
		assert.deepEqual(requests, ["/api/lessons/free"]);
		await r.save.click();
		await r.status.filter({ hasText: "המיקום נשמר: 42.5" }).waitFor();
		await r.page.reload();
		await r.status.filter({ hasText: "המיקום השמור נטען: 42.5" }).waitFor();
	});

	test(`restored lesson ignores a previous load completion at ${width}px`, async t => {
		const r = await reader(t, width);
		await r.open();
		await r.input.fill("0");
		await hold(r.page, "load");
		await restore(r.page);
		await held(r.page);
		await hide(r.page);
		await cleared(r);
		r.app.provider.readSection = async () => ({ id: "new-version", revision: 2, body_text: "טקסט קריאה חדש." });
		await restore(r.page);
		await r.body.filter({ hasText: "טקסט קריאה חדש." }).waitFor();
		await release(r.page);
		assert.equal(await r.body.textContent(), "טקסט קריאה חדש.");
		assert.equal(await r.save.isEnabled(), true);
	});

	test(`hidden lesson discards a late save response and resumes committed progress at ${width}px`, async t => {
		const r = await reader(t, width);
		await r.open();
		await r.input.fill("60");
		await hold(r.page, "save");
		await r.save.click();
		await held(r.page);
		await hide(r.page);
		await cleared(r);
		await release(r.page);
		await cleared(r);
		await restore(r.page);
		await r.status.filter({ hasText: "המיקום השמור נטען: 60" }).waitFor();
		assert.equal(await r.input.inputValue(), "60");
	});

	test(`superseded conflict reload cannot steal focus from restored reading at ${width}px`, async t => {
		const r = await reader(t, width);
		r.app.provider.savePosition = async () => { throw Object.assign(new Error(), { code: "40001" }); };
		await r.open();
		await r.input.fill("80");
		await r.save.click();
		await r.status.filter({ hasText: "בדפדפן אחר" }).waitFor();
		await hold(r.page, "load");
		await r.page.getByRole("button", { name: "טעינת המיקום השמור" }).click();
		await held(r.page);
		await hide(r.page);
		await restore(r.page);
		await r.status.filter({ hasText: "עדיין לא נשמר מיקום" }).waitFor();
		const link = r.page.getByRole("link", { name: "שיעור בדיקה בתשלום", exact: true });
		await link.focus();
		await release(r.page);
		assert.equal(await link.evaluate(node => document.activeElement === node), true, "Only the current reload may restore input focus");
	});
}
