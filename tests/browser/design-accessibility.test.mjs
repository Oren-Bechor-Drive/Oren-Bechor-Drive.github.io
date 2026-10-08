import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { startAccountGateway } from "../helpers/account-gateway.mjs";
import { setTimeout } from "node:timers/promises";

async function browserFixture(t) {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	return browser;
}

async function staticPage(browser, path, options = {}) {
	const page = await browser.newPage({ reducedMotion: "reduce", ...options });
	await page.route("**/*", serveRoadMedia);
	await page.goto(`http://gallery.test${path}`);
	return page;
}

async function assertVisibleMask(locator, pseudo = null) {
	assert.equal(await locator.isVisible(), true, "the mask belongs to an available visible control");
	const state = await locator.evaluate((node, pseudo) => {
		const style = getComputedStyle(node, pseudo);
		const probe = document.createElement("span");
		probe.style.color = "CanvasText";
		document.body.append(probe);
		const canvasText = getComputedStyle(probe).color;
		probe.remove();
		return {
			mask: style.maskImage,
			background: style.backgroundColor,
			adjust: style.forcedColorAdjust,
			canvasText,
		};
	}, pseudo);
	assert.notEqual(state.mask, "none", "the decorative icon retains its mask");
	assert.equal(state.adjust, "none", "the mask fill survives forced background replacement");
	assert.equal(state.background, state.canvasText, "the mask uses the user's system text color");
}

async function assertVisibleBorder(locator) {
	assert.equal(await locator.isVisible(), true, "the bounded control is available and visible");
	const border = await locator.evaluate(node => {
		const style = getComputedStyle(node);
		return { width: parseFloat(style.borderTopWidth), style: style.borderTopStyle, color: style.borderTopColor };
	});
	assert.ok(border.width >= 1, "the control remains bounded when shadows disappear");
	assert.equal(border.style, "solid");
	assert.notEqual(border.color, "rgba(0, 0, 0, 0)");
}

test("forced colors preserve home masks, action boundaries and keyboard FAQ focus", async t => {
	const browser = await browserFixture(t);
	for (const width of [1440, 390]) {
		for (const javaScriptEnabled of [true, false]) {
			const page = await staticPage(browser, "/", {
				viewport: { width, height: 844 }, forcedColors: "active", javaScriptEnabled,
			});
			await assertVisibleBorder(page.locator(".hero-actions .button").first());
			const navigationAction = page.locator(".nav-action").first();
			const hiddenNavigation = !await navigationAction.isVisible();
			if (hiddenNavigation) await page.locator("[data-menu-toggle]").click();
			await assertVisibleBorder(navigationAction);
			if (hiddenNavigation) await page.locator("[data-menu-toggle]").click();
			const summary = page.locator(".faq-item summary").first();
			await assertVisibleMask(summary, "::after");
			await summary.click();
			assert.equal(await summary.evaluate(node => getComputedStyle(node).outlineStyle), "none");
			await page.keyboard.press("Shift+Tab");
			await page.keyboard.press("Tab");
			// Script-disabled contexts cannot run the page callbacks used by waitForFunction.
			for (let attempt = 0; attempt < 20; attempt++) {
				if (await summary.evaluate(node => getComputedStyle(node).outlineOffset === "-3px")) break;
				await setTimeout(25);
			}
			const focused = await summary.evaluate(node => ({
				active: document.activeElement === node,
				outline: getComputedStyle(node).outlineStyle,
				offset: getComputedStyle(node).outlineOffset,
				shadow: getComputedStyle(node).boxShadow,
			}));
			assert.equal(focused.active, true);
			assert.equal(focused.outline, "solid");
			assert.equal(focused.offset, "-3px", "the system focus outline stays inside the clipped FAQ card");
			assert.equal(focused.shadow, "none");
			if (width === 390) {
				assert.equal(await page.locator(".topic-select").count(), 0);
				assert.equal(await page.locator("[data-topic-summaries] h3 a:visible").count(), 10);
			}
			await page.close();
		}
	}
});

