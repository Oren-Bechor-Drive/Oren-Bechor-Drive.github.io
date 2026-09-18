import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const { lessons, issues } = await readLearningContent(process.cwd());

const topicControl = (page, id) =>
	page.locator(
		`.topic-tab[data-topic="${id}"]:visible, #${id} > summary:visible`,
	);
const topicOutline = (page, id) =>
	page.locator(
		`.topic-reader[data-subject="${id}"] .subject-outline:visible, #${id} .subject-outline:visible`,
	);
const visibleTopics = (page) =>
	page.locator(".topic-tab:visible, .subject:visible");

test("desktop topic motion follows pointer input and settles for keyboard and reduced motion", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 1440, height: 900 },
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/");
	// Slow only the observation window, so loaded CI machines can sample mid-transition.
	await page.evaluate(() => {
		const sheet = [...document.styleSheets].find((sheet) =>
			sheet.href.endsWith("/course/css/course.css"),
		);
		sheet.insertRule(
			'.topic-reader[data-motion="true"] > * { transition-duration: 10s; }',
			sheet.cssRules.length,
		);
	});
	const sample = () =>
		page.evaluate(() => {
			return Number(
				getComputedStyle(document.querySelector(".topic-reader > h3"))
					.opacity,
			);
		});
	const frames = () =>
		page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);
	await topicControl(page, "signs-and-speed").click();
	await frames();
	assert.ok((await sample()) < 1, "pointer selection enters gradually");
	await topicControl(page, "right-of-way").dispatchEvent("click", {
		detail: 1,
	});
	assert.equal(
		await page
			.locator('.topic-reader[data-subject="right-of-way"]')
			.count(),
		1,
		"rapid selection immediately updates to the latest topic",
	);
	await page.keyboard.press("Tab");
	await frames();
	assert.equal(
		await sample(),
		1,
		"keyboard interaction settles active motion",
	);
	await topicControl(page, "roundabouts").focus();
	await page.keyboard.press("Enter");
	await frames();
	assert.equal(await sample(), 1, "keyboard selection has no entrance delay");
	await topicControl(page, "overtaking").click();
	await page.emulateMedia({ reducedMotion: "reduce" });
	await frames();
	assert.equal(
		await sample(),
		1,
		"enabling reduced motion settles an active transition",
	);
	await topicControl(page, "right-of-way").click();
	await frames();
	assert.equal(
		await sample(),
		1,
		"reduced motion leaves subsequent selections immediately readable",
	);
	assert.equal(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
		true,
	);
	await page.close();
});

test("mobile cards animate their full height in both directions and reverse without jumping", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({
		viewport: { width: 390, height: 900 },
		hasTouch: true,
	});
	await page.route("**/*", serveRoadMedia);
	await page.goto("http://gallery.test/course/");
	const sampleToggle = (id) =>
		page.locator(`#${id}`).evaluate((subject) => {
			const before = subject.getBoundingClientRect().height;
			subject
				.querySelector("summary")
				.dispatchEvent(
					new MouseEvent("click", {
						bubbles: true,
						cancelable: true,
						detail: 1,
					}),
				);
			const animation = subject.getAnimations()[0];
			animation.pause();
			animation.currentTime = 0;
			const start = subject.getBoundingClientRect().height;
			animation.currentTime = 50;
			return {
				before,
				start,
				middle: subject.getBoundingClientRect().height,
				open: subject.open,
			};
		});
	const opening = await sampleToggle("learning-foundations");
	assert.ok(
		Math.abs(opening.before - opening.start) < 1,
		"description does not jump into the summary before the card grows",
	);
	assert.ok(
		opening.middle > opening.start,
		"opening increases the entire card height",
	);
	const closing = await sampleToggle("learning-foundations");
	assert.ok(
		Math.abs(closing.before - closing.start) < 1,
		"rapid reversal starts from the visible height",
	);
	assert.ok(
		closing.middle < closing.start,
		"closing reduces the entire card height",
	);
	assert.equal(
		closing.open,
		true,
		"closing content stays rendered until the animation finishes",
	);
	await sampleToggle("learning-foundations");
	await sampleToggle("right-of-way");
	await page.keyboard.press("Tab");
	assert.deepEqual(
		await page
			.locator(".subject[open]")
			.evaluateAll((elements) => elements.map((el) => el.id)),
		["right-of-way"],
		"keyboard input settles both the outgoing and incoming card",
	);
	await topicControl(page, "roundabouts").focus();
	await page.keyboard.press("Enter");
	assert.equal(
		await page
			.locator(".subject")
			.evaluateAll(
				(elements) =>
					elements.flatMap((el) => el.getAnimations()).length,
			),
		0,
		"keyboard selections are immediate",
	);
	await sampleToggle("signs-and-speed");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.waitForFunction(() =>
		[...document.querySelectorAll(".subject")].every(
			(subject) => subject.getAnimations().length === 0,
		),
	);
	await topicControl(page, "signs-and-speed").tap();
	assert.equal(
		await page.locator(".subject[open]").count(),
		0,
		"reduced motion closes immediately",
	);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await topicControl(page, "learning-foundations").tap();
	await page.waitForFunction(
		() =>
			document.querySelector("#learning-foundations").style.height === "",
	);
	await topicControl(page, "learning-foundations").tap();
	await page.waitForFunction(
		() => !document.querySelector("#learning-foundations").open,
	);
	assert.equal(
		await page
			.locator("#learning-foundations")
			.evaluate((el) => el.style.height),
		"",
		"finished animations release fixed sizing",
	);
});

