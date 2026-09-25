import { startLocalApplication } from "./application.mjs";
import { createSupabaseProvider } from "./supabase.mjs";
import { createPrivateMedia } from "./private-media.mjs";
import { readFile } from "node:fs/promises";

if (process.env.NODE_ENV === "production") throw new Error("Use the Worker entry with persistent session storage for production; this launcher is local only.");
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishableKey, SUPABASE_SECRET_KEY: secretKey } = process.env;
const configured = Boolean(url && publishableKey && secretKey);
if (configured && new URL(url).protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
const { PRIVATE_MEDIA_ROOT: mediaRoot, PRIVATE_MEDIA_MANIFEST: mediaManifest } = process.env;
if (Boolean(mediaRoot) !== Boolean(mediaManifest)) throw new Error("Configure both PRIVATE_MEDIA_ROOT and PRIVATE_MEDIA_MANIFEST.");
const media = mediaRoot ? await createPrivateMedia({ root: mediaRoot, entries: JSON.parse(await readFile(mediaManifest, "utf8")) }) : null;
const app = await startLocalApplication({ origin, provider: configured ? createSupabaseProvider({ url, publishableKey, secretKey }) : null, media, googleEnabled: process.env.GOOGLE_AUTH_ENABLED === "true" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { void app.close(); });
console.log(`Local site: ${app.origin}/account/login.html`);
console.log(configured ? "Supabase configured. Sessions end when the gateway stops." : "Account screens available. Add server credentials to .env.local to enable authentication.");