test("forced colors preserve course, quiz, account and recovery controls", async t => {
	const browser = await browserFixture(t);
	const app = await startAccountGateway();
	t.after(() => app.close());
	for (const width of [1440, 390]) {
		const options = { viewport: { width, height: 844 }, forcedColors: "active" };
		const course = await staticPage(browser, "/course/", options);
		assert.equal(await course.locator(".course-profile").isVisible(), false);
		await assertVisibleMask(course.locator(".search-icon"));
		if (width === 390) await assertVisibleMask(course.locator(".subject-chevron").first());
		else await assertVisibleMask(course.locator('.topic-tab[aria-selected="true"]'), "::after");
		await course.locator("#topic-search").fill("zzzz");
		await assertVisibleBorder(course.locator(".clear-search"));
		await course.close();
		const lesson = await staticPage(browser, "/course/learning-foundations/", options);
		await assertVisibleMask(lesson.locator(".direction-icon").first());
		await assertVisibleBorder(lesson.locator(".course-button").first());
		await lesson.close();
		const quiz = await staticPage(browser, "/course/learning-foundations/quiz/", options);
		await assertVisibleMask(quiz.locator(".question-trigger"), "::after");
		await assertVisibleBorder(quiz.locator(".question-trigger"));
		await quiz.close();
		const account = await staticPage(browser, "/account/login.html", options);
		await assertVisibleMask(account.locator(".account-back"), "::before");
		await assertVisibleMask(account.locator(".password-toggle"), "::before");
		assert.equal(await account.locator("[data-google-controls]").isVisible(), false);
		await assertVisibleBorder(account.locator(".password-toggle"));
		await assertVisibleBorder(account.locator(".account-action:visible").first());
		await account.close();
		const liveCourse = await browser.newPage({ reducedMotion: "reduce", ...options });
		await liveCourse.goto(`${app.origin}/course/`);
		await liveCourse.getByRole("link", { name: "כניסה לחשבון" }).waitFor();
		await assertVisibleMask(liveCourse.locator(".course-profile-icon"));
		await liveCourse.close();
		const liveAccount = await browser.newPage({ reducedMotion: "reduce", ...options });
		await liveAccount.goto(`${app.origin}/account/login.html`);
		await liveAccount.locator("[data-google]:enabled").waitFor();
		await assertVisibleMask(liveAccount.locator(".account-google-mark"));
		await assertVisibleBorder(liveAccount.locator("[data-google]"));
		await liveAccount.close();
		const recovery = await staticPage(browser, "/404.html", options);
		for (const link of await recovery.locator(".recovery-actions a").all()) {
			await assertVisibleBorder(link);
		}
		await recovery.close();
	}
});

test("account errors preserve pointer editing and show focus after keyboard navigation", async t => {
	const app = await startAccountGateway();
	t.after(() => app.close());
	const browser = await browserFixture(t);
	for (const width of [1440, 390]) {
		for (const forcedColors of ["none", "active"]) {
			const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width === 390, forcedColors });
			await page.goto(`${app.origin}/account/login.html`);
			await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
			const email = page.getByLabel("כתובת אימייל");
			const password = page.locator('input[name="password"]');
			const alert = page.locator('.account-feedback[role="alert"]');
			await email[width === 390 ? "tap" : "click"]();
			await email.fill("learner@example.test");
			await password[width === 390 ? "tap" : "click"]();
			await password.fill("incorrect-password");
			assert.equal(await password.evaluate(node => getComputedStyle(node).outlineStyle), "none");
			await page.keyboard.press("Enter");
			await page.waitForFunction(() => document.activeElement.matches('.account-feedback[role="alert"]'));
			assert.equal(await alert.evaluate(node => getComputedStyle(node).outlineStyle), "none", "Enter from a pointer-focused field preserves pointer mode on the error target");
			await password[width === 390 ? "tap" : "click"]();
			await page.keyboard.press("Shift+Tab");
			await page.keyboard.press("Tab");
			assert.equal(await password.evaluate(node => document.activeElement === node), true);
			assert.equal(await password.evaluate(node => getComputedStyle(node).outlineStyle), "solid");
			await page.keyboard.press("Enter");
			await page.waitForFunction(() => document.activeElement.matches('.account-feedback[role="alert"]'));
			assert.equal(await alert.evaluate(node => getComputedStyle(node).outlineStyle), "solid", "keyboard submission keeps a visible error focus indicator");
			await password[width === 390 ? "tap" : "click"]();
			assert.equal(await password.evaluate(node => getComputedStyle(node).outlineStyle), "none");
			await page.close();
		}
	}
});