test("library learning content has contextual validation diagnostics", () =>
	assert.deepEqual(issues, []));

test("course preview preserves the welcome page's seven topic descriptions", async () => {
	const read = async (path) =>
		new JSDOM(
			await readFile(new URL(`../../${path}`, import.meta.url), "utf8"),
		).window.document;
	const welcome = await read("index.html");
	const course = await read("course/index.html");
	const descriptions = [
		...welcome.querySelectorAll("[data-topic-summaries] section"),
	].map((section) => [
		section.querySelector("h3").textContent,
		section.querySelector("p").textContent,
	]);
	const summaries = [...course.querySelectorAll(".subject summary")].map(
		(summary) => [
			summary.querySelector("h3").textContent,
			summary.querySelector("p").textContent,
		],
	);
	for (const description of descriptions)
		assert.deepEqual(
			summaries.find(([title]) => title === description[0]),
			description,
		);
	assert.equal(summaries.length, 9);
	assert.equal(
		course.querySelector("[data-search-status]").textContent,
		"9 נושאים לבחירה",
	);
	assert.equal(course.documentElement.lang, "he");
	assert.equal(course.documentElement.dir, "rtl");
	assert.equal(
		course.querySelector('meta[name="robots"]').content,
		"noindex",
	);
	assert.match(
		course.querySelector(".course-preview-note").textContent,
		/עדיין אינם זמינים/,
	);
});

test("course headers reserve blank profile space and only link the brand to home", async () => {
	for (const file of [
		"course/index.html",
		...lessons.map((lesson) => lesson.file),
	]) {
		const document = new JSDOM(
			await readFile(new URL(`../../${file}`, import.meta.url), "utf8"),
		).window.document;
		const header = document.querySelector(".course-header");
		assert.equal(header.querySelectorAll("a").length, 1);
		assert.equal(
			new URL(
				header.querySelector("a").getAttribute("href"),
				`https://site.test/${file}`,
			).pathname,
			"/index.html",
		);
		const profile = header.querySelector(".course-profile-slot");
		assert.equal(profile.getAttribute("aria-hidden"), "true");
		assert.equal(profile.textContent.trim(), "");
		assert.equal(profile.querySelector("button, a, [tabindex]"), null);
	}
});

