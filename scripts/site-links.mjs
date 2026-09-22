import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { JSDOM } from "jsdom";

import { readSitePages } from "./site-pages.mjs";

const origin = "https://site.invalid";

function normalizeDeploymentPrefix(prefix) {
	const url = new URL(prefix || "/", origin);
	if (url.origin !== origin || url.search || url.hash) {
		throw new TypeError("deploymentPrefix must be a local URL path");
	}
	return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
}

function relativeUrlPath(pathname, deploymentPrefix) {
	if (deploymentPrefix === "/") return pathname.replace(/^\/+/, "");
	if (pathname === deploymentPrefix.slice(0, -1)) return "";
	if (pathname.startsWith(deploymentPrefix)) {
		return pathname.slice(deploymentPrefix.length);
	}
	return null;
}

// Development-only validation. The published site still serves checked-in files directly.
export async function auditSiteLinks({
	rootDir,
	deploymentPrefix = "/",
}) {
	const root = path.resolve(rootDir);
	const prefix = normalizeDeploymentPrefix(deploymentPrefix);
	const { pages, resolveFile } = await readSitePages(root);
	const links = [];
	const issues = [];
	const documents = new Map();

	async function readDocument(file) {
		if (documents.has(file)) return documents.get(file);
		let document = null;
		try {
			const dom = new JSDOM(await readFile(path.join(root, file), "utf8"));
			document = dom.window.document;
		} catch (error) {
			issues.push(`${file}: cannot read HTML (${error.message})`);
		}
		documents.set(file, document);
		return document;
	}

	function parseReference(reference, htmlPath) {
		try {
			const base = `${origin}${prefix}${htmlPath}`;
			const url = new URL(reference, base);
			if (url.origin !== origin) return null;
			const urlPath = relativeUrlPath(url.pathname, prefix);
			if (urlPath === null) return { outsidePrefix: true };
			const relativePath = decodeURIComponent(urlPath);
			const fragment = url.hash
				? decodeURIComponent(url.hash.slice(1))
				: "";
			return { relativePath, fragment };
		} catch {
			return false;
		}
	}

	for (const htmlPath of pages) {
		const document = await readDocument(htmlPath);
		if (!document) continue;
		for (const element of document.querySelectorAll("[href], [src]")) {
			for (const attribute of ["href", "src"]) {
				if (!element.hasAttribute(attribute)) continue;
				const reference = element.getAttribute(attribute).trim();
				if (attribute === "src" && !reference) {
					issues.push(`${htmlPath}: src is empty`);
					continue;
				}
				const parsed = parseReference(reference, htmlPath);
				if (parsed === null) continue;
				if (parsed === false) {
					issues.push(
						`${htmlPath}: ${attribute} '${reference}' is not a valid local reference`,
					);
					continue;
				}
				if (parsed.outsidePrefix) {
					issues.push(
						`${htmlPath}: ${attribute} '${reference}' escapes deployment prefix '${prefix}'`,
					);
					continue;
				}
				const target = await resolveFile(parsed.relativePath);
				links.push({
					htmlPath,
					attribute,
					reference,
					target: target.file,
					fragment: parsed.fragment,
				});
				if (!target.file) {
					issues.push(
						`${htmlPath}: ${attribute} '${reference}' targets missing file '${target.requested}'`,
					);
					continue;
				}
				if (
					!parsed.fragment ||
					!/\.html?$/i.test(target.file)
				) {
					continue;
				}
				const targetDocument = await readDocument(target.file);
				const namedAnchor = [...(targetDocument?.querySelectorAll("a[name]") ?? [])]
					.some((anchor) => anchor.getAttribute("name") === parsed.fragment);
				if (
					targetDocument &&
					!targetDocument.getElementById(parsed.fragment) &&
					!namedAnchor
				) {
					issues.push(
						`${htmlPath}: ${attribute} '${reference}' targets missing fragment '#${parsed.fragment}' in '${target.file}'`,
					);
				}
			}
		}
	}

	for (const document of documents.values()) document?.defaultView.close();
	return { pages, links, issues };
}

async function runCli() {
	const audit = await auditSiteLinks({ rootDir: process.cwd() });
	if (audit.issues.length === 0) {
		console.log(
			`Site links OK: ${audit.links.length} local references across ${audit.pages.length} pages`,
		);
		return;
	}
	for (const issue of audit.issues) console.error(`- ${issue}`);
	process.exitCode = 1;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	await runCli();
}
