const validEmail = email => typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Hosting configuration owns rollout. Elapsed time never opens registration.
export function createAdmission(env) {
	const mode = env.REGISTRATION_MODE ?? "closed";
	if (!["closed", "pilot", "public"].includes(mode)) throw new Error("REGISTRATION_MODE must be closed, pilot or public.");
	if (mode === "public" && env.GOOGLE_AUTH_ENABLED !== "true") throw new Error("Public registration requires Google and email/password authentication.");
	const testers = mode === "pilot" ? (env.PILOT_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()) : [];
	if (mode === "pilot" && (testers.length > 2 || testers.some(email => !validEmail(email)) || new Set(testers).size !== testers.length)) {
		throw new Error("Pilot requires one or two distinct tester emails in PILOT_EMAILS.");
	}
	const allowed = new Set(testers);
	return email => validEmail(email) && (mode === "public" || (mode === "pilot" && allowed.has(email.toLowerCase())));
}
