import { createServer } from "node:http";
import { createGateway } from "./gateway.mjs";
import { servePublicFile } from "./http.mjs";

// The launcher and local tests share routing, listener policy and shutdown.
export async function startLocalApplication({ origin = "http://127.0.0.1:0", ...gatewayOptions } = {}) {
	const address = new URL(origin);
	if (address.origin !== origin || address.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(address.hostname)) {
		throw new Error("APP_ORIGIN must be an exact HTTP origin on localhost or 127.0.0.1 for this local server.");
	}
	let gateway;
	const server = createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, (req, res) =>
		req.url.startsWith("/api/") ? gateway(req, res) : servePublicFile(req, res));
	let closing;
	function close() {
		closing ??= new Promise((resolve, reject) => {
			server.close(error => error && error.code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve());
			server.closeAllConnections();
		});
		return closing;
	}
	try {
		await new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(Number(address.port || 80), "127.0.0.1", () => {
				try {
					address.port = String(server.address().port);
					gateway = createGateway({ ...gatewayOptions, origin: address.origin });
					server.off("error", reject);
					resolve();
				} catch (error) { reject(error); }
			});
		});
		return { origin: address.origin, close };
	} catch (error) {
		await close().catch(() => {});
		throw error;
	}
}
