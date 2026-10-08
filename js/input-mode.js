// Preserve native editing focus; show rings only after keyboard navigation.
document.addEventListener("pointerdown", () => {
	document.documentElement.dataset.inputMode = "pointer";
}, { capture: true });
document.addEventListener("keydown", event => {
	const controlNavigation = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
		&& event.target.matches?.('input[type="radio"], select, button[role="combobox"], [role="tab"]');
	if (event.key === "Tab" || controlNavigation) {
		document.documentElement.dataset.inputMode = "keyboard";
	}
}, { capture: true });
