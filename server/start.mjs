import { createServer } from "node:http";
import { createGateway } from "./gateway.mjs";
import { createSupabaseProvider } from "./supabase.mjs";
import { servePublicFile } from "./http.mjs";

if (process.env.NODE_ENV === "production") throw new Error("Choose persistent session storage and a hosting design before production deployment.");
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const address = new URL(origin);
if (address.origin !== origin || address.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(address.hostname)) {
	throw new Error("APP_ORIGIN must be an exact HTTP origin on localhost or 127.0.0.1 for this local server.");
}
const port = Number(address.port || 80);
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishableKey, SUPABASE_SECRET_KEY: secretKey } = process.env;
const configured = Boolean(url && publishableKey && secretKey);
if (configured && new URL(url).protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
const gateway = createGateway({ origin, provider: configured ? createSupabaseProvider({ url, publishableKey, secretKey }) : null, googleEnabled: process.env.GOOGLE_AUTH_ENABLED === "true" });
const server = createServer((req, res) => req.url.startsWith("/api/") ? gateway(req, res) : servePublicFile(req, res));
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(port, "127.0.0.1", () => {
	console.log(`Local site: ${origin}/account/login.html`);
	console.log(configured ? "Supabase configured. Sessions end when the gateway stops." : "Account screens available. Add server credentials to .env.local to enable authentication.");
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.close(); server.closeAllConnections(); });
