import "./focus.js";

const element = selector => document.querySelector(selector);
const status = element("[data-learning-status]");
const saveStatus = element("[data-save-status]");
const topics = element("[data-topics]");
const form = element("[data-quiz-form]");
const questions = element("[data-questions]");
const historyList = element("[data-history-list]");
let csrf, attempt, selectedTopic, nextCursor, heldDraft, draftBaseRevision;
let dirty = false, conflict = false, busy = false;
let lifetime = new AbortController();

function node(tag, text, className) {
	const result = document.createElement(tag);
	if (text !== undefined) result.textContent = text;
	if (className) result.className = className;
	return result;
}
function button(label, action) {
	const result = node("button", label, "account-action account-action-secondary");
	result.type = "button";
	result.addEventListener("click", () => run(action));
	return result;
}
function message(error) {
	if (error.status === 401) return "היכנסו לחשבון כדי להמשיך בלמידה.";
	if (error.status === 404) return "התוכן אינו זמין לחשבון. לתרגול נדרש מנוי פעיל.";
	if (error.status === 409) return "הניסיון עודכן בחלון אחר. טענו את הניסיון השמור לפני המשך התרגול.";
	if (error.status === 429) return "בוצעו בקשות רבות. המתינו דקה ונסו שוב.";
	return "לא הצלחנו להשלים את הפעולה. בדקו את החיבור ונסו שוב.";
}
function controls(disabled, editing = false) {
	document.querySelectorAll(".learning-shell button, [data-questions] input").forEach(control => {
		control.disabled = control.matches("[data-questions] input")
			? (disabled && !editing) || attempt?.status === "submitted" || conflict
			: disabled;
	});
}
function sameAnswers(left, right) {
	return Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => right[key] === value);
}
function chosenAnswers() {
	return Object.fromEntries([...questions.querySelectorAll("input:checked")].map(input => [input.name, input.value]));
}
function clearPrivate({ preserveDraft = false } = {}) {
	if (preserveDraft) {
		if (dirty && attempt?.status === "draft") heldDraft = { id: attempt.id, revision: draftBaseRevision, answers: chosenAnswers() };
	} else heldDraft = undefined;
	lifetime.abort();
	lifetime = new AbortController();
	csrf = attempt = selectedTopic = nextCursor = undefined;
	dirty = conflict = busy = false;
	topics.replaceChildren();
	element("[data-sections]").replaceChildren();
	questions.replaceChildren();
	historyList.replaceChildren();
	element("[data-explanations]").replaceChildren();
	for (const selector of ["[data-attempt]", "[data-results]", "[data-history]"]) element(selector).hidden = true;
	saveStatus.textContent = "";
	controls(false);
}
async function request(path, body) {
	const owner = lifetime;
	const response = await fetch(`/api/${path}`, { credentials: "same-origin", cache: "no-store",
		signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(10000)]),
		...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify(body) }) });
	const data = await response.json();
	if (owner !== lifetime) throw new DOMException("Obsolete request", "AbortError");
	if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
	if (data.csrf) csrf = data.csrf;
	return data;
}
async function run(action, editing = false) {
	if (busy) return;
	const owner = lifetime;
	const focused = document.activeElement;
	busy = true;
	controls(true, editing);
	try { await action(); }
	catch (error) {
		if (owner !== lifetime) return;
		if ([401, 404].includes(error.status)) clearPrivate();
		if (error.status === 409) {
			conflict = true;
			element("[data-reload-attempt]").hidden = false;
		}
		status.textContent = message(error);
		if (attempt) saveStatus.textContent = message(error) + (dirty && !conflict ? " התשובות שבחרתם עדיין מופיעות כאן. לחצו על שמירת תשובות כדי לנסות שוב." : "");
	} finally {
		if (owner === lifetime) {
			busy = false; controls(false);
			if (document.activeElement === document.body && focused?.isConnected && !focused.disabled) focused.focus();
		}
	}
}
function canLeave() {
	if (!dirty) return true;
	saveStatus.textContent = "יש תשובות שטרם נשמרו. שמרו אותן לפני מעבר למסך אחר.";
	return false;
}
async function loadTopics() {
	const data = await request("learning");
	const catalog = await request("sections");
	const sections = element("[data-sections]");
	sections.replaceChildren();
	for (const section of catalog.sections) {
		const link = node("a", section.title + (section.accessLevel === "free" ? " - הגדרה" : " - שיעור"), "account-action account-action-secondary");
		link.href = `reader.html?section=${encodeURIComponent(section.id)}&access=${section.accessLevel}`;
		sections.append(link);
	}
	if (!catalog.sections.length) sections.append(node("p", "חומרי הלימוד המאושרים עדיין לא פורסמו."));
	topics.replaceChildren();
	status.textContent = data.paidAccess ? "בחרו נושא כדי להמשיך בתרגול." : "לתרגול נדרש מנוי פעיל. נושאים שהושלמו נשמרים בחשבון.";
	if (!data.topics.length) status.textContent += " התרגולים המאושרים עדיין לא פורסמו.";
	for (const topic of data.topics) {
		const card = node("section", undefined, "learning-topic");
		card.append(node("h2", topic.title));
		if (topic.completedAt) card.append(node("p", "הושלם"));
		if (data.paidAccess) {
			const actions = node("div", undefined, "learning-actions");
			actions.append(button("פתיחת התרגול", () => openQuiz(topic.key)), button("היסטוריית ניסיונות", () => openHistory(topic.key)));
			card.append(actions);
		}
		topics.append(card);
	}
	if (heldDraft) {
		const draft = heldDraft;
		const saved = await request(`attempts/${draft.id}`);
		renderAttempt(saved);
		heldDraft = undefined;
		if (saved.status === "submitted") {
			saveStatus.textContent = "הניסיון כבר הוגש בחלון אחר. תשובות שלא נשמרו לא נכללו בהגשה.";
		} else if (!sameAnswers(saved.answers, draft.answers)) {
			questions.querySelectorAll("input").forEach(input => { input.checked = draft.answers[input.name] === input.value; });
			dirty = true;
			draftBaseRevision = draft.revision;
			conflict = saved.revision !== draftBaseRevision;
			element("[data-reload-attempt]").hidden = !conflict;
			saveStatus.textContent = conflict
				? "התשובות שטרם נשמרו הוחזרו, אך הניסיון עודכן בחלון אחר. טעינת הניסיון השמור תחליף אותן."
				: "התשובות שטרם נשמרו הוחזרו. לחצו על שמירת תשובות כדי לנסות שוב.";
		}
	}
}
function renderAttempt(data) {
	attempt = data;
	draftBaseRevision = data.revision;
	dirty = conflict = false;
	selectedTopic = data.topicKey;
	element("[data-attempt]").hidden = false;
	element("[data-history]").hidden = true;
	element("#quiz-heading").textContent = data.title;
	element("[data-reload-attempt]").hidden = true;
	questions.replaceChildren();
	for (const [index, question] of data.questions.entries()) {
		const field = node("fieldset");
		field.append(node("legend", `${index + 1}. ${question.prompt}`));
		for (const option of question.options) {
			const label = node("label", undefined, "learning-option");
			const input = node("input");
			input.type = "radio";
			input.name = question.id;
			input.value = option.id;
			input.checked = data.answers[question.id] === option.id;
			input.disabled = data.status === "submitted";
			label.append(input, node("span", option.text));
			field.append(label);
		}
		questions.append(field);
	}
	const submitted = data.status === "submitted";
	element("[data-draft-actions]").hidden = submitted;
	element("[data-results]").hidden = !submitted;
	saveStatus.textContent = submitted ? "הניסיון הוגש ונשמר." : "התשובות נשמרות לאחר כל בחירה. אפשר לחזור ולהמשיך מאוחר יותר.";
	const explanations = element("[data-explanations]");
	explanations.replaceChildren();
	if (submitted) {
		element("[data-score]").textContent = `הציון שלכם: ${data.score}/20. ${data.passed ? "עברתם את התרגול." : "אפשר לנסות שוב ללא הגבלה."}`;
		for (const result of data.results) {
			const question = data.questions.find(question => question.id === result.questionId);
			const correct = question.options.find(option => option.id === result.correctOptionId);
			const item = node("li");
			item.append(node("strong", result.correct ? "תשובה נכונה" : "תשובה שגויה"), node("p", question.prompt), node("p", `התשובה הנכונה: ${correct.text}`), node("p", result.explanation));
			explanations.append(item);
		}
		element("[data-complete]").hidden = !data.passed;
	}
}
async function openQuiz(key) {
	if (!canLeave()) return;
	renderAttempt(await request(`quizzes/${encodeURIComponent(key)}/start`, {}));
	element("#quiz-heading").focus();
}
async function save() {
	if (!attempt || attempt.status !== "draft" || conflict) return false;
	while (dirty) {
		saveStatus.textContent = "שומרים את התשובות...";
		const answers = chosenAnswers();
		const saved = await request(`attempts/${attempt.id}/save`, { answers, expectedRevision: attempt.revision });
		attempt = saved;
		draftBaseRevision = saved.revision;
		dirty = !sameAnswers(answers, chosenAnswers());
	}
	saveStatus.textContent = "התשובות נשמרו.";
	return true;
}
async function submit() {
	if (!attempt || conflict) return;
	const missing = [...questions.querySelectorAll("fieldset")].find(field => !field.querySelector("input:checked"));
	if (missing) {
		saveStatus.textContent = "יש לענות על כל 20 השאלות לפני ההגשה.";
		// run() temporarily disables controls; focus after they are enabled again.
		queueMicrotask(() => { controls(false); missing.querySelector("input").focus(); });
		return;
	}
	if (!await save()) return;
	renderAttempt(await request(`attempts/${attempt.id}/submit`, { expectedRevision: attempt.revision }));
	element("[data-score]").focus();
}
async function openHistory(key, before = null) {
	if (!canLeave()) return;
	const data = await request(`quizzes/${encodeURIComponent(key)}/history${before ? `?before=${encodeURIComponent(before)}` : ""}`);
	selectedTopic = key;
	element("[data-attempt]").hidden = true;
	element("[data-history]").hidden = false;
	if (!before) historyList.replaceChildren();
	for (const entry of data.attempts) {
		const item = node("li");
		const date = new Date(entry.submittedAt).toLocaleString("he-IL");
		item.append(button(`${date} - ${entry.score}/20`, async () => {
			renderAttempt(await request(`attempts/${entry.id}`));
			element("[data-score]").focus();
		}));
		historyList.append(item);
	}
	if (!data.attempts.length && !before) historyList.append(node("li", "עדיין לא הוגשו ניסיונות בנושא זה."));
	nextCursor = data.nextCursor;
	element("[data-more]").hidden = !data.hasMore;
	if (!before) element("#history-heading").focus();
}
form.addEventListener("change", () => {
	dirty = true;
	void run(save, true);
});
form.addEventListener("submit", event => { event.preventDefault(); void run(submit); });
element("[data-save]").addEventListener("click", () => run(save, true));
element("[data-retry]").addEventListener("click", () => run(() => openQuiz(attempt.topicKey)));
element("[data-more]").addEventListener("click", () => run(() => openHistory(selectedTopic, nextCursor)));
element("[data-reload-attempt]").addEventListener("click", () => run(async () => renderAttempt(await request(`attempts/${attempt.id}`))));
element("[data-complete]").addEventListener("click", () => run(async () => {
	await request(`topics/${encodeURIComponent(attempt.topicKey)}/complete`, {});
	await loadTopics();
	element("[data-complete]").hidden = true;
	saveStatus.textContent = "הנושא סומן כהושלם.";
}));
element("[data-reload]").addEventListener("click", () => { if (canLeave()) { clearPrivate({ preserveDraft: true }); void run(loadTopics); } });
window.addEventListener("beforeunload", event => { if (dirty || heldDraft) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("pagehide", () => clearPrivate({ preserveDraft: true }));
document.addEventListener("visibilitychange", () => {
	if (document.hidden) clearPrivate({ preserveDraft: true });
	else void run(loadTopics);
});
window.addEventListener("pageshow", event => { if (event.persisted) { clearPrivate({ preserveDraft: true }); void run(loadTopics); } });
void run(loadTopics);
