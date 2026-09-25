import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { accountProvider, startAccountGateway } from "../helpers/account-gateway.mjs";
import { endpoint, login, readerUrl, restoredNear, scrollToFraction, sections } from "./reader-journey-helpers.mjs";

const version = "11111111-1111-4111-8111-111111111111";
const longBody = Array.from({ length: 80 }, (_, i) => `פסקת בדיקה ${i + 1}. טקסט לבדיקת שמירת מיקום הקריאה.`).join("\n\n");

async function reader(t, width) {
	const provider = accountProvider();
	let position = null;
	let body = longBody;
	provider.readSections = async () => ({ sections: [{ id: sections.free, accessLevel: "free", title: "הגדרה לבדיקה" }] });
	provider.readSection = async (_token, section, level) => ({ id: version, section_id: section, access_level: level, revision: 1, body_text: body });
	provider.readPosition = async () => position;
	provider.savePosition = async (_token, _section, _level, input) => {
		position = { content_version_id: version, position: input.position, revision: (position?.revision ?? 0) + 1 };
		return position;
	};
	const app = await startAccountGateway({ provider });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width, height: 844 } });
	page.setDefaultTimeout(10000);
	await login(page, app.origin, "reader-lifetime@example.test");
	await page.addInitScript(() => {
		const original = window.fetch.bind(window);
		window.fetch = async (url, options) => {
			const response = await original(url, options);
			const path = String(url);
			const kind = path.endsWith("/position") && options?.method === "POST" ? "save" : path.endsWith("/free") ? "load" : null;
			if (!kind || window.holdReadingResponse !== kind) return response;
			window.holdReadingResponse = null;
			const text = await response.text();
			await new Promise(resolve => { window.releaseReadingResponse = resolve; });
			window.readingResponseReleased = false;
			const result = new Response(text, { status: response.status, headers: response.headers });
			setTimeout(() => { window.readingResponseReleased = true; }, 0);
			return result;
		};
	});
	return { app, page, provider, open: () => page.goto(readerUrl(app.origin)),
		body: page.locator("[data-reading-body]"),
		reading: page.locator("[data-reading]"),
		save: page.locator("[data-save-position]"),
		status: page.locator("[data-position-status]"),
		setBody(value) { body = value; }, get position() { return position; } };
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
async function cleared(r) {
	assert.equal(await r.body.textContent(), "");
	assert.equal(await r.reading.isVisible(), false);
	assert.equal(await r.save.isEnabled(), false);
	assert.equal(await r.status.textContent(), "");
}

for (const width of [1440, 390]) {
	test(`reader loads its catalog and one section response, then saves scroll at ${width}px`, async t => {
		const r = await reader(t, width);
		const requests = [];
		r.page.on("request", request => { if (request.url().includes("/api/")) requests.push(new URL(request.url()).pathname); });
		await r.open();
		await r.reading.waitFor({ state: "visible" });
		assert.deepEqual(requests, ["/api/sections", endpoint()]);
		await scrollToFraction(r.page, 0.425);
		await r.save.evaluate(button => button.click());
		await r.status.filter({ hasText: "מיקום הקריאה נשמר" }).waitFor();
		assert.ok(Math.abs(r.position.position - 4250) < 120);
		await r.page.reload();
		await restoredNear(r.page, 0.425);
	});

	test(`restored reader ignores an already received old load at ${width}px`, async t => {
		const r = await reader(t, width);
		await r.open();
		await r.reading.waitFor({ state: "visible" });
		await hold(r.page, "load");
		await restore(r.page);
		await held(r.page);
		await hide(r.page);
		await cleared(r);
		r.setBody("טקסט קריאה חדש.");
		await restore(r.page);
		await r.body.filter({ hasText: "טקסט קריאה חדש." }).waitFor();
		await release(r.page);
		assert.equal(await r.body.textContent(), "טקסט קריאה חדש.");
		assert.equal(await r.save.isEnabled(), true);
	});

	test(`hidden reader rejects a late save response and resumes committed progress at ${width}px`, async t => {
		const r = await reader(t, width);
		await r.open();
		await r.reading.waitFor({ state: "visible" });
		await scrollToFraction(r.page, 0.60);
		await hold(r.page, "save");
		await r.save.evaluate(button => button.click());
		await held(r.page);
		await hide(r.page);
		await cleared(r);
		await release(r.page);
		await cleared(r);
		await restore(r.page);
		await restoredNear(r.page, 0.60);
	});


	test(`restored reader ignores an already received old load failure at ${width}px`, async t => {
		const r = await reader(t, width);
		await r.open();
		await r.reading.waitFor({ state: "visible" });
		await r.page.route(`**${endpoint()}`, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
		await hold(r.page, "load");
		await restore(r.page);
		await held(r.page);
		await hide(r.page);
		await cleared(r);
		await r.page.unroute(`**${endpoint()}`);
		await restore(r.page);
		await r.reading.waitFor({ state: "visible" });
		await release(r.page);
		assert.equal(await r.reading.isVisible(), true);
		assert.doesNotMatch(await r.page.locator("[data-reader-status]").textContent(), /לא הצלחנו/);
	});

	test(`restored reader ignores an already received old save failure at ${width}px`, async t => {
		const r = await reader(t, width);
		await r.open();
		await r.reading.waitFor({ state: "visible" });
		await scrollToFraction(r.page, 0.60);
		await r.page.route(`**${endpoint()}/position`, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
		await hold(r.page, "save");
		await r.save.evaluate(button => button.click());
		await held(r.page);
		await hide(r.page);
		await cleared(r);
		await r.page.unroute(`**${endpoint()}/position`);
		await restore(r.page);
		await r.reading.waitFor({ state: "visible" });
		await release(r.page);
		assert.equal(await r.save.isEnabled(), true);
		assert.equal(await r.status.textContent(), "השיעור נטען.");
	});

	test(`superseded conflict reload does not steal focus at ${width}px`, async t => {
		const r = await reader(t, width);
		r.provider.savePosition = async () => { throw Object.assign(new Error(), { code: "40001" }); };
		await r.open();
		await r.reading.waitFor({ state: "visible" });
		await scrollToFraction(r.page, 0.80);
		await r.save.evaluate(button => button.click());
		await r.status.filter({ hasText: "בחלון אחר" }).waitFor();
		await hold(r.page, "load");
		await r.page.getByRole("button", { name: "טעינת השיעור מחדש" }).click();
		await held(r.page);
		await hide(r.page);
		await restore(r.page);
		await r.reading.waitFor({ state: "visible" });
		const link = r.page.getByRole("link", { name: "חזרה ללמידה שלכם" });
		await link.focus();
		await release(r.page);
		assert.equal(await link.evaluate(node => document.activeElement === node), true);
	});
}
