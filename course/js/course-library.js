const subjects = [...document.querySelectorAll(".subject")];
const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
const form = document.querySelector(".library-search");
const input = document.querySelector("#topic-search");
const clearButton = document.querySelector(".clear-search");
const status = document.querySelector("[data-search-status]");
const empty = document.querySelector(".search-empty");
const lastTopic = document.querySelector(".last-topic");
const lastTopicLink = document.querySelector("[data-last-topic-link]");
const browser = document.querySelector(".library-browser");
const topicList = document.querySelector(".topic-list");
const reader = document.querySelector(".topic-reader");
const subjectList = document.querySelector(".subject-list");
const desktop = matchMedia("(min-width: 900px)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const disclosures = new Map();
const storageKey = "oren-course:last-topic";
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
			selectSubject(subject, event.detail > 0),
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

function selectSubject(subject, animate = false) {
	renderSubject(subject, animate);
	try {
		localStorage.setItem(storageKey, subject.id);
	} catch {}
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
}

function clearSearch() {
	input.value = "";
	filterSubjects();
}

function showLastTopic(id) {
	const subject = subjectsById.get(id);
	if (!subject) return;
	document.querySelector("[data-last-topic-name]").textContent =
		subject.querySelector("h3").textContent;
	lastTopicLink.hash = id;
	lastTopic.hidden = false;
}

function openLinkedSubject(focus = false) {
	const subject = subjectsById.get(location.hash.slice(1));
	if (!subject) return;
	clearSearch();
	selectSubject(subject);
	openDisclosure(subject);
	const control = desktop.matches
		? tabs.get(subject.id)
		: subject.querySelector("summary");
	if (focus) control.focus({ preventScroll: true });
	(desktop.matches ? browser : subject).scrollIntoView({ block: "start" });
}

// Storage is optional. A blocked or stale record must not affect topic browsing.
try {
	showLastTopic(localStorage.getItem(storageKey));
} catch {}

// Measure the whole card so the description inside summary moves with the outline.
// Keep closing content rendered until its height reaches the compact summary.
function setDisclosure(subject, open, animate = false) {
	const height = subject.getBoundingClientRect().height;
	disclosures.get(subject)?.animation.cancel();
	disclosures.delete(subject);
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
	disclosures.set(subject, { animation, open });
	animation.onfinish = () => setDisclosure(subject, open);
}

function settleDisclosures() {
	for (const [subject, { open }] of disclosures) setDisclosure(subject, open);
}

function openDisclosure(subject, animate = false) {
	for (const other of subjects) {
		if (other !== subject && other.open)
			setDisclosure(other, false, animate);
	}
	setDisclosure(subject, true, animate);
}

for (const subject of subjects) {
	// Native named details retain exclusive behavior if this module does not load.
	subject.removeAttribute("name");
	subject.querySelector("summary").addEventListener("click", (event) => {
		event.preventDefault();
		const open = !(disclosures.get(subject)?.open ?? subject.open);
		if (open) {
			selectSubject(subject);
			openDisclosure(subject, event.detail > 0);
		} else setDisclosure(subject, false, event.detail > 0);
	});
}

// Keyboard interaction settles pointer transitions before focus or state changes.
document.addEventListener(
	"keydown",
	() => {
		reader.dataset.motion = "false";
		settleDisclosures();
	},
	true,
);
reducedMotion.addEventListener("change", settleDisclosures);

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
	selectSubject(subjectsById.get(visible[next].dataset.topic));
	visible[next].focus();
});

desktop.addEventListener("change", () => {
	settleDisclosures();
	const focused =
		browser.contains(document.activeElement) ||
		subjectList.contains(document.activeElement);
	if (!desktop.matches && !selectedSubject.hidden)
		openDisclosure(selectedSubject);
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
lastTopicLink.addEventListener("click", () => {
	if (lastTopicLink.hash === location.hash) openLinkedSubject(true);
});
form.hidden = false;
renderSubject(selectedSubject);
filterSubjects();
openLinkedSubject();
