import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const EXCLUDED_PAGE_DIRECTORIES = new Set([
	"assets",
	"css",
	"js",
	"docs",
	"scripts",
	"tools",
	"tests",
	"test",
	"fixtures",
	"node_modules",
	"vendor",
	"coverage",
	"dist",
	"build",
]);

// Shared by development checks; never imported by the site.
export async function discoverSitePages(rootDir) {
	const pages = [];
	async function discover(directory = "") {
		for (const entry of await readdir(path.join(rootDir, directory), {
			withFileTypes: true,
		})) {
			if (entry.name.startsWith(".")) continue;
			const relativePath = path.posix.join(directory, entry.name);
			if (
				entry.isDirectory() &&
				!EXCLUDED_PAGE_DIRECTORIES.has(entry.name)
			) {
				await discover(relativePath);
			} else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
				pages.push(relativePath);
			}
		}
	}
	await discover();
	return pages.sort();
}

// One inspection owns both its authored-page inventory and cached file identity.
// Callers still own URL parsing, fragments and domain-specific restrictions.
export async function readSitePages(rootDir) {
	const root = path.resolve(rootDir);
	const pages = await discoverSitePages(root);
	const targets = new Map();

	async function resolveFile(relativePath) {
		if (targets.has(relativePath)) return targets.get(relativePath);
		const requested = relativePath || "index.html";
		const absolute = path.resolve(root, relativePath);
		const relative = path.relative(root, absolute);
		let file = null;
		if (
			relative !== ".." &&
			!relative.startsWith(`..${path.sep}`) &&
			!path.isAbsolute(relative)
		) {
			const details = await stat(absolute).catch(() => null);
			const localPath = relative.split(path.sep).join("/");
			if (details?.isFile() && !relativePath.endsWith("/")) {
				file = localPath;
			} else if (details?.isDirectory()) {
				for (const name of ["index.html", "index.htm"]) {
					const index = await stat(path.join(absolute, name)).catch(() => null);
					if (index?.isFile()) {
						file = path.posix.join(localPath, name);
						break;
					}
				}
			}
		}
		const target = { file, requested };
		targets.set(relativePath, target);
		return target;
	}

	return { pages, resolveFile };
}
