import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const contentTypes = {
	".html": "text/html",
	".css": "text/css",
	".js": "text/javascript",
	".png": "image/png",
	".jpg": "image/jpeg",
	".woff2": "font/woff2",
};

test(
	"real gallery styles keep animation working across viewport changes",
	{ timeout: 30000 },
	async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({
			viewport: { width: 1440, height: 900 },
			reducedMotion: "no-preference",
		});
		let releaseDiscovery;
		const discoveryGate = new Promise((resolve) => {
			releaseDiscovery = resolve;
		});
		t.after(() => releaseDiscovery());
		// Serve the actual project files without a dev server or external font requests.
		await page.route("**/*", async (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== "http://gallery.test") return route.abort();
			if (route.request().method() === "HEAD") await discoveryGate;
			const filename = path.join(
				rootDir,
				url.pathname === "/" ? "index.html" : url.pathname,
			);
			try {
				const bytes = await readFile(filename);
				await route.fulfill({
					contentType:
						contentTypes[path.extname(filename)] ??
						"application/octet-stream",
					body: route.request().method() === "HEAD" ? "" : bytes,
				});
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
				await route.fulfill({ status: 404, body: "" });
			}
		});
		const session = await page.context().newCDPSession(page);
		const trace = [];
		session.on("Tracing.dataCollected", ({ value }) => trace.push(...value));
		await session.send("Tracing.start", {
			categories: "devtools.timeline",
			transferMode: "ReportEvents",
		});
		await page.goto("http://gallery.test/");
		await page.evaluate(() => new Promise(resolve =>
			requestAnimationFrame(() => requestAnimationFrame(resolve)),
		));
		const traceComplete = new Promise(resolve =>
			session.once("Tracing.tracingComplete", resolve),
		);
		await session.send("Tracing.end");
		await traceComplete;
		await t.test("the stop-sign entrance runs without compositor failures", () => {
			const entrances = trace.filter(event =>
				event.name === "Animation" && event.args?.data?.displayName === "image-reveal",
			);
			assert.ok(entrances.length > 0, "the browser must run the stop-sign entrance");
			const ids = new Set(entrances.map(event => event.id2.local));
			const failures = trace.filter(event =>
				event.name === "Animation" && ids.has(event.id2?.local) && event.args?.data?.compositeFailed,
			);
			assert.deepEqual(failures.map(event => event.args.data), []);
		});
		await t.test(
			"loading wheel covers the stopped road until discovery finishes",
			async () => {
				const loader = page.locator(".road-loader");
				assert.equal(await loader.isVisible(), true);
				const state = await loader.evaluate((element) => {
					const wheel = element.querySelector("img");
					return {
						wheelSource: wheel.getAttribute("src"),
						wheelAnimation: wheel.getAnimations()[0]?.playState,
						blur: getComputedStyle(element).backdropFilter,
						roadAnimations: document
							.querySelector(".road-carousel-track")
							.getAnimations().length,
					};
				});
				assert.equal(state.wheelSource, "assets/images/wheel.png");
				assert.equal(state.wheelAnimation, "running");
				assert.equal(state.roadAnimations, 0);
				assert.match(state.blur, /blur\([1-9]/);
				await page.emulateMedia({ reducedMotion: "reduce" });
				assert.equal(
					await page.locator(".hero-visual").evaluate(element => element.getAnimations().length),
					0,
				);
				assert.equal(
					await loader
						.locator("img")
						.evaluate((wheel) => wheel.getAnimations().length),
					0,
				);
				await page.emulateMedia({ reducedMotion: "no-preference" });
			},
		);
		releaseDiscovery();
		await page.locator('[data-road-carousel][data-ready="true"]').waitFor();
		assert.equal(await page.locator(".road-loader").isVisible(), false);

		for (const [name, width, height, secondsPerCar] of [
			["desktop", 1440, 900, 11.111111],
			["laptop", 1366, 768, 11.111111],
			["phone", 390, 844, 9.462366],
			["small phone", 375, 667, 9.462366],
			["desktop after resize", 1440, 900, 11.111111],
		]) {
			await t.test(name, async () => {
				await page.setViewportSize({ width, height });
				// Wait for the resize event and its style update to finish.
				await page.evaluate(
					() =>
						new Promise((resolve) =>
							requestAnimationFrame(() =>
								requestAnimationFrame(resolve),
							),
						),
				);
				const state = await page
					.locator("[data-road-carousel]")
					.evaluate((root) => {
						const group = root.querySelector(
							".road-carousel-group",
						);
						const track = root.querySelector(
							".road-carousel-track",
						);
						const animation = track
							.getAnimations()
							.find(
								(animation) =>
									animation.animationName === "road-scroll",
							);
						const hero = document.querySelector(".hero");
						const roadBounds = root.getBoundingClientRect();
						return {
							insideHero: hero.contains(root),
							roadBottom: roadBounds.bottom,
							heroBottom: hero.getBoundingClientRect().bottom,
							roadTop: roadBounds.top,
							actionsBottom: document
								.querySelector(".hero-actions")
								.getBoundingClientRect().bottom,
							pageWidth: document.documentElement.scrollWidth,
							cadence: Number(
								getComputedStyle(root).getPropertyValue(
									"--road-seconds-per-car",
								),
							),
							duration: parseFloat(
								getComputedStyle(track).animationDuration,
							),
							carStep:
								group.firstElementChild.getBoundingClientRect()
									.width +
								parseFloat(getComputedStyle(group).columnGap),
							distance: group.getBoundingClientRect().width,
							playState: animation?.playState,
						};
					});
				assert.equal(
					state.insideHero,
					true,
					"the gallery must belong to the hero",
				);
				assert.ok(
					state.roadBottom <= height + 1,
					"the complete road must fit in the initial viewport",
				);
				assert.ok(
					Math.abs(state.heroBottom - state.roadBottom) < 1,
					"the road must finish the hero",
				);
				assert.ok(
					state.actionsBottom <= state.roadTop,
					"hero actions must not overlap the road",
				);
				assert.ok(
					state.pageWidth <= width,
					"the gallery must not cause page overflow",
				);
				assert.equal(
					state.cadence,
					secondsPerCar,
					"production CSS must supply the approved cadence",
				);
				assert.equal(
					state.playState,
					"running",
					"production styles must create a running road animation",
				);
				assert.ok(
					state.duration > 0,
					"the loop must have a usable duration",
				);
				assert.ok(
					Math.abs(
						state.duration -
							(state.distance / state.carStep) * secondsPerCar,
					) < 0.001,
				);
			});
		}

		await t.test("reduced motion", async () => {
			await page.emulateMedia({ reducedMotion: "reduce" });
			assert.equal(
				await page
					.locator(".road-carousel-track")
					.evaluate((track) => track.getAnimations().length),
				0,
			);
			assert.equal(
				await page
					.locator('.road-carousel-group[aria-hidden="true"]')
					.isVisible(),
				false,
			);
		});

		await t.test(
			"without the enhancement script the fallback stays uncovered",
			async () => {
				await page.route("**/js/script.js", (route) => route.abort());
				await page.reload();
				assert.equal(
					await page.locator(".road-loader").isVisible(),
					false,
				);
				assert.equal(
					await page.locator(".road-carousel-group").count(),
					1,
				);
				assert.equal(
					await page.locator(".road-photo img").first().isVisible(),
					true,
				);
			},
		);
	},
);
