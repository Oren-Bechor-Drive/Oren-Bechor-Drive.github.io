export function initFaqDisclosures(root) {
	if (!root) return;

	const document = root.ownerDocument;
	const window = document.defaultView;
	const items = [...root.querySelectorAll(".faq-item")];
	const reducedMotion = window?.matchMedia?.("(prefers-reduced-motion: reduce)");
	const transitions = new Map();

	function finish(item, open) {
		const current = transitions.get(item);
		if (current) {
			current.animation.onfinish = null;
			current.animation.cancel();
			transitions.delete(item);
		}
		item.style.height = "";
		item.style.overflow = "";
		item.open = open;
		item.dataset.expanded = String(open);
	}

	function setOpen(item, open, animate = false) {
		const height = item.getBoundingClientRect().height;
		const current = transitions.get(item);
		if (current) {
			current.animation.onfinish = null;
			current.animation.cancel();
			transitions.delete(item);
		}
		item.style.height = "";
		item.style.overflow = "";
		item.open = open;
		item.dataset.expanded = String(open);
		item.dataset.motion = animate ? "pointer" : "instant";

		if (!animate || reducedMotion?.matches || !item.animate) return;

		const target = item.getBoundingClientRect().height;
		item.open = true;
		item.style.height = `${height}px`;
		item.style.overflow = "clip";
		const animation = item.animate(
			{ height: [`${height}px`, `${target}px`] },
			{
				duration: 220,
				easing: window
					.getComputedStyle(item)
					.getPropertyValue("--ease-out")
					.trim(),
				fill: "forwards",
			},
		);
		transitions.set(item, { animation, open });
		animation.onfinish = () => finish(item, open);
	}

	function settle() {
		for (const [item, { open }] of transitions) finish(item, open);
	}

	for (const item of items) {
		item.dataset.expanded = String(item.open);
		item.querySelector("summary").addEventListener("click", (event) => {
			event.preventDefault();
			const open = !(transitions.get(item)?.open ?? item.open);
			setOpen(item, open, event.detail > 0);
		});
	}

	document.addEventListener("keydown", settle, true);
	reducedMotion?.addEventListener?.("change", settle);
}
