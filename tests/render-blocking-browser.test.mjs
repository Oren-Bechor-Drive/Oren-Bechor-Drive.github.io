import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);

test("the styled page paints while fonts and enhancement scripts are still pending", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1366, 390]) {
		await t.test(`${width}px`, async () => {
			const page = await browser.newPage({
				viewport: { width, height: 844 },
				reducedMotion: "reduce",
			});
			let release;
			const gate = new Promise(resolve => { release = resolve; });
			const stylesheets = [];
			const fonts = [];
			await page.route("**/*", async route => {
				const request = route.request();
				if (request.resourceType() === "stylesheet") stylesheets.push(request.url());
				if (request.resourceType() === "font") fonts.push(request.url());
				if (["stylesheet", "font", "script"].includes(request.resourceType())) {
					await gate;
					return route.abort();
				}
				const url = new URL(request.url());
				if (url.origin !== "http://render.test") return route.abort();
				const filename = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
				try {
					const bytes = await readFile(new URL(filename, root));
					await route.fulfill({
						body: bytes,
						contentType: ({ ".html": "text/html", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" })[path.extname(filename)],
					});
				} catch (error) {
					if (error.code !== "ENOENT") throw error;
					await route.fulfill({ status: 404, body: "" });
				}
			});
			try {
				await page.goto("http://render.test/", { waitUntil: "commit" });
				await page.waitForFunction(() => performance.getEntriesByName("first-contentful-paint").length > 0, null, { timeout: 2000 });
				const state = await page.evaluate(() => ({
					background: getComputedStyle(document.body).backgroundColor,
					direction: getComputedStyle(document.body).direction,
					grid: getComputedStyle(document.querySelector(".hero")).display,
					overflow: document.documentElement.scrollWidth > innerWidth,
					road: getComputedStyle(document.querySelector(".hero-road")).backgroundImage,
					menu: getComputedStyle(document.querySelector(".site-menu")).display,
				}));
				assert.deepEqual(stylesheets, [], "initial rendering must not request a stylesheet");
				assert.ok(fonts.some(url => url.startsWith("https://fonts.gstatic.com/")), "font files should be discovered without a font stylesheet");
				assert.equal(state.background, "rgb(240, 251, 254)");
				assert.equal(state.direction, "rtl");
				assert.equal(state.grid, "grid");
				assert.equal(state.overflow, false);
				assert.equal(state.menu, width < 768 ? "none" : "flex");
				assert.match(state.road, /http:\/\/render\.test\/assets\/images\/road\.jpg/);
				assert.equal(await page.locator("h1").isVisible(), true);
			} finally {
				release();
				await page.close();
			}
		});
	}
});
