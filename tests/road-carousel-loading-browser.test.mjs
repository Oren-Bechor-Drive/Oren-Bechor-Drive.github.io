import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "./helpers/road-media.mjs";
import { roadPhotoSources } from "../js/road-photo-sources.js";

const photoNumbers = Object.keys(roadPhotoSources).map(Number).sort((a, b) => a - b);
const photoCount = photoNumbers.length;
const lastPhoto = photoNumbers.at(-1);

for (const [width, late] of [
	[1366, false],
	[390, false],
	[5000, false],
	[1366, true],
	[1366, "boundary"],
	[1366, "resize"],
]) {
	test(`progressive loading keeps position, order and deferred icons at ${width}px${late === "resize" ? " after widening during loading" : late === "boundary" ? " at the next loop boundary" : late ? " with reduced motion during a pending append" : ""}`, async (t) => {
		const browser = await chromium.launch();
		t.after(() => browser.close());
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		// Observe completed real decodes so a deferred-append assertion cannot pass
		// merely because the final response has not reached the decoder yet.
		await page.addInitScript(() => {
			window.decodedPhotoNumbers = [];
			const decode = HTMLImageElement.prototype.decode;
			HTMLImageElement.prototype.decode = async function () {
				await decode.call(this);
				const number = Number(this.src.match(/students-pass\/(\d+)\.png$/)?.[1]);
				if (number) window.decodedPhotoNumbers.push(number);
			};
		});
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		t.after(() => release());
		const consoleErrors = [];
		const failedResponses = [];
		page.on("console", message => {
			if (message.type() === "error") consoleErrors.push(message.text());
		});
		page.on("pageerror", error => consoleErrors.push(error.message));
		page.on("response", response => {
			if (response.status() >= 400) failedResponses.push(response.url());
		});
		let kitRequests = 0;
		const requestedImages = [];
		await page.route("**/*", async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.hostname === "kit.fontawesome.com") {
				kitRequests++;
				return route.fulfill({ contentType: "text/javascript", body: "" });
			}
			if (
				request.method() !== "HEAD" &&
				url.pathname.includes("students-pass")
			) {
				requestedImages.push(url.pathname);
				if (
					Number(url.pathname.match(/\/(\d+)(?:-\d+)?\.(?:png|webp)$/)?.[1]) === (late === "resize" ? 7 : lastPhoto)
				)
					await gate;
			}
			await serveRoadMedia(route);
		});
		await page.goto("http://gallery.test/", { waitUntil: "domcontentloaded" });
		// Initialization may already have added the aria-hidden loop duplicate.
		const minimumInitialCount = await page.locator('.road-carousel-group:not([aria-hidden="true"])').evaluate(group => {
			const step = group.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(group).columnGap);
			return Math.max(group.children.length, Math.ceil(innerWidth / step) + 1);
		});
		if (photoCount <= minimumInitialCount) {
			t.skip("The gallery needs more photos to exercise a later append at this viewport");
			return;
		}
		await page.locator('[data-ready="true"]').waitFor();
		await page.waitForFunction(
			(count) =>
				document.querySelector(".road-carousel-group").children.length ===
				count,
			late === "resize" ? 6 : photoCount - 1,
		);
		if (late === "resize") {
			await page.setViewportSize({ width: 5000, height: 844 });
			await page.waitForFunction(() => document.querySelector("[data-road-carousel]").dataset.ready !== "true");
		}
		assert.equal(await page.locator(".road-loader").isVisible(), false);
		assert.equal(kitRequests, 0);
		const leftBefore = await page.evaluate((late) => {
			if (late === "resize") return null;
			const animation = document
				.querySelector(".road-carousel-track")
				.getAnimations()[0];
			animation.pause();
			animation.currentTime = late
				? Number(animation.effect.getTiming().duration) - 2000
				: 4000;
			return document.querySelector(".road-car").getBoundingClientRect().left;
		}, late);
		release();
		let boundaryLeft;
		if (late === true || late === "boundary") {
			await page.waitForFunction(number => window.decodedPhotoNumbers.includes(number), lastPhoto);
			await page.evaluate(() => new Promise(resolve =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			));
			assert.equal(
				await page
					.locator(".road-carousel-group")
					.first()
					.locator(".road-car")
					.count(),
				photoCount - 1,
			);
			if (late === true) await page.emulateMedia({ reducedMotion: "reduce" });
			else {
				boundaryLeft = await page.locator(".road-carousel-track").evaluate(track => new Promise((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("The road did not reach its next loop boundary")), 3000);
					const animation = track.getAnimations()[0];
					track.addEventListener("animationiteration", () => {
						clearTimeout(timeout);
						animation.pause();
						resolve(track.querySelector(".road-car").getBoundingClientRect().left);
					}, { once: true });
					animation.currentTime = Number(animation.effect.getTiming().duration) - 100;
					animation.play();
				}));
			}
		}
		await page.waitForFunction(
			count =>
				document.querySelector(".road-carousel-group").children.length === count,
			photoCount,
			{ timeout: 5000 },
		);
		const state = await page.evaluate(() => ({
			left: document.querySelector(".road-car").getBoundingClientRect().left,
			photos: [
				...document
					.querySelector(".road-carousel-group")
					.querySelectorAll(".road-photo img"),
			].map((img) => ({
				src: img.src,
				current: img.currentSrc,
				loaded: img.complete && img.naturalWidth > 0,
			})),
			groups: [...document.querySelectorAll(".road-carousel-group")].map(
				(group) => group.innerHTML,
			),
		}));
		if (late === "boundary")
			assert.ok(Math.abs(state.left - boundaryLeft) < 1, "publishing at the loop boundary preserves the visible cars' position");
		if (!late)
			assert.ok(
				Math.abs(state.left - leftBefore) < 1,
				"appending must not move the visible cars",
			);
		assert.deepEqual(
			state.photos.map((photo) => Number(photo.src.match(/\/(\d+)\.png$/)[1])),
			photoNumbers,
		);
		assert.ok(
			state.photos.every(
				(photo) => photo.loaded && photo.current.endsWith(".webp"),
			),
		);
		assert.equal(state.groups[0], state.groups[1]);
		assert.deepEqual(failedResponses, [], "gallery loading must not probe missing files");
		assert.deepEqual(consoleErrors, [], "gallery loading must leave the browser console clean");
		assert.ok(
			requestedImages.every((src) => src.endsWith(".webp")),
			"student PNG bodies should not be downloaded",
		);
		const kitLoaded = page.waitForResponse(response => new URL(response.url()).hostname === "kit.fontawesome.com");
		await page.locator(".site-footer").scrollIntoViewIfNeeded();
		await kitLoaded;
		assert.equal(kitRequests, 1);
	});
}
