import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setImmediate as flushTasks, setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";

import { initRoadCarousel } from "../js/road-carousel.js";
import { roadPhotoSources } from "../js/road-photo-sources.js";

async function waitFor(condition, message) {
	const deadline = performance.now() + 3000;
	while (!condition() && performance.now() < deadline) await delay(10);
	assert.ok(condition(), message);
}

async function setup(
	t,
	{ count = 27, failureStatus, brokenPhoto, contentType = "image/png" } = {},
) {
	const html = await readFile(
		new URL("../index.html", import.meta.url),
		"utf8",
	);
	const dom = new JSDOM(html, { url: "https://example.com/course/", pretendToBeVisual: true });
	t.after(() => dom.window.close());
	// Model generated lists of different sizes without adding a test-only runtime API.
	const publishedSources = { ...roadPhotoSources };
	for (const number of Object.keys(roadPhotoSources)) delete roadPhotoSources[number];
	for (let number = 1; number <= count; number++)
		roadPhotoSources[number] = publishedSources[number] ?? {};
	t.after(() => {
		for (const number of Object.keys(roadPhotoSources)) delete roadPhotoSources[number];
		Object.assign(roadPhotoSources, publishedSources);
	});
	const { window } = dom;
	window.fetch = async (url, options) => {
		assert.equal(options.method, "HEAD");
		const number = Number(new URL(url).pathname.match(/\/(\d+)\.png$/)[1]);
		const status = failureStatus ?? (number <= count ? 200 : 404);
		return {
			ok: status === 200,
			status,
			headers: new Headers({ "Content-Type": contentType }),
		};
	};
	// JSDOM does not decode images. Model that browser boundary only.
	window.HTMLImageElement.prototype.decode = async function () {
		if (this.src.endsWith(`/${brokenPhoto}.png`))
			throw new Error("Image decode failed");
		Object.defineProperty(this, "naturalWidth", { value: 640 });
		Object.defineProperty(this, "naturalHeight", { value: 480 });
	};
	const root = window.document.querySelector("[data-road-carousel]");
	root.style.setProperty("--road-seconds-per-car", "11.111111");
	root.querySelector(".road-carousel-group").style.columnGap = "48px";
	root.querySelector(".road-carousel-group").style.minWidth = "1440px";
	root.querySelector(".road-carousel-group").style.padding = "0 24px";
	// JSDOM has no layout engine; supply rendered geometry at the browser seam.
	t.mock.method(
		window.HTMLElement.prototype,
		"getBoundingClientRect",
		function () {
			const width = this.matches(".road-car")
				? 496.8
				: this.matches(".road-carousel-group")
					? Math.max(1440, this.children.length * 544.8)
					: 0;
			return { width };
		},
	);
	return root;
}

test("photo publications do not read layout after changing the connected row in a frame", async (t) => {
	const root = await setup(t);
	const window = root.ownerDocument.defaultView;
	const group = root.querySelector(".road-carousel-group");
	let rowChanged = false;
	const requestFrame = window.requestAnimationFrame.bind(window);
	t.mock.method(window, "requestAnimationFrame", callback => requestFrame(time => {
		rowChanged = false;
		callback(time);
	}));
	for (const method of ["append", "replaceChildren"]) {
		const original = group[method].bind(group);
		t.mock.method(group, method, (...args) => {
			rowChanged = true;
			return original(...args);
		});
	}
	const measure = window.HTMLElement.prototype.getBoundingClientRect;
	t.mock.method(window.HTMLElement.prototype, "getBoundingClientRect", function () {
		assert.equal(rowChanged, false, "geometry reads must precede row changes");
		return measure.call(this);
	});
	const computedStyle = window.getComputedStyle.bind(window);
	t.mock.method(window, "getComputedStyle", (...args) => {
		assert.equal(rowChanged, false, "style reads must precede row changes");
		return computedStyle(...args);
	});
	await initRoadCarousel(root);
	assert.equal(group.children.length, 27);
	assert.equal(group.replaceChildren.mock.callCount(), 1);
	assert.equal(group.append.mock.callCount(), 0, "photos decoded together should publish in one batch");
});

