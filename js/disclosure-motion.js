// Shared by mobile navigation and the public quiz selector. CSS owns timing;
// semantic state changes immediately, including while an exit is still visible.
export function initDisclosureMotion(
	trigger,
	surface,
	query,
	desktopVisible = false,
) {
	const document = trigger.ownerDocument;
	const window = document.defaultView;
	const mobile = window?.matchMedia?.(query);
	let focusedControl = trigger.contains(document.activeElement) || surface.contains(document.activeElement)
		? document.activeElement
		: undefined;

	// CSS can hide a focused control before the breakpoint event is delivered.
	document.addEventListener("focusin", (event) => {
		focusedControl = trigger.contains(event.target) || surface.contains(event.target)
			? event.target
			: undefined;
	});
	document.addEventListener("focusout", (event) => {
		if (event.target === focusedControl && event.target.getClientRects().length)
			focusedControl = undefined;
	});

	function releasePress() {
		delete trigger.dataset.pressed;
	}

	function useKeyboard() {
		surface.dataset.motion = "instant";
		trigger.dataset.input = "keyboard";
		releasePress();
	}

	document.addEventListener(
		"pointerdown",
		() => {
			surface.dataset.motion = "pointer";
			trigger.dataset.input = "pointer";
		},
		true,
	);
	document.addEventListener("keydown", useKeyboard, true);
	// Assistive technology and programmatic activation need no entrance delay.
	document.addEventListener(
		"click",
		(event) => {
			if (event.detail === 0) useKeyboard();
		},
		true,
	);
	trigger.addEventListener("pointerdown", (event) => {
		if (event.isPrimary && event.button === 0)
			trigger.dataset.pressed = "true";
	});
	trigger.addEventListener("pointerleave", releasePress);
	document.addEventListener("pointerup", releasePress);
	document.addEventListener("pointercancel", releasePress);
	window?.addEventListener("blur", releasePress);

	function setOpen(open) {
		const expanded = open && (mobile?.matches ?? true);
		const visible =
			expanded || (desktopVisible && mobile && !mobile.matches);
		if (!visible && surface.contains(document.activeElement))
			trigger.focus({ preventScroll: true });
		trigger.setAttribute("aria-expanded", String(expanded));
		surface.dataset.open = String(expanded);
		surface.hidden = !visible;
		surface.inert = !visible;
	}

	mobile?.addEventListener?.("change", () => {
		const previousFocus = focusedControl;
		useKeyboard();
		setOpen(false);
		if (!desktopVisible || !previousFocus) return;
		if (mobile.matches && surface.contains(previousFocus))
			trigger.focus({ preventScroll: true });
		else if (!mobile.matches && trigger.contains(previousFocus))
			surface.querySelector("a[href]")?.focus({ preventScroll: true });
	});
	setOpen(false);
	return setOpen;
}
