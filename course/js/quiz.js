import { initDisclosureMotion } from "../../js/disclosure-motion.js";
import "../../js/input-mode.js";

const questions = [...document.querySelectorAll(".quiz-question")];
const form = document.querySelector(".quiz-form");
const session = document.querySelector("[data-quiz-session]");
const result = document.querySelector("[data-quiz-result]");
const position = document.querySelector("[data-quiz-position]");
const jump = document.querySelector("#question-jump");
const previous = document.querySelector("[data-quiz-previous]");
const next = document.querySelector("[data-quiz-next]");
const validation = document.querySelector("[data-quiz-validation]");
const resultTitle = document.querySelector("#quiz-result-title");
const defaultResultTitle = resultTitle.textContent;
const intro = document.querySelector(".lesson-intro > p");
const defaultIntro = intro.textContent;
const graded = form.hasAttribute("data-quiz-graded");
const shell = document.querySelector(".quiz-shell");
const toolbar = document.querySelector("[data-quiz-toolbar]");
let submitted = false;
let current = 0;
let mistakesOnly = false;

// The focused question announces navigation; the position remains visible text.
position.removeAttribute("role");
position.removeAttribute("aria-live");
position.removeAttribute("aria-atomic");
form.before(validation);

const start = document.createElement("button");
start.type = "button";
start.className = "course-button btn btn-primary quiz-start";
start.textContent = "תחילת התרגול";
start.setAttribute("data-quiz-start", "");
intro.parentElement.append(start);
start.addEventListener("click", () => showQuestion(current));

const progressGroup = document.createElement("div");
progressGroup.className = "quiz-progress";
const progress = document.createElement("progress");
progress.max = questions.length;
progress.value = 0;
progress.setAttribute("data-quiz-progress", "");
progress.setAttribute("aria-label", "שאלות שנענו");
const answered = document.createElement("span");
answered.setAttribute("data-quiz-answered", "");
progressGroup.append(progress, answered);
toolbar.append(progressGroup);
new ResizeObserver(() => {
	shell.style.setProperty("--quiz-toolbar-height", `${toolbar.getBoundingClientRect().height}px`);
}).observe(toolbar);

const summary = document.createElement("section");
summary.className = "quiz-result quiz-submit-summary";
summary.hidden = true;
summary.setAttribute("data-quiz-summary", "");
summary.setAttribute("aria-labelledby", "quiz-summary-title");
summary.innerHTML = '<h2 id="quiz-summary-title" tabindex="-1">לפני בדיקת השאלון</h2><p data-quiz-summary-count></p><p>בדקו את הבחירות שלכם. אפשר לחזור לכל שאלה ולשנות תשובה. לאחר הבדיקה התשובות ננעלות ומוצגים הציון וההסברים.</p><ol class="quiz-summary-answers"></ol><div class="quiz-result-actions"><button class="course-button btn btn-primary" type="button" data-quiz-submit>בדיקת השאלון</button><button class="quiz-previous btn btn-secondary" type="button" data-quiz-edit>חזרה לשאלות</button></div>';
if (graded) result.before(summary);
summary.querySelector("[data-quiz-submit]").addEventListener("click", finish);
summary.querySelector("[data-quiz-edit]").addEventListener("click", () => showQuestion(current));

function updateProgress() {
	const count = questions.length - missingAnswers().length;
	progress.value = count;
	progress.setAttribute("aria-valuetext", `${count} מתוך ${questions.length} שאלות נענו`);
	answered.textContent = `${count} מתוך ${questions.length} נענו`;
}

function focusCard(target) {
	const headerHeight = document.querySelector(".course-header").getBoundingClientRect().height;
	const toolbarHeight = session.hidden ? 0 : toolbar.getBoundingClientRect().height;
	const card = target.closest(".quiz-question, .quiz-result") ?? target;
	target.focus({ preventScroll: true });
	window.scrollTo({ top: Math.max(0, window.scrollY + card.getBoundingClientRect().top - headerHeight - toolbarHeight - 20), behavior: "instant" });
}

function prepareSubmission() {
	if (submitted || !graded) { finish(); return; }
	const missing = missingAnswers();
	if (missing.length) {
		showQuestion(missing[0]);
		updateValidation(missing);
		return;
	}
	validation.textContent = "";
	summary.querySelector("[data-quiz-summary-count]").textContent = `עניתם על כל ${questions.length} השאלות.`;
	const list = summary.querySelector(".quiz-summary-answers");
	list.replaceChildren();
	for (const [index, question] of questions.entries()) {
		const item = document.createElement("li");
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = `${question.querySelector("legend").textContent.trim()}: ${question.querySelector("input:checked").closest("label").querySelector("span").textContent.trim()}`;
		button.addEventListener("click", () => showQuestion(index));
		item.append(button);
		list.append(item);
	}
	session.hidden = result.hidden = true;
	summary.hidden = false;
	focusCard(summary.querySelector("h2"));
}

