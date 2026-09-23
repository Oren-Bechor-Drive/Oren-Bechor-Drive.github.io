import { registrationPasswordChecks } from "./password-policy.js";

const mode = document.body.dataset.account;
const form = document.querySelector("[data-account-form]");
const fields = document.querySelector(".account-fields");
const google = document.querySelector("[data-google]");
const errorBox = document.querySelector('[role="alert"]');
const statusBox = document.querySelector('[role="status"]');
const retry = document.querySelector("[data-retry]");
let session;
let busy = false;
let ready = false;

// Keep click-to-type behavior while reserving field outlines for keyboard navigation.
document.addEventListener("pointerdown", () => {
	document.documentElement.dataset.accountKeyboard = "false";
}, { capture: true });
document.addEventListener("keydown", event => {
	if (event.key === "Tab") document.documentElement.dataset.accountKeyboard = "true";
}, { capture: true });

const messages = {
	sign_in_failed: "לא הצלחנו להתחבר. בדקו את כתובת האימייל והסיסמה, וודאו שאישרתם את האימייל.",
	invalid_email: "יש להזין כתובת אימייל תקינה.",
	invalid_password: mode === "register"
		? "בחרו סיסמה באורך 9 עד 128 תווים, עם אות גדולה וקטנה באנגלית, ספרה ותו מיוחד."
		: "בחרו סיסמה באורך 12 עד 128 תווים.",
	rate_limited: "בוצעו ניסיונות רבים בזמן קצר. המתינו מעט ונסו שוב.",
	request_rejected: "הבקשה פגה. לחצו על ניסיון נוסף ונסו שוב.",
	session_expired: "ההתחברות הסתיימה. היכנסו שוב לחשבון.",
	recovery_required: "יש לפתוח את הקישור לאיפוס הסיסמה שקיבלתם באימייל.",
	unavailable: "ההתחברות אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע.",
	google_unavailable: "הכניסה עם Google אינה זמינה כרגע. אפשר להתחבר עם אימייל וסיסמה.",
	request_failed: "לא הצלחנו להשלים את הבקשה. נסו שוב בעוד רגע.",
};

function updateRegistrationPassword() {
	if (mode !== "register") return;
	const input = document.querySelector("#password");
	const checks = registrationPasswordChecks(input.value);
	const score = Object.values(checks).filter(Boolean).length;
	const strength = document.querySelector("[data-password-strength]");
	const meter = strength.querySelector('[role="meter"]');
	const label = strength.querySelector("[data-password-strength-label]");
	const level = !input.value ? "הזינו סיסמה" : score === 4 ? "חזקה" : score === 3 ? "בינונית" : "חלשה";
	const summary = `${score} מתוך 4 דרישות`;
	strength.hidden = false;
	strength.dataset.score = String(score);
	meter.setAttribute("aria-valuenow", String(score));
	meter.setAttribute("aria-valuetext", `${level}, ${summary}`);
	const text = input.value ? `${level} - ${summary}` : level;
	if (label.textContent !== text) label.textContent = text;
	for (const rule of document.querySelectorAll("[data-password-rule]")) {
		rule.dataset.met = String(checks[rule.dataset.passwordRule]);
	}
	input.setCustomValidity(input.value && score !== 4 ? messages.invalid_password : "");
}

if (mode === "register") {
	const password = document.querySelector("#password");
	password.addEventListener("input", updateRegistrationPassword);
	password.addEventListener("change", updateRegistrationPassword);
	window.addEventListener("pageshow", updateRegistrationPassword);
	form.addEventListener("reset", () => queueMicrotask(updateRegistrationPassword));
	updateRegistrationPassword();
}

function feedback(text, error = false) {
	errorBox.hidden = true;
	statusBox.hidden = true;
	const target = error ? errorBox : statusBox;
	target.textContent = text;
	target.hidden = false;
}
function updateControls() {
	// Service readiness gates submission, not typing or password visibility.
	if (fields) fields.disabled = busy;
	const disabled = busy || !ready;
	const submit = form?.querySelector('button[type="submit"]');
	if (submit) submit.disabled = disabled;
	if (google) google.disabled = disabled || !session?.google;
	const logout = document.querySelector("[data-logout]");
	if (logout) logout.disabled = disabled;
}
async function request(route, body) {
	const response = await fetch(`/api/account/${route}`, {
		method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
		headers: body === undefined ? {} : { "Content-Type": "application/json", "X-CSRF-Token": session.csrf },
		...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000),
	});
	if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("unavailable");
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || "request_failed");
	return data;
}

