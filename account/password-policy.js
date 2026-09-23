// Shared by the registration screen and gateway. Login accepts existing passwords.
export function registrationPasswordChecks(password) {
	return {
		length: password.length >= 9 && password.length <= 128,
		letters: /[A-Z]/.test(password) && /[a-z]/.test(password),
		digit: /[0-9]/.test(password),
		// Printable ASCII punctuation, excluding whitespace and other alphabets.
		special: /[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(password),
	};
}
