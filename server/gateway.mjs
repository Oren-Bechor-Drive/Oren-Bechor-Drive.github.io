import { createLearnerAccounts } from "./learner-accounts.mjs";
import { registrationPasswordChecks } from "../account/password-policy.js";

const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const fields = {
	login: ["email", "password"], register: ["email", "password"], recover: ["email"],
	reset: ["password"], google: [], logout: [],
};

async function input(req, route) {
	const chunks = [];
	let length = 0;
	for await (const chunk of req) {
		length += chunk.length;
		if (length > 16_384) fail(413, "too_large");
		chunks.push(chunk);
	}
	let body;
	try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { fail(400, "invalid_input"); }
	if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some(key => !fields[route].includes(key))) fail(400, "invalid_input");
	if (fields[route].includes("email")) {
		if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) fail(400, "invalid_email");
		body.email = body.email.trim();
	}
	if (fields[route].includes("password")) {
		if (typeof body.password !== "string") fail(400, "invalid_password");
		const valid = route === "register"
			? Object.values(registrationPasswordChecks(body.password)).every(Boolean)
			: body.password.length >= (route === "login" ? 1 : 12) && body.password.length <= 128;
		if (!valid) fail(400, "invalid_password");
	}
	return body;
}

export function createGateway({ origin, provider = null, googleEnabled = false, now = Date.now, authLimit = 20, sessionLimit = 1000 }) {
	const address = new URL(origin);
	if (address.origin !== origin || (address.protocol !== "https:" && !(address.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(address.hostname)))) throw new Error("An exact HTTPS origin or loopback HTTP origin is required");
	const secure = address.protocol === "https:";
	const cookieName = secure ? "__Host-oren_session" : "oren_session";
	const accounts = createLearnerAccounts({ origin, provider, googleEnabled, now, sessionLimit });
	const mutationLimit = createRateLimit({ now, limit: authLimit });
	const requestLimit = createRateLimit({ now, limit: 150, windowMs: 60_000 });
	function setCookie(res, token, maxAge) {
		res.setHeader("Set-Cookie", `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
	}
	const json = (res, data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };
	const redirect = (res, destination) => { res.writeHead(303, { Location: destination }); res.end(); };
	function respond(res, result) {
		if (result.cookie) setCookie(res, result.cookie.token, result.cookie.maxAge);
		return result.redirect ? redirect(res, result.redirect) : json(res, result.data);
	}
	return async function handle(req, res) {
		res.setHeader("Cache-Control", "private, no-store");
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Referrer-Policy", "no-referrer");
		res.setHeader("X-Content-Type-Options", "nosniff");
		let route;
		try {
			if (!requestLimit(req.socket.remoteAddress)) fail(429, "rate_limited");
			const url = new URL(req.url, origin);
			const cookies = (req.headers.cookie ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(`${cookieName}=`));
			const token = cookies.length === 1 ? cookies[0].slice(cookieName.length + 1) : null;
			if (url.pathname.startsWith("/api/lessons/")) {
				if (req.method !== "GET") fail(405, "method_not_allowed");
				if (url.search) fail(400, "invalid_input");
				if (!provider) fail(503, "unavailable");
				return respond(res, await accounts.readLesson(token, url.pathname.slice("/api/lessons/".length)));
			}
			if (!url.pathname.startsWith("/api/account/")) fail(404, "not_found");
			route = url.pathname.slice("/api/account/".length);
			if (route === "session" && req.method === "GET") return respond(res, await accounts.session(token));
			if (!provider) fail(503, "unavailable");
			if (route === "callback" && req.method === "GET") return respond(res, await accounts.completeCallback(token, {
				state: url.searchParams.get("state"), code: url.searchParams.get("code"), error: url.searchParams.has("error"),
			}));
			if (!Object.hasOwn(fields, route)) fail(404, "not_found");
			if (req.method !== "POST") fail(405, "method_not_allowed");
			if (req.headers.origin !== origin || req.headers["content-type"]?.split(";")[0].trim() !== "application/json" || !accounts.acceptsRequest(token, req.headers["x-csrf-token"])) fail(403, "request_rejected");
			if (!mutationLimit(req.socket.remoteAddress)) fail(429, "rate_limited");
			const body = await input(req, route);
			return respond(res, await accounts.perform(token, route, body));
		} catch (error) {
			if (res.writableEnded) return;
			let status = error.status ?? 503;
			let code = error.code ?? "unavailable";
			if (route === "login" && [400, 401, 403, 422].includes(status) && !["invalid_input", "invalid_email", "invalid_password", "request_rejected"].includes(code)) { status = 401; code = "sign_in_failed"; }
			else if (status >= 500) { status = 503; code = "unavailable"; }
			else if (status === 429) { code = "rate_limited"; }
			else if (!["invalid_input", "invalid_email", "invalid_password", "request_rejected", "recovery_required", "session_expired", "too_large", "not_found", "lesson_unavailable", "method_not_allowed", "google_unavailable"].includes(code)) code = "request_failed";
			if (status === 429) res.setHeader("Retry-After", "60");
			json(res, { error: code }, status);
		}
	};
}

function createRateLimit({ now = Date.now, limit = 20, windowMs = 900_000, capacity = 2000 } = {}) {
	const buckets = new Map();
	return address => {
		for (const [key, value] of buckets) if (value.until <= now()) buckets.delete(key);
		let value = buckets.get(address);
		if (!value) {
			if (buckets.size >= capacity) return false;
			value = { count: 0, until: now() + windowMs };
			buckets.set(address, value);
		}
		return ++value.count <= limit;
	};
}
