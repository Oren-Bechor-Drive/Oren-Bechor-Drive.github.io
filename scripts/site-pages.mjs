import { readdir } from "node:fs/promises";
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
