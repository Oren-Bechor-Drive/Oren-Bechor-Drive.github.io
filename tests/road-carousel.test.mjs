import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

import { initRoadCarousel } from "../js/road-carousel.js";

async function setup(t, { count = 27, failureStatus, brokenPhoto, contentType = "image/png" } = {}) {
	const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
	const dom = new JSDOM(html, { url: "https://example.com/course/" });
	t.after(() => dom.window.close());
	const { window } = dom;
	window.fetch = async (url, options) => {
		assert.equal(options.method, "HEAD");
		const number = Number(new URL(url).pathname.match(/\/(\d+)\.png$/)[1]);
		const status = failureStatus ?? (number <= count ? 200 : 404);
		return { ok: status === 200, status, headers: new Headers({ "Content-Type": contentType }) };
	};
	// JSDOM does not decode images. Model that browser boundary only.
	window.HTMLImageElement.prototype.decode = async function () {
		if (this.src.endsWith(`/${brokenPhoto}.png`)) throw new Error("Image decode failed");
		Object.defineProperty(this, "naturalWidth", { value: 640 });
		Object.defineProperty(this, "naturalHeight", { value: 480 });
	};
	const root = window.document.querySelector("[data-road-carousel]");
	root.style.setProperty("--road-seconds-per-car", "11.111111");
	root.querySelector(".road-carousel-group").style.columnGap = "48px";
	// JSDOM has no layout engine; supply rendered geometry at the browser seam.
	t.mock.method(window.HTMLElement.prototype, "getBoundingClientRect", function () {
		const width = this.matches(".road-car") ? 496.8
			: this.matches(".road-carousel-group") ? Math.max(1440, this.children.length * 544.8) : 0;
		return { width };
	});
	return root;
}

test("numbered photos extend beyond the car count and repeat in numeric order", async (t) => {
	const root = await setup(t);
	const originalCars = [...root.querySelectorAll(".road-car > img")].map(i => i.getAttribute("src"));
	t.mock.method(Math, "random", () => 0);
	await initRoadCarousel(root);
	const groups = root.querySelectorAll(".road-carousel-group");
	assert.equal(groups.length, 2);
	const photos = [...groups[0].querySelectorAll(".road-photo img")];
	assert.equal(photos.length, 27);
	assert.deepEqual(photos.map(i => Number(i.src.match(/\/(\d+)\.png$/)[1])),
		Array.from({ length: 27 }, (_, index) => index + 1));
	assert.equal(photos[9].src, "https://example.com/course/assets/images/students-pass/10.png");
	assert.ok(photos.every(i => !i.draggable && i.alt && i.width === 640 && i.height === 480));
	assert.equal(groups[1].innerHTML, groups[0].innerHTML);
	assert.equal(groups[1].getAttribute("aria-hidden"), "true");
	assert.ok(groups[1].hasAttribute("inert"));
	assert.equal(root.dataset.ready, "true");
	const carSources = [...groups[0].querySelectorAll(".road-car > img")].map(i => i.getAttribute("src"));
	assert.deepEqual(carSources.slice(0, originalCars.length), [...originalCars.slice(1), originalCars[0]]);
	assert.ok(carSources.every(src => originalCars.includes(src)));
});

test("the first missing numbered photo ends discovery", async (t) => {
	const root = await setup(t, { count: 3 });
	await initRoadCarousel(root);
	assert.equal(root.querySelector(".road-carousel-group").children.length, 3);
});

test("loading remains busy through photo decoding and clears when ready", async (t) => {
	const root = await setup(t, { count: 1 });
	const window = root.ownerDocument.defaultView;
	let releasePhoto;
	let decodingStarted;
	const decoding = new Promise(resolve => { decodingStarted = resolve; });
	const decoded = new Promise(resolve => { releasePhoto = resolve; });
	const originalDecode = window.HTMLImageElement.prototype.decode;
	window.HTMLImageElement.prototype.decode = async function () {
		decodingStarted();
		await decoded;
		return originalDecode.call(this);
	};
	const loading = initRoadCarousel(root);
	assert.equal(root.getAttribute("aria-busy"), "true");
	await decoding;
	assert.equal(root.getAttribute("aria-busy"), "true");
	assert.notEqual(root.dataset.ready, "true");
	releasePhoto();
	await loading;
	assert.equal(root.getAttribute("aria-busy"), "false");
	assert.equal(root.dataset.ready, "true");
});

for (const options of [{ failureStatus: 503 }, { brokenPhoto: 2 }, { contentType: "text/html" }]) {
	test(`loading failure preserves the static photo gallery: ${JSON.stringify(options)}`, async (t) => {
		const root = await setup(t, options);
		const before = root.innerHTML;
		await assert.rejects(initRoadCarousel(root));
		assert.equal(root.innerHTML, before);
		assert.notEqual(root.dataset.ready, "true");
		assert.equal(root.getAttribute("aria-busy"), "false");
	});
}

test("an empty numbered folder preserves the fallback without starting a loop", async (t) => {
	const root = await setup(t, { count: 0 });
	const before = root.innerHTML;
	await initRoadCarousel(root);
	assert.equal(root.innerHTML, before);
	assert.notEqual(root.dataset.ready, "true");
	assert.equal(root.getAttribute("aria-busy"), "false");
});

test("loop duration follows rendered travel distance and updates on resize", async (t) => {
	const root = await setup(t, { count: 15 });
	await initRoadCarousel(root);
	const duration = () => parseFloat(root.style.getPropertyValue("--road-loop-duration"));
	assert.ok(Math.abs(duration() - 166.666665) < 0.001);
	const group = root.querySelector(".road-carousel-group");
	group.getBoundingClientRect = () => ({ width: 15 * 480 });
	group.firstElementChild.getBoundingClientRect = () => ({ width: 448 });
	group.style.columnGap = "32px";
	root.style.setProperty("--road-seconds-per-car", "9.462366");
	root.ownerDocument.defaultView.dispatchEvent(new root.ownerDocument.defaultView.Event("resize"));
	assert.ok(Math.abs(duration() - 141.93549) < 0.001);
});

test("a short row accounts for viewport space in its travel duration", async (t) => {
	const root = await setup(t, { count: 1 });
	await initRoadCarousel(root);
	const duration = parseFloat(root.style.getPropertyValue("--road-loop-duration"));
	assert.ok(Math.abs(duration - 1440 / 544.8 * 11.111111) < 0.001);
});
