import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sources = ["css/base.css", "css/components.css", "css/welcome.css", "css/responsive.css"];
const marker = /<style data-site-styles>[\s\S]*?<\/style>/;

export async function inlineStyles({ rootDir, check = false }) {
	const sections = await Promise.all(sources.map(async (source) => {
		const css = await readFile(path.join(rootDir, source), "utf8");
		// Inline URLs resolve against the document, not the CSS file's directory.
		const rebased = css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/g,
			(match, quoted, singleQuoted, bare) => {
				const reference = quoted ?? singleQuoted ?? bare;
				if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(reference)) return match;
				return `url("${path.posix.join(path.posix.dirname(source), reference)}")`;
			});
		return `/* ${source} */\n${rebased.trim()}`;
	}));
	const block = `<style data-site-styles>\n${sections.join("\n\n")}\n</style>`;
	const htmlPath = path.join(rootDir, "index.html");
	const html = await readFile(htmlPath, "utf8");
	if (!marker.test(html)) throw new Error("index.html is missing the data-site-styles block");
	const updated = html.replace(marker, () => block);
	if (check && updated !== html)
		throw new Error("Inline styles are stale. Run npm run inline:styles and include index.html with the CSS changes.");
	if (!check && updated !== html) await writeFile(htmlPath, updated);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await inlineStyles({ rootDir: process.cwd(), check: process.argv.includes("--check") });
	console.log("Inline site styles match the four CSS source files.");
}
