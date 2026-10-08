const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Browser and server accept the same exact destinations, never a general redirect.
export function normalizeAccountReturn(value, origin) {
	if (typeof value !== "string" || value.length > 2048 || /[\x00-\x20\x7f\\%]/.test(value)) return "/account/";
	if (["/account/", "/account/learning.html"].includes(value)) return value;
	if (!value.startsWith("/account/reader.html?")) return "/account/";
	let target;
	try { target = new URL(value, origin); } catch { return "/account/"; }
	const params = target.searchParams;
	if (target.origin !== origin || target.hash || params.size !== 2
		|| params.getAll("section").length !== 1 || params.getAll("access").length !== 1
		|| !uuid.test(params.get("section") ?? "") || !["free", "paid"].includes(params.get("access"))) return "/account/";
	return "/account/reader.html?" + new URLSearchParams({ section: params.get("section"), access: params.get("access") });
}
