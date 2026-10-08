import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

for (const delayedPath of ["/js/script.js", "/js/topic-explorer.js"]) {
	for (const fail of [false, true]) {
		test(
			`mobile header stays compact while ${delayedPath} loads and ${fail ? "restores failed navigation" : "initializes navigation"}`,
			{ timeout: 20_000 },
			async (t) => {
				const browser = await chromium.launch();
				t.after(() => browser.close());
				const page = await browser.newPage({
					viewport: { width: 390, height: 844 },
					reducedMotion: "reduce",
				});
				let release;
				const pending = new Promise((resolve) => { release = resolve; });
				t.after(() => release());
				await page.route("**/*", async (route) => {
					if (new URL(route.request().url()).pathname === delayedPath) {
						await pending;
						if (fail) return route.abort();
					}
					return serveRoadMedia(route);
				});
				await page.goto("http://gallery.test/", { waitUntil: "commit" });
				await page.waitForFunction(() =>
					document.querySelector(".site-menu") && document.styleSheets.length === 5,
				);
				assert.equal(await page.locator(".site-header").evaluate(element => element.getBoundingClientRect().height), 66);
				assert.equal(await page.locator(".site-menu").isVisible(), false, "the expanded fallback does not flash during loading");
				release();
				await page.waitForLoadState("load");
				assert.equal(await page.locator("html").getAttribute("data-menu-pending"), null);
				if (fail) {
					assert.equal(await page.locator(".site-menu").isVisible(), true);
					assert.equal(await page.locator(".menu-toggle").isVisible(), false);
					await page.locator('.site-menu a[href="#about"]').click();
					assert.equal(new URL(page.url()).hash, "#about");
				} else {
					await page.locator(".menu-toggle").click();
					assert.equal(await page.locator(".site-menu").isVisible(), true);
					await page.keyboard.press("Escape");
					assert.equal(await page.locator(".site-menu").isVisible(), false);
					assert.equal(await page.locator(".menu-toggle").evaluate(element => element === document.activeElement), true);
				}
			},
		);
	}
}

for (const fail of [false, true]) {
	test(`stalled mobile enhancement keeps restored navigation after late ${fail ? "failure" : "success"}`, { timeout: 20_000 }, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
		let release;
		const pending = new Promise((resolve) => { release = resolve; });
		t.after(() => release());
		await page.route("**/*", async (route) => {
			if (new URL(route.request().url()).pathname === "/js/script.js") {
				await pending;
				if (fail) return route.abort();
			}
			return serveRoadMedia(route);
		});
		await page.goto("http://gallery.test/", { waitUntil: "commit" });
		await page.waitForFunction(() => document.documentElement.dataset.menuPending === "true");
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-menu-pending"));
		assert.equal(await page.locator(".site-menu").isVisible(), true);
		assert.equal(await page.locator(".menu-toggle").isVisible(), false);
		const link = page.locator('.site-menu a[href="#about"]');
		await link.focus();
		const height = await page.locator(".site-header").evaluate(element => element.getBoundingClientRect().height);
		release();
		await page.waitForLoadState("load");
		assert.equal(await page.locator(".site-menu").isVisible(), true);
		assert.equal(await page.locator(".site-header").evaluate(element => getComputedStyle(element).position), "static");
		assert.equal(await page.locator(".site-header").evaluate(element => element.getBoundingClientRect().height), height);
		assert.equal(await link.evaluate(element => document.activeElement === element), true, "late initialization preserves focused fallback links");
		await page.keyboard.press("Enter");
		assert.equal(new URL(page.url()).hash, "#about");
	});
}

function luminance(channels) {
	const linear = channels.map((channel) => {
		const value = channel / 255;
		return value <= 0.04045
			? value / 12.92
			: ((value + 0.055) / 1.055) ** 2.4;
	});
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

for (const reducedMotion of ["no-preference", "reduce"]) {
	test(`header preserves focus across desktop and phone layouts with ${reducedMotion} motion`, { timeout: 20_000 }, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		const firstLink = page.locator(".site-menu a").first();
		const toggle = page.locator(".menu-toggle");
		await firstLink.focus();
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForFunction(() => document.activeElement === document.querySelector(".menu-toggle"), null, { timeout: 5000 });
		assert.equal(await toggle.evaluate(element => document.activeElement === element), true, "a newly hidden desktop link transfers focus to the phone menu button");
		assert.equal(await page.locator(".site-menu").isVisible(), false);
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.waitForFunction(() => document.activeElement === document.querySelector(".site-menu a"), null, { timeout: 5000 });
		assert.equal(await firstLink.evaluate(element => document.activeElement === element), true, "the hidden phone menu button transfers focus to desktop navigation");
		await page.locator(".hero-actions a").first().focus();
		await page.setViewportSize({ width: 390, height: 844 });
		assert.equal(await page.locator(".hero-actions a").first().evaluate(element => document.activeElement === element), true, "unrelated focus stays in place");
		for (const blur of ["pointer", "programmatic"]) {
			await page.setViewportSize({ width: 1440, height: 900 });
			await firstLink.focus();
			if (blur === "pointer") await page.mouse.click(5, 30);
			else await firstLink.evaluate(element => element.blur());
			assert.equal(await page.evaluate(() => document.activeElement === document.body), true);
			await page.setViewportSize({ width: 390, height: 844 });
			await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			assert.equal(await page.evaluate(() => document.activeElement === document.body), true, `${blur} blur before resizing does not restore stale menu focus`);
		}
	});
}

test(
	"header brand has readable contrast and its visible text in its accessible name",
	{ timeout: 20_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390]) {
			for (const javaScriptEnabled of [true, false]) {
				const page = await browser.newPage({
					viewport: { width, height: 844 },
					javaScriptEnabled,
					reducedMotion: "reduce",
				});
				await page.route("**/*", serveRoadMedia);
				await page.goto("http://gallery.test/");
				const brand = page.locator(".brand");
				const visibleText = (await brand.innerText())
					.replace(/\s+/g, " ")
					.trim();
				const accessibleBrand = page.getByRole("link", {
					name: new RegExp(
						visibleText
							.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
							.replace(/ /g, "[\\s,]+"),
					),
				});
				assert.equal(
					await accessibleBrand.count(),
					1,
					"the accessible name includes the complete visible brand text",
				);
				const colors = await page
					.locator(".brand-copy small")
					.evaluate((element) => {
						const channels = (color) =>
							color.match(/[\d.]+/g).map(Number);
						return {
							text: channels(getComputedStyle(element).color),
							header: channels(
								getComputedStyle(
									element.closest(".site-header"),
								).backgroundColor,
							),
						};
					});
				// A black backdrop is the darkest possible result through the translucent header.
				const background = colors.header
					.slice(0, 3)
					.map((channel) => channel * (colors.header[3] ?? 1));
				const ratio =
					(luminance(background) + 0.05) /
					(luminance(colors.text.slice(0, 3)) + 0.05);
				assert.ok(
					ratio >= 4.5,
					`${width}px subtitle contrast is ${ratio.toFixed(2)}:1, below 4.5:1`,
				);
				await page.close();
			}
		}
	},
);
