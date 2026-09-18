import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

function luminance(channels) {
	const linear = channels.map(channel => {
		const value = channel / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

test("header brand has readable contrast and its visible text in its accessible name", { timeout: 20_000 }, async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1440, 390]) {
		for (const javaScriptEnabled of [true, false]) {
			const page = await browser.newPage({ viewport: { width, height: 844 }, javaScriptEnabled, reducedMotion: "reduce" });
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			const brand = page.locator(".brand");
			const visibleText = (await brand.innerText()).replace(/\s+/g, " ").trim();
			const accessibleBrand = page.getByRole("link", { name: new RegExp(visibleText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s,]+")) });
			assert.equal(await accessibleBrand.count(), 1, "the accessible name includes the complete visible brand text");
			const colors = await page.locator(".brand-copy small").evaluate(element => {
				const channels = color => color.match(/[\d.]+/g).map(Number);
				return {
					text: channels(getComputedStyle(element).color),
					header: channels(getComputedStyle(element.closest(".site-header")).backgroundColor),
				};
			});
			// A black backdrop is the darkest possible result through the translucent header.
			const background = colors.header.slice(0, 3).map(channel => channel * (colors.header[3] ?? 1));
			const ratio = (luminance(background) + 0.05) / (luminance(colors.text.slice(0, 3)) + 0.05);
			assert.ok(ratio >= 4.5, `${width}px subtitle contrast is ${ratio.toFixed(2)}:1, below 4.5:1`);
			await page.close();
		}
	}
});
