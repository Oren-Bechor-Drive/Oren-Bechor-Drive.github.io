import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const viewports = [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 },
	{ width: 320, height: 720 },
];

for (const javaScriptEnabled of [true, false]) {
	test(
		`footer content stays centered and readable with JavaScript ${
			javaScriptEnabled ? "enabled" : "disabled"
		}`,
		{ timeout: 20_000 },
		async (t) => {
			const browser = await chromium.launch();
			t.after(() => browser.close());

			for (const viewport of viewports) {
				const page = await browser.newPage({
					viewport,
					javaScriptEnabled,
					reducedMotion: "reduce",
				});
				await page.route("**/*", serveRoadMedia);
				await page.goto("http://gallery.test/");
				await page.locator(".site-footer").scrollIntoViewIfNeeded();

				const layout = await page.evaluate(() => {
					const bounds = (selector) => {
						const rect = document
							.querySelector(selector)
							.getBoundingClientRect();
						return {
							left: rect.left,
							right: rect.right,
							top: rect.top,
							bottom: rect.bottom,
							centerX: rect.left + rect.width / 2,
						};
					};
					const status = document.querySelector("#contact-status");
					return {
						viewportWidth: document.documentElement.clientWidth,
						documentWidth: document.documentElement.scrollWidth,
						footer: bounds(".site-footer"),
						social: bounds(".footer-social"),
						status: bounds("#contact-status"),
						items: [...document.querySelectorAll(".footer-social > span")].map(
							(item) => {
								const rect = item.getBoundingClientRect();
								return {
									left: rect.left,
									right: rect.right,
									top: rect.top,
									bottom: rect.bottom,
								};
							},
						),
						statusTextAlign: getComputedStyle(status).textAlign,
					};
				});

				for (const [name, bounds] of [
					["social group", layout.social],
					["availability note", layout.status],
				]) {
					assert.ok(
						Math.abs(bounds.centerX - layout.footer.centerX) <= 1,
						`${viewport.width}px ${name} is horizontally centered`,
					);
				}
				assert.equal(
					layout.statusTextAlign,
					"center",
					`${viewport.width}px availability note is center aligned`,
				);
				assert.equal(
					layout.documentWidth,
					layout.viewportWidth,
					`${viewport.width}px page has no horizontal overflow`,
				);
				const rows = Map.groupBy(layout.items, (item) => Math.round(item.top));
				assert.equal(
					rows.size,
					viewport.width === 320 ? 2 : 1,
					`${viewport.width}px social items wrap into the expected rows`,
				);
				for (const items of rows.values()) {
					const left = Math.min(...items.map((item) => item.left));
					const right = Math.max(...items.map((item) => item.right));
					assert.ok(
						Math.abs((left + right) / 2 - layout.social.centerX) <= 1,
						`${viewport.width}px wrapped social row is centered`,
					);
				}
				for (const item of layout.items) {
					assert.ok(
						item.left >= layout.social.left - 1 &&
							item.right <= layout.social.right + 1,
						`${viewport.width}px social item stays within the centered group`,
					);
					assert.ok(
						item.top >= layout.social.top - 1 &&
							item.bottom <= layout.social.bottom + 1,
						`${viewport.width}px social item wraps within the group`,
					);
				}

				await page.close();
			}
		},
	);
}