test("numbered photos extend beyond the car count and repeat in numeric order", async (t) => {
	const root = await setup(t);
	const originalCars = [...root.querySelectorAll(".road-car > img")].map((i) =>
		i.getAttribute("src"),
	);
	t.mock.method(Math, "random", () => 0);
	await initRoadCarousel(root);
	const groups = root.querySelectorAll(".road-carousel-group");
	assert.equal(groups.length, 2);
	const photos = [...groups[0].querySelectorAll(".road-photo img")];
	assert.equal(photos.length, 27);
	assert.deepEqual(
		photos.map((i) => Number(i.src.match(/\/(\d+)\.png$/)[1])),
		Array.from({ length: 27 }, (_, index) => index + 1),
	);
	assert.equal(
		photos[9].src,
		"https://example.com/course/assets/images/students-pass/10.png",
	);
	assert.ok(
		photos.every(
			(i) => !i.draggable && i.alt && i.width === 640 && i.height === 480,
		),
	);
	assert.equal(groups[1].innerHTML, groups[0].innerHTML);
	assert.equal(groups[1].getAttribute("aria-hidden"), "true");
	assert.ok(groups[1].hasAttribute("inert"));
	assert.equal(root.dataset.ready, "true");
	const carSources = [...groups[0].querySelectorAll(".road-car > img")].map(
		(i) => i.getAttribute("src"),
	);
	assert.deepEqual(carSources.slice(0, originalCars.length), [
		...originalCars.slice(1),
		originalCars[0],
	]);
	assert.ok(carSources.every((src) => originalCars.includes(src)));
});

test("a short generated list loads only its listed photos", async (t) => {
	const root = await setup(t, { count: 3 });
	const window = root.ownerDocument.defaultView;
	const fetch = window.fetch;
	const requested = [];
	window.fetch = (...args) => {
		requested.push(Number(new URL(args[0]).pathname.match(/\/(\d+)\.png$/)[1]));
		return fetch(...args);
	};
	await initRoadCarousel(root);
	assert.deepEqual(requested, [1, 2, 3]);
	assert.equal(root.querySelector(".road-carousel-group").children.length, 3);
});

