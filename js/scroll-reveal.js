export function initScrollReveals(document) {
	const window = document.defaultView;
	const roots = [...document.querySelectorAll("[data-scroll-reveal]")];
	if (!window?.IntersectionObserver || roots.length === 0) return;

	const observer = new window.IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				reveal(entry.target);
			}
		},
		{ rootMargin: "0px 0px -12%", threshold: 0.2 },
	);

	function reveal(root, instant = false) {
		if (instant) delete root.dataset.scrollMotion;
		root.dataset.scrollState = "visible";
		observer.unobserve(root);
		if (instant) {
			root.querySelectorAll(".scroll-reveal-target").forEach((target) => {
				target
					.getAnimations()
					.forEach((animation) => animation.finish());
			});
		}
	}

	for (const root of roots) {
		root.addEventListener("focusin", () => reveal(root, true), {
			once: true,
		});
		if (root.contains(document.activeElement)) reveal(root, true);
		else root.dataset.scrollState = "pending";
	}
	window.requestAnimationFrame(() => {
		for (const root of roots) {
			if (root.dataset.scrollState === "visible") continue;
			root.dataset.scrollMotion = "ready";
			observer.observe(root);
		}
	});
}
