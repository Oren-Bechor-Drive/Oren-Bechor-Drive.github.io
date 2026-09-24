import { startLocalApplication } from "../../server/application.mjs";

// Deterministic identity provider for transport/browser tests. No real email.
export function accountProvider({ createSessionUser = email => ({ id: email, email, email_confirmed_at: "2026-01-01", is_anonymous: false }) } = {}) {
	let sequence = 0;
	const tokens = new Map();
	const calls = [];
	const provider = {
		calls, tokens,
		async password(email, password) {
			calls.push(["password", email]);
			if (password !== "correct-password") throw Object.assign(new Error(), { status: 400 });
			return issue(email);
		},
		async signup(email, password, flow) { calls.push(["signup", email, flow]); },
		async recover(email, flow) { calls.push(["recover", email, flow]); },
		google(flow) { calls.push(["google", flow]); return `https://accounts.google.com/test?state=${flow.state}`; },
		async exchange(code, verifier) {
			calls.push(["exchange", code, verifier]);
			if (code !== "valid-code") throw Object.assign(new Error(), { status: 400 });
			return issue("learner@example.test");
		},
		async refresh(token) {
			calls.push(["refresh", token]);
			await new Promise(resolve => setTimeout(resolve, 15));
			const old = [...tokens.values()].find(value => value.refresh_token === token);
			if (!old) throw Object.assign(new Error(), { status: 401 });
			return issue(old.user.email);
		},
		async identity(token) {
			if (!tokens.has(token)) throw Object.assign(new Error(), { status: 401 });
			return tokens.get(token).user;
		},
		async provision(id) { calls.push(["provision", id]); },
		async learner(token) {
			const user = await provider.identity(token);
			return user.email.startsWith("suspended") ? null : { id: user.id, display_name: "" };
		},
		async updatePassword(token, password) { calls.push(["update", token, password]); },
		async logout(token, scope) { calls.push(["logout", scope]); tokens.delete(token); },
	};
	async function issue(email) {
		const number = ++sequence;
		const accessToken = `access-${number}`;
		const user = await createSessionUser(email, accessToken);
		const data = { access_token: accessToken, refresh_token: `refresh-${number}`, expires_in: 3600, user };
		tokens.set(data.access_token, data);
		return data;
	}
	return provider;
}

export async function startAccountGateway(options = {}) {
	const { provider = accountProvider(), ...settings } = options;
	const app = await startLocalApplication({ provider, googleEnabled: true, ...settings });
	return { ...app, provider };
}

export function browserClient(origin) {
	let cookie = "";
	let csrf = "";
	return {
		get cookie() { return cookie; },
		get csrf() { return csrf; },
		async request(path = "session", body, extra = {}) {
			const headers = { cookie, ...(body === undefined ? {} : { origin, "content-type": "application/json", "x-csrf-token": csrf }), ...extra.headers };
			const response = await fetch(`${origin}/api/account/${path}`, {
				method: body === undefined ? "GET" : "POST", redirect: "manual", ...extra, headers,
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			});
			const setCookie = response.headers.get("set-cookie");
			if (setCookie) cookie = setCookie.split(";")[0];
			const data = response.headers.get("content-type")?.includes("json") ? await response.json() : null;
			if (data?.csrf) csrf = data.csrf;
			return { response, data };
		},
	};
}
