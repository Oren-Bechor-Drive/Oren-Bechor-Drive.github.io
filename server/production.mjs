import { createSupabaseProvider } from "./supabase.mjs";
import { createSupabaseSessions } from "./session-store.mjs";
import { createDatabaseRateLimit } from "./rate-limit.mjs";
import { createStorageMedia } from "./storage-media.mjs";
import { createAdmission } from "./admission.mjs";

function httpsOrigin(value, name) {
	if (value === undefined || value === null || (typeof value === "string" && !value.trim())) throw configurationError(name, "missing");
	if (typeof value !== "string") throw configurationError(name, "invalid");
	let address;
	try { address = new URL(value); } catch { throw configurationError(name, "invalid"); }
	if (address.protocol !== "https:" || address.origin !== value) throw configurationError(name, "invalid");
	return value;
}
function configurationError(field, reason) {
	return Object.assign(new Error(`${field ?? "Hosting configuration"} ${reason === "missing" ? "is required" : "is invalid"}.`),
		{ configurationField: field, configurationReason: reason });
}

// Configuration validation is local. It does not create resources or open registration.
export function createProductionGatewayOptions(env, { fetchImpl = fetch, diagnostics } = {}) {
	const origin = httpsOrigin(env.APP_ORIGIN, "APP_ORIGIN");
	const url = httpsOrigin(env.SUPABASE_URL, "SUPABASE_URL");
	for (const name of ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SESSION_SECRET"]) {
		if (env[name] === undefined || env[name] === null || (typeof env[name] === "string" && !env[name].trim())) throw configurationError(name, "missing");
		if (typeof env[name] !== "string") throw configurationError(name, "invalid");
	}
	if (env.GOOGLE_AUTH_ENABLED !== undefined && !["true", "false"].includes(env.GOOGLE_AUTH_ENABLED)) throw configurationError("GOOGLE_AUTH_ENABLED", "invalid");
	const secret = env.SESSION_SECRET, serviceKey = env.SUPABASE_SECRET_KEY;
	const key = Buffer.from(secret, "base64");
	if (key.length !== 32 || key.toString("base64") !== secret) throw configurationError("SESSION_SECRET", "invalid");
	const admit = createAdmission(env);
	const bucket = env.PRIVATE_MEDIA_BUCKET, manifest = env.PRIVATE_MEDIA_ENTRIES;
	if (Boolean(bucket) !== Boolean(manifest)) throw configurationError(bucket ? "PRIVATE_MEDIA_ENTRIES" : "PRIVATE_MEDIA_BUCKET", "missing");
	let entries;
	if (manifest) {
		try {
			if (typeof manifest !== "string" || manifest.length > 131072) throw new Error();
			entries = JSON.parse(manifest);
		} catch { throw configurationError("PRIVATE_MEDIA_ENTRIES", "invalid"); }
	}
	let media = null;
	if (bucket) {
		media = createStorageMedia({ url, secretKey: serviceKey, bucket, entries, fetcher: fetchImpl });
	}
	const rateOptions = { url, serviceKey, secret, fetchImpl };
	return {
		origin, admit, diagnostics, googleEnabled: env.GOOGLE_AUTH_ENABLED === "true",
		provider: createSupabaseProvider({ url, publishableKey: env.SUPABASE_PUBLISHABLE_KEY, secretKey: serviceKey, fetcher: fetchImpl }),
		sessions: createSupabaseSessions({ url, serviceKey, secret, fetchImpl }),
		requestLimiter: createDatabaseRateLimit({ ...rateOptions, scope: "requests", limit: 150, windowSeconds: 60 }),
		mutationLimiter: createDatabaseRateLimit({ ...rateOptions, scope: "mutations", limit: 20, windowSeconds: 900 }),
		media,
	};
}
