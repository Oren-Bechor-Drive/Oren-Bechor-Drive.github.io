const subjects = [...document.querySelectorAll(".subject")];
const subjectsById = new Map(subjects.map(subject => [subject.id, subject]));
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
const storageKey = "oren-course:last-topic";
let selectedSubject = subjects[0];

// Both presentations use the authored outlines as their only content source.
const tabs = new Map(subjects.map(subject => {
	const tab = document.createElement("button");
	tab.type = "button";
	tab.className = "topic-tab";
	tab.id = `tab-${subject.id}`;
	tab.dataset.topic = subject.id;
	tab.setAttribute("role", "tab");
	tab.setAttribute("aria-controls", reader.id);
	tab.textContent = subject.querySelector("h3").textContent;
	tab.addEventListener("click", () => selectSubject(subject));
	topicList.append(tab);
	return [subject.id, tab];
}));

function renderSubject(subject) {
	selectedSubject = subject;
	reader.dataset.subject = subject.id;
	reader.setAttribute("aria-labelledby", tabs.get(subject.id).id);
	reader.replaceChildren(...["summary h3", "summary > p", ".subject-outline"].map(selector => subject.querySelector(selector).cloneNode(true)));
	for (const [id, tab] of tabs) {
		const selected = id === subject.id;
		tab.setAttribute("aria-selected", String(selected));
		tab.tabIndex = selected ? 0 : -1;
	}
}

function selectSubject(subject) {
	renderSubject(subject);
	try { localStorage.setItem(storageKey, subject.id); } catch {}
}

function updatePresentation() {
	const hasResults = subjects.some(subject => !subject.hidden);
	browser.hidden = !desktop.matches || !hasResults;
	subjectList.hidden = desktop.matches;
}

function normalize(value) {
	return value.normalize("NFKD").replace(/[\u0591-\u05c7]/g, "").replace(/[-־]/g, " ").toLocaleLowerCase("he").trim();
}

// Search the baseline HTML, including the outlines. It remains usable without JS.
const searchable = subjects.map(subject => ({
	subject,
	text: normalize(`${subject.textContent} ${subject.dataset.keywords}`),
}));

function filterSubjects() {
	const words = normalize(input.value).split(/\s+/).filter(Boolean);
	let count = 0;
	for (const { subject, text } of searchable) {
		subject.hidden = !words.every(word => text.includes(word));
		tabs.get(subject.id).hidden = subject.hidden;
		if (!subject.hidden) count++;
	}
	if (count && selectedSubject.hidden) renderSubject(subjects.find(subject => !subject.hidden));
	updatePresentation();
	clearButton.hidden = words.length === 0;
	empty.hidden = count !== 0;
	status.textContent = words.length ? `נמצאו ${count} נושאים` : `${subjects.length} נושאים לבחירה`;
}

function clearSearch() {
	input.value = "";
	filterSubjects();
}

function showLastTopic(id) {
	const subject = subjectsById.get(id);
	if (!subject) return;
	document.querySelector("[data-last-topic-name]").textContent = subject.querySelector("h3").textContent;
	lastTopicLink.hash = id;
	lastTopic.hidden = false;
}

function openLinkedSubject(focus = false) {
	const subject = subjectsById.get(location.hash.slice(1));
	if (!subject) return;
	clearSearch();
	selectSubject(subject);
	subject.open = true;
	const control = desktop.matches ? tabs.get(subject.id) : subject.querySelector("summary");
	if (focus) control.focus({ preventScroll: true });
	(desktop.matches ? browser : subject).scrollIntoView({ block: "start" });
}

// Storage is optional. A blocked or stale record must not affect topic browsing.
try { showLastTopic(localStorage.getItem(storageKey)); } catch {}

for (const subject of subjects) {
	subject.querySelector("summary").addEventListener("click", () => {
		if (!subject.open) selectSubject(subject);
	});
}

topicList.addEventListener("keydown", event => {
	const visible = [...tabs.values()].filter(tab => !tab.hidden);
	const index = visible.indexOf(event.target);
	if (index < 0) return;
	let next;
	if (event.key === "ArrowDown") next = (index + 1) % visible.length;
	else if (event.key === "ArrowUp") next = (index - 1 + visible.length) % visible.length;
	else if (event.key === "Home") next = 0;
	else if (event.key === "End") next = visible.length - 1;
	else return;
	event.preventDefault();
	selectSubject(subjectsById.get(visible[next].dataset.topic));
	visible[next].focus();
});

desktop.addEventListener("change", () => {
	const focused = browser.contains(document.activeElement) || subjectList.contains(document.activeElement);
	if (!desktop.matches && !selectedSubject.hidden) selectedSubject.open = true;
	updatePresentation();
	if (focused && !selectedSubject.hidden) {
		const control = desktop.matches ? tabs.get(selectedSubject.id) : selectedSubject.querySelector("summary");
		control.focus({ preventScroll: true });
	}
});

input.addEventListener("input", filterSubjects);
form.addEventListener("submit", event => event.preventDefault());
clearButton.addEventListener("click", () => { clearSearch(); input.focus(); });
document.querySelector("[data-show-all]").addEventListener("click", () => { clearSearch(); input.focus(); });
window.addEventListener("hashchange", () => openLinkedSubject(true));
lastTopicLink.addEventListener("click", () => {
	if (lastTopicLink.hash === location.hash) openLinkedSubject(true);
});
form.hidden = false;
renderSubject(selectedSubject);
filterSubjects();
openLinkedSubject();