test("mobile footer links have real 44px hit areas and compact Hebrew copy stays legible", async t => {
	const browser = await browserFixture(t);
	for (const javaScriptEnabled of [true, false]) {
		for (const path of ["/course/", "/course/learning-foundations/", "/course/learning-foundations/quiz/"]) {
			const page = await staticPage(browser, path, { viewport: { width: 390, height: 844 }, javaScriptEnabled });
			const links = page.locator(".course-footer a");
			assert.ok(await links.count() > 0);
			for (const link of await links.all()) {
				await link.scrollIntoViewIfNeeded();
				const hit = await link.evaluate(node => {
					const rect = node.getBoundingClientRect();
					return { height: rect.height, bottomHit: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.bottom - 3)) };
				});
				assert.ok(hit.height >= 44, `${path}: footer hit height is ${hit.height}px`);
				assert.equal(hit.bottomHit, true, `${path}: the lower padding belongs to the link hit area`);
			}
			await page.close();
		}
	}
	const home = await staticPage(browser, "/", { viewport: { width: 1440, height: 900 } });
	const tracking = await home.locator(".instructor-title-line").evaluate(node => ({ tracking: parseFloat(getComputedStyle(node).letterSpacing), size: parseFloat(getComputedStyle(node).fontSize) }));
	assert.ok(Math.abs(tracking.tracking) <= tracking.size * 0.011, "the subtitle uses tracking based on its own type size");
	await home.close();
	const account = await staticPage(browser, "/account/login.html");
	const contrast = await account.locator(".account-footer").evaluate(node => {
		const luminance = color => {
			const linear = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
				const value = channel / 255;
				return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
		};
		return (luminance(getComputedStyle(document.body).backgroundColor) + 0.05) / (luminance(getComputedStyle(node).color) + 0.05);
	});
	assert.ok(contrast >= 4.5, `account footer contrast is ${contrast.toFixed(2)}:1`);
	await account.close();
});

