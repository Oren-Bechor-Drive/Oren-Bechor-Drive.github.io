import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const disclosures = [
	{ path: "/#faq", selector: ".faq-item", simultaneous: 2 },
	{ path: "/course/", selector: ".subject", simultaneous: 1 },
];

test("completed details transitions release their height and retain each page's opening policy", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const { path, selector, simultaneous } of disclosures) {
		const page = await browser.newPage({
			viewport: { width: 390, height: 844 },
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto(`http://gallery.test${path}`);
		const items = page.locator(selector);
		const toggle = (index) =>
			items.nth(index).locator("summary").dispatchEvent("click", { detail: 1 });
		const waitForCompletion = () =>
			page.waitForFunction(
				(selector) =>
					[...document.querySelectorAll(selector)].every(
						(item) => item.style.height === "" && item.style.overflow === "",
					),
				selector,
			);
		await toggle(0);
		await toggle(1);
		await waitForCompletion();
		assert.equal(await page.locator(`${selector}[open]`).count(), simultaneous);
		await toggle(1);
		await waitForCompletion();
		assert.equal(await items.nth(1).getAttribute("open"), null);
		await page.close();
	}
});

test("blocking the shared details module preserves the native disclosures", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const { path, selector, simultaneous } of disclosures) {
		for (const width of [1440, 390]) {
			const page = await browser.newPage({ viewport: { width, height: 844 } });
			await page.route("**/*", (route) =>
				new URL(route.request().url()).pathname === "/js/details-motion.js"
					? route.abort()
					: serveRoadMedia(route),
			);
			await page.goto(`http://gallery.test${path}`);
			const items = page.locator(selector);
			for (const index of [0, 1]) {
				await items.nth(index).locator("summary").focus();
				await page.keyboard.press("Enter");
			}
			assert.equal(await page.locator(`${selector}[open]`).count(), simultaneous);
			await page.keyboard.press("Enter");
			assert.equal(await items.nth(1).getAttribute("open"), null);
			await page.close();
		}
	}
});

test("native details remain usable when height animation is unavailable", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const { path, selector, simultaneous } of disclosures) {
		const page = await browser.newPage({
			viewport: { width: 390, height: 844 },
		});
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.addInitScript(() => {
			Element.prototype.animate = undefined;
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto(`http://gallery.test${path}`);
		const items = page.locator(selector);
		const toggle = (index) =>
			items.nth(index).locator("summary").dispatchEvent("click", { detail: 1 });
		await toggle(0);
		await toggle(1);
		assert.equal(await page.locator(`${selector}[open]`).count(), simultaneous);
		await toggle(1);
		assert.equal(await items.nth(1).getAttribute("open"), null);
		assert.deepEqual(
			await items.evaluateAll((elements) =>
				elements.map((item) => [item.style.height, item.style.overflow]),
			),
			Array.from({ length: await items.count() }, () => ["", ""]),
			"instant toggles leave no clipping or fixed height",
		);
		assert.deepEqual(errors, []);
		await page.close();
	}
});
