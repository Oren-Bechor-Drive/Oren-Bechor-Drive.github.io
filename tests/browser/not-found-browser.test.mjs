import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const notFoundHtml = await readFile(
	new URL("../../404.html", import.meta.url),
	"utf8",
);

async function serveNestedNotFound(route) {
	const url = new URL(route.request().url());
	if (url.pathname === "/missing/lesson/turn") {
		await route.fulfill({
			status: 404,
			contentType: "text/html",
			body: notFoundHtml,
		});
		return;
	}
	await serveRoadMedia(route);
}

test(
	"nested 404 centers one recovery message and stays usable without JavaScript",
	{ timeout: 20_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());

		for (const viewport of [
			{ width: 1440, height: 900 },
			{ width: 390, height: 844 },
			{ width: 320, height: 568, short: true },
		]) {
			const page = await browser.newPage({
				javaScriptEnabled: false,
				viewport,
				reducedMotion: "reduce",
			});
			await page.route("**/*", serveNestedNotFound);
			const response = await page.goto(
				"http://gallery.test/missing/lesson/turn",
			);

			assert.equal(response.status(), 404);
			assert.equal(await page.locator("h1").innerText(), "העמוד לא נמצא");
			assert.equal(await page.locator("main").isVisible(), true);
			assert.equal(await page.locator("main > .error-message").count(), 1);
			assert.equal(await page.locator("main").locator(":scope > *").count(), 1);
			assert.equal(await page.locator("header, footer, .learning-preview").count(), 0);
			assert.equal(
				await page.locator('[data-recovery-action][href="/course/"]').isVisible(),
				true,
			);

			const layout = await page.evaluate(() => {
				const main = document.querySelector("main").getBoundingClientRect();
				const message = document
					.querySelector(".error-message")
					.getBoundingClientRect();
				const code = document.querySelector(".error-code");
				const codeBox = code.getBoundingClientRect();
				const textRange = document.createRange();
				textRange.selectNodeContents(code);
				const codeText = textRange.getBoundingClientRect();
				const codeStyle = getComputedStyle(code);

				return {
					mainCenterX: main.left + main.width / 2,
					mainCenterY: main.top + main.height / 2,
					messageCenterX: message.left + message.width / 2,
					messageCenterY: message.top + message.height / 2,
					messageTop: message.top,
					codeWidth: codeBox.width,
					codeHeight: codeBox.height,
					codeCenterX: codeBox.left + codeBox.width / 2,
					codeCenterY: codeBox.top + codeBox.height / 2,
					textCenterX: codeText.left + codeText.width / 2,
					textCenterY: codeText.top + codeText.height / 2,
					borderStyle: codeStyle.borderStyle,
					borderColor: codeStyle.borderColor,
					documentHeight: document.documentElement.scrollHeight,
				};
			});

			assert.ok(
				Math.abs(layout.messageCenterX - layout.mainCenterX) <= 1,
				"the complete error message is horizontally centered",
			);
			assert.ok(layout.codeWidth >= 176, "the amber 404 ring is enlarged");
			assert.ok(Math.abs(layout.codeWidth - layout.codeHeight) <= 1);
			assert.equal(layout.borderStyle, "solid");
			assert.equal(layout.borderColor, "rgb(246, 219, 120)");
			assert.ok(Math.abs(layout.textCenterX - layout.codeCenterX) <= 2);
			assert.ok(Math.abs(layout.textCenterY - layout.codeCenterY) <= 2);

			if (viewport.short) {
				assert.ok(layout.messageTop >= 24, "short view keeps the start visible");
				assert.ok(
					layout.documentHeight > viewport.height,
					"short view scrolls vertically when the content cannot fit",
				);
			} else {
				assert.ok(
					Math.abs(layout.messageCenterY - layout.mainCenterY) <= 1,
					"the complete error message is vertically centered",
				);
			}

			await page.locator(".skip-link").focus();
			assert.deepEqual(
				await page.evaluate(() => ({
					scrollBehavior: getComputedStyle(document.documentElement)
						.scrollBehavior,
					skipTransitionDuration: getComputedStyle(
						document.querySelector(".skip-link"),
					).transitionDuration,
				})),
				{ scrollBehavior: "auto", skipTransitionDuration: "0s" },
				"reduced motion removes smooth scrolling and skip-link motion",
			);
			assert.equal(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
				true,
				"page has no horizontal overflow",
			);

			await page.keyboard.press("Tab");
			assert.equal(
				await page.evaluate(() => document.activeElement?.getAttribute("href")),
				"/",
				"the primary recovery action follows the skip link in keyboard order",
			);
			assert.equal(
				await page.locator(":focus").evaluate((element) =>
					getComputedStyle(element).outlineStyle,
				),
				"solid",
				"keyboard focus remains visible",
			);
			await page.keyboard.press("Tab");
			assert.equal(
				await page.evaluate(() => document.activeElement?.getAttribute("href")),
				"/course/",
			);
			await page.keyboard.press("Enter");
			await page.waitForURL("http://gallery.test/course/");
			assert.equal(
				await page.locator("h1").innerText(),
				"מה תרצו ללמוד היום?",
			);
			await page.close();
		}
	},
);

