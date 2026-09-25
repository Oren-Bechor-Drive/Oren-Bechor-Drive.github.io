class ProviderError extends Error {
	constructor(status, code = "provider_error") { super(code); this.status = status; this.code = code; }
}

// Stateless adapter. Each call supplies its user's access token explicitly.
export function createSupabaseProvider({ url, publishableKey, secretKey, fetcher = fetch }) {
	const base = new URL(url).origin;
	async function request(path, { method = "GET", body, token, admin = false } = {}) {
		const key = admin ? secretKey : publishableKey;
		const headers = { apikey: key, "content-type": "application/json" };
		if (token) headers.authorization = `Bearer ${token}`;
		// Legacy service-role JWTs need Authorization; sb_secret keys use apikey.
		else if (admin && !key.startsWith("sb_secret_")) headers.authorization = `Bearer ${key}`;
		let response;
		try {
			response = await fetcher(base + path, { method, headers, redirect: "error", signal: AbortSignal.timeout(10_000),
				...(body === undefined ? {} : { body: JSON.stringify(body) }) });
		} catch { throw new ProviderError(503); }
		let data;
		try { data = response.status === 204 ? null : await response.json(); }
		catch { throw new ProviderError(503); }
		if (!response.ok) throw new ProviderError(response.status, data?.error_code ?? data?.code);
		return data;
	}
	const pkce = flow => ({ code_challenge: flow.challenge, code_challenge_method: "s256" });
	return {
		password: (email, password) => request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } }),
		signup: (email, password, flow) => request(`/auth/v1/signup?redirect_to=${encodeURIComponent(flow.redirect)}`, { method: "POST", body: { email, password, ...pkce(flow) } }),
		recover: (email, flow) => request(`/auth/v1/recover?redirect_to=${encodeURIComponent(flow.redirect)}`, { method: "POST", body: { email, ...pkce(flow) } }),
		google(flow) {
			const target = new URL("/auth/v1/authorize", base);
			target.search = new URLSearchParams({ provider: "google", redirect_to: flow.redirect, ...pkce(flow), scopes: "email profile" }).toString();
			return target.href;
		},
		exchange: (code, verifier) => request("/auth/v1/token?grant_type=pkce", { method: "POST", body: { auth_code: code, code_verifier: verifier } }),
		refresh: token => request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: token } }),
		identity: token => request("/auth/v1/user", { token }),
		provision: id => request("/rest/v1/rpc/provision_learner", { method: "POST", admin: true, body: { p_auth_user_id: id } }),
		async learner(token) {
			const rows = await request("/rest/v1/learners?select=id,display_name&limit=1", { token });
			return rows[0] ?? null;
		},
		async readSection(token, sectionId, accessLevel) {
			const rows = await request("/rest/v1/rpc/read_section", { method: "POST", token,
				body: { p_section_id: sectionId, p_access_level: accessLevel } });
			return rows[0] ?? null;
		},
		async readPosition(token, sectionId, accessLevel) {
			const query = new URLSearchParams({ select: "content_version_id,position,revision", section_id: `eq.${sectionId}`, access_level: `eq.${accessLevel}`, limit: "1" });
			const rows = await request(`/rest/v1/section_progress?${query}`, { token });
			return rows[0] ?? null;
		},
		async savePosition(token, sectionId, accessLevel, { contentVersionId, position, expectedRevision }) {
			// This RPC returns a single composite row, not a SETOF collection.
			return request("/rest/v1/rpc/save_my_position", { method: "POST", token,
				body: { p_section_id: sectionId, p_access_level: accessLevel, p_content_version_id: contentVersionId,
					p_position: position, p_expected_revision: expectedRevision } });
		},
		updatePassword: (token, password) => request("/auth/v1/user", { method: "PUT", token, body: { password } }),
		logout: (token, scope = "local") => request(`/auth/v1/logout?scope=${scope}`, { method: "POST", token }),
	};
}
