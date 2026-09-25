import { createSupabaseProvider } from "./supabase.mjs";
import { createSupabaseSessions } from "./session-store.mjs";
import { createDatabaseRateLimit } from "./rate-limit.mjs";
import { createStorageMedia } from "./storage-media.mjs";
import { createAdmission } from "./admission.mjs";

function httpsOrigin(value, name) {
	let address;
	try { address = new URL(value); } catch { throw new Error(`${name} must be an exact HTTPS origin.`); }
	if (address.protocol !== "https:" || address.origin !== value) throw new Error(`${name} must be an exact HTTPS origin.`);
	return value;
}

// Configuration validation is local. It does not create resources or open registration.
export function createProductionGatewayOptions(env, { fetchImpl = fetch } = {}) {
	const origin = httpsOrigin(env.APP_ORIGIN, "APP_ORIGIN");
	const url = httpsOrigin(env.SUPABASE_URL, "SUPABASE_URL");
	for (const name of ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SESSION_SECRET"]) {
		if (typeof env[name] !== "string" || !env[name].trim()) throw new Error(`${name} is required.`);
	}
	if (env.GOOGLE_AUTH_ENABLED !== undefined && !["true", "false"].includes(env.GOOGLE_AUTH_ENABLED)) throw new Error("GOOGLE_AUTH_ENABLED must be true or false.");
	const secret = env.SESSION_SECRET, serviceKey = env.SUPABASE_SECRET_KEY;
	const admit = createAdmission(env);
	const bucket = env.PRIVATE_MEDIA_BUCKET, manifest = env.PRIVATE_MEDIA_ENTRIES;
	if (Boolean(bucket) !== Boolean(manifest)) throw new Error("Configure both PRIVATE_MEDIA_BUCKET and PRIVATE_MEDIA_ENTRIES.");
	let entries;
	if (manifest) {
		try {
			if (typeof manifest !== "string" || manifest.length > 131072) throw new Error();
			entries = JSON.parse(manifest);
		} catch { throw new Error("PRIVATE_MEDIA_ENTRIES must contain a JSON media registry."); }
	}
	const rateOptions = { url, serviceKey, secret, fetchImpl };
	return {
		origin, admit, googleEnabled: env.GOOGLE_AUTH_ENABLED === "true",
		provider: createSupabaseProvider({ url, publishableKey: env.SUPABASE_PUBLISHABLE_KEY, secretKey: serviceKey, fetcher: fetchImpl }),
		sessions: createSupabaseSessions({ url, serviceKey, secret, fetchImpl }),
		requestLimiter: createDatabaseRateLimit({ ...rateOptions, scope: "requests", limit: 150, windowSeconds: 60 }),
		mutationLimiter: createDatabaseRateLimit({ ...rateOptions, scope: "mutations", limit: 20, windowSeconds: 900 }),
		media: bucket ? createStorageMedia({ url, secretKey: serviceKey, bucket, entries, fetcher: fetchImpl }) : null,
	};
}
