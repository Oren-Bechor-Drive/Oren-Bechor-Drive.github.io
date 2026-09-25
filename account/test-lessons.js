import "./focus.js";

const status = document.querySelector('[role="status"]');
const article = document.querySelector("[data-lesson-content]");
const body = document.querySelector("[data-lesson-body]");
const heading = document.querySelector("#lesson-heading");
const retry = document.querySelector("[data-retry]");
const positionForm = document.querySelector("[data-position-form]");
const positionInput = document.querySelector("#reading-position");
const saveButton = document.querySelector("[data-save-position]");
const positionStatus = document.querySelector("[data-position-status]");
const reloadPosition = document.querySelector("[data-reload-position]");
const key = new URL(location.href).searchParams.get("lesson") ?? "free";
const selected = [...document.querySelectorAll("[data-lesson]")].find(link => link.dataset.lesson === key);

function render(state) {
	status.textContent = state.status;
	body.textContent = state.reading?.lesson.body ?? "";
	heading.textContent = state.reading ? selected.textContent : "";
	article.hidden = !state.reading;
	if (positionInput.value !== state.draft) positionInput.value = state.draft;
	positionInput.disabled = !["ready", "conflict"].includes(state.phase);
	saveButton.disabled = state.phase !== "ready";
	positionStatus.textContent = state.positionStatus;
	reloadPosition.hidden = state.phase !== "conflict";
	retry.hidden = state.phase !== "unavailable";
}

// One reading lifetime owns load, save and invalidation. DOM flags only render it.
function createReader() {
	const empty = () => ({ phase: "idle", reading: null, draft: "0", status: "", positionStatus: "" });
	let state = empty();
	let pending;
	function update(changes) {
		state = { ...state, ...changes };
		render(state);
	}
	function cancel() {
		if (pending) {
			pending.controller.abort();
			clearTimeout(pending.timeout);
			pending = null;
		}
	}
	function clear() {
		cancel();
		state = empty();
		render(state);
	}
	async function request(path, options, accept, reject) {
		cancel();
		const operation = { controller: new AbortController() };
		operation.timeout = setTimeout(() => operation.controller.abort(), 10_000);
		pending = operation;
		try {
			const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, signal: operation.controller.signal });
			const data = await response.json();
			if (pending === operation) accept(response, data);
		} catch {
			if (pending === operation) reject();
		} finally {
			clearTimeout(operation.timeout);
			if (pending === operation) pending = null;
		}
	}
	function load(focus = false) {
		clear();
		if (!selected) {
			update({ phase: "missing", status: "שיעור הבדיקה לא נמצא. בחרו אחד מהשיעורים שברשימה." });
			return;
		}
		update({ phase: "loading", status: "טוענים את שיעור הבדיקה..." });
		return request(`/api/lessons/${key}`, {}, (response, data) => {
			const errors = {
				401: "היכנסו לחשבון כדי לקרוא את שיעור הבדיקה.",
				404: "השיעור אינו זמין לחשבון זה. שיעור הבדיקה בתשלום דורש הרשאת בדיקה תקפה. לאחר עדכון הגישה אפשר לנסות שוב.",
				429: "בוצעו בקשות רבות בזמן קצר. המתינו דקה ונסו שוב.",
			};
			if (errors[response.status]) {
				update({ phase: "unavailable", status: errors[response.status] });
				return;
			}
			if (!response.ok || typeof data.lesson?.body !== "string" || !data.csrf || !("position" in data)) throw new Error("unavailable");
			const draft = String((data.position?.position ?? 0) / 100);
			update({ phase: "ready", reading: data, draft, status: "שיעור הבדיקה נטען.",
				positionStatus: data.position
					? `המיקום השמור נטען: ${draft} אחוזים.${data.position.contentVersionId !== data.lesson.id ? " תוכן השיעור עודכן מאז השמירה. בדקו את המיקום לפני שמירה נוספת." : ""}`
					: "עדיין לא נשמר מיקום לשיעור זה." });
			// Focus belongs to this accepted load, never to a superseded caller.
			if (focus) positionInput.focus();
		}, () => update({ phase: "unavailable", status: "לא הצלחנו לטעון את שיעור הבדיקה. בדקו שהשירות המקומי פועל ונסו שוב." }));
	}
	function save() {
		if (state.phase !== "ready") return;
		const { reading, draft } = state;
		update({ phase: "saving", positionStatus: "שומרים את המיקום..." });
		return request(`/api/lessons/${key}/position`, {
			method: "POST", headers: { "content-type": "application/json", "x-csrf-token": reading.csrf },
			body: JSON.stringify({ contentVersionId: reading.lesson.id, position: Math.round(Number(draft) * 100), expectedRevision: reading.position?.revision ?? 0 }),
		}, (response, data) => {
			if ([401, 403, 404].includes(response.status)) {
				clear();
				update({ phase: "unavailable", status: "לא ניתן לשמור כרגע. בדקו שהחשבון מחובר ושהגישה לשיעור תקפה, ואז טענו את השיעור שוב." });
				return;
			}
			if (response.status === 409) {
				update({ phase: "conflict", positionStatus: "המיקום עודכן בדפדפן אחר. הבחירה שלכם לא נשמרה. טענו את המיקום השמור כדי להמשיך." });
				return;
			}
			if (!response.ok || !data.position) throw new Error("unavailable");
			update({ phase: "ready", reading: { ...reading, position: data.position },
				positionStatus: `המיקום נשמר: ${data.position.position / 100} אחוזים.` });
		}, () => update({ phase: "ready", positionStatus: "לא הצלחנו לשמור את המיקום. הבחירה נשארה כאן. בדקו את החיבור ונסו לשמור שוב." }));
	}
	return {
		load, save, clear,
		edit(draft) {
			if (!["ready", "conflict"].includes(state.phase)) return;
			update({ draft, ...(state.phase === "ready" ? { positionStatus: "המיקום השתנה. לחצו על שמירת מיקום כדי לשמור בחשבון." } : {}) });
		},
	};
}

const reader = createReader();
selected?.setAttribute("aria-current", "page");
positionForm.addEventListener("submit", event => {
	event.preventDefault();
	if (positionForm.reportValidity()) void reader.save();
});
positionInput.addEventListener("input", () => reader.edit(positionInput.value));
reloadPosition.addEventListener("click", () => void reader.load(true));
retry.addEventListener("click", () => void reader.load());
window.addEventListener("pagehide", reader.clear);
window.addEventListener("pageshow", event => { if (event.persisted) void reader.load(); });
document.addEventListener("visibilitychange", () => {
	if (document.hidden) reader.clear();
	else void reader.load();
});
void reader.load();