async function assertControlBorderContrast(locator, name) {
	assert.equal(await locator.isVisible(), true, `${name}: the control is visible`);
	const state = await locator.evaluate((node) => {
		const channels = (color) => color.match(/[\d.]+/g).map(Number);
		const composite = (front, back) => {
			const alpha = front[3] ?? 1;
			return front.slice(0, 3).map((value, index) => value * alpha + back[index] * (1 - alpha));
		};
		const luminance = (color) => {
			const linear = color.map((channel) => {
				const value = channel / 255;
				return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
		};
		const contrast = (first, second) => {
			const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
			return (values[0] + 0.05) / (values[1] + 0.05);
		};
		const ancestors = [];
		for (let parent = node.parentElement; parent; parent = parent.parentElement) ancestors.unshift(parent);
		const outside = ancestors.reduce(
			(background, ancestor) => composite(channels(getComputedStyle(ancestor).backgroundColor), background),
			[255, 255, 255],
		);
		const style = getComputedStyle(node);
		const inside = composite(channels(style.backgroundColor), outside);
		const border = composite(channels(style.borderTopColor), outside);
		return {
			width: parseFloat(style.borderTopWidth),
			style: style.borderTopStyle,
			contrast: Math.min(contrast(border, outside), contrast(border, inside)),
		};
	});
	assert.ok(state.width >= 1 && state.style === "solid", `${name}: a real border defines the control`);
	assert.ok(state.contrast >= 3, `${name}: border contrast is ${state.contrast.toFixed(2)}:1`);
}

test("search, quiz choices and account control borders retain 3:1 contrast including hover", async (t) => {
	const browser = await browserFixture(t);
	const course = await staticPage(browser, "/course/");
	await assertControlBorderContrast(course.locator(".search-field"), "library search");
	await course.locator("#topic-search").fill("zzzz");
	await assertControlBorderContrast(course.locator(".search-field"), "search with an active query");
	await course.close();
	const quiz = await staticPage(browser, "/course/learning-foundations/quiz/");
	await assertControlBorderContrast(quiz.locator(".question-trigger"), "question navigation");
	const answer = quiz.locator(".quiz-question:visible .quiz-answers label").first();
	await assertControlBorderContrast(answer, "quiz answer");
	await answer.hover();
	await answer.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
	await assertControlBorderContrast(answer, "hovered quiz answer");
	await quiz.close();
	const app = await startAccountGateway();
	t.after(() => app.close());
	const account = await browser.newPage({ reducedMotion: "reduce" });
	await account.goto(`${app.origin}/account/login.html`);
	await account.locator("[data-google]:enabled").waitFor();
	for (const selector of ['input[name="email"]', 'input[name="password"]', "[data-google]"]) {
		const control = account.locator(selector);
		await assertControlBorderContrast(control, selector);
		await control.hover();
		await control.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
		await assertControlBorderContrast(control, `hovered ${selector}`);
	}
	await account.close();
});

test("320px pages reflow with 200 percent browser root text", async (t) => {
	const browser = await browserFixture(t);
	for (const javaScriptEnabled of [true, false]) {
		for (const [path, textSelector] of [
			["/", ".hero-copy > p"],
			["/course/", ".library-intro p"],
			["/course/learning-foundations/", ".lesson-intro p"],
			["/course/learning-foundations/quiz/", ".lesson-intro > p"],
			["/account/login.html", ".account-intro"],
			["/account/register.html", ".account-intro"],
			["/account/recovery.html", ".account-intro"],
			["/404.html", ".error-explanation"],
		]) {
			await t.test(`${path} with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, async () => {
				const page = await staticPage(browser, path, {
					viewport: { width: 320, height: 900 }, javaScriptEnabled,
				});
				const originalSize = await page.locator(textSelector).first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
				await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
				const enlargedSize = await page.locator(textSelector).first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
				assert.ok(enlargedSize >= originalSize * 1.95, `${path}: meaningful text responds to 200 percent browser root sizing`);
				const reflow = await page.evaluate(() => {
					const clipped = [...document.querySelectorAll("h1, h2, h3, p, summary, a, label, button")]
						.filter((node) => !node.closest('[hidden], [aria-hidden="true"], [data-road-carousel], .skip-link, .visually-hidden'))
						.filter((node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden")
						.flatMap((node) => {
							const clone = node.cloneNode(true);
							for (const hidden of clone.querySelectorAll('.visually-hidden, [aria-hidden="true"]')) hidden.remove();
							if (!clone.textContent.trim()) return [];
							const range = document.createRange();
							range.selectNodeContents(node);
							const outside = [...range.getClientRects()].some((rect) => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1));
							return outside ? [node.textContent.trim().slice(0, 80)] : [];
						});
					return { overflow: document.documentElement.scrollWidth > innerWidth, clipped };
				});
				assert.equal(reflow.overflow, false, `${path}: larger text does not cause horizontal page scrolling`);
				assert.deepEqual(reflow.clipped, [], `${path}: meaningful text remains inside the viewport`);
				await page.close();
			});
		}
	}
});
