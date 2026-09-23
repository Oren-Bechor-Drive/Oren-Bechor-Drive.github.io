// Own the difference between a details element's intended open state and the
// temporary open state needed to keep its contents rendered while closing.
export function createDetailsMotion(document, { duration }) {
	const window = document.defaultView;
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
	}

	function setOpen(item, open, animate = false) {
		// Sample before cancellation so reversals start at the visible height.
		const height = item.getBoundingClientRect().height;
		finish(item, open);
		if (!animate || reducedMotion?.matches || !item.animate) return;

		const target = item.getBoundingClientRect().height;
		item.open = true;
		item.style.height = `${height}px`;
		item.style.overflow = "clip";
		const animation = item.animate(
			{ height: [`${height}px`, `${target}px`] },
			{
				duration,
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

	reducedMotion?.addEventListener?.("change", settle);

	return {
		setOpen,
		settle,
		isOpen: (item) => transitions.get(item)?.open ?? item.open,
		hasPending: () => transitions.size > 0,
	};
}
