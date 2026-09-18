import { initDisclosureMotion } from "./disclosure-motion.js";

export function initTopicExplorer(root) {
	const cards = [...root.querySelectorAll(".topic-card")];
	const panel = root.querySelector("[data-topic-panel]");
	const title = panel?.querySelector("[data-topic-panel-title]");
	const description = panel?.querySelector("[data-topic-panel-description]");
	const summaries = root.querySelector("[data-topic-summaries]");
	const descriptions = [...(summaries?.querySelectorAll("p") ?? [])];

	if (
		cards.length === 0 ||
		!panel ||
		!title ||
		!description ||
		descriptions.length !== cards.length
	) {
		throw new Error("Missing required topic panel elements");
	}

	const browserWindow = root.ownerDocument.defaultView;
	const motionPreference = browserWindow?.matchMedia?.(
		"(prefers-reduced-motion: reduce)",
	);
	const document = root.ownerDocument;
	const picker = document.createElement("div");
	picker.className = "topic-picker";
	const label = document.createElement("span");
	label.id = "topic-picker-label";
	label.textContent = "בחרו נושא לימוד";
	const dropdown = document.createElement("button");
	dropdown.type = "button";
	dropdown.className = "topic-select";
	dropdown.id = "topic-picker-value";
	dropdown.setAttribute("aria-haspopup", "listbox");
	dropdown.setAttribute("aria-expanded", "false");
	dropdown.setAttribute("aria-labelledby", `${label.id} ${dropdown.id}`);
	const menu = document.createElement("div");
	menu.className = "topic-options";
	menu.id = "topic-options";
	menu.hidden = true;
	menu.setAttribute("role", "listbox");
	menu.setAttribute("aria-labelledby", label.id);
	dropdown.setAttribute("aria-controls", menu.id);
	const options = cards.map((card) => {
		const option = document.createElement("button");
		option.type = "button";
		option.className = "topic-option";
		option.tabIndex = -1;
		option.setAttribute("role", "option");
		option.textContent = card.textContent.trim();
		option.addEventListener("click", (event) => {
			select(card, { animate: event.detail > 0 });
			setOpen(false, true);
		});
		menu.append(option);
		return option;
	});
	picker.append(label, dropdown, menu);
	root.prepend(picker);
	root.dataset.topicDropdown = "true";
	const setDisclosureOpen = initDisclosureMotion(
		dropdown,
		menu,
		"(max-width: 639px)",
	);

	function setOpen(open, restoreFocus = false) {
		setDisclosureOpen(open);
		if (open)
			options
				.find(
					(option) => option.getAttribute("aria-selected") === "true",
				)
				.focus();
		else if (restoreFocus) dropdown.focus();
	}

	dropdown.addEventListener("click", () => setOpen(menu.hidden));
	picker.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !menu.hidden) {
			event.preventDefault();
			setOpen(false, true);
			return;
		}
		if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
			return;
		event.preventDefault();
		if (menu.hidden) {
			setOpen(true);
			return;
		}
		const index = options.indexOf(document.activeElement);
		const next =
			event.key === "Home"
				? 0
				: event.key === "End"
					? options.length - 1
					: (index +
							(event.key === "ArrowDown" ? 1 : -1) +
							options.length) %
						options.length;
		options[next].focus();
	});
	document.addEventListener("pointerdown", (event) => {
		if (!picker.contains(event.target)) setOpen(false);
	});
	picker.addEventListener("focusout", (event) => {
		if (!picker.contains(event.relatedTarget)) setOpen(false);
	});
	let pendingUpdate;
	let selectedCard;

	function updateContent(card) {
		browserWindow?.clearTimeout(pendingUpdate);
		title.textContent = card.textContent.trim();
		description.textContent =
			descriptions[cards.indexOf(card)].textContent.trim();
		panel.dataset.updating = "false";
	}

	function select(card, { animate = true } = {}) {
		if (card === selectedCard && animate) return;
		selectedCard = card;
		const withMotion = animate && !motionPreference?.matches;
		panel.dataset.motion = withMotion ? "pointer" : "instant";
		dropdown.textContent = card.textContent.trim();
		options.forEach((option, index) => {
			option.setAttribute("aria-selected", String(cards[index] === card));
		});
		cards.forEach((candidate) => {
			const selected = candidate === card;
			candidate.dataset.active = String(selected);
			candidate.setAttribute("aria-expanded", String(selected));
		});

		browserWindow?.clearTimeout(pendingUpdate);
		if (!withMotion) {
			updateContent(card);
			return;
		}

		panel.dataset.updating = "true";
		pendingUpdate = browserWindow?.setTimeout(
			() => updateContent(card),
			110,
		);
	}

	motionPreference?.addEventListener?.("change", () => {
		if (motionPreference.matches) {
			panel.dataset.motion = "instant";
			updateContent(selectedCard);
		}
	});

	cards.forEach((card, index) => {
		card.addEventListener("click", (event) =>
			select(card, { animate: event.detail > 0 }),
		);
		card.addEventListener("keydown", (event) => {
			let nextIndex;
			if (event.key === "ArrowLeft")
				nextIndex = (index + 1) % cards.length;
			if (event.key === "ArrowRight")
				nextIndex = (index - 1 + cards.length) % cards.length;
			if (event.key === "Home") nextIndex = 0;
			if (event.key === "End") nextIndex = cards.length - 1;
			if (nextIndex === undefined) return;
			event.preventDefault();
			cards[nextIndex].focus();
		});
	});

	const initiallyActive =
		cards.find((card) => card.dataset.active === "true") ?? cards[0];
	select(initiallyActive, { animate: false });
	summaries.hidden = true;
	panel.hidden = false;
	const rail = root.querySelector(".topic-rail");
	if (rail) rail.hidden = false;
	const prompt = root
		.closest(".course-topics")
		?.querySelector(".topic-prompt");
	if (prompt) prompt.textContent = "בחרו נושא וראו מה תלמדו";
}
