const METADATA_CONCURRENCY = 4;
const LOAD_TIMEOUT_MS = 8000;

export async function initRoadCarousel(root, photoSources) {
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
	let metadataComplete = false;
	let stopped = false;
	let shown = 0;
	let repeat;
	let startupTimer;
	let pendingFrame;
	let framePromise;
	let resized = false;

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

	function schedulePublish() {
		if (pendingFrame !== undefined) return framePromise;
		framePromise = new Promise((resolve) => {
			pendingFrame = browserWindow.requestAnimationFrame(() => {
				pendingFrame = undefined;
				try {
					publishAvailable();
				} catch (error) {
					controller.abort(error);
				} finally {
					resolve();
				}
			});
		});
		return framePromise;
	}

	function publishAvailable() {
		let count = shown;
		if (!stopped) {
			count = 0;
			while (records[count]?.image) count += 1;
		}
		// Decoding and metadata requests can finish together. Skip geometry until a row can change.
		const allShown = count && count === shown && metadataComplete && count === records.length;
		if (
			!resized &&
			(!count || count <= shown || (!shown && count < templates.length && !metadataComplete))
		) {
			if (allShown)
				root.dataset.ready = "true";
			return;
		}

		// Read layout once, before changing either row or the animation duration.
		const groupStyle = browserWindow.getComputedStyle(group);
		const gap = parseFloat(groupStyle.columnGap);
		const carStep = group.firstElementChild.getBoundingClientRect().width + gap;
		const viewportWidth = root.getBoundingClientRect().width;
		const oldDistance = group.getBoundingClientRect().width;
		const secondsPerCar = Number(
			browserWindow.getComputedStyle(root).getPropertyValue("--road-seconds-per-car"),
		);
		const minimumWidth = parseFloat(groupStyle.minWidth);
		const padding =
			parseFloat(groupStyle.paddingLeft) + parseFloat(groupStyle.paddingRight);
		const animation = track
			.getAnimations?.()
			.find((item) => item.animationName === "road-scroll");
		const oldDuration =
			parseFloat(root.style.getPropertyValue("--road-loop-duration")) * 1000;
		const offset =
			animation && oldDuration > 0
				? ((Number(animation.currentTime) % oldDuration) / oldDuration) * oldDistance
				: 0;
		// Widening may expose the duplicate everywhere. Hold that row until it can cover the viewport.
		const restart =
			!stopped && resized && shown &&
			(!metadataComplete || shown < records.length) &&
			oldDistance <= viewportWidth;
		const initialCount = Math.max(
			templates.length,
			Math.ceil(viewportWidth / carStep) + 1,
		);
		const minimum = metadataComplete
			? Math.min(initialCount, records.length)
			: initialCount;
		const canAppend =
			!stopped && count >= minimum && count > shown &&
			(restart || !animation || offset + viewportWidth <= oldDistance);
		// Equal-width flex items plus gaps and end padding determine the new row width.
		const distance = canAppend
			? Math.max(minimumWidth, count * carStep - gap + padding)
			: oldDistance;
		const duration = (distance / carStep) * secondsPerCar;

		const canUpdateTiming =
			(resized || canAppend) && distance > 0 && carStep > 0 && secondsPerCar > 0;
		if (canUpdateTiming)
			root.style.setProperty("--road-loop-duration", `${duration}s`);
		if (animation && resized && !canAppend && canUpdateTiming && oldDistance > 0)
			animation.currentTime = (offset / oldDistance) * duration * 1000;
		resized = false;
		if (restart) delete root.dataset.ready;
		if (!canAppend) {
			if (allShown)
				root.dataset.ready = "true";
			return;
		}

		const cars = records.slice(shown, count).map(({ image }, index) => {
			const car = templates[(shown + index) % templates.length].cloneNode(true);
			// The moving row needs its sprites ready before they enter the viewport.
			car.querySelector("img").loading = "eager";
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
		if (animation && !restart) {
			// Preserve physical position using the computed distance, without another layout read.
			animation.currentTime = (offset / distance) * duration * 1000;
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
		const optimized = photoSources[number];
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

	async function checkPhoto(number) {
		const url = new URL(
			`assets/images/students-pass/${number}.png`,
			document.baseURI,
		);
		const response = await withDeadline(
			browserWindow.fetch(url.href, {
				method: "HEAD",
				cache: "default",
				signal: controller.signal,
			}),
		);
		if (
			!response.ok ||
			!response.headers.get("Content-Type")?.startsWith("image/")
		) {
			throw new Error(
				`Unable to load listed student photo ${number}: HTTP ${response.status}`,
			);
		}
		// Ignore responses that settle after a failure or timeout.
		if (controller.signal.aborted) return;
		const record = {};
		records[number - 1] = record;
		// Start decoding immediately, including while sibling HEAD requests are pending.
		record.loaded = loadPhoto(number, response).then(
			(image) => {
				record.image = image;
				schedulePublish();
			},
			(error) => {
				record.error = error;
			},
		);
	}

	async function loadListedPhotos() {
		const numbers = Object.keys(photoSources).map(Number).sort((a, b) => a - b);
		let next = 0;
		async function loadNext() {
			while (next < numbers.length) {
				const number = numbers[next];
				next += 1;
				await checkPhoto(number);
			}
		}
		await Promise.all(
			Array.from(
				{ length: Math.min(METADATA_CONCURRENCY, numbers.length) },
				loadNext,
			),
		);
		metadataComplete = true;
		schedulePublish();
	}

	function resize() {
		resized = true;
		schedulePublish();
	}

	root.setAttribute("aria-busy", "true");
	startupTimer = browserWindow.setTimeout(
		() => controller.abort(new Error("Student gallery loading timed out")),
		LOAD_TIMEOUT_MS,
	);
	track.addEventListener("animationiteration", schedulePublish);
	browserWindow.addEventListener("resize", resize);
	motionPreference?.addEventListener("change", schedulePublish);
	try {
		await loadListedPhotos();
		await Promise.all(records.map((record) => record.loaded));
		const failed = records.find((record) => record.error);
		if (failed) throw failed.error;
		await withDeadline(schedulePublish());
	} finally {
		stopped = !metadataComplete || records.some((record) => record.error);
		browserWindow.clearTimeout(startupTimer);
		controller.abort();
		if (pendingFrame !== undefined) {
			browserWindow.cancelAnimationFrame(pendingFrame);
			pendingFrame = undefined;
		}
		root.setAttribute("aria-busy", "false");
		if (!shown) {
			track.removeEventListener("animationiteration", schedulePublish);
			browserWindow.removeEventListener("resize", resize);
			motionPreference?.removeEventListener("change", schedulePublish);
		}
	}
}
