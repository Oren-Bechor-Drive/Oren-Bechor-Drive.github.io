// Preserve native editing focus; show rings only after keyboard navigation.
document.addEventListener("pointerdown", () => {
	document.documentElement.dataset.accountKeyboard = "false";
}, { capture: true });
document.addEventListener("keydown", event => {
	if (event.key === "Tab") document.documentElement.dataset.accountKeyboard = "true";
}, { capture: true });
