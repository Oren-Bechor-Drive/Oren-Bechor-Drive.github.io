import "./focus.js";

const element = selector => document.querySelector(selector);
const status = element("[data-reader-status]");
const body = element("[data-reading-body]");
const media = element("[data-reading-media]");
const positionStatus = element("[data-position-status]");
const saveButton = element("[data-save-position]");
const params = new URL(location.href).searchParams;
const section = params.get("section"), access = params.get("access");
const valid = /^[0-9a-f-]{36}$/i.test(section ?? "") && ["free", "paid"].includes(access);
const endpoint = `/api/sections/${encodeURIComponent(section)}/${access}`;
let reading, pending, timer, restoring = false, conflict = false;
let lifetime = new AbortController();
function clear() {
	clearTimeout(timer);
	lifetime.abort();
	lifetime = new AbortController();
	reading = pending = undefined;
	conflict = false;
	body.textContent = "";
	media.querySelectorAll("video").forEach(video => { video.pause(); video.removeAttribute("src"); video.load(); });
	media.replaceChildren();
	element("[data-reading]").hidden = true;
	saveButton.disabled = true;
	positionStatus.textContent = "";
}
async function request(path, payload) {
	const owner = lifetime;
	const response = await fetch(path, { cache: "no-store", credentials: "same-origin",
		signal: AbortSignal.any([owner.signal, AbortSignal.timeout(10000)]),
		...(payload ? { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": reading.csrf }, body: JSON.stringify(payload) } : {}) });
	const data = await response.json();
	if (owner !== lifetime) throw new DOMException("Obsolete", "AbortError");
	if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
	return data;
}
function failure(error, loading = false) {
	const feedback = loading ? status : positionStatus;
	if ([401, 404].includes(error.status)) {
		clear();
		status.textContent = error.status === 401 ? "היכנסו לחשבון כדי לקרוא את השיעור." : "השיעור אינו זמין לחשבון. לשיעורים המלאים נדרש מנוי פעיל.";
	} else if (error.status === 409) {
		conflict = true;
		feedback.textContent = "המיקום עודכן בחלון אחר. טענו את השיעור מחדש כדי להמשיך מהמיקום השמור.";
	} else feedback.textContent = error.status === 429
		? "בוצעו בקשות רבות. המתינו דקה ונסו שוב."
		: "לא הצלחנו לשמור או לטעון. בדקו את החיבור ונסו שוב.";
}
async function load() {
	clear();
	if (!valid) { status.textContent = "בחרו שיעור מתוך מסך הלמידה שלכם."; return; }
	const owner = lifetime;
	status.textContent = "טוענים את השיעור...";
	try {
		const catalog = await request("/api/sections");
		const descriptor = catalog.sections.find(item => item.id === section && item.accessLevel === access);
		if (!descriptor) throw Object.assign(new Error(), { status: 404 });
		const data = await request(endpoint);
		reading = data;
		element("#reader-heading").textContent = descriptor.title;
		body.textContent = data.lesson.body;
		for (const item of data.media) {
			const figure = document.createElement("figure");
			const content = document.createElement(item.type.startsWith("video/") ? "video" : "img");
			content.src = item.url;
			if (content.tagName === "VIDEO") { content.controls = true; content.preload = "metadata"; }
			else { content.alt = item.title; content.loading = "lazy"; }
			const caption = document.createElement("figcaption");
			caption.textContent = item.title;
			figure.append(content, caption);
			media.append(figure);
		}
		element("[data-reading]").hidden = false;
		saveButton.disabled = false;
		status.textContent = "מיקום הקריאה נשמר בזמן הגלילה. אפשר גם לשמור אותו באמצעות הכפתור.";
		const sameVersion = !data.position || data.position.contentVersionId === data.lesson.id;
		positionStatus.textContent = sameVersion ? "השיעור נטען." : "השיעור עודכן מאז הקריאה האחרונה. התחלנו מראש השיעור.";
		restoring = true;
		const fraction = sameVersion ? (data.position?.position ?? 0) / 10000 : 0;
		window.scrollTo({ top: window.scrollY + body.getBoundingClientRect().top + fraction * Math.max(0, body.offsetHeight - innerHeight) - 20, behavior: "instant" });
		requestAnimationFrame(() => { restoring = false; });
	} catch (error) { if (owner === lifetime) failure(error, true); }
}
function currentPosition() {
	const distance = 20 - body.getBoundingClientRect().top;
	return Math.round(Math.max(0, Math.min(1, distance / Math.max(1, body.offsetHeight - innerHeight))) * 10000);
}
async function save() {
	if (!reading || conflict) return;
	if (pending) { clearTimeout(timer); timer = setTimeout(save, 500); return; }
	const owner = lifetime;
	const operation = {};
	const focused = document.activeElement;
	pending = operation;
	saveButton.disabled = true;
	positionStatus.textContent = "שומרים את מיקום הקריאה...";
	try {
		const saved = await request(`${endpoint}/position`, { contentVersionId: reading.lesson.id, position: currentPosition(), expectedRevision: reading.position?.revision ?? 0 });
		reading.position = saved.position;
		positionStatus.textContent = "מיקום הקריאה נשמר.";
	} catch (error) { if (owner === lifetime) failure(error); }
	finally { if (pending === operation) {
		pending = null; saveButton.disabled = conflict;
		if (focused === saveButton && document.activeElement === document.body && !conflict) saveButton.focus();
	} }
}
window.addEventListener("scroll", () => {
	if (!reading || restoring || conflict) return;
	clearTimeout(timer);
	timer = setTimeout(save, 600);
}, { passive: true });
saveButton.addEventListener("click", () => { clearTimeout(timer); void save(); });
element("[data-reload]").addEventListener("click", load);
window.addEventListener("pagehide", clear);
window.addEventListener("pageshow", event => { if (event.persisted) void load(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) clear(); else void load(); });
void load();
