import { copyFile, lstat, mkdir, mkdtemp, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { publicTypes, publicTopFiles, publicDirectories } from "../server/public-files.mjs";

const siteRoot = fileURLToPath(new URL("../", import.meta.url));
function within(parent, child) {
	const relative = path.relative(parent, child);
	return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export async function packageWorkerAssets({ root = siteRoot, output } = {}) {
	root = await realpath(root);
	output = path.resolve(output ?? path.join(root, ".worker/public"));
	if (within(output, root) || (within(root, output) && output !== path.join(root, ".worker/public"))) {
		throw new Error("Worker output must be .worker/public or outside the source tree.");
	}
	await mkdir(path.dirname(output), { recursive: true });
	if (await realpath(path.dirname(output)) !== path.dirname(output)) throw new Error("Worker output must not contain symlinks.");
	const existing = await lstat(output).catch(error => { if (error.code !== "ENOENT") throw error; });
	if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new Error("Worker output must be a directory without symlinks.");
	const temporary = await mkdtemp(path.join(path.dirname(output), ".package-"));
	const files = [];
	async function copy(relative) {
		if (relative.split(path.sep).some(part => part.startsWith(".") || part.includes("\\"))) return;
		const source = path.join(root, relative);
		const entry = await lstat(source).catch(error => { if (error.code !== "ENOENT") throw error; });
		if (!entry) return;
		if (entry.isSymbolicLink()) throw new Error(`Public symlink is not allowed: ${relative}`);
		if (entry.isDirectory()) {
			for (const name of (await readdir(source)).sort()) await copy(path.join(relative, name));
		} else if (entry.isFile() && publicTypes[path.extname(relative)]) {
			if (entry.size > 25 * 1024 * 1024) throw new Error(`Public asset exceeds the Worker 25 MiB limit: ${relative}`);
			await mkdir(path.dirname(path.join(temporary, relative)), { recursive: true });
			await copyFile(source, path.join(temporary, relative));
			files.push(relative.split(path.sep).join("/"));
		}
	}
	try {
		for (const relative of [...publicTopFiles, ...publicDirectories]) await copy(relative);
		if (!files.includes("index.html")) throw new Error("Public index.html is required.");
		await writeFile(path.join(temporary, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: frame-ancestors 'none'\n  Cache-Control: no-cache\n");
		await rm(output, { recursive: true, force: true });
		await rename(temporary, output);
		return { output, files: files.sort() };
	} finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const { files } = await packageWorkerAssets();
	console.log(`Packaged ${files.length} public files in .worker/public.`);
}
