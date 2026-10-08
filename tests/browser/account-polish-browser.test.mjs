import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { startAccountGateway } from "../helpers/account-gateway.mjs";

async function fixture(t) {
	const app = await startAccountGateway();
	const browser = await chromium.launch();
	t.after(async () => { await browser.close(); await app.close(); });
	return { app, browser };
}

async function accountRequest(page, app, route, data) {
	const session = await (await page.request.get(`${app.origin}/api/account/session`)).json();
	const response = await page.request.post(`${app.origin}/api/account/${route}`, {
		headers: { Origin: app.origin, "X-CSRF-Token": session.csrf }, data,
	});
	assert.equal(response.ok(), true, `Fixture ${route} request should succeed`);
}

async function openScreen(page, app, screen) {
	if (screen === "reset") {
		await accountRequest(page, app, "recover", { email: "learner@example.test" });
		const flow = app.provider.calls.findLast(call => call[0] === "recover")[2];
		await page.goto(`${app.origin}/api/account/callback?state=${flow.state}&code=valid-code`);
		await page.waitForURL(/reset.html/);
	} else {
		if (screen === "index") {
			await accountRequest(page, app, "login", { email: "learner@example.test", password: "correct-password" });
		}
		await page.goto(`${app.origin}/account/${screen}.html`);
	}
	if (screen === "index") await page.getByText("learner@example.test", { exact: true }).waitFor();
	else if (screen !== "verify") await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
	await page.evaluate(() => document.fonts.ready);
}

async function assertDocumentFits(page, label) {
	const size = await page.evaluate(() => ({
		width: document.documentElement.scrollWidth,
		height: document.documentElement.scrollHeight,
		viewportWidth: document.documentElement.clientWidth,
		viewportHeight: document.documentElement.clientHeight,
	}));
	assert.ok(size.width <= size.viewportWidth, `${label}: document width ${size.width} exceeds ${size.viewportWidth}`);
	assert.equal(await page.locator(".account-card").evaluate(node => node.scrollHeight <= node.clientHeight + 1), true, `${label}: the document owns vertical scrolling`);
}

async function assertControlsReachable(page, label) {
	const controls = page.locator('main a[href]:visible, main input:visible, main button:visible');
	for (const control of await controls.all()) {
		await control.scrollIntoViewIfNeeded();
		const reachable = await control.evaluate(node => {
			return [...node.getClientRects()].some(bounds => {
				const x = bounds.left + bounds.width / 2;
				const y = bounds.top + bounds.height / 2;
				return bounds.top >= -1 && bounds.bottom <= innerHeight + 1 && bounds.left >= -1 && bounds.right <= innerWidth + 1
					&& node.contains(document.elementFromPoint(x, y));
			});
		});
		assert.equal(reachable, true, `${label}: ${await control.getAttribute("name") || await control.textContent()} must remain reachable`);
	}
}

test("all account screens omit the top bar and kicker", async t => {
	const { app, browser } = await fixture(t);
	const page = await browser.newPage();
	for (const screen of ["login", "register", "recovery", "verify", "reset", "index"]) {
		await t.test(screen, async () => {
			await openScreen(page, app, screen);
			assert.equal(await page.getByRole("banner").count(), 0);
			assert.equal(await page.locator(".account-kicker").count(), 0);
		});
	}
});

