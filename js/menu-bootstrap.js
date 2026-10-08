// Reserve the compact header before deferred modules load. Failed enhancement
// restores the authored links; the entry module owns the working menu.
(() => {
	if (!("noModule" in document.createElement("script"))) return;
	const root = document.documentElement;
	root.dataset.menuPending = "true";

	function restoreFallback(event) {
		if (
			event &&
			event.target !== window &&
			!event.target?.matches?.('script[src="js/script.js"]')
		) return;
		if (!root.hasAttribute("data-menu-enhanced")) root.dataset.menuFallback = "true";
		delete root.dataset.menuPending;
		window.removeEventListener("error", restoreFallback, true);
		window.clearTimeout(deadline);
	}

	window.addEventListener("error", restoreFallback, true);
	const deadline = window.setTimeout(restoreFallback, 3000);
	window.addEventListener("load", () => restoreFallback(), { once: true });
})();
