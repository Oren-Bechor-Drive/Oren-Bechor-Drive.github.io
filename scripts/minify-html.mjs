import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { minify } from "html-minifier-terser";

const source = await readFile("index.html", "utf8");
const result = await minify(source, {
	collapseWhitespace: true,
	conservativeCollapse: true,
	caseSensitive: true,
	keepClosingSlash: true,
});
await writeFile("index.html", `${result.trim()}\n`);
console.log(
	`HTML: ${Buffer.byteLength(source)} → ${Buffer.byteLength(result.trim()) + 1} bytes; gzip: ${gzipSync(source).length} → ${gzipSync(`${result.trim()}\n`).length} bytes.`,
);