test("login recovery link precedes submit visually and in keyboard order", async t => {
	const { app, browser } = await fixture(t);
	const page = await browser.newPage();
	await openScreen(page, app, "login");
	const recovery = page.getByRole("link", { name: "שכחתם את הסיסמה?" });
	const submit = page.getByRole("button", { name: "כניסה לחשבון", exact: true });
	assert.ok(await recovery.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('button[type="submit"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
	const linkBounds = await recovery.boundingBox();
	const submitBounds = await submit.boundingBox();
	assert.ok(linkBounds.y + linkBounds.height <= submitBounds.y);
	await recovery.focus();
	await page.keyboard.press("Tab");
	assert.equal(await submit.evaluate(node => node === document.activeElement), true);
});

test("Google sign-in uses a rendered decorative icon without a text G", async t => {
	const { app, browser } = await fixture(t);
	const page = await browser.newPage();
	for (const screen of ["login", "register"]) {
		await openScreen(page, app, screen);
		const icon = page.locator(".account-google-mark");
		assert.equal((await icon.textContent()).trim(), "");
		assert.equal(await icon.getAttribute("aria-hidden"), "true");
		assert.ok(await page.getByRole("button", { name: "המשך עם Google", exact: true }).isVisible());
		const style = await icon.evaluate(node => ({ mask: getComputedStyle(node).maskImage, width: node.clientWidth, height: node.clientHeight }));
		assert.notEqual(style.mask, "none");
		assert.ok(style.width > 0 && style.height > 0);
		const iconUrl = style.mask.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
		assert.ok(iconUrl, "Google mask must reference a loadable icon");
		assert.ok((await page.request.get(iconUrl)).ok());
	}
});

test("password eye controls switch state without visible text and preserve accessible names", async t => {
	const { app, browser } = await fixture(t);
	const page = await browser.newPage();
	for (const screen of ["login", "register", "reset"]) {
		await openScreen(page, app, screen);
		const password = page.locator("#password");
		const toggle = page.getByRole("button", { name: "הצגת הסיסמה", exact: true });
		await password.fill("correct-password");
		assert.equal((await toggle.textContent()).trim(), "");
		assert.equal(await toggle.getAttribute("aria-pressed"), "false");
		const showMask = await toggle.evaluate(node => getComputedStyle(node, "::before").maskImage);
		assert.notEqual(showMask, "none");
		await toggle.click();
		const hide = page.getByRole("button", { name: "הסתרת הסיסמה", exact: true });
		assert.equal(await password.getAttribute("type"), "text");
		assert.equal(await hide.getAttribute("aria-pressed"), "true");
		assert.equal((await hide.textContent()).trim(), "");
		const hideMask = await hide.evaluate(node => getComputedStyle(node, "::before").maskImage);
		assert.notEqual(hideMask, "none");
		assert.notEqual(hideMask, showMask, "The eye icon must change when the password is revealed");
		await hide.click();
		assert.equal(await password.getAttribute("type"), "password");
		assert.equal(await password.inputValue(), "correct-password");
		assert.equal(await toggle.getAttribute("aria-pressed"), "false");
	}
});

test("account fields retain native pointer editing and show outlines only for keyboard navigation", async t => {
	const { app, browser } = await fixture(t);
	const page = await browser.newPage();
	const outline = input => input.evaluate(node => getComputedStyle(node).outlineStyle);
	for (const screen of ["login", "register", "recovery", "reset"]) {
		await openScreen(page, app, screen);
		assert.equal(await page.evaluate(() => document.activeElement.tagName), "BODY", `${screen}: fields should not autofocus`);
		const input = page.locator("input").first();
		await input.click();
		assert.equal(await input.evaluate(node => node === document.activeElement), true);
		assert.equal(await outline(input), "none", `${screen}: pointer focus should not display an outline`);
		await page.keyboard.type("learner");
		assert.equal(await input.inputValue(), "learner");
		assert.equal(await outline(input), "none", `${screen}: typing should not enable a navigation outline`);
		await page.keyboard.press("Tab");
		await page.keyboard.press("Shift+Tab");
		assert.equal(await input.evaluate(node => node === document.activeElement), true);
		assert.notEqual(await outline(input), "none", `${screen}: keyboard focus must remain visible`);
		const label = page.locator(`label[for="${await input.getAttribute("id")}"]`);
		await label.click();
		assert.equal(await input.evaluate(node => node === document.activeElement), true);
		assert.equal(await outline(input), "none", `${screen}: clicking a label should preserve pointer focus behavior`);
		if (screen !== "recovery") {
			await page.getByRole("button", { name: "הצגת הסיסמה", exact: true }).click();
			assert.equal(await outline(page.locator("#password")), "none");
		}
	}
});

test("account documents avoid horizontal overflow and keep controls reachable at desktop and short mobile sizes", async t => {
	const { app, browser } = await fixture(t);
	for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 320, height: 568 }]) {
		const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
		for (const screen of ["login", "register", "recovery", "verify", "reset", "index"]) {
			await t.test(`${screen} at ${viewport.width}x${viewport.height}`, async () => {
				await openScreen(page, app, screen);
				await assertDocumentFits(page, screen);
				await assertControlsReachable(page, screen);
				await assertDocumentFits(page, screen);
			});
		}
		await page.close();
	}
});

