import { open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const siteRoot = fileURLToPath(new URL("../", import.meta.url));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["video/mp4", "video/webm", "image/png", "image/jpeg", "image/webp"]);
const fail = () => { throw Object.assign(new Error("learning_unavailable"), { status: 404, code: "learning_unavailable" }); };

// The registry is server-owned. URLs contain opaque IDs, never filenames or storage URLs.
export async function createPrivateMedia({ root, entries }) {
	const directory = await realpath(root);
	const relativeToSite = path.relative(siteRoot, directory);
	const siteWithinMedia = path.relative(directory, siteRoot);
	if (!relativeToSite.startsWith(`..${path.sep}`) || !siteWithinMedia.startsWith(`..${path.sep}`)) throw new Error("Private media must live outside the checked-in site.");
	if (!Array.isArray(entries)) throw new Error("Private media entries must be an array.");
	const registry = new Map();
	async function openFile(entry) {
		const filename = path.join(directory, entry.file);
		if (await realpath(filename) !== filename) throw new Error("Private media symlinks are not allowed.");
		const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
		try {
			const stat = await handle.stat();
			if (!stat.isFile() || !stat.size) throw new Error("Private media must be a nonempty file.");
			return { handle, size: stat.size };
		} catch (error) { await handle.close(); throw error; }
	}
	for (const input of entries) {
		if (!input || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(input.id) || registry.has(input.id)
			|| !uuid.test(input.sectionId) || !uuid.test(input.contentVersionId) || !allowedTypes.has(input.type)
			|| typeof input.title !== "string" || !input.title.trim() || input.title.length > 300
			|| typeof input.file !== "string" || !input.file || input.file.includes("\\") || input.file.includes("\0")
			|| path.isAbsolute(input.file) || input.file.split("/").some(part => !part || part.startsWith("."))) throw new Error("Invalid private media descriptor.");
		const entry = Object.freeze({ ...input });
		const { handle } = await openFile(entry);
		await handle.close();
		registry.set(entry.id, entry);
	}
	return {
		lookup: id => registry.get(id),
		forSection(sectionId, contentVersionId) {
			return [...registry.values()].filter(entry => entry.sectionId === sectionId && entry.contentVersionId === contentVersionId)
				.map(({ id, title, type }) => ({ id, title, type, url: `/api/media/${id}` }));
		},
		async send(req, res, entry) {
			let file;
			try { file = await openFile(entry); } catch { fail(); }
			const { handle, size } = file;
			let start = 0, end = size - 1, status = 200;
			try {
				if (req.headers.range) {
					const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
					if (!match || (!match[1] && !match[2])) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
					start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
					end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
					if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size || (!match[1] && Number(match[2]) === 0)) {
						res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end();
					}
					status = 206;
				}
				res.writeHead(status, { "Content-Type": entry.type, "Content-Length": end - start + 1, "Accept-Ranges": "bytes",
					"Content-Disposition": "inline", "Cross-Origin-Resource-Policy": "same-origin",
					...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) });
				if (req.method === "HEAD") return res.end();
				await pipeline(handle.createReadStream({ start, end, autoClose: false }), res);
			} finally { await handle.close(); }
		},
	};
}
