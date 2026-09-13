// Shared by the mobile navigation and learning-topic list. CSS owns timing;
// semantic state changes immediately, including while an exit is still visible.
export function initDisclosureMotion(trigger, surface, query, desktopVisible = false) {
	const document = trigger.ownerDocument;
	const window = document.defaultView;
	const mobile = window?.matchMedia?.(query);

	function releasePress() {
		delete trigger.dataset.pressed;
	}

	function useKeyboard() {
		surface.dataset.motion = "instant";
		trigger.dataset.input = "keyboard";
		releasePress();
	}

	document.addEventListener("pointerdown", () => {
		surface.dataset.motion = "pointer";
		trigger.dataset.input = "pointer";
	}, true);
	document.addEventListener("keydown", useKeyboard, true);
	// Assistive technology and programmatic activation need no entrance delay.
	document.addEventListener("click", event => {
		if (event.detail === 0) useKeyboard();
	}, true);
	trigger.addEventListener("pointerdown", event => {
		if (event.isPrimary && event.button === 0) trigger.dataset.pressed = "true";
	});
	trigger.addEventListener("pointerleave", releasePress);
	document.addEventListener("pointerup", releasePress);
	document.addEventListener("pointercancel", releasePress);
	window?.addEventListener("blur", releasePress);

	function setOpen(open) {
		const expanded = open && (mobile?.matches ?? true);
		const visible = expanded || (desktopVisible && mobile && !mobile.matches);
		trigger.setAttribute("aria-expanded", String(expanded));
		surface.dataset.open = String(expanded);
		surface.hidden = !visible;
		surface.inert = !visible;
	}

	mobile?.addEventListener?.("change", () => {
		useKeyboard();
		setOpen(false);
	});
	setOpen(false);
	return setOpen;
}
