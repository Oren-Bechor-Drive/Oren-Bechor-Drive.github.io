import { inspectPassword } from "./password-policy.js";
import "../js/input-mode.js";

const mode = document.body.dataset.account;
const form = document.querySelector("[data-account-form]");
const fields = document.querySelector(".account-fields");
const google = document.querySelector("[data-google]");
const errorBox = document.querySelector('[role="alert"]');
const statusBox = document.querySelector('.account-feedback[role="status"]');
const startup = document.querySelector("[data-startup]");
const retry = document.querySelector("[data-retry]");
const unavailableLibrary = document.querySelector("[data-unavailable-library]");
const confirmation = document.querySelector("[data-recovery-confirmation]");
const queryStatus = new URLSearchParams(location.search).get("status");
let session, recoveryEmail;
let busy = false;
let ready = false;
let verificationTimer, verificationResendAt = 0, verificationExpiresAt = 0;

const messages = {
	sign_in_failed: "ההתחברות לא הושלמה. בדקו את כתובת האימייל והסיסמה, וודאו שאישרתם את האימייל.",
	invalid_email: "יש להזין כתובת אימייל תקינה, למשל name@gmail.com.",
	invalid_password: mode === "login" ? "יש להזין סיסמה באורך 1 עד 128 תווים." : "בחרו סיסמה עם לפחות 12 תווים. אם היא ארוכה מדי, קצרו אותה.",
	rate_limited: "בוצעו ניסיונות רבים בזמן קצר. המתינו מעט ונסו שוב.",
	request_rejected: "הבקשה פגה. לחצו על ניסיון נוסף ונסו שוב.",
	session_expired: "ההתחברות הסתיימה. היכנסו שוב לחשבון.",
	recovery_required: "יש לפתוח את הקישור לאיפוס הסיסמה שקיבלתם באימייל, באותו דפדפן שבו ביקשתם אותו.",
	unavailable: mode === "register" ? "יצירת החשבון אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע."
		: mode === "verify" ? "בדיקת בקשת ההרשמה אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע."
		: ["recovery", "reset"].includes(mode) ? "איפוס הסיסמה אינו זמין כרגע. אפשר לנסות שוב בעוד רגע."
		: "ההתחברות אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע.",
	google_unavailable: "הכניסה עם Google אינה זמינה כרגע. אפשר להתחבר עם אימייל וסיסמה.",
	request_failed: "הבקשה לא הושלמה. נסו שוב בעוד רגע.",
};

