import { readFile, realpath, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { publicTypes as types, publicTopFiles, publicDirectories } from "./public-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const topFiles = new Set(publicTopFiles);
const directories = new Set(publicDirectories);

export async function servePublicFile(req, res) {
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("Referrer-Policy", "no-referrer");
	res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
	try {
		if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); return res.end(); }
		const pathname = decodeURIComponent(new URL(req.url, "http://local.test").pathname);
		const parts = pathname.slice(1).split("/");
		if (parts.some(part => part.startsWith(".") || part.includes("\\") || part.includes("\0"))) throw new Error();
		let relative = pathname.slice(1) || "index.html";
		if (!topFiles.has(relative) && !directories.has(parts[0])) throw new Error();
		let absolute = path.join(root, relative);
		if ((await stat(absolute)).isDirectory()) {
			if (!pathname.endsWith("/")) { res.writeHead(308, { Location: `${pathname}/` }); return res.end(); }
			absolute = path.join(absolute, "index.html");
		}
		const actual = await realpath(absolute);
		if (!actual.startsWith(root) || actual !== absolute || !types[path.extname(actual)]) throw new Error();
		const data = await readFile(actual);
		res.writeHead(200, { "Content-Type": types[path.extname(actual)], "Content-Length": data.length,
			"Cache-Control": parts[0] === "account" ? "private, no-store" : "no-cache" });
		res.end(req.method === "HEAD" ? undefined : data);
	} catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("לא נמצא"); }
}