test(
	"404 motion introduces the complete message and keeps recovery feedback input-aware",
	{ timeout: 20_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());

		const page = await browser.newPage({
			javaScriptEnabled: false,
			viewport: { width: 1440, height: 900 },
			reducedMotion: "no-preference",
		});
		await page.route("**/*", serveNestedNotFound);
		await page.goto("http://gallery.test/missing/lesson/turn");

		const entrance = await page.locator(".error-message").evaluate((element) => {
			const animation = element.getAnimations()[0];
			const timing = animation.effect.getComputedTiming();
			animation.pause();
			animation.currentTime = 0;
			const startStyle = getComputedStyle(element);
			const startTransform = new DOMMatrixReadOnly(startStyle.transform);
			const start = {
				opacity: Number(startStyle.opacity),
				scale: startTransform.a,
			};
			animation.currentTime = timing.duration;
			const endStyle = getComputedStyle(element);
			const endTransform = new DOMMatrixReadOnly(endStyle.transform);

			return {
				animationName: animation.animationName,
				duration: timing.duration,
				delay: timing.delay,
				easing: getComputedStyle(element).animationTimingFunction,
				start,
				end: {
					opacity: Number(endStyle.opacity),
					scale: endTransform.a,
				},
			};
		});
		assert.deepEqual(entrance, {
			animationName: "error-message-enter",
			duration: 280,
			delay: 0,
			easing: "cubic-bezier(0.23, 1, 0.32, 1)",
			start: { opacity: 0, scale: 0.96 },
			end: { opacity: 1, scale: 1 },
		});
		assert.deepEqual(
			await page.locator(".error-kicker, h1, .error-explanation, .recovery-actions").evaluateAll(
				(elements) =>
					elements.map((element) => ({
						animations: element.getAnimations().length,
						opacity: getComputedStyle(element).opacity,
					})),
			),
			Array.from({ length: 4 }, () => ({ animations: 0, opacity: "1" })),
			"message elements share the wrapper entrance without independent animations",
		);

		const primary = page.locator(".recovery-primary");
		const primaryBox = await primary.boundingBox();
		const pointerClient = await page.context().newCDPSession(page);
		await pointerClient.send("Input.dispatchMouseEvent", {
			type: "mouseMoved",
			x: primaryBox.x + primaryBox.width / 2,
			y: primaryBox.y + primaryBox.height / 2,
		});
		await pointerClient.send("Input.dispatchMouseEvent", {
			type: "mousePressed",
			x: primaryBox.x + primaryBox.width / 2,
			y: primaryBox.y + primaryBox.height / 2,
			button: "left",
			clickCount: 1,
		});
		const pointerPress = await primary.evaluate((element) => {
			const animation = element.getAnimations()[0];
			const timing = animation.effect.getComputedTiming();
			animation.finish();
			const transform = new DOMMatrixReadOnly(
				getComputedStyle(element).transform,
			);
			return {
				property: animation.transitionProperty,
				duration: timing.duration,
				easing: getComputedStyle(element).transitionTimingFunction,
				scale: transform.a,
				y: transform.m42,
			};
		});
		assert.deepEqual(pointerPress, {
			property: "transform",
			duration: 140,
			easing: "cubic-bezier(0.23, 1, 0.32, 1)",
			scale: 0.99,
			y: 1,
		});
		await pointerClient.send("Input.dispatchMouseEvent", {
			type: "mouseReleased",
			x: 0,
			y: 0,
			button: "left",
			clickCount: 1,
		});
		await page.close();

		const keyboardPage = await browser.newPage({
			javaScriptEnabled: false,
			viewport: { width: 1440, height: 900 },
			reducedMotion: "no-preference",
		});
		await keyboardPage.route("**/*", serveNestedNotFound);
		await keyboardPage.goto("http://gallery.test/missing/lesson/turn");
		const keyboardPrimary = keyboardPage.locator(".recovery-primary");
		const keyboardMessage = keyboardPage.locator(".error-message");
		await keyboardMessage.evaluate((element) => {
			const animation = element.getAnimations()[0];
			animation.pause();
			animation.currentTime = 0;
		});
		await keyboardPrimary.evaluate((element) =>
			element.setAttribute("href", "#main-content"),
		);
		await keyboardPage.locator(".skip-link").focus();
		await keyboardPage.keyboard.press("Tab");
		assert.equal(
			await keyboardPrimary.evaluate((element) =>
				element.matches(":focus-visible"),
			),
			true,
		);
		assert.deepEqual(
			await keyboardMessage.evaluate((element) => ({
				animations: element.getAnimations().length,
				opacity: getComputedStyle(element).opacity,
				transform: getComputedStyle(element).transform,
			})),
			{ animations: 1, opacity: "1", transform: "none" },
			"focus settles the entrance without canceling its one-time timeline",
		);
		await keyboardPage.keyboard.down("Enter");
		assert.deepEqual(
			await keyboardPrimary.evaluate((element) => ({
				animations: element.getAnimations().length,
				transform: getComputedStyle(element).transform,
			})),
			{ animations: 0, transform: "none" },
			"keyboard activation stays immediate and spatially still",
		);
		await keyboardPage.close();

		const reducedPage = await browser.newPage({
			javaScriptEnabled: false,
			viewport: { width: 1440, height: 900 },
			reducedMotion: "reduce",
		});
		await reducedPage.route("**/*", serveNestedNotFound);
		await reducedPage.goto("http://gallery.test/missing/lesson/turn");
		const reducedEntrance = await reducedPage
			.locator(".error-message")
			.evaluate((element) => {
				const animation = element.getAnimations()[0];
				const timing = animation.effect.getComputedTiming();
				animation.pause();
				animation.currentTime = 0;
				return {
					animationName: animation.animationName,
					duration: timing.duration,
					opacity: getComputedStyle(element).opacity,
					transform: getComputedStyle(element).transform,
				};
			});
		assert.deepEqual(reducedEntrance, {
			animationName: "error-message-fade",
			duration: 80,
			opacity: "0",
			transform: "none",
		});
		const reducedPrimary = reducedPage.locator(".recovery-primary");
		const reducedBox = await reducedPrimary.boundingBox();
		const reducedClient = await reducedPage.context().newCDPSession(reducedPage);
		await reducedClient.send("Input.dispatchMouseEvent", {
			type: "mouseMoved",
			x: reducedBox.x + reducedBox.width / 2,
			y: reducedBox.y + reducedBox.height / 2,
		});
		await reducedClient.send("Input.dispatchMouseEvent", {
			type: "mousePressed",
			x: reducedBox.x + reducedBox.width / 2,
			y: reducedBox.y + reducedBox.height / 2,
			button: "left",
			clickCount: 1,
		});
		assert.deepEqual(
			await reducedPrimary.evaluate((element) => ({
				animations: element.getAnimations().length,
				transform: getComputedStyle(element).transform,
				transitionDuration: getComputedStyle(element).transitionDuration,
			})),
			{ animations: 0, transform: "none", transitionDuration: "0s" },
		);
		await reducedClient.send("Input.dispatchMouseEvent", {
			type: "mouseReleased",
			x: 0,
			y: 0,
			button: "left",
			clickCount: 1,
		});
		await reducedPage.close();
	},
);
