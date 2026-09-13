import { roadPhotoSources } from "./road-photo-sources.js";

const DISCOVERY_CONCURRENCY = 4;
const LOAD_TIMEOUT_MS = 8000;

export async function initRoadCarousel(root) {
	const document = root.ownerDocument;
	const browserWindow = document.defaultView;
	const group = root.querySelector(".road-carousel-group");
	const track = group.parentElement;
	const templates = [...group.children];
	const records = [];
	const controller = new browserWindow.AbortController();
	const motionPreference = browserWindow.matchMedia?.(
		"(prefers-reduced-motion: reduce)",
	);
	let discoveryComplete = false;
	let stopped = false;
	let shown = 0;
	let repeat;
	let startupTimer;

	// Deadlines reject even if a host or image decoder never settles.
	function withDeadline(operation) {
		return new Promise((resolve, reject) => {
			const signal = controller.signal;
			const cleanup = () => {
				browserWindow.clearTimeout(timer);
				signal.removeEventListener("abort", abort);
			};
			const abort = () => {
				cleanup();
				reject(signal.reason);
			};
			const timer = browserWindow.setTimeout(
				() => controller.abort(new Error("Student gallery loading timed out")),
				LOAD_TIMEOUT_MS,
			);
			if (signal.aborted) abort();
			else signal.addEventListener("abort", abort, { once: true });
			operation.then(
				(value) => {
					cleanup();
					resolve(value);
				},
				(error) => {
					cleanup();
					reject(error);
				},
			);
		});
	}

	for (let index = templates.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[templates[index], templates[randomIndex]] = [
			templates[randomIndex],
			templates[index],
		];
	}

	function updateDuration() {
		const secondsPerCar = Number(
			browserWindow
				.getComputedStyle(root)
				.getPropertyValue("--road-seconds-per-car"),
		);
		const gap = parseFloat(browserWindow.getComputedStyle(group).columnGap);
		const carStep = group.firstElementChild.getBoundingClientRect().width + gap;
		const distance = group.getBoundingClientRect().width;
		if (distance > 0 && carStep > 0 && secondsPerCar > 0) {
			root.style.setProperty(
				"--road-loop-duration",
				`${(distance / carStep) * secondsPerCar}s`,
			);
		}
	}

	function publishAvailable() {
		if (stopped) return;
		let count = 0;
		while (records[count]?.image) count += 1;
		const carStep =
			group.firstElementChild.getBoundingClientRect().width +
			parseFloat(browserWindow.getComputedStyle(group).columnGap);
		// Keep the initial row wider than the viewport, so later appends have a safe seam.
		const initialCount = Math.max(
			templates.length,
			Math.ceil(root.getBoundingClientRect().width / carStep) + 1,
		);
		const minimum = discoveryComplete
			? Math.min(initialCount, records.length)
			: initialCount;
		if (
			count &&
			count === shown &&
			discoveryComplete &&
			count === records.length
		) {
			root.dataset.ready = "true";
		}
		if (!count || count < minimum || count <= shown) return;

		// Extending the first row moves its duplicate. Wait if that duplicate is visible.
		const animation = track
			.getAnimations?.()
			.find((item) => item.animationName === "road-scroll");
		const oldDistance = group.getBoundingClientRect().width;
		const oldDuration =
			parseFloat(root.style.getPropertyValue("--road-loop-duration")) * 1000;
		const offset =
			animation && oldDuration > 0
				? ((Number(animation.currentTime) % oldDuration) / oldDuration) *
					oldDistance
				: 0;
		if (animation && offset + root.getBoundingClientRect().width > oldDistance)
			return;

		const cars = records.slice(shown, count).map(({ image }, index) => {
			const car = templates[(shown + index) % templates.length].cloneNode(true);
			car.querySelector(".road-photo").replaceChildren(image);
			return car;
		});
		if (!shown) group.replaceChildren(...cars);
		else group.append(...cars);
		repeat?.remove();
		repeat = group.cloneNode(true);
		repeat.setAttribute("aria-hidden", "true");
		repeat.setAttribute("inert", "");
		group.after(repeat);
		shown = count;
		updateDuration();
		if (animation) {
			// Preserve physical position, rather than the old loop's percentage.
			const duration =
				parseFloat(root.style.getPropertyValue("--road-loop-duration")) * 1000;
			animation.currentTime =
				(offset / group.getBoundingClientRect().width) * duration;
		}
		browserWindow.clearTimeout(startupTimer);
		root.dataset.ready = "true";
		root.setAttribute("aria-busy", "false");
	}

	async function loadPhoto(number, response) {
		const image = document.createElement("img");
		const src = new URL(
			`assets/images/students-pass/${number}.png`,
			document.baseURI,
		).href;
		const optimized = roadPhotoSources[number];
		image.alt = `אורן בכור ותלמידיו לאחר מעבר הטסט, תמונה ${number}`;
		image.draggable = false;
		image.decoding = "async";
		image.fetchPriority = number <= templates.length ? "high" : "low";
		// A replacement PNG with a different size uses the original until re-optimized.
		if (
			optimized &&
			response.headers.get("Content-Length") === String(optimized.originalBytes)
		) {
			image.sizes = optimized.sizes;
			image.srcset = optimized.srcset;
		}
		image.src = src;
		try {
			await withDeadline(image.decode());
		} catch (error) {
			if (!image.srcset || stopped) throw error;
			image.removeAttribute("srcset");
			image.removeAttribute("sizes");
			await withDeadline(image.decode());
		}
		image.width = image.naturalWidth;
		image.height = image.naturalHeight;
		return image;
	}

	async function probe(number) {
		const url = new URL(
			`assets/images/students-pass/${number}.png`,
			document.baseURI,
		);
		const request = (cache) =>
			withDeadline(
				browserWindow.fetch(url.href, {
					method: "HEAD",
					cache,
					signal: controller.signal,
				}),
			);
		let response = await request("default");
		// Recheck the end marker so a cached 404 does not hide newly uploaded photos.
		if (response.status === 404) response = await request("no-cache");
		if (response.status === 404) return null;
		if (
			!response.ok ||
			!response.headers.get("Content-Type")?.startsWith("image/")
		) {
			throw new Error(
				`Unable to discover student photo ${number}: HTTP ${response.status}`,
			);
		}
		// A slower speculative response must not reopen an already confirmed gap.
		if (stopped || (discoveryComplete && number > records.length)) return null;
		const record = {};
		records[number - 1] = record;
		// Start decoding immediately, including while sibling HEAD requests are pending.
		record.loaded = loadPhoto(number, response).then(
			(image) => {
				record.image = image;
				publishAvailable();
			},
			(error) => {
				record.error = error;
			},
		);
		return record;
	}

	async function discover() {
		for (let first = 1; !stopped; first += DISCOVERY_CONCURRENCY) {
			const batch = Array.from({ length: DISCOVERY_CONCURRENCY }, (_, index) =>
				probe(first + index).then(
					(value) => ({ value }),
					(reason) => ({ status: "rejected", reason }),
				),
			);
			for (const [index, pending] of batch.entries()) {
				const result = await pending;
				if (stopped) return;
				if (result.status === "rejected") throw result.reason;
				if (!result.value) {
					records.length = first + index - 1;
					discoveryComplete = true;
					publishAvailable();
					return;
				}
			}
			publishAvailable();
		}
	}

	function resize() {
		updateDuration();
		// Widening can expose the duplicate everywhere. Hold the loaded row still
		// until it can cover the new viewport; restarting here belongs to the resize.
		if (
			shown &&
			(!discoveryComplete || shown < records.length) &&
			group.getBoundingClientRect().width <= root.getBoundingClientRect().width
		)
			delete root.dataset.ready;
		publishAvailable();
	}

	root.setAttribute("aria-busy", "true");
	startupTimer = browserWindow.setTimeout(
		() => controller.abort(new Error("Student gallery loading timed out")),
		LOAD_TIMEOUT_MS,
	);
	track.addEventListener("animationiteration", publishAvailable);
	browserWindow.addEventListener("resize", resize);
	motionPreference?.addEventListener("change", publishAvailable);
	try {
		await discover();
		await Promise.all(records.map((record) => record.loaded));
		const failed = records.find((record) => record.error);
		if (failed) throw failed.error;
		publishAvailable();
	} finally {
		stopped = !discoveryComplete || records.some((record) => record.error);
		browserWindow.clearTimeout(startupTimer);
		controller.abort();
		root.setAttribute("aria-busy", "false");
		if (!shown) {
			track.removeEventListener("animationiteration", publishAvailable);
			browserWindow.removeEventListener("resize", resize);
			motionPreference?.removeEventListener("change", publishAvailable);
		}
	}
}
