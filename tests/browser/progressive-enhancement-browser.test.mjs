import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

for (const failure of ["disabled", "module unavailable"]) {
	test(
		`navigation and all topic descriptions remain usable with JavaScript ${failure}`,
		{ timeout: 20_000 },
		async (t) => {
			const browser = await chromium.launch();
			t.after(() => browser.close());
			for (const width of [1440, 390, 320]) {
				const page = await browser.newPage({
					javaScriptEnabled: failure !== "disabled",
					viewport: { width, height: 844 },
					reducedMotion: "reduce",
				});
				await page.route("**/*", (route) =>
					failure === "module unavailable" &&
					new URL(route.request().url()).pathname === "/js/script.js"
						? route.abort()
						: serveRoadMedia(route),
				);
				await page.goto("http://gallery.test/");
				assert.equal(
					await page.locator(".site-menu").isVisible(),
					true,
					`${width}px navigation is available`,
				);
				assert.equal(
					await page.locator(".menu-toggle").isVisible(),
					false,
					"a nonfunctional menu button is not offered",
				);
				await page.locator('.site-menu a[href="#about"]').click();
				assert.equal(
					await page.locator(".topic-card:visible").count(),
					0,
					"nonfunctional topic buttons are not offered",
				);
				const content = await page.locator("#about").innerText();
				for (const description of [
					"לקרוא את מבנה הצומת",
					"לזהות כביש חד-סטרי",
					"להתקרב נכון למעגל תנועה",
					"להכיר תמרורים נפוצים",
					"להבין מתי עקיפה אפשרית",
					"להביט רחוק",
					"להכיר את המצבים שבהם תלמידים נכשלים",
				]) {
					assert.ok(
						content.includes(description),
						`readable description: ${description}`,
					);
				}
				assert.equal(
					await page.evaluate(
						() =>
							document.documentElement.scrollWidth <= innerWidth,
					),
					true,
					"no horizontal overflow",
				);
				assert.ok(
					await page
						.locator("#about-title")
						.evaluate(
							(element) =>
								element.getBoundingClientRect().top >= 0,
						),
					"destination title stays in view",
				);
				const alignment = await page.evaluate(() => ({
					top: document
						.querySelector("#about")
						.getBoundingClientRect().top,
					headerBottom: document
						.querySelector(".site-header")
						.getBoundingClientRect().bottom,
				}));
				assert.ok(
					Math.abs(
						alignment.top -
							(width < 769 ? 0 : alignment.headerBottom),
					) <= 1,
					"baseline anchor accounts only for a sticky header",
				);
				await page.close();
			}
		},
	);
}

test(
	"enhancement preserves topic selection and mobile navigation",
	{ timeout: 20_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390, 320]) {
			const page = await browser.newPage({
				viewport: { width, height: 844 },
				reducedMotion: "reduce",
			});
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/");
			if (width < 769) {
				assert.equal(
					await page.locator(".site-menu").isVisible(),
					false,
				);
				await page.locator(".menu-toggle").click();
			}
			await page.locator('.site-menu a[href="#about"]').click();
			if (width < 640) {
				await page.locator(".topic-select").focus();
				await page.keyboard.press("ArrowDown");
				await page.keyboard.press("End");
			} else await page.locator(".topic-card").last().focus();
			await page.keyboard.press("Enter");
			assert.equal(
				await page.locator("[data-topic-panel-title]").innerText(),
				"טעויות נפוצות בטסט",
			);
			assert.ok(
				(
					await page
						.locator("[data-topic-panel-description]")
						.innerText()
				).startsWith("להכיר את המצבים שבהם תלמידים נכשלים"),
			);
			assert.equal(
				await page.locator("[data-topic-summaries]").isVisible(),
				false,
				"baseline summaries do not duplicate the enhanced panel",
			);
			assert.equal(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
				true,
			);
			await page.close();
		}
	},
);