for (const mode of ["enhanced", "disabled", "blocked module"]) {
	test(
		`topics stay in a fixed desktop list or compact accordion with ${mode} JavaScript`,
		{ timeout: 20_000 },
		async (t) => {
			const browser = await chromium.launch();
			t.after(() => browser.close());
			for (const width of [1440, 1024, 768, 390, 320]) {
				const page = await browser.newPage({
					viewport: { width, height: 900 },
					javaScriptEnabled: mode !== "disabled",
					reducedMotion: "reduce",
				});
				await page.route("**/*", (route) =>
					mode === "blocked module" &&
					route
						.request()
						.url()
						.endsWith("/course/js/course-library.js")
						? route.abort()
						: serveRoadMedia(route),
				);
				await page.goto("http://gallery.test/course/");
				const desktop = mode === "enhanced" && width >= 900;
				if (desktop) await page.getByRole("tablist").waitFor();
				const controls = desktop
					? page.locator(".topic-tab")
					: page.locator(".subject summary");
				const positions = await controls.evaluateAll((elements) =>
					elements.map((el) => ({
						top: el.offsetTop,
						height: el.getBoundingClientRect().height,
					})),
				);
				for (const id of await page
					.locator(".subject")
					.evaluateAll((elements) => elements.map((el) => el.id))) {
					const control = topicControl(page, id);
					await control.focus();
					await page.keyboard.press("Enter");
					assert.equal(
						await topicOutline(page, id).isVisible(),
						true,
					);
					assert.equal(
						await topicOutline(page, id).textContent(),
						await page
							.locator(`#${id} .subject-outline`)
							.textContent(),
						"the reader preserves the complete authored outline",
					);
					if (desktop) {
						assert.equal(
							await control.getAttribute("aria-selected"),
							"true",
						);
						assert.equal(
							await page
								.getByRole("tab", { selected: true })
								.count(),
							1,
						);
						assert.deepEqual(
							await controls.evaluateAll((elements) =>
								elements.map((el) => ({
									top: el.offsetTop,
									height: el.getBoundingClientRect().height,
								})),
							),
							positions,
							"selecting any topic never reflows the topic list",
						);
						const list = await page
							.getByRole("tablist")
							.boundingBox();
						const reader = await page
							.getByRole("tabpanel")
							.boundingBox();
						assert.ok(
							reader.x + reader.width < list.x,
							"the reading panel sits to the left of the RTL topic list",
						);
						assert.equal(
							await page
								.getByRole("tabpanel")
								.getAttribute("aria-labelledby"),
							await control.getAttribute("id"),
						);
					} else {
						assert.deepEqual(
							await page
								.locator(".subject[open]")
								.evaluateAll((elements) =>
									elements.map((el) => el.id),
								),
							[id],
						);
						assert.ok(
							positions.every(({ height }) => height < 120),
							"closed topics are compact rows",
						);
					}
					assert.equal(
						await control.evaluate(
							(el) => el === document.activeElement,
						),
						true,
					);
					assert.equal(
						await page.evaluate(
							() =>
								document.documentElement.scrollWidth <=
								innerWidth,
						),
						true,
					);
				}
				await page.close();
			}
		},
	);

	test(
		`learner can open the learning page and jump to any section with ${mode} JavaScript`,
		{ timeout: 20_000 },
		async (t) => {
			const browser = await chromium.launch();
			t.after(() => browser.close());
			for (const width of [1440, 390, 320]) {
				const page = await browser.newPage({
					viewport: { width, height: 900 },
					javaScriptEnabled: mode !== "disabled",
					reducedMotion: "reduce",
				});
				await page.route("**/*", (route) =>
					mode === "blocked module" &&
					route
						.request()
						.url()
						.endsWith("/course/js/course-library.js")
						? route.abort()
						: serveRoadMedia(route),
				);
				await page.goto("http://gallery.test/course/");
				assert.equal(
					await page
						.getByRole("link", {
							name: "ללמידה: זכויות קדימה ופניות",
						})
						.isVisible(),
					false,
				);
				await topicControl(page, "right-of-way").focus();
				await page.keyboard.press("Enter");
				await page.locator(".subject-learn:visible").click();
				assert.equal(
					new URL(page.url()).pathname,
					"/course/right-of-way/",
				);
				assert.equal(
					await page.locator("h1").innerText(),
					"זכויות קדימה ופניות",
				);
				for (const lesson of lessons) {
					await page.goto(`http://gallery.test/${lesson.file}`);
					for (const { id } of [...lesson.sections].reverse()) {
						await page
							.locator(`.lesson-contents a[href="#${id}"]`)
							.click();
						assert.equal(new URL(page.url()).hash, `#${id}`);
						const top = await page
							.locator(`#${id}`)
							.evaluate(
								(element) =>
									element.getBoundingClientRect().top,
							);
						assert.ok(
							top >= 0 && top < 200,
							`${id} is reachable independently at ${width}px`,
						);
					}
					assert.equal(
						await page.evaluate(
							() =>
								document.documentElement.scrollWidth <=
								innerWidth,
						),
						true,
					);
					assert.equal(
						await page
							.locator(".course-brand img")
							.evaluate(
								(image) =>
									image.complete && image.naturalWidth > 0,
							),
						true,
					);
					await page
						.getByRole("link", {
							name: "חזרה לנושאי הלימוד",
							exact: true,
						})
						.click();
					assert.equal(new URL(page.url()).pathname, "/course/");
				}
				await page.locator(".course-brand").click();
				assert.equal(new URL(page.url()).pathname, "/index.html");
				await page.close();
			}
		},
	);
}

