import { createWorker } from "./worker-adapter.mjs";
import { createProductionGatewayOptions } from "./production.mjs";
import { createDiagnostics } from "./diagnostics.mjs";

// A binding object owns its own gateway. Never reuse credentials across envs.
const workers = new WeakMap();
export default {
	async fetch(request, env, ctx) {
		let worker = workers.get(env);
		if (!worker) {
			const diagnostics = createDiagnostics({ write: line => console.error(line) });
			try { worker = createWorker({ gatewayOptions: createProductionGatewayOptions(env, { diagnostics }) }); }
			catch (error) {
				diagnostics.emit({ category: "configuration", operation: "startup", status: 503, field: error.configurationField, reason: error.configurationReason });
				worker = createWorker();
			}
			workers.set(env, worker);
		}
		return worker.fetch(request, env, ctx);
	},
};
