import "../js/input-mode.js";
import { createProtectedPage } from "./protected-page.js";
import { createQuizAttemptEditor } from "./quiz-attempt-editor.js";

const element = selector => document.querySelector(selector);
const status = element("[data-learning-status]");
const saveStatus = element("[data-save-status]");
const topics = element("[data-topics]");
const form = element("[data-quiz-form]");
const questions = element("[data-questions]");
const historyList = element("[data-history-list]");
const editor = createQuizAttemptEditor();
element("[data-learning-interface]").hidden = false;
element("[data-sign-in]").href = `login.html?return=${encodeURIComponent(location.pathname)}`;
let csrf, selectedTopic, nextCursor;
let busy = false;
const lifetime = createProtectedPage({
	clear: ({ preserveState }) => clearPrivate({ preserveDraft: preserveState }),
	restore: () => void run(loadTopics),
});

function node(tag, text, className) {
	const result = document.createElement(tag);
	if (text !== undefined) result.textContent = text;
	if (className) result.className = className;
	return result;
}
function button(label, action) {
	const result = node("button", label, "account-action btn btn-secondary account-action-secondary");
	result.type = "button";
	result.addEventListener("click", () => run(action));
	return result;
}
function message(error) {
	if (error.status === 401) return "היכנסו לחשבון כדי להמשיך בלמידה.";
	if (error.status === 404) return "התוכן אינו זמין לחשבון שלכם כרגע. אפשר להמשיך בנושאי הלימוד ובתרגול החינמי.";
	if (error.status === 409) return "הניסיון עודכן בחלון אחר. טענו את הניסיון השמור לפני המשך התרגול.";
	if (error.status === 429) return "בוצעו בקשות רבות. המתינו דקה ונסו שוב.";
	return "הפעולה לא הושלמה. בדקו את החיבור ונסו שוב.";
}
function controls(disabled, editing = false) {
	const { editable } = editor.view;
	document.querySelectorAll(".learning-shell button, [data-questions] input").forEach(control => {
		control.disabled = control.matches("[data-questions] input")
			? (disabled && !editing) || !editable
			: disabled;
	});
}
function clearPrivate({ preserveDraft = false } = {}) {
	editor.clear({ preserveDraft });
	csrf = selectedTopic = nextCursor = undefined;
	busy = false;
	topics.replaceChildren();
	element("[data-sections]").replaceChildren();
	element("[data-section-catalog]").hidden = true;
	questions.replaceChildren();
	historyList.replaceChildren();
	element("[data-explanations]").replaceChildren();
	element("#quiz-heading").textContent = "";
	element("[data-score]").textContent = "";
	element("[data-score-threshold]").textContent = "";
	element("[data-retention]").hidden = true;
	for (const selector of ["[data-attempt]", "[data-results]", "[data-result-summary]", "[data-history]"]) element(selector).hidden = true;
	saveStatus.textContent = "";
	controls(false);
}
async function run(action, editing = false) {
	if (busy) return;
	const focused = document.activeElement;
	return lifetime.run(async ({ request: ownedRequest }) => {
		busy = true;
		controls(true, editing);
		const request = async (path, body) => {
			const data = await ownedRequest(`/api/${path}`, { body, csrf });
			if (data.csrf) csrf = data.csrf;
			return data;
		};
		await action(request);
		if (status.dataset.failed === "true") {
			status.dataset.failed = "false";
			status.setAttribute("role", "status");
			status.textContent = "אפשר להמשיך בלמידה ובתרגול.";
			element("[data-reload]").hidden = true;
		}
	}, {
		error(error) {
			if ([401, 404].includes(error.status)) lifetime.reset();
			const { attempt, dirty, conflict } = editor.view;
			element("[data-reload-attempt]").hidden = !conflict;
			status.textContent = message(error);
			status.dataset.failed = "true";
			status.setAttribute("role", "alert");
			element("[data-reload]").hidden = error.status === 401;
			element("[data-sign-in]").hidden = error.status !== 401;
			if (attempt) saveStatus.dataset.failed = "true";
			if (attempt) saveStatus.textContent = message(error) + (dirty && !conflict ? " התשובות שבחרתם עדיין מופיעות כאן. לחצו על שמירת תשובות כדי לנסות שוב." : "");
		},
		finish() {
			busy = false; controls(false);
			if (document.activeElement === document.body && focused?.isConnected && !focused.disabled) focused.focus();
		},
	});
}
function canLeave() {
	if (!editor.view.dirty) return true;
	saveStatus.textContent = "יש תשובות שטרם נשמרו. שמרו אותן לפני מעבר למסך אחר.";
	return false;
}
async function loadTopics(request) {
	status.dataset.failed = "false";
	status.setAttribute("role", "status");
	element("[data-reload]").hidden = true;
	const data = await request("learning");
	const catalog = await request("sections");
	element("[data-sign-in]").hidden = true;
	element("[data-retention]").hidden = !(data.paidAccess || data.hadPaidAccess);
	element("[data-section-catalog]").hidden = false;
	const sections = element("[data-sections]");
	sections.replaceChildren();
	for (const section of catalog.sections) {
		const card = node("article", undefined, "learning-topic");
		card.append(node("h3", section.title), node("p", section.accessLevel === "free" ? "קריאה בחשבון חינמי" : "קריאה בגישה המורחבת", "account-hint"));
		const link = node("a", "פתיחת חומר הקריאה", "account-action btn btn-secondary account-action-secondary");
		link.href = `reader.html?section=${encodeURIComponent(section.id)}&access=${section.accessLevel}`;
		card.append(link);
		sections.append(card);
	}
	if (!catalog.sections.length) sections.append(node("p", "חומרי הקריאה הזמינים לחשבון עדיין לא פורסמו."));
	topics.replaceChildren();
	status.textContent = data.paidAccess ? "בחרו חומר קריאה או נושא לתרגול."
		: "החשבון החינמי מאפשר לקרוא חומרי בסיס שפורסמו כאן. אפשר גם ללמוד ולתרגל ללא מנוי בנושאי הלימוד. הגישה לתרגולים השמורים בחשבון עדיין אינה זמינה בחשבון שלכם.";
	if (!data.topics.length) status.textContent += " תרגולים לחשבון עדיין לא פורסמו.";
	for (const topic of data.topics) {
		const card = node("section", undefined, "learning-topic");
		card.dataset.topic = topic.key;
		card.append(node("h2", topic.title));
		card.append(node("p", topic.completedAt ? "הושלם" : "עדיין לא סומן כהושלם", topic.completedAt ? "learning-completion" : "account-hint"));
		if (data.paidAccess) {
			const last = topic.latestAttempt;
			card.append(node("p", last ? `הציון האחרון: ${last.score}/${last.questionCount}, ${Math.round(100 * last.score / last.questionCount)}%.` : "עדיין לא הוגש תרגול בנושא זה.", "account-hint"));
			const actions = node("div", undefined, "learning-actions");
			actions.append(button("פתיחת התרגול", request => openQuiz(request, topic.key)), button("היסטוריית ניסיונות", request => openHistory(request, topic.key)));
			card.append(actions);
		}
		topics.append(card);
	}
	const restored = await editor.restore(request);
	if (restored !== "none") {
		renderAttempt();
		if (restored === "submitted") {
			saveStatus.textContent = "הניסיון כבר הוגש בחלון אחר. תשובות שלא נשמרו לא נכללו בהגשה.";
		} else if (restored === "conflict" || restored === "draft") {
			saveStatus.textContent = restored === "conflict"
				? "התשובות שטרם נשמרו הוחזרו, אך הניסיון עודכן בחלון אחר. טעינת הניסיון השמור תחליף אותן."
				: "התשובות שטרם נשמרו הוחזרו. לחצו על שמירת תשובות כדי לנסות שוב.";
		}
	}
}
function renderAttempt() {
	const { attempt: data, answers, conflict, editable } = editor.view;
	const submitted = data.status === "submitted";
	saveStatus.dataset.failed = "false";
	selectedTopic = data.topicKey;
	element("[data-attempt]").hidden = false;
	element("[data-history]").hidden = true;
	element("#quiz-heading").textContent = data.title;
	element("[data-reload-attempt]").hidden = !conflict;
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
			input.checked = answers[question.id] === option.id;
			input.disabled = !editable;
			label.append(input, node("span", option.text));
			if (submitted) {
				const result = data.results.find(result => result.questionId === question.id);
				const correct = option.id === result.correctOptionId;
				const chosen = answers[question.id] === option.id;
				label.dataset.correct = String(correct);
				label.dataset.chosen = String(chosen);
				if (correct || chosen) label.append(node("span", correct && chosen ? "התשובה הנכונה שבחרתם" : correct ? "התשובה הנכונה" : "התשובה שבחרתם", "learning-answer-marker"));
			}
			field.append(label);
		}
		questions.append(field);
	}
	element("[data-draft-actions]").hidden = submitted;
	element("[data-results]").hidden = !submitted;
	element("[data-result-summary]").hidden = !submitted;
	element("[data-quiz-threshold]").hidden = submitted;
	saveStatus.textContent = submitted ? "הניסיון הוגש ונשמר." : "התשובות נשמרות לאחר כל בחירה. אפשר לחזור ולהמשיך מאוחר יותר.";
	const explanations = element("[data-explanations]");
	explanations.replaceChildren();
	if (submitted) {
		element("[data-score]").textContent = `הציון שלכם: ${data.score}/${data.questions.length}, ${Math.round(100 * data.score / data.questions.length)}%. ${data.passed ? "עברתם את התרגול." : "אפשר לנסות שוב ללא הגבלה."}`;
		element("[data-score-threshold]").textContent = `כדי לעבור נדרשות ${Math.ceil(data.questions.length * 0.85)} תשובות נכונות מתוך ${data.questions.length}, לפחות 85%.`;
		for (const result of data.results) {
			const question = data.questions.find(question => question.id === result.questionId);
			const correct = question.options.find(option => option.id === result.correctOptionId);
			const chosen = question.options.find(option => option.id === answers[question.id]);
			const item = node("li");
			item.append(node("strong", result.correct ? "תשובה נכונה" : "תשובה שגויה"), node("p", question.prompt), node("p", `התשובה שבחרתם: ${chosen?.text ?? ""}`), node("p", `התשובה הנכונה: ${correct.text}`), node("p", result.explanation));
			explanations.append(item);
		}
		element("[data-complete]").hidden = !data.passed;
	}
}
async function openQuiz(request, key) {
	if (!canLeave()) return;
	editor.load(await request(`quizzes/${encodeURIComponent(key)}/start`, {}));
	renderAttempt();
	element("#quiz-heading").focus();
	element("[data-attempt]").scrollIntoView({ block: "start", behavior: "instant" });
}
async function save(request) {
	if (!editor.view.editable) return;
	saveStatus.dataset.failed = "false";
	saveStatus.textContent = "שומרים את התשובות...";
	if (await editor.save(request)) saveStatus.textContent = "התשובות נשמרו.";
}
async function submit(request) {
	const result = await editor.submit(request);
	if (result.status === "incomplete") {
		saveStatus.textContent = `יש לענות על כל ${editor.view.attempt.questions.length} השאלות לפני ההגשה.`;
		// run() temporarily disables controls; focus after they are enabled again.
		const missing = [...questions.querySelectorAll("input")].find(input => input.name === result.questionId);
		queueMicrotask(() => { controls(false); missing.focus(); });
		return;
	}
	if (result.status !== "submitted") return;
	renderAttempt();
	element("[data-score]").focus();
}
async function openHistory(request, key, before = null) {
	if (!canLeave()) return;
	const data = await request(`quizzes/${encodeURIComponent(key)}/history${before ? `?before=${encodeURIComponent(before)}` : ""}`);
	selectedTopic = key;
	element("[data-attempt]").hidden = true;
	element("[data-history]").hidden = false;
	if (!before) historyList.replaceChildren();
	for (const entry of data.attempts) {
		const item = node("li");
		const date = new Date(entry.submittedAt).toLocaleString("he-IL");
		item.append(button(`${date} - ${entry.score}/${entry.questionCount}`, async request => {
			editor.load(await request(`attempts/${entry.id}`));
			renderAttempt();
			element("[data-score]").focus();
		}));
		historyList.append(item);
	}
	if (!data.attempts.length && !before) historyList.append(node("li", "עדיין לא הוגשו ניסיונות בנושא זה."));
	nextCursor = data.nextCursor;
	element("[data-more]").hidden = !data.hasMore;
	if (!before) element("#history-heading").focus();
}
form.addEventListener("change", event => {
	editor.choose(event.target.name, event.target.value);
	void run(save, true);
});
form.addEventListener("submit", event => { event.preventDefault(); void run(submit); });
element("[data-save]").addEventListener("click", () => run(save, true));
element("[data-retry]").addEventListener("click", () => run(request => openQuiz(request, editor.view.attempt.topicKey)));
element("[data-more]").addEventListener("click", () => run(request => openHistory(request, selectedTopic, nextCursor)));
element("[data-reload-attempt]").addEventListener("click", () => run(async request => {
	editor.load(await request(`attempts/${editor.view.attempt.id}`));
	renderAttempt();
}));
element("[data-complete]").addEventListener("click", () => run(async request => {
	await request(`topics/${encodeURIComponent(editor.view.attempt.topicKey)}/complete`, {});
	await loadTopics(request);
	element("[data-complete]").hidden = true;
	saveStatus.textContent = "הנושא סומן כהושלם.";
}));
element("[data-reload]").addEventListener("click", () => { if (canLeave()) { lifetime.reset({ preserveState: true }); void run(loadTopics); } });
window.addEventListener("beforeunload", event => { if (editor.view.unsaved) { event.preventDefault(); event.returnValue = ""; } });
void run(loadTopics);