const mistakes = document.createElement("nav");
mistakes.id = "quiz-mistakes";
mistakes.className = "quiz-mistakes";
mistakes.setAttribute("aria-labelledby", "quiz-mistakes-title");
mistakes.hidden = true;
const mistakesTitle = document.createElement("h3");
mistakesTitle.id = "quiz-mistakes-title";
mistakesTitle.textContent = "שאלות שכדאי לחזור אליהן";
const mistakesList = document.createElement("ul");
mistakes.append(mistakesTitle, mistakesList);
const reviewMistakes = document.createElement("button");
reviewMistakes.type = "button";
reviewMistakes.className = "quiz-previous btn btn-secondary";
reviewMistakes.setAttribute("data-quiz-errors", "");
reviewMistakes.hidden = true;
if (graded) {
	result.querySelector(".quiz-result-actions").before(mistakes);
	result.querySelector("[data-quiz-review]").after(reviewMistakes);
}

function navigationIndexes() {
	return questions.flatMap((question, index) =>
		!mistakesOnly || question.dataset.result === "incorrect" ? [index] : [],
	);
}

function missingAnswers() {
	return questions.flatMap((question, index) =>
		question.querySelector("input:checked") ? [] : [index],
	);
}

function updateValidation(missing = missingAnswers()) {
	validation.textContent = missing.length
		? `${missing.length === 1 ? "נשארה שאלה אחת" : `נשארו ${missing.length} שאלות`} בלי תשובה: ${missing.map(index => index + 1).join(", ")}. אפשר לענות עליהן ואז לסיים.`
		: "";
}

function reviewQuestion(index, onlyMistakes = false) {
	mistakesOnly = onlyMistakes;
	showQuestion(index);
}

function showResults() {
	session.hidden = true;
	summary.hidden = true;
	result.hidden = false;
	focusCard(resultTitle);
}

for (const [index, question] of questions.entries()) {
	const option = document.createElement("option");
	option.value = String(index);
	option.textContent = question.querySelector("legend").textContent;
	jump.append(option);
}

// The native selector's options supply the enhanced list from authored questions.
const selector = initQuestionSelector();

function initQuestionSelector() {
	const wrapper = jump.parentElement;
	const label = jump.labels[0];
	const trigger = document.createElement("button");
	trigger.type = "button";
	trigger.id = "question-selector";
	trigger.className = "question-trigger";
	trigger.setAttribute("role", "combobox");
	trigger.setAttribute("aria-haspopup", "listbox");
	trigger.setAttribute("aria-controls", "question-options");
	const list = document.createElement("ul");
	list.id = "question-options";
	list.className = "question-options";
	list.setAttribute("role", "listbox");
	list.setAttribute("aria-label", label.textContent);
	const options = [...jump.options].map((option, index) => {
		const item = document.createElement("li");
		item.id = `question-option-${index}`;
		item.textContent = option.textContent;
		item.setAttribute("role", "option");
		item.addEventListener("pointerdown", (event) => event.preventDefault());
		item.addEventListener("click", () => choose(index));
		list.append(item);
		return item;
	});
	const setOpen = initDisclosureMotion(trigger, list, "(min-width: 0px)");
	let active = 0;
	function isOpen() {
		return trigger.getAttribute("aria-expanded") === "true";
	}
	function highlight(index) {
		active = Math.max(0, Math.min(options.length - 1, index));
		options.forEach((option, i) => {
			option.dataset.active = String(i === active);
		});
		trigger.setAttribute("aria-activedescendant", options[active].id);
		const item = options[active];
		if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
		else if (
			item.offsetTop + item.offsetHeight >
			list.scrollTop + list.clientHeight
		)
			list.scrollTop =
				item.offsetTop + item.offsetHeight - list.clientHeight;
	}
	function open() {
		const rect = trigger.getBoundingClientRect();
		const below = window.innerHeight - rect.bottom - 16;
		const above = rect.top - 16;
		const upwards = below < 240 && above > below;
		list.dataset.side = upwards ? "above" : "below";
		list.style.maxHeight = `${Math.max(44, Math.min(320, upwards ? above : below))}px`;
		setOpen(true);
		highlight(jump.selectedIndex);
	}
	function close() {
		setOpen(false);
		trigger.removeAttribute("aria-activedescendant");
	}
	function choose(index) {
		close();
		reviewQuestion(index);
	}
	trigger.addEventListener("click", () => (isOpen() ? close() : open()));
	trigger.addEventListener("keydown", (event) => {
		if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
			event.preventDefault();
			const wasOpen = isOpen();
			if (!wasOpen) open();
			if (event.key === "Home") highlight(0);
			else if (event.key === "End") highlight(options.length - 1);
			else if (wasOpen)
				highlight(active + (event.key === "ArrowDown" ? 1 : -1));
		} else if ((event.key === "Enter" || event.key === " ") && isOpen()) {
			event.preventDefault();
			choose(active);
		} else if (event.key === "Escape" && isOpen()) {
			event.preventDefault();
			close();
		} else if (event.key === "Tab") close();
	});
	document.addEventListener("pointerdown", (event) => {
		if (!wrapper.contains(event.target)) close();
	});
	wrapper.addEventListener("focusout", (event) => {
		if (!wrapper.contains(event.relatedTarget)) close();
	});
	window.addEventListener("resize", close);
	wrapper.append(trigger, list);
	label.htmlFor = trigger.id;
	jump.hidden = true;
	wrapper.classList.add("is-enhanced");
	return (index) => {
		trigger.textContent = questions[index].querySelector("legend").textContent;
		options.forEach((option, i) => {
			const question = questions[i];
			const state = question.dataset.result ?? (question.querySelector("input:checked") ? "answered" : "unanswered");
			const label = { answered: "נענתה", unanswered: "לא נענתה", correct: "תשובה נכונה", incorrect: "תשובה שגויה" }[state];
			const text = `${question.querySelector("legend").textContent.trim()} - ${label}`;
			option.setAttribute("aria-selected", String(i === index));
			option.dataset.answerState = jump.options[i].dataset.answerState = state;
			option.textContent = jump.options[i].textContent = text;
		});
	};
}

