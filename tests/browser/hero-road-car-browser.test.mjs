import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

test("hero car follows the resized road, waits five seconds, repeats and respects reduced motion", async (t) => {
	const browser = await chromium.launch();
	t.after(() => browser.close());
	for (const width of [1860, 390]) {
		const page = await browser.newPage({
			viewport: { width, height: 930 },
			reducedMotion: "no-preference",
		});
		await page.route("**/*", serveRoadMedia);
		await page.goto("http://gallery.test/");
		await page.waitForFunction(
			() =>
				document.querySelector(".hero-road-car").getAnimations()
					.length === 1,
		);
		const sample = (time) =>
			page.locator(".hero-road-car").evaluate((car, time) => {
				const animation = car.getAnimations()[0];
				animation.pause();
				animation.currentTime = time;
				const bounds = car.getBoundingClientRect();
				const road = document.querySelector(".hero-road-surface");
				const box = road.ownerSVGElement.getBoundingClientRect();
				const x = (bounds.left + bounds.right) / 2 - box.left;
				const y = (bounds.top + bounds.bottom) / 2 - box.top;
				const length = road.getTotalLength();
				let nearest = Infinity;
				let nearestLength = 0;
				const scaleX =
					box.width / road.ownerSVGElement.viewBox.baseVal.width;
				const scaleY =
					box.height / road.ownerSVGElement.viewBox.baseVal.height;
				for (let i = 0; i <= 3000; i++) {
					const point = road.getPointAtLength((length * i) / 3000);
					const distance = Math.hypot(
						x - point.x * scaleX,
						y - point.y * scaleY,
					);
					if (distance < nearest) {
						nearest = distance;
						nearestLength = (length * i) / 3000;
					}
				}
				const before = road.getPointAtLength(
					Math.max(0, nearestLength - 1),
				);
				const after = road.getPointAtLength(
					Math.min(length, nearestLength + 1),
				);
				const tangent = Math.atan2(
					(after.y - before.y) * scaleY,
					(after.x - before.x) * scaleX,
				);
				const matrix = new DOMMatrixReadOnly(
					getComputedStyle(car).transform,
				);
				const heading = Math.atan2(matrix.b, matrix.a) - Math.PI;
				const headingError = Math.abs(
					Math.atan2(
						Math.sin(heading - tangent),
						Math.cos(heading - tangent),
					),
				);
				return {
					y,
					nearest,
					headingError,
					opacity: getComputedStyle(car).opacity,
					transform: getComputedStyle(car).transform,
					height: box.height,
					duration: animation.effect.getTiming().duration,
				};
			}, time);
		assert.ok((await sample(0)).y < 0, "car starts above the hero");
		assert.equal((await sample(0)).duration, 20_000);
		for (const time of [3000, 6000, 9000, 12_000]) {
			const state = await sample(time);
			assert.ok(
				state.nearest < 2,
				`${width}px at ${time}ms: car must stay on the road center`,
			);
			assert.equal(state.opacity, "1");
			assert.ok(
				state.headingError < 0.12,
				`${width}px at ${time}ms: car must face along the road`,
			);
		}
		const finish = await sample(15_000);
		assert.ok(finish.y > finish.height, "car exits below the hero");
		for (const time of [15_000, 17_500, 19_999]) {
			const state = await sample(time);
			assert.equal(
				state.opacity,
				"0",
				"car stays hidden throughout the five-second pause",
			);
			assert.equal(state.transform, finish.transform);
		}
		assert.equal(
			(await sample(23_000)).transform,
			(await sample(3000)).transform,
			"next drive repeats the route",
		);
		await sample(6000);
		await page.setViewportSize({
			width: width === 390 ? 768 : 1366,
			height: 844,
		});
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);
		assert.deepEqual(
			await page.locator(".hero-road-car").evaluate((car) => {
				const animation = car.getAnimations()[0];
				return {
					time: animation.currentTime,
					state: animation.playState,
				};
			}),
			{ time: 6000, state: "paused" },
			"resizing preserves elapsed time and pause state",
		);
		assert.ok(
			(await sample(6000)).nearest < 2,
			"resizing keeps the car on the road",
		);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.waitForFunction(
			() =>
				document.querySelector(".hero-road-car").getAnimations()
					.length === 0,
		);
		assert.equal(
			await page
				.locator(".hero-road-car")
				.evaluate((car) => getComputedStyle(car).opacity),
			"1",
		);
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.waitForFunction(
			() =>
				document.querySelector(".hero-road-car").getAnimations()
					.length === 1,
		);
		assert.equal(
			await page.evaluate(
				() => document.documentElement.scrollWidth > innerWidth,
			),
			false,
		);
		await page.close();
	}
});
