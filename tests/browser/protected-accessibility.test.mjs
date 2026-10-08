import assert from "node:assert/strict";
import test from "node:test";
import { privateMediaReader, syntheticTranscript } from "../helpers/private-media.mjs";

async function assertReflow(page) {
	const state = await page.evaluate(() => {
		const clipped = [...document.querySelectorAll("h1, h2, h3, p, summary, a, legend, label, button")]
			.filter(node => !node.closest('[hidden], [aria-hidden="true"], .skip-link, .visually-hidden'))
			.filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
			.flatMap(node => {
				if (!node.textContent.trim()) return [];
				const range = document.createRange();
				range.selectNodeContents(node);
				return [...range.getClientRects()].some(rect => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))
					? [node.textContent.trim().slice(0, 80)] : [];
			});
		return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, clipped };
	});
	assert.equal(state.overflow, false, "Protected content reflows without horizontal page scrolling.");
	assert.deepEqual(state.clipped, [], "Meaningful text remains within the viewport.");
}

async function assertKeyboardFocus(control) {
	const state = await control.evaluate(node => ({ focused: document.activeElement === node, style: getComputedStyle(node).outlineStyle,
		width: parseFloat(getComputedStyle(node).outlineWidth), color: getComputedStyle(node).outlineColor }));
	assert.equal(state.focused, true);
	assert.equal(state.style, "solid");
	assert.ok(state.width >= 3);
	assert.notEqual(state.color, "rgba(0, 0, 0, 0)");
}

async function enlargeText(page, locator) {
	const original = await locator.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
	await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
	assert.ok(await locator.evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= original * 1.95);
}

async function keyboardSave(page, key) {
	const response = page.waitForResponse(response => response.url().endsWith("/save") && response.request().method() === "POST");
	await page.keyboard.press(key);
	assert.equal((await response).status(), 200);
	await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
	await page.waitForFunction(() => !document.querySelector('[data-questions] input').disabled);
}

