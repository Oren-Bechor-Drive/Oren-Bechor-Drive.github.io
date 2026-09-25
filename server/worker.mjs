import { createWorker } from "./worker-adapter.mjs";
import { createProductionGatewayOptions } from "./production.mjs";

// A binding object owns its own gateway. Never reuse credentials across envs.
const workers = new WeakMap();
export default {
	async fetch(request, env, ctx) {
		let worker = workers.get(env);
		if (!worker) {
			try { worker = createWorker({ gatewayOptions: createProductionGatewayOptions(env) }); }
			catch { worker = createWorker(); }
			workers.set(env, worker);
		}
		return worker.fetch(request, env, ctx);
	},
};