function showQuestion(index, focus = true) {
	current = index;
	summary.hidden = true;
	result.hidden = true;
	session.hidden = false;
	questions.forEach((question, i) => {
		question.hidden = i !== current;
	});
	position.textContent = `שאלה ${current + 1} מתוך ${questions.length}`;
	jump.value = String(current);
	selector(current);
	const indexes = navigationIndexes();
	previous.disabled = current === indexes[0];
	previous.hidden = previous.disabled;
	previous.textContent = mistakesOnly ? "הטעות הקודמת" : "השאלה הקודמת";
	next.textContent = current === indexes.at(-1)
		? (submitted ? "לתוצאות השאלון" : "סיכום לפני בדיקה")
		: (mistakesOnly ? "הטעות הבאה" : "השאלה הבאה");
	updateProgress();
	if (focus) {
		shell.classList.add("quiz-started");
		start.hidden = true;
		focusCard(questions[current].querySelector("legend"));
	}
}

function finish() {
	if (submitted) { showResults(); return; }
	const missing = missingAnswers();
	if (missing.length) {
		showQuestion(missing[0]);
		updateValidation(missing);
		return;
	}
	validation.textContent = "";
	if (graded) {
		let correct = 0;
		for (const question of questions) {
			const matches = question.querySelector("input:checked").value ===
				question.dataset.correctAnswer;
			if (matches) correct++;
			question.dataset.result = matches ? "correct" : "incorrect";
			const feedback = question.querySelector("[data-quiz-feedback]");
			feedback.hidden = false;
			feedback.open = true;
			feedback.querySelector("summary").textContent =
				matches ? "תשובה נכונה" : "תשובה שגויה";
			const choice = document.createElement("p");
			choice.setAttribute("data-quiz-choice", "");
			choice.textContent = `התשובה שלכם: ${question.querySelector("input:checked").closest("label").querySelector("span").textContent.trim()}`;
			feedback.querySelector("summary").after(choice);
			for (const input of question.querySelectorAll("input")) {
				input.disabled = true;
				const correctAnswer = input.value === question.dataset.correctAnswer;
				if (!correctAnswer && !input.checked) continue;
				const label = input.closest("label");
				label.dataset.answerResult = correctAnswer ? "correct" : "incorrect";
				if (label.querySelector(".quiz-answer-state")) continue;
				const state = document.createElement("span");
				state.className = "quiz-answer-state";
				state.textContent = correctAnswer
					? (input.checked ? "התשובה שבחרתם - נכונה" : "התשובה הנכונה")
					: "התשובה שבחרתם - שגויה";
				label.append(state);
			}
		}
		submitted = true;
		const minimum = Math.ceil(questions.length * 85 / 100);
		const percentage = Math.round(correct / questions.length * 100);
		const announcedScore = document.createElement("span");
		announcedScore.className = "visually-hidden";
		announcedScore.textContent = ` - ${percentage}%`;
		resultTitle.replaceChildren(document.createTextNode(correct >= minimum ? "עברתם את התרגול" : "לא עברתם את התרגול"), announcedScore);
		result.dataset.outcome = correct >= minimum ? "passed" : "failed";
		intro.textContent = "התשובות ננעלו לאחר ההגשה. אפשר לעבור על הבחירות, התשובות הנכונות וההסברים, או להתחיל ניסיון חדש.";
		document.querySelector("[data-quiz-count]").textContent =
			`עניתם נכון על ${correct} מתוך ${questions.length} שאלות.`;
		document.querySelector("[data-quiz-score]").textContent = `${percentage}%`;
		document.querySelector("[data-quiz-threshold]").textContent = `סף המעבר: 85%. נדרשות ${minimum} מתוך ${questions.length} תשובות נכונות.`;
		for (const [index, question] of questions.entries()) {
			if (question.dataset.result !== "incorrect") continue;
			const item = document.createElement("li");
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.reviewQuestion = String(index);
			button.textContent = question.querySelector("legend").textContent;
			button.addEventListener("click", () => reviewQuestion(index));
			item.append(button);
			mistakesList.append(item);
		}
		mistakes.hidden = reviewMistakes.hidden = correct === questions.length;
		reviewMistakes.textContent = `לעבור על הטעויות (${questions.length - correct})`;
		selector(current);
	} else {
		document.querySelector("[data-quiz-count]").textContent =
			`סימנתם תשובה ב-${questions.length} מתוך ${questions.length} שאלות.`;
	}
	showResults();
}