for (const width of [1440, 320]) for (const forcedColors of ["none", "active"]) {
	test(`protected native controls keep names, RTL order and usable focus at ${width}px with ${forcedColors} forced colors and 200 percent text`, async t => {
		const r = await privateMediaReader(t, { width, forcedColors, quiz: true });
		const { page } = r;
		const pointer = async control => { if (width === 320) await control.tap(); else await control.click(); };
		await r.open();
		assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
		assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running").length), 0);
		await enlargeText(page, page.locator("[data-reading-body]"));
		assert.equal(await page.locator("html").getAttribute("lang"), "he");
		assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
		assert.equal(await page.getByRole("main").count(), 1);
		assert.equal(await page.getByRole("region", { name: "שיעור לבדיקה", exact: true }).count(), 1);
		assert.equal(await page.getByRole("figure", { name: "סרטון סינתטי לבדיקה", exact: true }).count(), 1);
		const accessibility = await page.context().newCDPSession(page);
		const { nodes } = await accessibility.send("Accessibility.getFullAXTree");
		await accessibility.detach();
		const disclosure = nodes.find(node => node.role?.value === "DisclosureTriangle" && node.name?.value === "תמלול הסרטון");
		assert.ok(disclosure, "Chromium exposes the native disclosure with its Hebrew name.");
		assert.equal(disclosure.properties.find(property => property.name === "expanded").value.value, false);
		assert.equal(await page.getByRole("navigation", { name: "המשך הלמידה", exact: true }).count(), 1);
		assert.equal(await page.locator("[data-reader-status]").getAttribute("aria-live"), "polite");
		assert.equal(await page.locator("[data-reading-body]").evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector("[data-reading-media]")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
		await pointer(r.summary);
		await r.transcript.filter({ hasText: "תמלול סינתטי" }).waitFor();
		assert.equal(await r.transcript.textContent(), syntheticTranscript);
		assert.equal(await r.summary.evaluate(node => getComputedStyle(node).outlineStyle), "none");
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");
		await assertKeyboardFocus(r.summary);
		await page.keyboard.press("Enter");
		assert.equal(await r.summary.evaluate(node => node.parentElement.open), false);
		await page.keyboard.press("Enter");
		assert.equal(await r.summary.evaluate(node => node.parentElement.open), true);
		if (forcedColors === "active") {
			const boundary = await r.summary.evaluate(node => ({ width: parseFloat(getComputedStyle(node.parentElement).borderTopWidth),
				style: getComputedStyle(node.parentElement).borderTopStyle, fill: getComputedStyle(node, "::after").backgroundColor,
				adjust: getComputedStyle(node, "::after").forcedColorAdjust }));
			assert.ok(boundary.width >= 1);
			assert.equal(boundary.style, "solid");
			assert.notEqual(boundary.fill, "rgba(0, 0, 0, 0)");
			assert.equal(boundary.adjust, "none");
		}
		await assertReflow(page);
		await page.goto(r.app.origin + "/account/learning.html");
		await page.getByRole("button", { name: "פתיחת התרגול", exact: true }).waitFor();
		await enlargeText(page, page.locator(".account-intro"));
		await pointer(page.getByRole("button", { name: "פתיחת התרגול", exact: true }));
		const heading = page.locator("#quiz-heading");
		await heading.filter({ hasText: "תרגול בדיקה" }).waitFor();
		assert.equal(await page.locator("[data-attempt]").getByRole("heading", { name: "תרגול בדיקה", exact: true }).count(), 1);
		assert.equal(await heading.evaluate(node => document.activeElement === node), true);
		assert.equal(await heading.evaluate(node => getComputedStyle(node).outlineStyle), "none");
		const group = page.getByRole("group", { name: "1. שאלת בדיקה 1.", exact: true });
		assert.equal(await group.count(), 1);
		const first = group.getByRole("radio", { name: "אפשרות בדיקה א.", exact: true });
		const second = group.getByRole("radio", { name: "אפשרות בדיקה ב.", exact: true });
		assert.equal(await first.count(), 1);
		assert.equal(await second.count(), 1);
		assert.equal(await first.evaluate(node => {
			const radio = node.getBoundingClientRect(), text = node.nextElementSibling.getBoundingClientRect();
			return getComputedStyle(node.parentElement).direction === "rtl" && (radio.right > text.right || text.top >= radio.bottom);
		}), true, "The radio precedes its Hebrew label at the right edge or above it when text wraps.");
		await pointer(first);
		await page.locator("[data-save-status]").filter({ hasText: "התשובות נשמרו" }).waitFor();
		assert.equal(await first.evaluate(node => document.activeElement === node), true);
		assert.equal(await first.evaluate(node => getComputedStyle(node).outlineStyle), "none");
		await keyboardSave(page, "ArrowLeft");
		assert.equal(await second.isChecked(), true);
		await assertKeyboardFocus(second);
		await keyboardSave(page, "ArrowRight");
		assert.equal(await first.isChecked(), true);
		await assertKeyboardFocus(first);
		const submit = page.getByRole("button", { name: "הגשת התרגול", exact: true });
		await submit.focus();
		await page.keyboard.press("Enter");
		const secondQuestion = page.getByRole("group", { name: "2. שאלת בדיקה 2.", exact: true }).getByRole("radio").first();
		await assertKeyboardFocus(secondQuestion);
		assert.match(await page.locator("[data-save-status]").textContent(), /כל 3 השאלות/);
		await keyboardSave(page, "Space");
		await page.keyboard.press("Tab");
		const thirdQuestion = page.getByRole("group", { name: "3. שאלת בדיקה 3.", exact: true }).getByRole("radio").first();
		await assertKeyboardFocus(thirdQuestion);
		await keyboardSave(page, "Space");
		await page.keyboard.press("Tab");
		await assertKeyboardFocus(page.getByRole("button", { name: "שמירת תשובות", exact: true }));
		await page.keyboard.press("Tab");
		await assertKeyboardFocus(submit);
		await page.keyboard.press("Enter");
		const score = page.getByRole("heading", { name: "הציון שלכם: 3/3, 100%. עברתם את התרגול.", exact: true });
		await score.waitFor();
		await assertKeyboardFocus(score);
		assert.equal(await page.getByRole("region", { name: "הציון שלכם: 3/3, 100%. עברתם את התרגול.", exact: true }).count(), 2);
		assert.equal(await page.locator("[data-results] li").count(), 3);
		assert.equal(await page.locator("[data-save-status]").getAttribute("role"), "status");
		await assertReflow(page);
	});
}
