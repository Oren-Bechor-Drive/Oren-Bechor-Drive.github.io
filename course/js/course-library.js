const subjects = [...document.querySelectorAll(".subject")];
const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
const form = document.querySelector(".library-search");
const input = document.querySelector("#topic-search");
const clearButton = document.querySelector(".clear-search");
const status = document.querySelector("[data-search-status]");
const empty = document.querySelector(".search-empty");
const browser = document.querySelector(".library-browser");
const topicList = document.querySelector(".topic-list");
const reader = document.querySelector(".topic-reader");
const subjectList = document.querySelector(".subject-list");
const desktop = matchMedia("(min-width: 900px)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let selectedSubject = subjects[0];

// Both presentations use the authored outlines as their only content source.
const tabs = new Map(
	subjects.map((subject) => {
		const tab = document.createElement("button");
		tab.type = "button";
		tab.className = "topic-tab";
		tab.id = `tab-${subject.id}`;
		tab.dataset.topic = subject.id;
		tab.setAttribute("role", "tab");
		tab.setAttribute("aria-controls", reader.id);
		tab.textContent = subject.querySelector("h3").textContent;
		tab.addEventListener("click", (event) =>
			renderSubject(subject, event.detail > 0),
		);
		topicList.append(tab);
		return [subject.id, tab];
	}),
);

function renderSubject(subject, animate = false) {
	reader.dataset.motion = String(animate && subject !== selectedSubject);
	selectedSubject = subject;
	reader.dataset.subject = subject.id;
	reader.setAttribute("aria-labelledby", tabs.get(subject.id).id);
	reader.replaceChildren(
		...["summary h3", "summary > p", ".subject-outline"].map((selector) =>
			subject.querySelector(selector).cloneNode(true),
		),
	);
	for (const [id, tab] of tabs) {
		const selected = id === subject.id;
		tab.setAttribute("aria-selected", String(selected));
		tab.tabIndex = selected ? 0 : -1;
	}
}

function updatePresentation() {
	const hasResults = subjects.some((subject) => !subject.hidden);
	browser.hidden = !desktop.matches || !hasResults;
	subjectList.hidden = desktop.matches;
}

function normalize(value) {
	return value
		.normalize("NFKD")
		.replace(/[\u0591-\u05c7]/g, "")
		.replace(/[-־]/g, " ")
		.toLocaleLowerCase("he")
		.trim();
}

// Search the baseline HTML, including the outlines. It remains usable without JS.
const searchable = subjects.map((subject) => ({
	subject,
	text: normalize(`${subject.textContent} ${subject.dataset.keywords}`),
}));

function filterSubjects() {
	const words = normalize(input.value).split(/\s+/).filter(Boolean);
	let count = 0;
	for (const { subject, text } of searchable) {
		subject.hidden = !words.every((word) => text.includes(word));
		tabs.get(subject.id).hidden = subject.hidden;
		if (!subject.hidden) count++;
	}
	if (count && selectedSubject.hidden)
		renderSubject(subjects.find((subject) => !subject.hidden));
	updatePresentation();
	clearButton.hidden = words.length === 0;
	empty.hidden = count !== 0;
	status.textContent = words.length
		? `נמצאו ${count} נושאים`
		: `${subjects.length} נושאים לבחירה`;
	topicDisclosures.filterChanged();
}

function clearSearch() {
	input.value = "";
	filterSubjects();
}

function openLinkedSubject(focus = false) {
	const subject = subjectsById.get(location.hash.slice(1));
	if (!subject) return;
	clearSearch();
	renderSubject(subject);
	topicDisclosures.open(subject);
	const control = desktop.matches
		? tabs.get(subject.id)
		: subject.querySelector("summary");
	if (focus) control.focus({ preventScroll: true });
	(desktop.matches ? browser : subject).scrollIntoView({ block: "start" });
}

function initTopicDisclosures() {
	const transitions = new Map();
	let positionFrame;

	function cancelPositionTracking() {
		cancelAnimationFrame(positionFrame);
		positionFrame = undefined;
	}

	// Measure the whole card so the description inside summary moves with the outline.
	// Keep closing content rendered until its height reaches the compact summary.
	function setOpen(subject, open, animate = false) {
		const height = subject.getBoundingClientRect().height;
		transitions.get(subject)?.animation.cancel();
		transitions.delete(subject);
		subject.style.height = "";
		subject.style.overflow = "";
		subject.open = open;
		if (!animate || reducedMotion.matches || desktop.matches) return;
		const target = subject.getBoundingClientRect().height;
		subject.open = true;
		subject.style.height = `${height}px`;
		subject.style.overflow = "clip";
		const animation = subject.animate(
			{ height: [`${height}px`, `${target}px`] },
			{
				duration: 200,
				easing: getComputedStyle(subject)
					.getPropertyValue("--ease-out")
					.trim(),
				fill: "forwards",
			},
		);
		transitions.set(subject, { animation, open });
		animation.onfinish = () => setOpen(subject, open);
	}

	function settle() {
		for (const [subject, { open }] of transitions) setOpen(subject, open);
	}

	function preserveSummaryPosition(subject, top) {
		const summary = subject.querySelector("summary");
		const scrollPadding = Number.parseFloat(
			getComputedStyle(document.documentElement).scrollPaddingTop,
		);
		const targetTop = Math.max(top, scrollPadding);
		const adjust = () => {
			positionFrame = undefined;
			if (desktop.matches) return;
			window.scrollBy(0, summary.getBoundingClientRect().top - targetTop);
			if (transitions.size) positionFrame = requestAnimationFrame(adjust);
		};
		positionFrame = requestAnimationFrame(adjust);
	}

	function openExclusively(subject, animate = false) {
		for (const other of subjects) {
			if (other !== subject && other.open) setOpen(other, false, animate);
		}
		setOpen(subject, true, animate);
	}

	for (const subject of subjects) {
		// Native named details retain exclusive behavior if this module does not load.
		subject.removeAttribute("name");
		subject.querySelector("summary").addEventListener("click", (event) => {
			event.preventDefault();
			cancelPositionTracking();
			const open = !(transitions.get(subject)?.open ?? subject.open);
			if (open) {
				const summaryTop = event.currentTarget.getBoundingClientRect().top;
				const precedingSubjectIsOpen = subjects.some(
					(other) =>
						other !== subject &&
						other.open &&
						other.compareDocumentPosition(subject) &
							Node.DOCUMENT_POSITION_FOLLOWING,
				);
				renderSubject(subject);
				openExclusively(subject, event.detail > 0);
				if (!desktop.matches && precedingSubjectIsOpen)
					preserveSummaryPosition(subject, summaryTop);
			} else setOpen(subject, false, event.detail > 0);
		});
	}

	// Keyboard and viewport changes finish disclosure motion before changing focus.
	document.addEventListener(
		"keydown",
		() => {
			cancelPositionTracking();
			settle();
		},
		true,
	);
	desktop.addEventListener("change", () => {
		cancelPositionTracking();
		settle();
		if (!desktop.matches && !selectedSubject.hidden)
			openExclusively(selectedSubject);
	});

	// Reduced motion finishes at the final height before position tracking stops.
	reducedMotion.addEventListener("change", settle);
	document.addEventListener("pointerdown", cancelPositionTracking, true);
	document.addEventListener("wheel", cancelPositionTracking, { passive: true });

	return {
		filterChanged: cancelPositionTracking,
		open(subject) {
			cancelPositionTracking();
			openExclusively(subject);
		},
	};
}

const topicDisclosures = initTopicDisclosures();

// Keyboard interaction also settles pointer motion in the desktop preview.
document.addEventListener(
	"keydown",
	() => {
		reader.dataset.motion = "false";
	},
	true,
);

topicList.addEventListener("keydown", (event) => {
	const visible = [...tabs.values()].filter((tab) => !tab.hidden);
	const index = visible.indexOf(event.target);
	if (index < 0) return;
	let next;
	if (event.key === "ArrowDown") next = (index + 1) % visible.length;
	else if (event.key === "ArrowUp")
		next = (index - 1 + visible.length) % visible.length;
	else if (event.key === "Home") next = 0;
	else if (event.key === "End") next = visible.length - 1;
	else return;
	event.preventDefault();
	renderSubject(subjectsById.get(visible[next].dataset.topic));
	visible[next].focus();
});

desktop.addEventListener("change", () => {
	const focused =
		browser.contains(document.activeElement) ||
		subjectList.contains(document.activeElement);
	updatePresentation();
	if (focused && !selectedSubject.hidden) {
		const control = desktop.matches
			? tabs.get(selectedSubject.id)
			: selectedSubject.querySelector("summary");
		control.focus({ preventScroll: true });
	}
});

input.addEventListener("input", filterSubjects);
form.addEventListener("submit", (event) => event.preventDefault());
clearButton.addEventListener("click", () => {
	clearSearch();
	input.focus();
});
document.querySelector("[data-show-all]").addEventListener("click", () => {
	clearSearch();
	input.focus();
});
window.addEventListener("hashchange", () => openLinkedSubject(true));
form.hidden = false;
renderSubject(selectedSubject);
filterSubjects();
openLinkedSubject();
