import { withOwnedDatabase } from "./database.mjs";

export const databaseSessionConfiguration = Object.freeze({ url: "http://127.0.0.1", serviceKey: "sb_secret_fixture" });
const endpoint = databaseSessionConfiguration.url + "/rest/v1/rpc/gateway_session";
const actions = new Set(["generation", "create", "get", "live", "remove", "begin_reset", "finish_reset", "acquire", "rotate", "save", "resolve_reset", "sweep"]);
const parameters = ["p_action", "p_key", "p_lease", "p_data"];
const invalid = () => { throw new Error("Invalid owned database session request"); };

// Replaces HTTP transport only. The production encryption/REST adapter still
// sends its actual request, and each SQL call commits on an independent connection.
export function createDatabaseSessionFetch(database) {
	return async (url, options) => {
		if (url !== endpoint || options?.method !== "POST") invalid();
		const headers = new Headers(options.headers);
		if (headers.get("apikey") !== databaseSessionConfiguration.serviceKey || headers.has("authorization") || headers.get("content-type") !== "application/json") invalid();
		let body;
		try { body = JSON.parse(options.body); } catch { invalid(); }
		if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== parameters.length || !parameters.every(name => Object.hasOwn(body, name))) invalid();
		const { p_action, p_key, p_lease, p_data } = body;
		if (!actions.has(p_action) || !(p_key === null || typeof p_key === "string") || !(p_lease === null || typeof p_lease === "string") || !p_data || typeof p_data !== "object" || Array.isArray(p_data)) invalid();
		return withOwnedDatabase(database, async client => {
			await client.query("set role service_role");
			const result = await client.query("select public.gateway_session($1,$2,$3,$4) as result", [p_action, p_key, p_lease, p_data]);
			return Response.json(result.rows[0].result);
		});
	};
}
