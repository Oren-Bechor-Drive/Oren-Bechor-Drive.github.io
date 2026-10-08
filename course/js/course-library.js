import { createDetailsMotion } from "../../js/details-motion.js";
import "../../js/input-mode.js";

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
		...[
			"summary h3",
			"summary > p",
			".subject-meta",
			".subject-learn",
			".subject-outline",
		].map((selector) => subject.querySelector(selector).cloneNode(true)),
	);
	reader.querySelector(".subject-outline .subject-meta").remove();
	reader.querySelector(".subject-outline .subject-learn").remove();
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

// These are course words, not a general Hebrew stemmer. Unknown words stay intact.
const wordGroups = [
	["פנייה", "פניה", "פניות", "פניית"],
	["מעגל", "מעגלים", "מעגלי"],
	["כיכר", "כיכרות"],
	["הולך", "הולכי"],
	["רגל", "רגליים"],
	["תיאוריה", "תאוריה", "תיאורייה"],
	["מבחן", "מבחנים", "מבחני"],
	["תמרור", "תמרורים", "תמרורי"],
	["נתיב", "נתיבים", "נתיבי"],
	["כביש", "כבישים", "כבישי"],
	["מהירות", "מהירויות"],
	["נהג", "נהגים", "נהגי"],
	["רכב", "רכבים"],
	["צומת", "צמתים"],
];
const spelling = (value) =>
	value
		.normalize("NFKD")
		.replace(/[\u0591-\u05c7]/g, "")
		.replace(/יי+/g, "י")
		.replace(/וו+/g, "ו")
		.toLocaleLowerCase("he");
const aliases = new Map();
for (const [term, ...variants] of wordGroups) {
	const canonical = spelling(term);
	for (const variant of [term, ...variants]) {
		const word = spelling(variant);
		aliases.set(word, canonical);
		for (const prefix of ["ב", "ל", "ה"])
			aliases.set(`${prefix}${word}`, canonical);
	}
}

function normalize(value) {
	return value
		.split(/\s+/)
		.map((word) => spelling(word).replace(/[^\p{L}\p{N}]/gu, " "))
		.join(" ")
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => aliases.get(word) ?? word)
		.join(" ");
}

// Search the baseline HTML, including the outlines. It remains usable without JS.
const searchable = subjects.map((subject) => ({
	subject,
	title: normalize(subject.querySelector("h3").textContent),
	text: normalize(
		`${subject.querySelector("summary").textContent} ${subject.querySelector(".subject-outline ul").textContent} ${subject.dataset.keywords}`,
	),
}));

function filterSubjects() {
	const words = normalize(input.value).split(/\s+/).filter(Boolean);
	const matches = [];
	for (const { subject, title, text } of searchable) {
		subject.hidden = !words.every((word) => text.includes(word));
		tabs.get(subject.id).hidden = subject.hidden;
		if (!subject.hidden)
			matches.push({
				subject,
				score: words.filter((word) => title.includes(word)).length,
			});
	}
	matches.sort((a, b) => b.score - a.score);
	const count = matches.length;
	for (const { subject } of matches) {
		topicList.append(tabs.get(subject.id));
		subjectList.append(subject);
	}
	if (count && (words.length || selectedSubject.hidden))
		renderSubject(matches[0].subject);
	updatePresentation();
	clearButton.hidden = words.length === 0;
	empty.hidden = count !== 0;
	status.textContent = words.length
		? count === 0
			? "לא נמצאו נושאים"
			: count === 1
				? "נמצא נושא אחד"
				: `נמצאו ${count} נושאים`
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
	const motion = createDetailsMotion(document, { duration: 200 });
	let positionFrame;

	function cancelPositionTracking() {
		cancelAnimationFrame(positionFrame);
		positionFrame = undefined;
	}

	function setOpen(subject, open, animate = false) {
		motion.setOpen(subject, open, animate && !desktop.matches);
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
			if (motion.hasPending()) positionFrame = requestAnimationFrame(adjust);
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
			const open = !motion.isOpen(subject);
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
			motion.settle();
		},
		true,
	);
	desktop.addEventListener("change", () => {
		cancelPositionTracking();
		motion.settle();
	});

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
	const visible = [...topicList.querySelectorAll(".topic-tab")].filter((tab) => !tab.hidden);
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
	const active = document.activeElement;
	const focusedControl = active.closest(".subject, .topic-tab");
	const focusedSubject = subjectsById.get(
		focusedControl?.dataset.topic ?? focusedControl?.id,
	) ?? (reader.contains(active) ? selectedSubject : null);
	if (focusedSubject && !focusedSubject.hidden) renderSubject(focusedSubject);
	if (!desktop.matches && !selectedSubject.hidden)
		topicDisclosures.open(selectedSubject);
	updatePresentation();
	if (focusedSubject && !focusedSubject.hidden) {
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