function resetAttempt() {
	form.reset();
	submitted = false;
	mistakesOnly = false;
	validation.textContent = "";
	resultTitle.textContent = defaultResultTitle;
	delete result.dataset.outcome;
	intro.textContent = defaultIntro;
	mistakesList.replaceChildren();
	mistakes.hidden = reviewMistakes.hidden = true;
	document.querySelector("[data-quiz-count]").textContent = "";
	document.querySelector("[data-quiz-score]").textContent = "";
	document.querySelector("[data-quiz-threshold]").textContent = "";
	for (const question of questions) {
		delete question.dataset.result;
		for (const label of question.querySelectorAll("[data-answer-result]")) {
			delete label.dataset.answerResult;
			label.querySelector(".quiz-answer-state")?.remove();
		}
		const feedback = question.querySelector("[data-quiz-feedback]");
		feedback.querySelector("[data-quiz-choice]")?.remove();
		feedback.hidden = true;
		feedback.open = false;
		feedback.querySelector("summary").textContent = "בדיקת התשובה";
		for (const input of question.querySelectorAll("input"))
			input.disabled = false;
	}
	showQuestion(0);
}

// Public theory answers are authored in HTML; protected-course grading is separate.
form.addEventListener("submit", (event) => {
	event.preventDefault();
	prepareSubmission();
});
form.addEventListener("change", () => {
	selector(current);
	updateProgress();
	shell.classList.add("quiz-started");
	start.hidden = true;
	if (validation.textContent) updateValidation();
});
previous.addEventListener("click", () => {
	const indexes = navigationIndexes();
	showQuestion(indexes[indexes.indexOf(current) - 1]);
});
next.addEventListener("click", () => {
	const indexes = navigationIndexes();
	const following = indexes[indexes.indexOf(current) + 1];
	if (following === undefined) prepareSubmission();
	else showQuestion(following);
});
document
	.querySelector("[data-quiz-review]")
	.addEventListener("click", () => {
		const firstMistake = questions.findIndex(question => question.dataset.result === "incorrect");
		reviewQuestion(graded ? Math.max(0, firstMistake) : current);
	});
if (graded) {
	reviewMistakes.addEventListener("click", () => reviewQuestion(questions.findIndex(question => question.dataset.result === "incorrect"), true));
	document.querySelector("[data-quiz-retry]").addEventListener("click", resetAttempt);
	for (const question of questions)
		question.querySelector("[data-quiz-feedback]").hidden = true;
}
document.querySelector("[data-quiz-fallback]").hidden = true;
document.querySelector("[data-quiz-toolbar]").hidden = false;
document.querySelector("[data-quiz-controls]").hidden = false;
showQuestion(0, false);
