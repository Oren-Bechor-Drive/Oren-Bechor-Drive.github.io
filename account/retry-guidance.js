export function readRetryAfter(value) {
	if (typeof value !== "string" || !/^[1-9][0-9]{0,4}$/.test(value)) return null;
	const seconds = Number(value);
	return seconds <= 86400 ? seconds : null;
}

export function retryGuidance(seconds) {
	return seconds === null
		? "בוצעו בקשות רבות. המתינו מעט ונסו שוב."
		: `בוצעו בקשות רבות. אפשר לנסות שוב בעוד ${seconds} שניות.`;
}
