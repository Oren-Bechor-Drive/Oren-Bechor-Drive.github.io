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

test("protected catalog titles and lesson bodies render markup as text", async t => {
	const { startAccountGateway, accountProvider } = await import("../helpers/account-gateway.mjs");
	const section = "11111111-1111-4111-8111-111111111111";
	const version = "22222222-2222-4222-8222-222222222222";
	const markup = '<img src="/injected-image" onerror="window.injected=true"><script>window.injected=true</script>';
	const provider = accountProvider();
	provider.myLearning = async () => ({ topics: [], paidAccess: false });
	provider.readSections = async () => ({ sections: [{ id: section, accessLevel: "free", title: markup }] });
	provider.readPosition = async () => null;
	provider.readSection = async () => ({ id: version, section_id: section, access_level: "free", revision: 1, body_text: markup });
	const app = await startAccountGateway({ provider });
	t.after(app.close);
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage();
	const injectedRequests = [];
	page.on("request", request => { if (request.url().endsWith("/injected-image")) injectedRequests.push(request.url()); });
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill("markup@example.test");
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	await page.goto(app.origin + "/account/learning.html");
	const link = page.locator("[data-sections] a");
	await link.waitFor();
	assert.equal(await link.textContent(), markup + " - הגדרה");
	assert.equal(await link.locator("img, script").count(), 0);
	await link.click();
	await page.locator("[data-reading]").waitFor();
	assert.equal(await page.locator("#reader-heading").textContent(), markup);
	assert.equal(await page.locator("[data-reading-body]").textContent(), markup);
	assert.equal(await page.locator("#reader-heading img, #reader-heading script, [data-reading-body] img, [data-reading-body] script").count(), 0);
	assert.equal(await page.evaluate(() => window.injected), undefined);
	assert.deepEqual(injectedRequests, []);
});
