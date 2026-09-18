const subjects = [...document.querySelectorAll(".subject")];
const subjectsById = new Map(subjects.map(subject => [subject.id, subject]));
const form = document.querySelector(".library-search");
const input = document.querySelector("#topic-search");
const clearButton = document.querySelector(".clear-search");
const status = document.querySelector("[data-search-status]");
const empty = document.querySelector(".search-empty");
const lastTopic = document.querySelector(".last-topic");
const lastTopicLink = document.querySelector("[data-last-topic-link]");
const storageKey = "oren-course:last-topic";

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
		if (!subject.hidden) count++;
	}
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
	subject.open = true;
	if (focus) subject.querySelector("summary").focus();
	subject.scrollIntoView({ block: "start" });
}

// Storage is optional. A blocked or stale record must not affect topic browsing.
try { showLastTopic(localStorage.getItem(storageKey)); } catch {}

for (const subject of subjects) {
	subject.addEventListener("toggle", () => {
		if (!subject.open) return;
		try { localStorage.setItem(storageKey, subject.id); } catch {}
	});
}

input.addEventListener("input", filterSubjects);
form.addEventListener("submit", event => event.preventDefault());
clearButton.addEventListener("click", () => { clearSearch(); input.focus(); });
document.querySelector("[data-show-all]").addEventListener("click", () => { clearSearch(); input.focus(); });
window.addEventListener("hashchange", () => openLinkedSubject(true));
lastTopicLink.addEventListener("click", () => {
	if (lastTopicLink.hash === location.hash) openLinkedSubject(true);
});
form.hidden = false;
filterSubjects();
openLinkedSubject();
