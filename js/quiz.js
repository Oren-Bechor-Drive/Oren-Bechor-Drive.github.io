const questions = [...document.querySelectorAll(".quiz-question")];
const form = document.querySelector(".quiz-form");
const session = document.querySelector("[data-quiz-session]");
const result = document.querySelector("[data-quiz-result]");
const position = document.querySelector("[data-quiz-position]");
const jump = document.querySelector("#question-jump");
const previous = document.querySelector("[data-quiz-previous]");
const next = document.querySelector("[data-quiz-next]");
let current = 0;

for (const [index, question] of questions.entries()) {
	const option = document.createElement("option");
	option.value = String(index);
	option.textContent = question.querySelector("legend").textContent;
	jump.append(option);
}

function showQuestion(index, focus = true) {
	current = index;
	result.hidden = true;
	session.hidden = false;
	questions.forEach((question, i) => { question.hidden = i !== current; });
	position.textContent = `שאלה ${current + 1} מתוך ${questions.length}`;
	jump.value = String(current);
	previous.disabled = current === 0;
	next.textContent = current === questions.length - 1 ? "סיום השאלון" : "השאלה הבאה";
	if (focus) questions[current].querySelector("legend").focus();
}

function finish() {
	const answered = questions.filter(question => question.querySelector("input:checked")).length;
	document.querySelector("[data-quiz-count]").textContent = `סימנתם תשובה ב-${answered} מתוך ${questions.length} שאלות.`;
	session.hidden = true;
	result.hidden = false;
	document.querySelector("#quiz-result-title").focus();
}

// Radio inputs keep selections while questions are hidden. No placeholder has a score.
form.addEventListener("submit", event => event.preventDefault());
previous.addEventListener("click", () => showQuestion(current - 1));
next.addEventListener("click", () => current < questions.length - 1 ? showQuestion(current + 1) : finish());
jump.addEventListener("change", () => showQuestion(Number(jump.value)));
document.querySelector("[data-quiz-review]").addEventListener("click", () => showQuestion(current));
document.querySelector("[data-quiz-fallback]").hidden = true;
document.querySelector("[data-quiz-toolbar]").hidden = false;
document.querySelector("[data-quiz-controls]").hidden = false;
showQuestion(0, false);
