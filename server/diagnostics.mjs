const categories = new Set(["configuration", "dependency", "unexpected"]);
const operations = new Set(["startup", "account", "learning", "position", "media", "rate_limit"]);
const fields = new Set(["APP_ORIGIN", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SESSION_SECRET", "GOOGLE_AUTH_ENABLED", "REGISTRATION_MODE", "PILOT_EMAILS", "PRIVATE_MEDIA_BUCKET", "PRIVATE_MEDIA_ENTRIES"]);

// Only this finite vocabulary can reach the reporter. Caller payloads never do.
export function createDiagnostics({ write, now = Date.now }) {
	const recent = new Map();
	return {
		emit(input) {
			try {
				if (!input || !categories.has(input.category) || !operations.has(input.operation)
					|| !Number.isInteger(input.status) || input.status < 100 || input.status > 599) return;
				const event = { category: input.category, operation: input.operation, status: input.status };
				if (input.category === "configuration") {
					if (fields.has(input.field)) event.field = input.field;
					if (["missing", "invalid"].includes(input.reason)) event.reason = input.reason;
				}
				const key = JSON.stringify([event.category, event.operation, event.field, event.reason]);
				const time = now(), previous = recent.get(key);
				if (!Number.isFinite(time)) return;
				if (previous && time - previous.at < 60_000 && time >= previous.at) {
					previous.suppressed = Math.min(Number.MAX_SAFE_INTEGER - 1, previous.suppressed + 1);
					return;
				}
				if (previous?.suppressed) event.count = previous.suppressed + 1;
				recent.set(key, { at: time, suppressed: 0 });
				write(JSON.stringify(event));
			} catch { /* Reporting failure cannot change authorization or responses. */ }
		},
	};
}