async function bootstrap() {
	ready = false;
	updateControls();
	retry.hidden = true;
	try {
		session = await request("session");
		if (!session.available) throw new Error("unavailable");
		if (session.user && ["login", "register"].includes(mode)) return location.replace("/account/");
		if (mode === "account") {
			if (!session.user) return location.replace("/account/login.html");
			document.querySelector("[data-email]").textContent = session.user.email;
			document.querySelector("[data-account-details]").hidden = false;
		}
		if (mode === "reset" && !session.recovery) {
			feedback(messages.recovery_required, true);
			return;
		}
		if (status !== "link-expired") errorBox.hidden = true;
		ready = true;
		updateControls();
		if (google) {
			document.querySelector("[data-google-note]").hidden = session.google;
		}
	} catch (error) {
		feedback(messages[error.message] ?? messages.unavailable, true);
		retry.hidden = false;
	}
}

async function perform(action) {
	if (busy || !ready) return;
	busy = true;
	updateControls();
	form?.setAttribute("aria-busy", "true");
	retry.hidden = true;
	errorBox.hidden = true;
	statusBox.hidden = true;
	try { await action(); }
	catch (error) {
		feedback(messages[error.message] ?? messages.request_failed, true);
		retry.hidden = !["request_rejected", "session_expired", "unavailable"].includes(error.message);
		errorBox.focus();
	} finally {
		busy = false;
		updateControls();
		form?.removeAttribute("aria-busy");
	}
}

form?.addEventListener("submit", event => {
	event.preventDefault();
	updateRegistrationPassword();
	if (!form.reportValidity()) return;
	// Capture before disabling the fieldset; disabled fields are excluded from FormData.
	const body = Object.fromEntries(new FormData(form));
	void perform(async () => {
		const result = await request(mode === "recovery" ? "recover" : mode, body);
		form.reset();
		if (mode === "register") location.assign("/account/verify.html");
		else if (mode === "login") location.assign("/account/");
		else if (mode === "reset") location.assign(`/account/login.html?status=${result.otherSessionsSignedOut ? "password-updated" : "password-updated-signout-incomplete"}`);
		else feedback("אם קיים חשבון עם הכתובת הזו, יישלח אליו קישור לאיפוס הסיסמה. פתחו אותו באותו דפדפן שבו ביקשתם את האיפוס.");
	});
});

google?.addEventListener("click", () => void perform(async () => {
	const result = await request("google", {});
	const target = new URL(result.url);
	if (target.protocol !== "https:") throw new Error("request_failed");
	location.assign(target.href);
}));
document.querySelector("[data-logout]")?.addEventListener("click", () => void perform(async () => {
	await request("logout", {});
	location.replace("/account/login.html?status=signed-out");
}));
document.querySelector("[data-password-toggle]")?.addEventListener("click", event => {
	const input = document.querySelector("#password");
	const visible = input.type === "password";
	input.type = visible ? "text" : "password";
	event.currentTarget.setAttribute("aria-label", visible ? "הסתרת הסיסמה" : "הצגת הסיסמה");
	event.currentTarget.setAttribute("aria-pressed", String(visible));
});
retry.addEventListener("click", bootstrap);

const status = new URLSearchParams(location.search).get("status");
if (status === "password-updated") feedback("הסיסמה עודכנה. אפשר להתחבר עם הסיסמה החדשה.");
if (status === "password-updated-signout-incomplete") feedback("הסיסמה עודכנה. לא הצלחנו לנתק את כל המכשירים האחרים. אפשר להתחבר עם הסיסמה החדשה.");
if (status === "signed-out") feedback("יצאתם מהחשבון.");
if (status === "link-expired") feedback("הקישור אינו תקף או שנפתח בדפדפן אחר. נסו להתחבר שוב, או בקשו קישור חדש.", true);
void bootstrap();
