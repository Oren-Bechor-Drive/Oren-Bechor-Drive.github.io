import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

for (const javaScriptEnabled of [true, false]) {
	test(`closing course action and icon-only footer stay readable with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390, 320]) {
			const page = await browser.newPage({ viewport: { width, height: 844 }, javaScriptEnabled, reducedMotion: "reduce" });
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			await page.locator(".site-footer").scrollIntoViewIfNeeded();
			await page.waitForFunction(() => [...document.querySelectorAll(".footer-social img")].every(image => image.complete && image.naturalWidth > 0));
			const social = page.locator(".footer-social");
			assert.equal(await social.locator(':scope > span[aria-disabled="true"][role="img"]').count(), 4);
			assert.deepEqual(await social.locator(":scope > span").evaluateAll(items => items.map(item => item.getAttribute("aria-label"))), ["אינסטגרם - קישור אינו זמין", "טיקטוק - קישור אינו זמין", "יוטיוב - קישור אינו זמין", "וואטסאפ - קישור אינו זמין"]);
			assert.equal(await social.locator("a, button, [tabindex]").count(), 0);
			assert.equal(await page.locator(".site-footer p, .site-footer nav, #contact-status").count(), 0);
			assert.equal((await page.locator(".site-footer").innerText()).trim(), "");
			assert.equal(await social.locator("img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0 && image.alt === "")), true);
			const layout = await page.locator(".site-footer").evaluate(footer => {
				const bounds = footer.getBoundingClientRect();
				const social = footer.querySelector(".footer-social").getBoundingClientRect();
				const icons = [...footer.querySelectorAll(".footer-social > span")].map(element => element.getBoundingClientRect());
				return {
					centered: Math.abs((social.left + social.right) / 2 - (bounds.left + bounds.right) / 2) <= 1,
					inside: icons.every(rect => rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom),
					oneRow: icons.every(rect => Math.abs(rect.top - icons[0].top) <= 1),
					comfortable: icons.every(rect => rect.width >= 44 && rect.height >= 44),
				};
			});
			assert.ok(Object.values(layout).every(Boolean), JSON.stringify(layout));
			assert.equal(await page.locator("#start p").count(), 0);
			const action = page.getByRole("link", { name: "לנושאי הלימוד ולתרגול", exact: true });
			const actionLayout = await action.evaluate(link => {
				const rect = link.getBoundingClientRect();
				const shell = link.parentElement.getBoundingClientRect();
				const icon = link.querySelector(".direction-icon");
				const style = getComputedStyle(link);
				return {
					inside: rect.left >= shell.left && rect.right <= shell.right,
					large: rect.height >= 64 && rect.width >= Math.min(shell.width, 320),
					legible: parseFloat(style.fontSize) >= 18,
					blue: style.backgroundColor === "rgb(38, 71, 150)" && style.color === "rgb(255, 255, 255)",
					decorativeArrow: icon.getAttribute("aria-hidden") === "true" && getComputedStyle(icon).maskImage.includes("arrow-left-long.svg"),
				};
			});
			assert.ok(Object.values(actionLayout).every(Boolean), JSON.stringify(actionLayout));
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			await action.click();
			await page.waitForURL("**/course/");
			await page.close();
		}
	});
}

test("closing course action preserves keyboard focus and hides pointer and touch rings", async t => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const reducedMotion of ["no-preference", "reduce"]) {
		const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		const action = page.locator("#start .button");
		await action.evaluate(link => link.addEventListener("click", event => event.preventDefault()));
		await page.locator("#faq details:last-child summary").focus();
		await page.keyboard.press("Tab");
		assert.equal(await action.evaluate(link => document.activeElement === link), true);
		assert.equal(await action.evaluate(link => getComputedStyle(link).outlineStyle), "solid");
		assert.equal(await action.evaluate(link => getComputedStyle(link).outlineWidth), "3px");
		await action.click();
		assert.equal(await action.evaluate(link => document.activeElement === link), true);
		assert.equal(await action.evaluate(link => getComputedStyle(link).outlineStyle), "none");
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");
		assert.equal(await action.evaluate(link => getComputedStyle(link).outlineStyle), "solid");
		await action.tap();
		assert.equal(await action.evaluate(link => document.activeElement === link), true);
		assert.equal(await action.evaluate(link => getComputedStyle(link).outlineStyle), "none");
		if (reducedMotion === "reduce") {
			await action.hover();
			assert.equal(await action.evaluate(link => getComputedStyle(link).transform), "none");
		}
		await page.close();
	}
});
