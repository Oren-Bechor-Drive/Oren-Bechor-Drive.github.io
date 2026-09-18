import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

test(
	"CSP preserves local page features and blocks inline and external scripts",
	{ timeout: 20_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({
			viewport: { width: 390, height: 844 },
			reducedMotion: "reduce",
		});
		const externalRequests = [];
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.route("**/*", async (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== "http://gallery.test")
				externalRequests.push(url.href);
			return serveRoadMedia(route);
		});
		await page.addInitScript(() => {
			window.policyViolations = [];
			document.addEventListener("securitypolicyviolation", (event) => {
				window.policyViolations.push({
					directive: event.effectiveDirective,
					blocked: event.blockedURI,
				});
			});
		});
		await page.goto("http://gallery.test/");
		await page.locator(".menu-toggle").click();
		await page.locator('.site-menu a[href="#about"]').click();
		await page.locator(".topic-select").focus();
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("End");
		await page.keyboard.press("Enter");
		assert.equal(
			await page.locator("[data-topic-panel-title]").innerText(),
			"טעויות נפוצות בטסט",
		);
		await page.locator("footer").scrollIntoViewIfNeeded();
		assert.equal(await page.locator(".footer-social img").count(), 4);
		await page.waitForFunction(() =>
			[...document.querySelectorAll(".footer-social img")].every(
				(image) => image.complete && image.naturalWidth > 0,
			),
		);
		assert.deepEqual(
			await page.evaluate(() => window.policyViolations),
			[],
			"normal features cause no CSP violations",
		);
		assert.deepEqual(errors, []);
		assert.deepEqual(
			externalRequests,
			[],
			"the page and icons need no third-party requests",
		);
		assert.equal(
			await page.locator('meta[name="referrer"]').getAttribute("content"),
			"strict-origin-when-cross-origin",
		);

		await page.evaluate(() => {
			const inline = document.createElement("script");
			inline.textContent = "window.injectedInlineScript = true";
			document.head.append(inline);
			const external = document.createElement("script");
			external.src = "https://untrusted.example/injected.js";
			document.head.append(external);
		});
		await page.waitForFunction(() => window.policyViolations.length === 2);
		const violations = await page.evaluate(() => window.policyViolations);
		assert.ok(
			violations.every(
				(violation) => violation.directive === "script-src-elem",
			),
		);
		assert.ok(
			violations.some((violation) => violation.blocked === "inline"),
		);
		assert.ok(
			violations.some(
				(violation) =>
					violation.blocked ===
					"https://untrusted.example/injected.js",
			),
		);
		assert.equal(
			await page.evaluate(() => window.injectedInlineScript),
			undefined,
		);
		assert.deepEqual(
			externalRequests,
			[],
			"the disallowed script is blocked before network access",
		);
	},
);