test("short account viewports retain keyboard access while the document scrolls", async t => {
	const { app, browser } = await fixture(t);
	const page = await browser.newPage({ viewport: { width: 320, height: 284 } });
	await openScreen(page, app, "register");
	await assertDocumentFits(page, "short registration");
	await assertControlsReachable(page, "short registration");
	await page.getByLabel("כתובת אימייל").focus();
	await page.keyboard.press("Tab");
	assert.equal(await page.locator("#password").evaluate(node => node === document.activeElement), true);
	await page.keyboard.press("Tab");
	assert.equal(await page.getByRole("button", { name: "הצגת הסיסמה" }).evaluate(node => node === document.activeElement), true);
});

test("account navigation stays reachable without JavaScript or with a blocked entry module", async t => {
	const { app, browser } = await fixture(t);
	for (const javaScriptEnabled of [false, true]) {
		const page = await browser.newPage({ javaScriptEnabled, viewport: { width: 320, height: 568 } });
		if (javaScriptEnabled) await page.route("**/account/account.js", route => route.abort());
		await page.goto(`${app.origin}/account/login.html`);
		await assertDocumentFits(page, "baseline login");
		await assertControlsReachable(page, "baseline login");
		await page.getByRole("link", { name: "שכחתם את הסיסמה?" }).click();
		await page.waitForURL(/recovery.html/);
		await page.getByRole("link", { name: "חזרה לכניסה לחשבון" }).click();
		await page.waitForURL(/login.html/);
		await page.getByRole("link", { name: "יצירת חשבון חינמי" }).click();
		await page.waitForURL(/register.html/);
		await assertDocumentFits(page, "baseline registration");
		await assertControlsReachable(page, "baseline registration");
		await page.getByRole("link", { name: "חזרה לדף הבית" }).click();
		await page.waitForURL(`${app.origin}/index.html`);
		await page.close();
	}
});

test("primary account links keep shared button geometry and readable text inside link containers", async t => {
	const { app, browser } = await fixture(t);
	for (const screen of ["index", "reset", "learning", "reader"]) {
		const page = await browser.newPage();
		if (screen === "index") await openScreen(page, app, screen);
		else await page.goto(`${app.origin}/account/${screen}.html${screen === "reader" ? "?section=00000000-0000-0000-0000-000000000000&access=free" : ""}`);
		const link = page.locator("a.btn-primary:visible").first();
		await link.waitFor();
		const result = await link.evaluate(node => {
			const probe = document.createElement("button");
			probe.className = "btn btn-primary";
			document.body.append(probe);
			const style = getComputedStyle(node), baseline = getComputedStyle(probe);
			const properties = ["minHeight", "paddingTop", "paddingRight", "fontSize", "fontWeight", "lineHeight", "gap"];
			const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
				.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
				.reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
			const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
			const result = { actual: properties.map(property => style[property]), expected: properties.map(property => baseline[property]), contrast: (values[0] + 0.05) / (values[1] + 0.05), height: node.getBoundingClientRect().height };
			probe.remove();
			return result;
		});
		assert.deepEqual(result.actual, result.expected, `${screen}: account styles must preserve shared control geometry`);
		assert.ok(result.contrast >= 4.5, `${screen}: primary action text must pass normal-text contrast`);
		assert.ok(result.height >= 44);
		await page.close();
	}
});