test(
	"desktop keyboard selection, fragment links and resizing preserve the selected subject",
	{ timeout: 20_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({
			viewport: { width: 1440, height: 900 },
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/course/#right-of-way");
		assert.equal(
			await topicOutline(page, "right-of-way").isVisible(),
			true,
		);
		await topicControl(page, "right-of-way").focus();
		await page.keyboard.press("ArrowDown");
		assert.equal(await topicOutline(page, "roundabouts").isVisible(), true);
		await page.keyboard.press("End");
		assert.equal(
			await topicOutline(page, "licensing-and-points").isVisible(),
			true,
		);
		await page.keyboard.press("Home");
		await page.keyboard.press("ArrowDown");
		assert.equal(
			await topicOutline(page, "signs-and-speed").isVisible(),
			true,
		);
		await page.keyboard.press("Tab");
		assert.equal(
			await page
				.getByRole("tabpanel")
				.evaluate((el) => el === document.activeElement),
			true,
		);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.locator(".subject-list").waitFor({ state: "visible" });
		assert.equal(
			await topicOutline(page, "signs-and-speed").isVisible(),
			true,
		);
		assert.equal(
			await topicControl(page, "signs-and-speed").evaluate(
				(el) => el === document.activeElement,
			),
			true,
		);
		await topicControl(page, "overtaking").click();
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.getByRole("tablist").waitFor({ state: "visible" });
		assert.equal(await topicOutline(page, "overtaking").isVisible(), true);
		assert.equal(
			await page
				.getByRole("tab", { selected: true })
				.getAttribute("data-topic"),
			"overtaking",
		);
		await page.getByRole("searchbox").fill("מלווה");
		assert.equal(
			await topicOutline(page, "licensing-and-points").isVisible(),
			true,
		);
		await page.getByRole("searchbox").fill("zzz");
		assert.equal(
			await page.getByRole("tabpanel").isVisible(),
			false,
			"no stale outline appears beside an empty result",
		);
		await page.getByRole("button", { name: "הצגת כל הנושאים" }).click();
		assert.equal(await page.getByRole("tab").count(), 9);
	},
);

test(
	"library supports search, reset, arbitrary topic selection and return visits",
	{ timeout: 30_000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		for (const width of [1440, 390, 320]) {
			const page = await browser.newPage({
				viewport: { width, height: 900 },
				reducedMotion: "reduce",
			});
			const errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await page.route("**/*", serveRoadMedia);
			await page.goto("http://gallery.test/course/");
			assert.equal(
				await page.locator(".last-topic").isVisible(),
				false,
				"no invented history on the first visit",
			);
			const search = page.getByRole("searchbox");
			for (const [query, id] of [
				["מלווה", "licensing-and-points"],
				["גרירה", "licensing-and-points"],
				["תיאוריה", "learning-foundations"],
				["סיכום", "learning-foundations"],
				["מצמד", "right-of-way"],
				["הילוך", "driving-test"],
			]) {
				await search.fill(query);
				assert.equal(
					await visibleTopics(page).count(),
					1,
					`${query} finds its topic at ${width}px`,
				);
				assert.equal(await topicControl(page, id).isVisible(), true);
			}
			assert.equal(
				await page.evaluate(() =>
					localStorage.getItem("oren-course:last-topic"),
				),
				null,
				"searching alone does not invent a topic visit",
			);
			await search.fill("כיכר");
			assert.equal(await visibleTopics(page).count(), 1);
			assert.equal(
				await topicControl(page, "roundabouts").isVisible(),
				true,
			);
			await topicControl(page, "roundabouts").focus();
			await page.keyboard.press("Enter");
			assert.equal(
				await topicOutline(page, "roundabouts").isVisible(),
				true,
			);
			await page.waitForFunction(
				() =>
					localStorage.getItem("oren-course:last-topic") ===
					"roundabouts",
			);
			await search.fill("zzz");
			assert.equal(await visibleTopics(page).count(), 0);
			assert.equal(await page.locator(".search-empty").isVisible(), true);
			await page.getByRole("button", { name: "הצגת כל הנושאים" }).click();
			assert.equal(await visibleTopics(page).count(), 9);
			assert.equal(
				await search.evaluate(
					(element) => element === document.activeElement,
				),
				true,
			);
			await search.fill("  פנייה   שמאלה  ");
			assert.equal(
				await topicControl(page, "right-of-way").isVisible(),
				true,
			);
			await page.reload();
			assert.equal(await page.locator(".last-topic").isVisible(), true);
			assert.match(
				await page.locator("[data-last-topic-name]").innerText(),
				/מעגלי תנועה/,
			);
			await topicControl(page, "learning-foundations").click();
			await search.fill("zzz");
			await page.locator("[data-last-topic-link]").click();
			await topicOutline(page, "roundabouts").waitFor({
				state: "visible",
			});
			assert.equal(
				await topicOutline(page, "roundabouts").isVisible(),
				true,
			);
			assert.equal(
				await page.locator(".subject-outline:visible").count(),
				1,
				"return links show only the requested outline",
			);
			assert.equal(await search.inputValue(), "");
			assert.equal(
				await topicControl(page, "roundabouts").evaluate(
					(element) => element === document.activeElement,
				),
				true,
			);
			assert.equal(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
				true,
				`no overflow at ${width}px`,
			);
			assert.equal(
				await page
					.locator(".course-brand img")
					.evaluate(
						(image) => image.complete && image.naturalWidth > 0,
					),
				true,
			);
			assert.deepEqual(errors, []);
			await page.close();
		}
	},
);

for (const failure of [
	"disabled",
	"blocked module",
	"blocked storage",
	"stale storage",
]) {
	test(
		`topic browsing survives ${failure}`,
		{ timeout: 20_000 },
		async (t) => {
			const browser = await chromium.launch();
			t.after(() => browser.close());
			for (const width of [1440, 320]) {
				const page = await browser.newPage({
					javaScriptEnabled: failure !== "disabled",
					viewport: { width, height: 900 },
				});
				if (failure === "blocked storage")
					await page.addInitScript(() => {
						Object.defineProperty(window, "localStorage", {
							get() {
								throw new DOMException(
									"Storage blocked",
									"SecurityError",
								);
							},
						});
					});
				if (failure === "stale storage")
					await page.addInitScript(() =>
						localStorage.setItem(
							"oren-course:last-topic",
							"removed-topic",
						),
					);
				await page.route("**/*", (route) =>
					failure === "blocked module" &&
					route
						.request()
						.url()
						.endsWith("/course/js/course-library.js")
						? route.abort()
						: serveRoadMedia(route),
				);
				await page.goto("http://gallery.test/course/");
				assert.equal(await visibleTopics(page).count(), 9);
				assert.equal(
					await page.locator("[data-search-status]").innerText(),
					"9 נושאים לבחירה",
				);
				assert.equal(
					await page.locator(".last-topic").isVisible(),
					false,
				);
				if (["disabled", "blocked module"].includes(failure))
					assert.equal(
						await page.getByRole("searchbox").isVisible(),
						false,
					);
				await topicControl(page, "driving-test").focus();
				await page.keyboard.press("Enter");
				assert.equal(
					await topicOutline(page, "driving-test").isVisible(),
					true,
					"test preparation opens without completing earlier topics",
				);
				for (const id of [
					"learning-foundations",
					"licensing-and-points",
				]) {
					await topicControl(page, id).focus();
					await page.keyboard.press("Enter");
					assert.equal(
						await topicOutline(page, id).isVisible(),
						true,
						`${id} opens with ${failure}`,
					);
				}
				assert.equal(
					await page.evaluate(
						() =>
							document.documentElement.scrollWidth <= innerWidth,
					),
					true,
				);
				await page
					.getByRole("link", { name: "חזרה לדף הבית", exact: true })
					.click();
				assert.equal(new URL(page.url()).pathname, "/index.html");
				await page.close();
			}
		},
	);
}
