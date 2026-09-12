export async function initRoadCarousel(root) {
	const document = root.ownerDocument;
	const browserWindow = document.defaultView;
	const group = root.querySelector(".road-carousel-group");
	const templates = [...group.children];
	const sources = [];

	root.setAttribute("aria-busy", "true");
	try {
		// Static hosting cannot list a directory. Consecutive filenames end at 404.
		for (let number = 1; ; number += 1) {
			const url = new URL(
				`assets/images/students-pass/${number}.png`,
				document.baseURI,
			);
			const response = await browserWindow.fetch(url.href, {
				method: "HEAD",
				cache: "no-cache",
			});
			if (response.status === 404) break;
			if (
				!response.ok ||
				!response.headers.get("Content-Type")?.startsWith("image/")
			) {
				throw new Error(
					`Unable to discover student photo ${number}: HTTP ${response.status}`,
				);
			}
			sources.push(url.href);
		}
		if (sources.length === 0) return;

		// Finish loading before replacing the working static fallback.
		const photos = await Promise.all(
			sources.map(async (src, index) => {
				const image = document.createElement("img");
				image.src = src;
				image.alt = `אורן בכור ותלמידיו לאחר מעבר הטסט, תמונה ${index + 1}`;
				image.draggable = false;
				image.decoding = "async";
				await image.decode();
				image.width = image.naturalWidth;
				image.height = image.naturalHeight;
				return image;
			}),
		);

		// Shuffle car colors only; photo order always remains 1, 2, 3, ...
		for (let index = templates.length - 1; index > 0; index -= 1) {
			const randomIndex = Math.floor(Math.random() * (index + 1));
			[templates[index], templates[randomIndex]] = [
				templates[randomIndex],
				templates[index],
			];
		}
		const cars = photos.map((photo, index) => {
			const car = templates[index % templates.length].cloneNode(true);
			car.querySelector(".road-photo").replaceChildren(photo);
			return car;
		});
		group.replaceChildren(...cars);
		const repeat = group.cloneNode(true);
		repeat.setAttribute("aria-hidden", "true");
		repeat.setAttribute("inert", "");
		group.after(repeat);
		function updateDuration() {
			const secondsPerCar = Number(
				browserWindow
					.getComputedStyle(root)
					.getPropertyValue("--road-seconds-per-car"),
			);
			const gap = parseFloat(
				browserWindow.getComputedStyle(group).columnGap,
			);
			const carStep =
				group.firstElementChild.getBoundingClientRect().width + gap;
			const distance = group.getBoundingClientRect().width;
			if (distance > 0 && carStep > 0 && secondsPerCar > 0) {
				root.style.setProperty(
					"--road-loop-duration",
					`${(distance / carStep) * secondsPerCar}s`,
				);
			}
		}

		// Layout is viewport-driven; resizing also picks up the phone cadence.
		updateDuration();
		browserWindow.addEventListener("resize", updateDuration);
		root.dataset.ready = "true";
	} finally {
		// Also uncover the static fallback after an empty gallery or a load failure.
		root.setAttribute("aria-busy", "false");
	}
}
