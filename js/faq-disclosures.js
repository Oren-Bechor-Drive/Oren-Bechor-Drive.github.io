import { createDetailsMotion } from "./details-motion.js";

export function initFaqDisclosures(root) {
	if (!root) return;

	const document = root.ownerDocument;
	const items = [...root.querySelectorAll(".faq-item")];
	const motion = createDetailsMotion(document, { duration: 220 });

	for (const item of items) {
		item.dataset.expanded = String(item.open);
		item.querySelector("summary").addEventListener("click", (event) => {
			event.preventDefault();
			const open = !motion.isOpen(item);
			const animate = event.detail > 0;
			motion.setOpen(item, open, animate);
			item.dataset.expanded = String(open);
			item.dataset.motion = animate ? "pointer" : "instant";
		});
	}

	document.addEventListener("keydown", motion.settle, true);
}
