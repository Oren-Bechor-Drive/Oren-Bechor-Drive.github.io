import { open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createMediaPolicy } from "./media-policy.mjs";

const siteRoot = fileURLToPath(new URL("../", import.meta.url));
const fail = () => { throw Object.assign(new Error("learning_unavailable"), { status: 404, code: "learning_unavailable" }); };

// The registry is server-owned. URLs contain opaque IDs, never filenames or storage URLs.
export async function createPrivateMedia({ root, entries }) {
	const directory = await realpath(root);
	const relativeToSite = path.relative(siteRoot, directory);
	const siteWithinMedia = path.relative(directory, siteRoot);
	if (!relativeToSite.startsWith(`..${path.sep}`) || !siteWithinMedia.startsWith(`..${path.sep}`)) throw new Error("Private media must live outside the checked-in site.");
	const policy = createMediaPolicy(entries, file => Boolean(file) && !file.includes("\\") && !file.includes("\0")
		&& !path.isAbsolute(file) && !file.split("/").some(part => !part || part.startsWith(".")));
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
		const { handle } = await openFile(policy.lookup(input.id));
		await handle.close();
	}
	return {
		lookup: policy.lookup,
		forSection: policy.forSection,
		async send(req, res, entry) {
			let request;
			try { request = policy.request(entry, { method: req.method, range: req.headers.range }); } catch { fail(); }
			if (req.aborted || res.destroyed) return;
			let file;
			try { file = await openFile(entry); } catch { fail(); }
			const { handle, size } = file;
			try {
				const plan = request.response(size);
				res.writeHead(plan.status, plan.headers);
				if (!plan.sendBody) return res.end();
				await pipeline(handle.createReadStream({ start: plan.start, end: plan.end, autoClose: false }), res);
			} finally { await handle.close(); }
		},
	};
}
