import { startLocalApplication } from "./application.mjs";
import { createSupabaseProvider } from "./supabase.mjs";

if (process.env.NODE_ENV === "production") throw new Error("Choose persistent session storage and a hosting design before production deployment.");
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishableKey, SUPABASE_SECRET_KEY: secretKey } = process.env;
const configured = Boolean(url && publishableKey && secretKey);
if (configured && new URL(url).protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
const app = await startLocalApplication({ origin, provider: configured ? createSupabaseProvider({ url, publishableKey, secretKey }) : null, googleEnabled: process.env.GOOGLE_AUTH_ENABLED === "true" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { void app.close(); });
console.log(`Local site: ${app.origin}/account/login.html`);
console.log(configured ? "Supabase configured. Sessions end when the gateway stops." : "Account screens available. Add server credentials to .env.local to enable authentication.");
