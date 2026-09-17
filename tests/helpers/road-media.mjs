import { readFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../../", import.meta.url);
const contentTypes = {
	".html": "text/html",
	".css": "text/css",
	".js": "text/javascript",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".webmanifest": "application/manifest+json",
};

// Scenarios own request delays and failures; this module serves project files.
// Return the served source and body size for download observations.
export async function serveRoadMedia(route) {
	const request = route.request();
	const url = new URL(request.url());
	if (url.origin !== "http://gallery.test") {
		await route.abort();
		return;
	}
	const source = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
	let bytes;
	try {
		bytes = await readFile(new URL(source, root));
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		await route.fulfill({ status: 404, body: "" });
		return;
	}
	const isHead = request.method() === "HEAD";
	await route.fulfill({
		contentType: contentTypes[path.extname(source)] ?? "application/octet-stream",
		headers: { "content-length": String(bytes.length) },
		body: isHead ? "" : bytes,
	});
	return { source, byteLength: isHead ? 0 : bytes.length };
}
