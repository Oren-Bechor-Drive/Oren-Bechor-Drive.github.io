// Synthetic questions for integration checks, never driving instruction.
export function quizQuestions() {
	return Array.from({ length: 20 }, (_, index) => ({
		id: `q${index + 1}`,
		prompt: `שאלת בדיקה ${index + 1}.`,
		options: [{ id: "a", text: "אפשרות בדיקה א." }, { id: "b", text: "אפשרות בדיקה ב." }],
		correctOptionId: "a",
		explanation: `הסבר לבדיקה ${index + 1}.`,
	}));
}
export function quizAnswers(correct = 20) {
	return Object.fromEntries(quizQuestions().map((q, index) => [q.id, index < correct ? "a" : "b"]));
}
