import "../js/input-mode.js";
import { createProtectedPage } from "./protected-page.js";

const element = selector => document.querySelector(selector);
const status = element("[data-reader-status]");
const heading = element("#reader-heading");
const defaultHeading = heading.textContent;
const body = element("[data-reading-body]");
const media = element("[data-reading-media]");
const positionStatus = element("[data-position-status]");
const saveButton = element("[data-save-position]");
const reload = element("[data-reload]");
const signIn = element("[data-sign-in]");
const progress = element("[data-reading-progress]");
element("[data-reader-interface]").hidden = false;
signIn.href = `login.html?return=${encodeURIComponent(location.pathname + location.search)}`;
const params = new URL(location.href).searchParams;
const section = params.get("section"), access = params.get("access");
const valid = /^[0-9a-f-]{36}$/i.test(section ?? "") && ["free", "paid"].includes(access);
const endpoint = `/api/sections/${encodeURIComponent(section)}/${access}`;
let reading, pending, timer, restoring = false, restoredScrollY = 0, conflict = false;
const lifetime = createProtectedPage({ clear, restore: load });
function clear() {
	clearTimeout(timer);
	reading = pending = undefined;
	conflict = restoring = false;
	heading.textContent = defaultHeading;
	body.textContent = "";
	media.querySelectorAll("video").forEach(video => { video.pause(); video.removeAttribute("src"); video.load(); });
	media.replaceChildren();
	element("[data-reading]").hidden = true;
	saveButton.disabled = true;
	positionStatus.textContent = "";
	saveButton.hidden = true;
	reload.hidden = true;
	signIn.hidden = true;
}
function failure(error, loading = false) {
	const feedback = loading ? status : positionStatus;
	if ([401, 404].includes(error.status)) {
		lifetime.reset();
		status.textContent = error.status === 401 ? "היכנסו לחשבון כדי לקרוא את קטע הלימוד." : "קטע הלימוד אינו זמין לחשבון שלכם כרגע. אפשר להמשיך בנושאי הלימוד ובתרגול החינמי.";
	} else if (error.status === 409) {
		conflict = true;
		feedback.textContent = "המיקום עודכן בחלון אחר. טענו את קטע הלימוד מחדש כדי להמשיך מהמיקום השמור.";
	} else feedback.textContent = error.status === 429
		? "בוצעו בקשות רבות. המתינו דקה ונסו שוב."
		: "השמירה או הטעינה לא הושלמו. בדקו את החיבור ונסו שוב.";
	feedback.dataset.failed = "true";
	if ([401, 404].includes(error.status)) status.dataset.failed = "true";
	signIn.hidden = error.status !== 401;
	reload.hidden = error.status === 401;
	saveButton.hidden = loading || !reading || conflict;

}
async function load() {
	lifetime.reset();
	if (!valid) { status.textContent = "בחרו קטע לימוד מתוך מסך הלמידה שלכם."; return; }
	status.dataset.failed = "false";
	status.textContent = "טוענים את קטע הלימוד...";
	return lifetime.run(async ({ request, commit }) => {
		const catalog = await request("/api/sections");
		const descriptor = catalog.sections.find(item => item.id === section && item.accessLevel === access);
		if (!descriptor) throw Object.assign(new Error(), { status: 404 });
		const data = await request(endpoint);
		reading = data;
		heading.textContent = descriptor.title;
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
		status.textContent = "מיקום הקריאה נשמר אוטומטית בזמן הגלילה.";
		const sameVersion = !data.position || data.position.contentVersionId === data.lesson.id;
		progress.textContent = `מיקום הקריאה: ${sameVersion ? Math.round((data.position?.position ?? 0) / 100) : 0}%.`;
		positionStatus.textContent = sameVersion ? "קטע הלימוד נטען." : "קטע הלימוד עודכן מאז הקריאה האחרונה. הקריאה מתחילה מראש הקטע.";
		restoring = true;
		const fraction = sameVersion ? (data.position?.position ?? 0) / 10000 : 0;
		const top = fraction > 0
			? window.scrollY + body.getBoundingClientRect().top + fraction * Math.max(0, body.offsetHeight - innerHeight) - 20
			: 0;
		window.scrollTo({ top, behavior: "instant" });
		restoredScrollY = window.scrollY;
		requestAnimationFrame(() => commit(() => { restoring = false; }));
	}, { error: error => failure(error, true) });
}
function currentPosition() {
	const distance = 20 - body.getBoundingClientRect().top;
	return Math.round(Math.max(0, Math.min(1, distance / Math.max(1, body.offsetHeight - innerHeight))) * 10000);
}
async function save() {
	if (!reading || conflict) return;
	if (pending) { clearTimeout(timer); timer = setTimeout(save, 500); return; }
	const focused = document.activeElement;
	return lifetime.run(async ({ request }) => {
		pending = true;
		saveButton.disabled = true;
		positionStatus.dataset.failed = "false";
		positionStatus.textContent = "שומרים את מיקום הקריאה...";
		const saved = await request(`${endpoint}/position`, { csrf: reading.csrf,
			body: { contentVersionId: reading.lesson.id, position: currentPosition(), expectedRevision: reading.position?.revision ?? 0 } });
		reading.position = saved.position;
		positionStatus.textContent = "מיקום הקריאה נשמר.";
		saveButton.hidden = true;
		reload.hidden = true;
	}, { error: failure, finish() {
		pending = false; saveButton.disabled = conflict;
		if (focused === saveButton && document.activeElement === document.body && !conflict) positionStatus.focus({ preventScroll: true });
	} });
}

window.addEventListener("scroll", () => {
	if (!reading || conflict) return;
	if (restoring) {
		restoring = false;
		if (Math.abs(window.scrollY - restoredScrollY) < 1) return;
	}
	progress.textContent = `מיקום הקריאה: ${Math.round(currentPosition() / 100)}%.`;
	clearTimeout(timer);
	timer = setTimeout(save, 600);
}, { passive: true });
saveButton.addEventListener("click", () => { clearTimeout(timer); void save(); });
element("[data-reload]").addEventListener("click", load);
void load();
