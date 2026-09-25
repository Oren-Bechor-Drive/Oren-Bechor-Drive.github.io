import { createServer } from "node:http";
import { isIP } from "node:net";
import { httpServerHandler } from "cloudflare:node";
import { createGateway } from "./gateway.mjs";
import { publicTypes, publicTopFiles, publicDirectories } from "./public-files.mjs";

const securityHeaders = {
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"Content-Security-Policy": "frame-ancestors 'none'",
};
const privateHeaders = { ...securityHeaders, "Cache-Control": "private, no-store", Pragma: "no-cache" };
const unavailable = () => Response.json({ error: "unavailable" }, { status: 503, headers: privateHeaders });

// CF-Connecting-IP is supplied by Cloudflare at ingress. Generic proxy headers
// are not client identity. This adapter must only run behind that ingress.
function clientAddress(request) {
	const address = request.headers.get("cf-connecting-ip");
	if (!address || !isIP(address)) return null;
	return isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address;
}

function publicPath(pathname) {
	try {
		const decoded = decodeURIComponent(pathname);
		const parts = decoded.slice(1).split("/");
		if (parts.some(part => part.startsWith(".") || part.includes("\\") || part.includes("\0"))) return null;
		const relative = decoded.slice(1) || "index.html";
		if (!publicTopFiles.includes(relative) && !publicDirectories.includes(parts[0])) return null;
		const last = parts.at(-1);
		if (last.includes(".") && !publicTypes[last.slice(last.lastIndexOf("."))]) return null;
		return decoded;
	} catch { return null; }
}

export function createWorker({ gatewayOptions = null } = {}) {
	let gatewayHandler;
	if (gatewayOptions) {
		const gateway = createGateway(gatewayOptions);
		const server = createServer((req, res) => {
			Object.defineProperty(req.socket, "remoteAddress", { value: req.headers["x-oren-client-address"], configurable: true });
			delete req.headers["x-oren-client-address"];
			void gateway(req, res).catch(() => {
				if (res.headersSent) return res.destroy();
				res.writeHead(503, { ...privateHeaders, "Content-Type": "application/json" });
				res.end('{"error":"unavailable"}');
			});
		});
		gatewayHandler = httpServerHandler(server);
	}
	return {
		async fetch(request, env, ctx) {
			const url = new URL(request.url);
			if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
				if (!gatewayHandler) return unavailable();
				if (url.origin !== gatewayOptions.origin) return Response.json({ error: "request_rejected" }, { status: 421, headers: privateHeaders });
				const address = clientAddress(request);
				if (!address) return unavailable();
				const headers = new Headers(request.headers);
				for (const key of [...headers.keys()]) if (key === "forwarded" || key.startsWith("x-forwarded-")) headers.delete(key);
				headers.set("x-oren-client-address", address);
				try {
					const response = await gatewayHandler.fetch(new Request(request, { headers }), env, ctx);
					const result = new Response(response.body, response);
					for (const [name, value] of Object.entries(privateHeaders)) result.headers.set(name, value);
					return result;
				} catch { return unavailable(); }
			}
			const pathname = publicPath(url.pathname);
			const account = pathname === "/account" || pathname?.startsWith("/account/");
			const headers = { ...securityHeaders, "Cache-Control": account ? "private, no-store" : "no-cache" };
			if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers });
			if (!pathname) return new Response(request.method === "HEAD" ? null : "לא נמצא", { status: 404, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
			if (!env.ASSETS) return unavailable();
			// html_handling=none keeps checked-in .html URLs. Resolve only real
			// directory indexes, preserving the site's ordinary static-host URLs.
			let response = await env.ASSETS.fetch(request);
			if (response.status === 404 && !pathname.split("/").at(-1).includes(".")) {
				const index = new URL(url);
				index.pathname = `${pathname.endsWith("/") ? pathname : `${pathname}/`}index.html`;
				const found = await env.ASSETS.fetch(new Request(index, request));
				if (found.status === 200) {
					if (!pathname.endsWith("/")) return new Response(null, { status: 308, headers: { ...headers, Location: `${pathname}/${url.search}` } });
					response = found;
				}
			}
			const result = new Response(request.method === "HEAD" ? null : response.body, response);
			for (const [name, value] of Object.entries(headers)) result.headers.set(name, value);
			return result;
		},
	};
}
