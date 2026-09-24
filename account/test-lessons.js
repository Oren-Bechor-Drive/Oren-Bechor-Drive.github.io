const status = document.querySelector('[role="status"]');
const article = document.querySelector("[data-lesson-content]");
const body = document.querySelector("[data-lesson-body]");
const heading = document.querySelector("#lesson-heading");
const retry = document.querySelector("[data-retry]");
const key = new URL(location.href).searchParams.get("lesson") ?? "free";
const selected = [...document.querySelectorAll("[data-lesson]")].find(link => link.dataset.lesson === key);
let request;

function clear() {
	request?.abort();
	request = null;
	body.textContent = "";
	article.hidden = true;
}

async function load() {
	clear();
	retry.hidden = true;
	if (!selected) {
		status.textContent = "שיעור הבדיקה לא נמצא. בחרו אחד מהשיעורים שברשימה.";
		return;
	}
	selected.setAttribute("aria-current", "page");
	status.textContent = "טוענים את שיעור הבדיקה...";
	const controller = new AbortController();
	request = controller;
	const timeout = setTimeout(() => controller.abort(), 10_000);
	try {
		const response = await fetch(`/api/lessons/${key}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
		const data = await response.json();
		if (request !== controller) return;
		if (response.status === 401) {
			status.textContent = "היכנסו לחשבון כדי לקרוא את שיעור הבדיקה.";
		} else if (response.status === 404) {
			status.textContent = "השיעור אינו זמין לחשבון זה. שיעור הבדיקה בתשלום דורש הרשאת בדיקה תקפה. לאחר עדכון הגישה אפשר לנסות שוב.";
		} else if (response.status === 429) {
			status.textContent = "בוצעו בקשות רבות בזמן קצר. המתינו דקה ונסו שוב.";
		} else {
			if (!response.ok || typeof data.lesson?.body !== "string") throw new Error("unavailable");
			heading.textContent = selected.textContent;
			body.textContent = data.lesson.body;
			article.hidden = false;
			status.textContent = "שיעור הבדיקה נטען.";
			return;
		}
		retry.hidden = false;
	} catch {
		if (request !== controller) return;
		status.textContent = "לא הצלחנו לטעון את שיעור הבדיקה. בדקו שהשירות המקומי פועל ונסו שוב.";
		retry.hidden = false;
	} finally { clearTimeout(timeout); }
}

retry.addEventListener("click", load);
// A restored tab rechecks access instead of keeping a previous lesson response.
window.addEventListener("pagehide", clear);
window.addEventListener("pageshow", event => { if (event.persisted) load(); });
document.addEventListener("visibilitychange", () => {
	if (document.hidden) clear();
	else load();
});
load();
