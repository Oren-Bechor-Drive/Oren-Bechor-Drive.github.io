import "../js/input-mode.js";
import { createProtectedPage } from "./protected-page.js";
import { createReaderPosition } from "./reader-position.js";
import { readRetryAfter, retryGuidance } from "./retry-guidance.js";

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
const positions = createReaderPosition({ send: async input => {
	const response = await fetch(`${endpoint}/position`, { method: "POST", credentials: "same-origin", cache: "no-store",
		keepalive: true, signal: AbortSignal.timeout(10000),
		headers: { "content-type": "application/json", "x-csrf-token": input.csrf },
		body: JSON.stringify({ contentVersionId: input.contentVersionId, position: input.position, expectedRevision: input.expectedRevision }) });
	const data = await response.json();
	if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status, retryAfterSeconds: readRetryAfter(response.headers.get("retry-after")) });
	return data;
} });
const lifetime = createProtectedPage({ clear, restore: () => load(true), beforeSuspend() {
	if (reading && !conflict) {
		positions.update(currentPosition());
		void positions.flush().catch(() => {});
	}
} });
function clear({ preserveState = false } = {}) {
	clearTimeout(timer);
	if (!preserveState) positions.clear();
	reading = pending = undefined;
	conflict = restoring = false;
	heading.textContent = defaultHeading;
	body.textContent = "";
	media.querySelectorAll("track, source, img").forEach(item => item.removeAttribute("src"));
	media.querySelectorAll("video").forEach(video => { video.pause(); video.removeAttribute("src"); video.load(); });
	media.querySelectorAll(".reading-transcript").forEach(details => {
		details.open = false;
		details.querySelectorAll("p").forEach(text => { text.textContent = ""; });
	});
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
		? retryGuidance(error.retryAfterSeconds ?? null)
		: "השמירה או הטעינה לא הושלמו. בדקו את החיבור ונסו שוב.";
	feedback.dataset.failed = "true";
	if ([401, 404].includes(error.status)) status.dataset.failed = "true";
	signIn.hidden = error.status !== 401;
	reload.hidden = error.status === 401;
	saveButton.hidden = loading || !reading || conflict;

}
async function readTranscript(url, signal) {
	const limit = 256 * 1024;
	const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
	if (!response.ok) {
		await response.body?.cancel();
		throw Object.assign(new Error("Transcript unavailable"), { status: response.status, retryAfterSeconds: readRetryAfter(response.headers.get("retry-after")) });
	}
	const length = response.headers.get("content-length");
	if (response.headers.get("content-type")?.trim().toLowerCase() !== "text/plain; charset=utf-8" || !response.body
		|| (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > limit))) {
		await response.body?.cancel();
		throw new Error("Invalid transcript metadata");
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8", { fatal: true });
	let size = 0, text = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) throw new Error("Transcript exceeds the reading limit");
			text += decoder.decode(value, { stream: true });
		}
		return text + decoder.decode();
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
function addVideoAlternatives(video, descriptor, figure) {
	const contentVersionId = reading.lesson.id;
	if (descriptor.captions?.length) {
		const feedback = document.createElement("p");
		feedback.className = "reading-media-feedback";
		feedback.setAttribute("role", "status");
		for (const item of descriptor.captions) {
			const track = document.createElement("track");
			track.kind = "captions";
			track.srclang = item.language;
			track.label = item.label;
			track.src = item.url;
			track.default = item.language === "he";
			track.addEventListener("error", () => {
				if (!video.isConnected) return;
				void lifetime.run(async ({ request, commit }) => {
					// Native tracks do not expose their HTTP status. Recheck access before feedback.
					const current = await request(endpoint);
					if (current.lesson.id !== contentVersionId) throw Object.assign(new Error("Media version unavailable"), { status: 404 });
					commit(() => { feedback.textContent = "טעינת הכתוביות לא הושלמה. טענו את קטע הלימוד מחדש כדי לנסות שוב."; });
				}, { error: error => failure(error, true) });
			});
			video.append(track);
		}
		figure.append(feedback);
	}
	if (!descriptor.transcript) return;
	const details = document.createElement("details");
	details.className = "reading-transcript";
	const summary = document.createElement("summary");
	summary.textContent = "תמלול הסרטון";
	const feedback = document.createElement("p");
	feedback.className = "reading-transcript-status reading-media-feedback";
	feedback.setAttribute("role", "status");
	const text = document.createElement("p");
	text.className = "reading-transcript-text";
	details.append(summary, feedback, text);
	let loaded = false, loading = false;
	details.addEventListener("toggle", () => {
		if (!details.open || !details.isConnected || loaded || loading) return;
		loading = true;
		feedback.textContent = "טוענים את התמלול...";
		void lifetime.run(async ({ signal, commit }) => {
			const content = await readTranscript(descriptor.transcript.url, signal);
			commit(() => { text.textContent = content; feedback.textContent = ""; loaded = true; });
		}, { error(error) {
			if ([401, 404].includes(error.status)) failure(error, true);
			else feedback.textContent = error.status === 429 ? retryGuidance(error.retryAfterSeconds ?? null)
				: "טעינת התמלול לא הושלמה. סגרו ופתחו את התמלול כדי לנסות שוב.";
		}, finish() { loading = false; } });
	});
	figure.append(details);
}
async function load(preservePosition = false) {
	lifetime.reset({ preserveState: preservePosition });
	if (!valid) { status.textContent = "בחרו קטע לימוד מתוך מסך הלמידה שלכם."; return; }
	status.dataset.failed = "false";
	status.textContent = "טוענים את קטע הלימוד...";
	return lifetime.run(async ({ request, commit }) => {
		const catalog = await request("/api/sections");
		const descriptor = catalog.sections.find(item => item.id === section && item.accessLevel === access);
		if (!descriptor) throw Object.assign(new Error(), { status: 404 });
		const data = await request(endpoint);
		reading = data;
		const sameVersion = !data.position || data.position.contentVersionId === data.lesson.id;
		const resumed = positions.hydrate({ contentVersionId: data.lesson.id, csrf: data.csrf,
			position: sameVersion ? (data.position?.position ?? 0) : 0, revision: data.position?.revision ?? 0,
			acknowledged: sameVersion && Boolean(data.position) });
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
			if (content.tagName === "VIDEO") addVideoAlternatives(content, item, figure);
			media.append(figure);
		}
		element("[data-reading]").hidden = false;
		saveButton.disabled = false;
		status.textContent = "מיקום הקריאה נשמר אוטומטית בזמן הגלילה.";
		progress.textContent = `מיקום הקריאה: ${Math.round(resumed / 100)}%.`;
		positionStatus.textContent = sameVersion ? "קטע הלימוד נטען." : "קטע הלימוד עודכן מאז הקריאה האחרונה. הקריאה מתחילה מראש הקטע.";
		restoring = true;
		const fraction = resumed / 10000;
		const top = fraction > 0
			? window.scrollY + body.getBoundingClientRect().top + fraction * Math.max(0, body.offsetHeight - innerHeight) - 20
			: 0;
		window.scrollTo({ top, behavior: "instant" });
		restoredScrollY = window.scrollY;
		requestAnimationFrame(() => commit(() => { restoring = false; }));
		void positions.flush().catch(error => commit(() => failure(error)));
	}, { error: error => failure(error, true) });
}
function currentPosition() {
	const distance = 20 - body.getBoundingClientRect().top;
	return Math.round(Math.max(0, Math.min(1, distance / Math.max(1, body.offsetHeight - innerHeight))) * 10000);
}
async function save() {
	if (!reading || conflict) return;
	positions.update(currentPosition());
	if (pending) { clearTimeout(timer); timer = setTimeout(save, 500); return; }
	const focused = document.activeElement;
	return lifetime.run(async ({ commit }) => {
		pending = true;
		saveButton.disabled = true;
		positionStatus.dataset.failed = "false";
		positionStatus.textContent = "שומרים את מיקום הקריאה...";
		await positions.flush();
		commit(() => {
			positionStatus.textContent = "מיקום הקריאה נשמר.";
			saveButton.hidden = true;
			reload.hidden = true;
		});
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
	positions.update(currentPosition());
	clearTimeout(timer);
	timer = setTimeout(save, 600);
}, { passive: true });
saveButton.addEventListener("click", () => { clearTimeout(timer); void save(); });
element("[data-reload]").addEventListener("click", () => load());
void load();
