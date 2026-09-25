// Synthetic questions for integration checks, never driving instruction.
export function quizQuestions(count = 20) {
	return Array.from({ length: count }, (_, index) => ({
		id: `q${index + 1}`,
		prompt: `שאלת בדיקה ${index + 1}.`,
		options: [{ id: "a", text: "אפשרות בדיקה א." }, { id: "b", text: "אפשרות בדיקה ב." }],
		correctOptionId: "a",
		explanation: `הסבר לבדיקה ${index + 1}.`,
	}));
}
export function quizAnswers(correct = 20, count = 20) {
	return Object.fromEntries(quizQuestions(count).map((q, index) => [q.id, index < correct ? "a" : "b"]));
}
