const validEmail = email => typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
function configurationError(field, reason = "invalid") {
	return Object.assign(new Error(`${field} ${reason === "missing" ? "is required" : "is invalid"}.`),
		{ configurationField: field, configurationReason: reason });
}

// Hosting configuration owns rollout. Elapsed time never opens registration.
export function createAdmission(env) {
	const mode = env.REGISTRATION_MODE ?? "closed";
	if (!["closed", "pilot", "public"].includes(mode)) throw configurationError("REGISTRATION_MODE");
	if (mode === "public" && env.GOOGLE_AUTH_ENABLED !== "true") throw configurationError("GOOGLE_AUTH_ENABLED");
	if (mode === "pilot" && (env.PILOT_EMAILS === undefined || env.PILOT_EMAILS === null || (typeof env.PILOT_EMAILS === "string" && !env.PILOT_EMAILS.trim()))) throw configurationError("PILOT_EMAILS", "missing");
	if (mode === "pilot" && typeof env.PILOT_EMAILS !== "string") throw configurationError("PILOT_EMAILS");
	const testers = mode === "pilot" ? env.PILOT_EMAILS.split(",").map(email => email.trim().toLowerCase()) : [];
	if (mode === "pilot" && (testers.length > 2 || testers.some(email => !validEmail(email)) || new Set(testers).size !== testers.length)) {
		throw configurationError("PILOT_EMAILS");
	}
	const allowed = new Set(testers);
	return email => validEmail(email) && (mode === "public" || (mode === "pilot" && allowed.has(email.toLowerCase())));
}
