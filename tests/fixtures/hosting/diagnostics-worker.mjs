import production from "../../../server/worker.mjs";

// Test-only reporter observation. This fixture is outside the public allowlist.
const events = [];
export default {
	async fetch(request, env, ctx) {
		if (new URL(request.url).pathname === "/__test/diagnostics") return Response.json(events);
		const original = console.error;
		console.error = line => { events.push(JSON.parse(line)); };
		try { return await production.fetch(request, env, ctx); }
		finally { console.error = original; }
	},
};
