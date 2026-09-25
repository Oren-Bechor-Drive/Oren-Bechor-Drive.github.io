import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createMediaPolicy } from "./media-policy.mjs";

const unavailable = () => { throw Object.assign(new Error("unavailable"), { status: 503, code: "unavailable" }); };
const integer = value => typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

function storageOrigin(value) {
	let url;
	try { url = new URL(value); } catch { throw new Error("Invalid Storage origin."); }
	const hosted = url.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && !url.port;
	const local = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
	if ((!hosted && !local) || url.username || url.password || url.search || url.hash || url.pathname !== "/"
		|| ![url.origin, `${url.origin}/`].includes(value)) throw new Error("An exact Supabase HTTPS origin or loopback HTTP origin is required.");
	return url.origin;
}

// The gateway must authorize the current learner and content version before every send.
// This server-only registry never publishes Storage paths, credentials or signed URLs.
export function createStorageMedia({ url, secretKey, bucket, entries, fetcher = fetch }) {
	const base = storageOrigin(url);
	if (typeof secretKey !== "string" || secretKey.length > 4096 || !/^[A-Za-z0-9_.-]+$/.test(secretKey)
		|| !(/^sb_secret_[\w-]+$/.test(secretKey) || /^[\w-]+\.[\w-]+\.[\w-]+$/.test(secretKey))) throw new Error("A server Storage key is required.");
	if (typeof bucket !== "string" || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(bucket) || typeof fetcher !== "function") throw new Error("Invalid Storage configuration.");
	const policy = createMediaPolicy(entries, file => file.length <= 1024 && file.split("/").every(part => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part)));
	return {
		lookup: policy.lookup,
		forSection: policy.forSection,
		async send(req, res, entry) {
			let delivery;
			try { delivery = policy.request(entry, { method: req.method, range: req.headers.range }); } catch { unavailable(); }
			if (req.aborted || res.destroyed) return;
			const controller = new AbortController();
			const disconnect = () => controller.abort();
			let timer, response;
			const touch = () => { clearTimeout(timer); timer = setTimeout(disconnect, 15_000); timer.unref(); };
			res.once("close", disconnect);
			req.once("aborted", disconnect);
			touch();
			try {
				const validSyntax = delivery.rangeHeader !== undefined;
				const headers = { apikey: secretKey, "accept-encoding": "identity" };
				if (!secretKey.startsWith("sb_secret_")) headers.authorization = `Bearer ${secretKey}`;
				if (validSyntax) headers.range = delivery.rangeHeader;
				// Supabase's authenticated object route has no HEAD handler. Cancel GET after headers for HEAD.
				const request = () => fetcher(`${base}/storage/v1/object/authenticated/${bucket}/${entry.file}`, {
					method: "GET", headers, redirect: "error", signal: controller.signal,
				});
				response = await request();
				touch();
				if (response.redirected) unavailable();
				// Storage may encode InvalidRange as 400, or omit the total size on 416.
				// Read only full-object headers to establish whether the requested range is unsatisfiable.
				const rangeError = validSyntax && [400, 416].includes(response.status) && !response.headers.has("content-range");
				if (rangeError) {
					await response.body?.cancel();
					delete headers.range;
					response = await request();
					touch();
					if (response.redirected || response.status !== 200) unavailable();
				}
				let size;
				const status = response.status;
				if (status === 416 && validSyntax) {
					const match = /^bytes \*\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
					size = match ? integer(match[1]) : null;
					if (!size || delivery.response(size).status !== 416) unavailable();
				} else {
					const length = integer(response.headers.get("content-length"));
					if (![200, 206].includes(status) || !length || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== entry.type
						|| (response.headers.has("content-encoding") && response.headers.get("content-encoding") !== "identity")) unavailable();
					if (status === 206) {
						const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
						if (!validSyntax || !match) unavailable();
						const [start, end, total] = match.slice(1).map(integer);
						size = total;
						const expected = size && delivery.response(size);
						if (!expected || expected.status !== 206 || start !== expected.start || end !== expected.end || length !== end - start + 1) unavailable();
					} else {
						if ((validSyntax && (!rangeError || delivery.response(length).status !== 416)) || response.headers.has("content-range")) unavailable();
						size = length;
					}
				}
				const plan = delivery.response(size);
				res.writeHead(plan.status, plan.headers);
				if (!plan.sendBody) return res.end();
				const { length } = plan;
				let received = 0;
				const verifyLength = new Transform({
					transform(chunk, encoding, callback) {
						touch(); received += chunk.length;
						callback(received > length ? new Error("Invalid Storage body length.") : null, chunk);
					},
					flush(callback) { callback(received === length ? null : new Error("Incomplete Storage body.")); },
				});
				await pipeline(Readable.fromWeb(response.body), verifyLength, res, { signal: controller.signal });
			} catch {
				unavailable();
			} finally {
				clearTimeout(timer);
				res.off("close", disconnect);
				req.off("aborted", disconnect);
				controller.abort();
				if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
			}
		},
	};
}