// Only protected account destinations are accepted after password sign-in.
function returnDestination() {
	const value = new URLSearchParams(location.search).get("return");
	if (!value?.startsWith("/account/") || value.includes("\\")) return "/account/";
	const target = new URL(value, location.origin);
	if (target.origin !== location.origin || target.hash) return "/account/";
	if (target.pathname === "/account/learning.html" && !target.search) return target.pathname;
	if (target.pathname === "/account/reader.html" && /^[0-9a-f-]{36}$/i.test(target.searchParams.get("section") ?? "")
		&& ["free", "paid"].includes(target.searchParams.get("access"))
		&& target.searchParams.size === 2) return target.pathname + target.search;
	return "/account/";
}
function fieldError(input) {
	const value = input.value;
	if (input.name === "email") {
		if (!value.trim()) return "יש להזין כתובת אימייל.";
		if (!value.includes("@")) return "חסר הסימן @ בכתובת, למשל name@gmail.com.";
		if (!value.split("@")[1]) return "חסר החלק שאחרי ה-@, למשל name@gmail.com.";
		return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? "" : messages.invalid_email;
	}
	const { length, error } = inspectPassword(value, { existing: mode === "login" });
	if (error === "required") return "יש להזין סיסמה.";
	if (error === "too_short") return `הסיסמה קצרה מדי: צריך לפחות 12 תווים, הזנתם ${length}.`;
	if (error === "too_long") return mode === "login" ? "הסיסמה ארוכה מדי. אפשר להזין עד 128 תווים."
		: "הסיסמה ארוכה מדי. קצרו אותה או החליפו חלק מהתווים באותיות באנגלית.";
	return "";
}
function validateField(input) {
	const text = fieldError(input);
	const message = document.querySelector(`#${input.id}-error`);
	message.textContent = text;
	message.hidden = !text;
	input.setAttribute("aria-invalid", String(Boolean(text)));
	return !text;
}
function updateRegistrationPassword() {
	if (!["register", "reset"].includes(mode)) return;
	const input = document.querySelector("#password");
	const met = inspectPassword(input.value).error === null;
	const strength = document.querySelector("[data-password-strength]");
	const meter = strength.querySelector('[role="meter"]');
	const label = strength.querySelector("[data-password-strength-label]");
	const text = !input.value ? "הזינו סיסמה" : met ? "הסיסמה עומדת בכל הדרישות" : fieldError(input);
	strength.hidden = false;
	strength.dataset.score = String(Number(met));
	meter.setAttribute("aria-valuenow", String(Number(met)));
	meter.setAttribute("aria-valuetext", text);
	if (label.textContent !== text) label.textContent = text;
	for (const rule of document.querySelectorAll("[data-password-rule]")) rule.dataset.met = String(met);
	input.setCustomValidity(input.value && !met ? text : "");
}
for (const input of form?.querySelectorAll("input") ?? []) {
	input.addEventListener("input", () => {
		updateRegistrationPassword();
		if (input.getAttribute("aria-invalid") === "true") validateField(input);
	});
}
if (["register", "reset"].includes(mode)) {
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
function expiredLinkFeedback() {
	feedback("הקישור אינו תקף או שנפתח בדפדפן אחר. פתחו אותו בדפדפן שבו ביקשתם אותו, או בקשו קישור חדש.", true);
	const links = document.createElement("span");
	links.className = "account-error-links";
	for (const [href, text] of [["login.html", "כניסה לחשבון"], ["recovery.html", "בקשת קישור חדש לאיפוס"]]) {
		const link = document.createElement("a"); link.href = href; link.textContent = text; links.append(link);
	}
	errorBox.append(links);
}
function renderVerification(context) {
	clearTimeout(verificationTimer);
	verificationResendAt = context ? Date.now() + context.resendAfter * 1000 : 0;
	verificationExpiresAt = context ? Date.now() + context.expiresAfter * 1000 : 0;
	const controls = document.querySelector("[data-verification-controls]");
	const email = document.querySelector("[data-verification-email]");
	const missing = document.querySelector("[data-verification-missing]");
	const wait = document.querySelector("[data-verification-wait]");
	email.textContent = context?.maskedEmail ?? "";
	function tick() {
		const active = Boolean(context && Date.now() < verificationExpiresAt);
		controls.hidden = !active; missing.hidden = active;
		if (!active) { email.textContent = ""; wait.textContent = ""; if (session) session.verification = null; }
		else {
			const seconds = Math.max(0, Math.ceil((verificationResendAt - Date.now()) / 1000));
			wait.textContent = seconds ? `אפשר לבקש קישור נוסף בעוד ${seconds} שניות.` : "אפשר לבקש קישור נוסף לאותה כתובת אימייל.";
			verificationTimer = setTimeout(tick, 1000);
		}
		updateControls();
	}
	tick();
}
function updateControls() {
	if (fields) fields.disabled = busy;
	const disabled = busy || !ready;
	for (const control of document.querySelectorAll('button[type="submit"], [data-google], [data-logout], [data-resend], [data-change-email], [data-verification-resend]')) {
		control.disabled = disabled || (control === google && !session?.google)
			|| (control.matches("[data-verification-resend]") && (!session?.verification || Date.now() < verificationResendAt));
		control.dataset.idleLabel ??= control.textContent.trim();
		if (control === google) continue;
		control.textContent = busy && !control.matches("[data-change-email]")
			? control.matches("[data-logout]") ? "יוצאים..." : control.matches("[data-resend], [data-verification-resend]") ? "שולחים..."
				: ({ login: "מתחברים...", register: "יוצרים חשבון...", reset: "שומרים...", recovery: "שולחים..." })[mode]
			: control.dataset.idleLabel;
	}
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
	ready = false; updateControls(); retry.hidden = true; startup.hidden = false;
	try {
		session = await request("session");
		if (!session.available) throw new Error("unavailable");
		if (mode === "verify") renderVerification(session.verification);
		if (session.user && ["login", "register", "verify"].includes(mode)) return location.replace(returnDestination());
		if (mode === "account") {
			if (!session.user) return location.replace("/account/login.html");
			document.querySelector("[data-email]").textContent = session.user.email;
			document.querySelector("[data-account-details]").hidden = false;
		}
		if (mode === "reset") {
			form.hidden = !session.recovery;
			const link = document.querySelector("[data-new-recovery]");
			for (const className of ["account-action", "btn", "btn-primary"]) link.classList.toggle(className, !session.recovery);
			if (!session.recovery) { feedback(messages.recovery_required, true); return; }
		}
		if (queryStatus !== "link-expired") errorBox.hidden = true;
		unavailableLibrary.hidden = true;
		ready = true; updateControls();
		if (google) {
			document.querySelector("[data-google-controls]").hidden = !session.google;
			const intro = document.querySelector("[data-google-intro]"); if (intro) intro.hidden = !session.google;
		}
	} catch (error) {
		if (mode === "verify") renderVerification(null);
		feedback(messages[error.message] ?? messages.unavailable, true);
		unavailableLibrary.hidden = false; retry.hidden = false;
	} finally { startup.hidden = true; }
}
async function perform(action) {
	if (busy || !ready) return;
	busy = true; updateControls(); form?.setAttribute("aria-busy", "true");
	retry.hidden = true; errorBox.hidden = true; statusBox.hidden = true;
	try { await action(); }
	catch (error) {
		if (mode === "verify") {
			try { session = await request("session"); renderVerification(session.verification); }
			catch { renderVerification(null); }
		}
		feedback(messages[error.message] ?? messages.request_failed, true);
		retry.hidden = !["request_rejected", "session_expired", "unavailable"].includes(error.message);
		unavailableLibrary.hidden = error.message !== "unavailable";
		errorBox.focus();
	} finally { busy = false; updateControls(); form?.removeAttribute("aria-busy"); }
}
async function recover(email) {
	await request("recover", { email });
	recoveryEmail = email;
	form.hidden = true; confirmation.hidden = false;
	feedback("אם קיים חשבון עם הכתובת שהזנתם, יישלח אליו קישור לאיפוס הסיסמה. פתחו אותו באותו דפדפן שבו ביקשתם את האיפוס.");
	document.querySelector("#recovery-confirmation-heading").focus();
}
form?.addEventListener("submit", event => {
	event.preventDefault(); updateRegistrationPassword();
	const invalid = [...form.querySelectorAll("input")].filter(input => !validateField(input));
	if (invalid.length) { invalid[0].focus(); return; }
	const body = Object.fromEntries(new FormData(form));
	void perform(async () => {
		if (mode === "recovery") return recover(body.email);
		const result = await request(mode, body);
		form.reset();
		if (mode === "register") location.assign("/account/verify.html");
		else if (mode === "login") location.assign(returnDestination());
		else if (mode === "reset") location.assign(`/account/login.html?status=${result.otherSessionsSignedOut ? "password-updated" : "password-updated-signout-incomplete"}`);
	});
});
document.querySelector("[data-resend]")?.addEventListener("click", () => void perform(async () => {
	await recover(recoveryEmail);
	feedback("אם קיים חשבון עם הכתובת שהזנתם, יישלח אליו קישור נוסף. פתחו אותו באותו דפדפן.");
}));
document.querySelector("[data-verification-resend]")?.addEventListener("click", () => void perform(async () => {
	const result = await request("resend", {});
	session.verification = result.verification;
	renderVerification(result.verification);
	feedback("אם אפשר להשלים את ההרשמה עם הכתובת שהזנתם, יישלח אליה קישור נוסף לאישור החשבון. פתחו אותו באותו דפדפן.");
}));
if (mode === "verify") {
	const refreshVerification = () => { if (ready && !busy && !document.hidden) void bootstrap(); };
	window.addEventListener("focus", refreshVerification);
	document.addEventListener("visibilitychange", refreshVerification);
}
document.querySelector("[data-change-email]")?.addEventListener("click", () => { confirmation.hidden = true; form.hidden = false; document.querySelector("#email").focus(); });
google?.addEventListener("click", () => void perform(async () => {
	const result = await request("google", {}); const target = new URL(result.url);
	if (target.protocol !== "https:") throw new Error("request_failed");
	location.assign(target.href);
}));
document.querySelector("[data-logout]")?.addEventListener("click", () => void perform(async () => { await request("logout", {}); location.replace("/account/login.html?status=signed-out"); }));
document.querySelector("[data-password-toggle]")?.addEventListener("click", event => {
	const input = document.querySelector("#password"); const visible = input.type === "password";
	input.type = visible ? "text" : "password";
	event.currentTarget.setAttribute("aria-label", visible ? "הסתרת הסיסמה" : "הצגת הסיסמה");
	event.currentTarget.setAttribute("aria-pressed", String(visible));
});
retry.addEventListener("click", bootstrap);
if (queryStatus === "password-updated") feedback("הסיסמה עודכנה. אפשר להתחבר עם הסיסמה החדשה.");
if (queryStatus === "password-updated-signout-incomplete") feedback("הסיסמה עודכנה. חלק מהמכשירים האחרים לא נותקו. אפשר להתחבר עם הסיסמה החדשה.");
if (queryStatus === "signed-out") feedback("יצאתם מהחשבון.");
if (queryStatus === "link-expired") expiredLinkFeedback();
void bootstrap();
