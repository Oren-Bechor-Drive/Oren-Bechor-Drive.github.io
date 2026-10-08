import { startLocalApplication } from "./application.mjs";
import { createSupabaseProvider } from "./supabase.mjs";
import { createPrivateMedia } from "./private-media.mjs";
import { readFile } from "node:fs/promises";
import { createDiagnostics } from "./diagnostics.mjs";

const diagnostics = createDiagnostics({ write: line => console.error(line) });
async function start() {
	if (process.env.NODE_ENV === "production") throw new Error("Use the Worker entry with persistent session storage for production; this launcher is local only.");
	const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
	const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishableKey, SUPABASE_SECRET_KEY: secretKey } = process.env;
	const configured = Boolean(url && publishableKey && secretKey);
	if (configured) {
		try { if (new URL(url).protocol !== "https:") throw new Error(); }
		catch { throw Object.assign(new Error(), { configurationField: "SUPABASE_URL", configurationReason: "invalid" }); }
	} else {
		const field = !url ? "SUPABASE_URL" : !publishableKey ? "SUPABASE_PUBLISHABLE_KEY" : "SUPABASE_SECRET_KEY";
		diagnostics.emit({ category: "configuration", operation: "startup", status: 503, field, reason: "missing" });
	}
	let address;
	try { address = new URL(origin); } catch { /* Validated below without logging the supplied value. */ }
	if (!address || address.origin !== origin || address.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(address.hostname)) {
		throw Object.assign(new Error(), { configurationField: "APP_ORIGIN", configurationReason: "invalid" });
	}
	const { PRIVATE_MEDIA_ROOT: mediaRoot, PRIVATE_MEDIA_MANIFEST: mediaManifest } = process.env;
	let media = null;
	if (mediaRoot || mediaManifest) {
		try {
			if (!mediaRoot || !mediaManifest) throw new Error();
			media = await createPrivateMedia({ root: mediaRoot, entries: JSON.parse(await readFile(mediaManifest, "utf8")) });
		} catch { throw Object.assign(new Error(), { configurationField: "PRIVATE_MEDIA_ENTRIES", configurationReason: "invalid" }); }
	}
	const app = await startLocalApplication({ origin, provider: configured ? createSupabaseProvider({ url, publishableKey, secretKey }) : null, media, diagnostics, googleEnabled: process.env.GOOGLE_AUTH_ENABLED === "true" });
	for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { void app.close(); });
	console.log(`Local site: ${app.origin}/account/login.html`);
	console.log(configured ? "Supabase configured. Sessions end when the gateway stops." : "Account screens available. Add server credentials to .env.local to enable authentication.");
}
try { await start(); }
catch (error) {
	diagnostics.emit({ category: error.configurationReason ? "configuration" : "unexpected", operation: "startup", status: 503,
		field: error.configurationField, reason: error.configurationReason });
	console.error("Local gateway startup failed. Check the configuration and local port.");
	process.exitCode = 1;
}
