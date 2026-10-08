import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

for (const javaScriptEnabled of [true, false]) {
	test(`footer brand and supplied destinations stay readable with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, async t => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390, 320]) {
			const page = await browser.newPage({ viewport: { width, height: 844 }, javaScriptEnabled, reducedMotion: "reduce" });
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			await page.locator(".site-footer").scrollIntoViewIfNeeded();
			await page.waitForFunction(() => [...document.querySelectorAll(".footer-social img")].every(image => image.complete && image.naturalWidth > 0));
			const social = page.locator(".footer-social");
			assert.equal(await social.locator(':scope > span[aria-disabled="true"]').count(), 4);
			assert.equal(await social.locator("a, button, [tabindex]").count(), 0);
			assert.match(await page.locator("#contact-status").innerText(), /קישורי יצירת הקשר והרשתות החברתיות יתווספו בהמשך/);
			assert.equal(await social.locator("img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0 && image.alt === "")), true);
			const links = page.locator(".site-footer nav a");
			assert.deepEqual(await links.evaluateAll(items => items.map(link => link.getAttribute("href"))), ["./", "course/"]);
			const layout = await page.locator(".site-footer").evaluate(footer => {
				const bounds = footer.getBoundingClientRect();
				return [...footer.querySelectorAll("p, nav, .footer-social, .footer-social > span")].map(element => {
					const rect = element.getBoundingClientRect();
					return { centered: element.matches(".footer-social > span") || Math.abs((rect.left + rect.right) / 2 - (bounds.left + bounds.right) / 2) <= 1, inside: rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom };
				});
			});
			assert.ok(layout.every(item => item.centered && item.inside));
			for (const link of await links.all()) assert.ok((await link.boundingBox()).height >= 44, "footer destinations preserve touch target height");
			await links.last().focus();
			await page.keyboard.press("Enter");
			await page.waitForURL("**/course/");
			assert.equal(new URL(page.url()).pathname, "/course/");
			await page.close();
		}
	});
}