test("loading remains busy through photo decoding and clears when ready", async (t) => {
	const root = await setup(t, { count: 1 });
	const window = root.ownerDocument.defaultView;
	let releasePhoto;
	let decodingStarted;
	const decoding = new Promise((resolve) => {
		decodingStarted = resolve;
	});
	const decoded = new Promise((resolve) => {
		releasePhoto = resolve;
	});
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

for (const options of [
	{ failureStatus: 503 },
	{ failureStatus: 404 },
	{ brokenPhoto: 2 },
	{ contentType: "text/html" },
]) {
	test(`loading failure preserves the static photo gallery: ${JSON.stringify(options)}`, async (t) => {
		const root = await setup(t, options);
		const before = root.innerHTML;
		await assert.rejects(initRoadCarousel(root));
		assert.equal(root.innerHTML, before);
		assert.notEqual(root.dataset.ready, "true");
		assert.equal(root.getAttribute("aria-busy"), "false");
	});
}

test("an empty generated list preserves the fallback without starting a loop", async (t) => {
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
	const duration = () =>
		parseFloat(root.style.getPropertyValue("--road-loop-duration"));
	assert.ok(Math.abs(duration() - 166.666665) < 0.001);
	const group = root.querySelector(".road-carousel-group");
	group.getBoundingClientRect = () => ({ width: 15 * 480 });
	group.firstElementChild.getBoundingClientRect = () => ({ width: 448 });
	group.style.columnGap = "32px";
	root.style.setProperty("--road-seconds-per-car", "9.462366");
	root.ownerDocument.defaultView.dispatchEvent(
		new root.ownerDocument.defaultView.Event("resize"),
	);
	await new Promise(resolve => root.ownerDocument.defaultView.requestAnimationFrame(resolve));
	assert.ok(Math.abs(duration() - 141.93549) < 0.001);
});

test("a short row accounts for viewport space in its travel duration", async (t) => {
	const root = await setup(t, { count: 1 });
	await initRoadCarousel(root);
	const duration = parseFloat(
		root.style.getPropertyValue("--road-loop-duration"),
	);
	assert.ok(Math.abs(duration - (1440 / 544.8) * 11.111111) < 0.001);
});

test("metadata loading overlaps requests and decoding while a later HEAD is pending", async (t) => {
	const root = await setup(t, { count: 8 });
	const window = root.ownerDocument.defaultView;
	const fetch = window.fetch;
	let release;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	const requests = [];
	let releaseFirstThree;
	const firstThree = new Promise(resolve => { releaseFirstThree = resolve; });
	let decoded = false;
	const decode = window.HTMLImageElement.prototype.decode;
	window.HTMLImageElement.prototype.decode = async function () {
		decoded = true;
		return decode.call(this);
	};
	window.fetch = async (url, options) => {
		requests.push({ url, options });
		if (url.endsWith("/4.png")) await gate;
		else await firstThree;
		return fetch(url, options);
	};
	const loading = initRoadCarousel(root);
	try {
		await waitFor(() => requests.length >= 4, "four HEAD requests must start before any response is released");
		assert.equal(requests.length, 4, "metadata concurrency must be bounded to four requests");
		releaseFirstThree();
		await waitFor(() => decoded, "confirmed photos must decode while metadata is pending");
		assert.equal(
			requests.find(({ url }) => url.endsWith("/1.png")).options.cache,
			"default",
		);
	} finally {
		releaseFirstThree();
		release();
		await loading;
	}
});

test("metadata loading refills available request slots while a sibling is pending", async (t) => {
	const root = await setup(t, { count: 8 });
	const window = root.ownerDocument.defaultView;
	const fetch = window.fetch;
	let releaseFourth;
	const fourthPending = new Promise(resolve => { releaseFourth = resolve; });
	const requested = [];
	let activeRequests = 0;
	let peakRequests = 0;
	window.fetch = async (url, options) => {
		const number = Number(new URL(url).pathname.match(/\/(\d+)\.png$/)[1]);
		requested.push(number);
		activeRequests++;
		peakRequests = Math.max(peakRequests, activeRequests);
		if (number === 4) await fourthPending;
		const response = await fetch(url, options);
		activeRequests--;
		return response;
	};
	const loading = initRoadCarousel(root);
	try {
		await waitFor(
			() => requested.includes(8),
			"settled request slots must start later metadata while photo 4 remains pending",
		);
		assert.equal(activeRequests, 1);
		assert.equal(peakRequests, 4);
	} finally {
		releaseFourth();
		await loading;
	}
	assert.deepEqual(requested, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("the initial row starts before the last photo decodes", async (t) => {
	const root = await setup(t, { count: 15 });
	const window = root.ownerDocument.defaultView;
	const decode = window.HTMLImageElement.prototype.decode;
	let release;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	window.HTMLImageElement.prototype.decode = async function () {
		if (this.src.endsWith("/15.png")) await gate;
		return decode.call(this);
	};
	const loading = initRoadCarousel(root);
	try {
		await waitFor(() => root.dataset.ready === "true", "the initial row must start while photo 15 is pending");
		assert.equal(root.dataset.ready, "true");
		assert.equal(root.getAttribute("aria-busy"), "false");
		assert.equal(
			root.querySelector(".road-carousel-group").children.length,
			14,
		);
	} finally {
		release();
		await loading;
	}
	assert.equal(root.querySelector(".road-carousel-group").children.length, 15);
});

test("a later loading failure preserves the already running row", async (t) => {
	const root = await setup(t, { count: 8 });
	const window = root.ownerDocument.defaultView;
	const fetch = window.fetch;
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	window.fetch = async (url, options) => {
		if (url.endsWith("/7.png")) {
			await gate;
			return { ok: false, status: 503 };
		}
		return fetch(url, options);
	};
	const loading = initRoadCarousel(root);
	const rejected = assert.rejects(loading, /photo 7: HTTP 503/);
	let runningRow;
	try {
		await waitFor(() => root.dataset.ready === "true", "the first six photos must start before the failure");
		assert.equal(root.querySelector(".road-carousel-group").children.length, 6);
		runningRow = root.innerHTML;
	} finally {
		release();
		await rejected;
	}
	await flushTasks();
	assert.equal(root.innerHTML, runningRow);
	assert.equal(root.dataset.ready, "true");
	assert.equal(root.getAttribute("aria-busy"), "false");
});

test("a row kept after a later failure updates phone cadence without publishing partial photos", async (t) => {
	const root = await setup(t, { count: 8 });
	const window = root.ownerDocument.defaultView;
	const group = root.querySelector(".road-carousel-group");
	const track = group.parentElement;
	const animation = { animationName: "road-scroll", currentTime: 0 };
	track.getAnimations = () => [animation];
	root.getBoundingClientRect = () => ({ width: 1366 });

	let releaseSeven;
	let releaseEight;
	let markSevenDecoded;
	const sevenPending = new Promise(resolve => { releaseSeven = resolve; });
	const eightPending = new Promise(resolve => { releaseEight = resolve; });
	const sevenDecoded = new Promise(resolve => { markSevenDecoded = resolve; });
	const fetch = window.fetch;
	window.fetch = async (url, options) => {
		if (url.endsWith("/7.png")) await sevenPending;
		if (url.endsWith("/8.png")) {
			await eightPending;
			return { ok: false, status: 503 };
		}
		return fetch(url, options);
	};
	const decode = window.HTMLImageElement.prototype.decode;
	window.HTMLImageElement.prototype.decode = async function () {
		await decode.call(this);
		if (this.src.endsWith("/7.png")) markSevenDecoded();
	};

	const loading = initRoadCarousel(root);
	const rejected = assert.rejects(loading, /photo 8: HTTP 503/);
	await waitFor(() => root.dataset.ready === "true", "the first six photos must start");
	assert.equal(group.children.length, 6);
	assert.ok(
		Math.abs(parseFloat(root.style.getPropertyValue("--road-loop-duration")) - 66.666666) < 0.001,
	);
	releaseSeven();
	await sevenDecoded;
	releaseEight();
	await rejected;
	assert.equal(group.children.length, 6, "photo 7 must not leak into the failed row");
	const preservedRow = group.innerHTML;

	group.style.columnGap = "32px";
	group.style.minWidth = "390px";
	group.style.padding = "0 16px";
	group.getBoundingClientRect = () => ({ width: 2880 });
	group.firstElementChild.getBoundingClientRect = () => ({ width: 448 });
	root.getBoundingClientRect = () => ({ width: 390 });
	root.style.setProperty("--road-seconds-per-car", "9.462366");
	animation.currentTime = 16666.6665;
	window.dispatchEvent(new window.Event("resize"));
	await new Promise(resolve => window.requestAnimationFrame(resolve));

	assert.ok(
		Math.abs(parseFloat(root.style.getPropertyValue("--road-loop-duration")) - 56.774196) < 0.001,
	);
	assert.ok(Math.abs(animation.currentTime - 14193.549) < 0.001);
	assert.equal(group.innerHTML, preservedRow);
});

test("a stalled metadata request has a deadline and cannot mutate the fallback later", async (t) => {
	const root = await setup(t);
	const window = root.ownerDocument.defaultView;
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let release;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	const fetch = window.fetch;
	window.fetch = async (...args) => {
		await gate;
		return fetch(...args);
	};
	const before = root.innerHTML;
	const loading = initRoadCarousel(root);
	const rejected = assert.rejects(loading, /timed out/i);
	t.mock.timers.tick(7999);
	await flushTasks();
	assert.equal(root.getAttribute("aria-busy"), "true");
	t.mock.timers.tick(1);
	await rejected;
	assert.equal(root.getAttribute("aria-busy"), "false");
	release();
	await flushTasks();
	assert.equal(root.innerHTML, before);
});

test("six decoded photos start even when HEAD 7 stalls", async (t) => {
	const root = await setup(t, { count: 8 });
	const window = root.ownerDocument.defaultView;
	const fetch = window.fetch;
	let release;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	window.fetch = async (url, options) => {
		if (url.endsWith("/7.png")) await gate;
		return fetch(url, options);
	};
	const loading = initRoadCarousel(root);
	try {
		await waitFor(() => root.dataset.ready === "true", "six decoded photos must start while HEAD 7 is pending");
		assert.equal(root.dataset.ready, "true");
	} finally {
		release();
		await loading;
	}
});

test("a failed listed photo rejects without retrying or waiting for later metadata requests", async (t) => {
	const root = await setup(t, { count: 4 });
	const window = root.ownerDocument.defaultView;
	const fetch = window.fetch;
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	const requests = [];
	window.fetch = async (url, options) => {
		requests.push(url);
		if (url.endsWith("/2.png")) return { ok: false, status: 404 };
		if (url.endsWith("/3.png")) await gate;
		return fetch(url, options);
	};
	const before = root.innerHTML;
	try {
		await assert.rejects(initRoadCarousel(root), /photo 2: HTTP 404/);
		assert.equal(requests.filter(url => url.endsWith("/2.png")).length, 1);
		assert.equal(root.getAttribute("aria-busy"), "false");
	} finally {
		release();
	}
	await flushTasks();
	assert.equal(root.innerHTML, before, "late metadata must not replace the fallback after failure");
});

for (const scenario of ["responsive", "changed original", "broken delivery"]) {
	test(`listed photo delivery keeps PNG recovery: ${scenario}`, async (t) => {
		const root = await setup(t, { count: 1 });
		const window = root.ownerDocument.defaultView;
		const fetch = window.fetch;
		window.fetch = async (...args) => {
			const response = await fetch(...args);
			response.headers.set("Content-Length", String(roadPhotoSources[1].originalBytes + (scenario === "changed original" ? 1 : 0)));
			return response;
		};
		const decode = window.HTMLImageElement.prototype.decode;
		let attempts = 0;
		window.HTMLImageElement.prototype.decode = async function () {
			attempts++;
			if (scenario === "broken delivery" && this.srcset) throw new Error("Invalid WebP");
			return decode.call(this);
		};
		await initRoadCarousel(root);
		const image = root.querySelector(".road-photo img");
		assert.ok(image.src.endsWith("/assets/images/students-pass/1.png"));
		if (scenario === "responsive") {
			assert.match(image.srcset, /\.webp \d+w, .*\.webp \d+w/);
			assert.match(image.sizes, /max-width: 768px/);
		} else {
			assert.equal(image.srcset, "");
			assert.equal(image.sizes, "");
		}
		assert.equal(attempts, scenario === "broken delivery" ? 2 : 1);
	});
}
