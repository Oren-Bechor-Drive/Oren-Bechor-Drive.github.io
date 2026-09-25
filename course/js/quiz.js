import { initDisclosureMotion } from "../../js/disclosure-motion.js";

const questions = [...document.querySelectorAll(".quiz-question")];
const form = document.querySelector(".quiz-form");
const session = document.querySelector("[data-quiz-session]");
const result = document.querySelector("[data-quiz-result]");
const position = document.querySelector("[data-quiz-position]");
const jump = document.querySelector("#question-jump");
const previous = document.querySelector("[data-quiz-previous]");
const next = document.querySelector("[data-quiz-next]");
const validation = document.querySelector("[data-quiz-validation]");
const graded = form.hasAttribute("data-quiz-graded");
let submitted = false;
let current = 0;

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
		showQuestion(index);
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
		trigger.textContent = jump.options[index].textContent;
		options.forEach((option, i) =>
			option.setAttribute("aria-selected", String(i === index)),
		);
	};
}

function showQuestion(index, focus = true) {
	current = index;
	result.hidden = true;
	session.hidden = false;
	questions.forEach((question, i) => {
		question.hidden = i !== current;
	});
	position.textContent = `שאלה ${current + 1} מתוך ${questions.length}`;
	jump.value = String(current);
	selector(current);
	previous.disabled = current === 0;
	next.textContent = current === questions.length - 1
		? (submitted ? "לתוצאות השאלון" : "סיום השאלון")
		: "השאלה הבאה";
	if (focus) questions[current].querySelector("legend").focus();
}

function finish() {
	const firstUnanswered = questions.findIndex(
		(question) => !question.querySelector("input:checked"),
	);
	if (firstUnanswered !== -1) {
		showQuestion(firstUnanswered);
		validation.textContent = "יש לענות על כל השאלות לפני סיום השאלון.";
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
			for (const input of question.querySelectorAll("input"))
				input.disabled = true;
		}
		submitted = true;
		document.querySelector("[data-quiz-count]").textContent =
			`עניתם נכון על ${correct} מתוך ${questions.length} שאלות. הציון: ${Math.round(correct / questions.length * 100)}%.`;
	} else {
		document.querySelector("[data-quiz-count]").textContent =
			`סימנתם תשובה ב-${questions.length} מתוך ${questions.length} שאלות.`;
	}
	session.hidden = true;
	result.hidden = false;
	document.querySelector("#quiz-result-title").focus();
}

function resetAttempt() {
	form.reset();
	submitted = false;
	validation.textContent = "";
	document.querySelector("[data-quiz-count]").textContent = "";
	for (const question of questions) {
		delete question.dataset.result;
		const feedback = question.querySelector("[data-quiz-feedback]");
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
	finish();
});
form.addEventListener("change", () => {
	if (questions.every((question) => question.querySelector("input:checked")))
		validation.textContent = "";
});
previous.addEventListener("click", () => showQuestion(current - 1));
next.addEventListener("click", () =>
	current < questions.length - 1 ? showQuestion(current + 1) : finish(),
);
document
	.querySelector("[data-quiz-review]")
	.addEventListener("click", () => showQuestion(current));
if (graded) {
	document.querySelector("[data-quiz-retry]").addEventListener("click", resetAttempt);
	for (const question of questions)
		question.querySelector("[data-quiz-feedback]").hidden = true;
}
document.querySelector("[data-quiz-fallback]").hidden = true;
document.querySelector("[data-quiz-toolbar]").hidden = false;
document.querySelector("[data-quiz-controls]").hidden = false;
showQuestion(0, false);
