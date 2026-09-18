import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Import only supported parsers; unrelated container parsers are never loaded.
import { JPG } from "image-size/types/jpg";
import { PNG } from "image-size/types/png";
import { WEBP } from "image-size/types/webp";
import { JSDOM } from "jsdom";
import { discoverStudentPhotos } from "./student-photos.mjs";
import { discoverSitePages } from "./site-pages.mjs";

const EXTENSION_FORMATS = new Map([
	[".jpg", "jpeg"],
	[".jpeg", "jpeg"],
	[".webp", "webp"],
	[".png", "png"],
	[".svg", "svg"],
]);

const FORMAT_MIMES = new Map([
	["jpeg", "image/jpeg"],
	["webp", "image/webp"],
	["png", "image/png"],
]);

const FORMAT_PARSERS = new Map([
	["jpeg", JPG],
	["webp", WEBP],
	["png", PNG],
]);

export function inspectImage(buffer) {
	const [format, parser] =
		[...FORMAT_PARSERS].find(([, candidate]) =>
			candidate.validate(buffer),
		) ?? [];
	if (!format) throw new Error("unsupported image format");
	let metadata;
	try {
		metadata = parser.calculate(buffer);
	} catch (error) {
		throw new Error("image metadata could not be read", { cause: error });
	}

	const mime = FORMAT_MIMES.get(format);
	return { format, mime, width: metadata.width, height: metadata.height };
}

function cleanReference(reference) {
	return reference.split(/[?#]/, 1)[0];
}

export async function auditSiteMedia({ rootDir }) {
	const pages = await discoverSitePages(rootDir);
	const assets = [];
	const issues = [];
	for (const htmlPath of pages) {
		const audit = await auditRoadMedia({ rootDir, htmlPath });
		assets.push(...audit.assets.map((asset) => ({ htmlPath, ...asset })));
		issues.push(...audit.issues.map((issue) => `${htmlPath}: ${issue}`));
	}
	return { pages, assets, issues };
}

function inspectSvg(buffer) {
	let dom;
	try {
		dom = new JSDOM(buffer.toString("utf8"), {
			contentType: "image/svg+xml",
		});
		const root = dom.window.document.documentElement;
		if (
			root.localName !== "svg" ||
			root.namespaceURI !== "http://www.w3.org/2000/svg"
		) {
			throw new Error("not an SVG document");
		}
		// SVGs are scalable: validate XML and MIME, not raster dimensions.
		return { format: "svg", mime: "image/svg+xml" };
	} catch (error) {
		throw new Error("invalid SVG document", { cause: error });
	} finally {
		dom?.window.close();
	}
}

function* srcsetCandidates(srcset) {
	// URLs end at whitespace, not commas: embedded data URLs contain commas.
	let remaining = srcset ?? "";
	while (remaining) {
		remaining = remaining.replace(/^[\s,]+/, "");
		const source = remaining.match(/^\S+/)?.[0];
		if (!source) return;
		remaining = remaining.slice(source.length);
		if (source.endsWith(",")) {
			yield [source.replace(/,+$/, ""), ""];
			continue;
		}
		const descriptor = remaining.split(",", 1)[0];
		remaining = remaining.slice(descriptor.length + 1);
		yield [source, descriptor.trim()];
	}
}

export async function auditRoadMedia({ rootDir, htmlPath = "index.html" }) {
	const absoluteHtmlPath = path.resolve(rootDir, htmlPath);
	const html = await readFile(absoluteHtmlPath, "utf8");
	const dom = new JSDOM(html);
	const document = dom.window.document;
	const issues = [];
	const assets = [];

	const inspectedSources = new Map();

	async function inspectSource(source) {
		source = cleanReference(source.trim());
		// Audit local declarations only. Never fetch external or embedded assets.
		if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source)) return null;
		if (inspectedSources.has(source)) return inspectedSources.get(source);
		let inspected;
		try {
			if (!source) throw new Error("image source is empty");
			const decodedSource = decodeURIComponent(source);
			const absoluteImagePath = decodedSource.startsWith("/")
				? path.resolve(rootDir, `.${decodedSource}`)
				: path.resolve(path.dirname(absoluteHtmlPath), decodedSource);
			const bytes = await readFile(absoluteImagePath);
			inspected =
				path.extname(decodedSource).toLowerCase() === ".svg"
					? inspectSvg(bytes)
					: inspectImage(bytes);
		} catch (error) {
			issues.push(
				`${source}: ${error.code === "ENOENT" ? "file does not exist" : error.message}`,
			);
			inspectedSources.set(source, null);
			return null;
		}
		const declaredFormat = EXTENSION_FORMATS.get(
			path.extname(source).toLowerCase(),
		);

		if (declaredFormat !== inspected.format) {
			issues.push(
				`${source}: extension declares ${declaredFormat ?? "unknown"}, bytes are ${inspected.format}`,
			);
		}
		const asset = { source, ...inspected };
		inspectedSources.set(source, asset);
		assets.push(asset);
		return asset;
	}

	async function inspectSrcset(srcset) {
		const deliveries = [];
		for (const [deliverySource, descriptor] of srcsetCandidates(srcset)) {
			const delivery = await inspectSource(
				cleanReference(deliverySource),
			);
			if (delivery) deliveries.push(delivery);
			if (
				delivery &&
				delivery.format !== "svg" &&
				/^\d+w$/.test(descriptor) &&
				parseInt(descriptor) !== delivery.width
			) {
				issues.push(
					`${deliverySource}: srcset declares ${descriptor}, file is ${delivery.width}px wide`,
				);
			}
		}
		return deliveries;
	}

	for (const image of document.querySelectorAll("img")) {
		const source = cleanReference(image.getAttribute("src") ?? "");
		const marked = image.matches(
			"img[data-road-media], [data-road-carousel] .road-car > img, [data-road-carousel] .road-photo img",
		);
		const srcset = image.getAttribute("srcset");
		const hasCandidates = !srcsetCandidates(srcset).next().done;
		const inspected =
			source || marked || !hasCandidates
				? await inspectSource(source)
				: null;
		await inspectSrcset(srcset);
		if (!inspected) continue;
		if (!marked) continue;
		if (inspected.format === "svg") {
			issues.push(
				`${source}: marked road media requires JPEG, WebP, or PNG`,
			);
			continue;
		}
		const declaredWidth = Number(image.getAttribute("width"));
		const declaredHeight = Number(image.getAttribute("height"));
		const alt = image.getAttribute("alt")?.trim() ?? "";
		if (
			declaredWidth !== inspected.width ||
			declaredHeight !== inspected.height
		) {
			issues.push(
				`${source}: declared ${declaredWidth}x${declaredHeight}, file is ${inspected.width}x${inspected.height}`,
			);
		}
		if (!alt) issues.push(`${source}: alternative text is empty`);
		inspected.alt = alt;
	}
	for (const source of document.querySelectorAll(
		"picture > source[srcset]",
	)) {
		await inspectSrcset(source.getAttribute("srcset"));
	}

	// Background images can be preloaded without a corresponding img element.
	for (const preload of document.querySelectorAll(
		'link[rel~="preload"][as="image"]',
	)) {
		const source = cleanReference(preload.getAttribute("href") ?? "");
		const srcset = preload.getAttribute("imagesrcset");
		const hasCandidates = !srcsetCandidates(srcset).next().done;
		const inspected =
			source || !hasCandidates ? await inspectSource(source) : null;
		const deliveries = await inspectSrcset(srcset);
		const declaredType = preload.getAttribute("type");
		for (const asset of new Set([inspected, ...deliveries])) {
			if (asset && declaredType !== null && declaredType !== asset.mime) {
				issues.push(
					`${asset.source}: preload type is ${declaredType}, expected ${asset.mime}`,
				);
			}
		}
	}

	const gallery = document.querySelector("[data-road-carousel]");
	if (gallery) {
		await auditGallery(
			gallery,
			path.dirname(absoluteHtmlPath),
			issues,
			inspectSource,
			inspectSrcset,
		);
	}
	dom.window.close();
	return { assets, issues };
}

async function auditGallery(
	gallery,
	pageDir,
	issues,
	inspectSource,
	inspectSrcset,
) {
	async function filesIn(directory) {
		try {
			return (
				await readdir(path.join(pageDir, directory), {
					withFileTypes: true,
				})
			)
				.filter((entry) => entry.isFile())
				.map((entry) => entry.name);
		} catch (error) {
			issues.push(
				`${directory}: ${error.code === "ENOENT" ? "directory does not exist" : error.message}`,
			);
			return [];
		}
	}

	const carDirectory = "assets/images/cars";
	const availableCars = (await filesIn(carDirectory)).filter((name) =>
		/^car-.*\.png$/.test(name),
	);
	// Match runtime initialization: only this group's direct children are templates.
	const group = gallery.querySelector(".road-carousel-group");
	if (!group) issues.push("Student gallery: missing carousel group");
	const cars = group ? [...group.children] : [];
	const templates = cars.map((car) =>
		cleanReference(
			car.querySelector(":scope > img")?.getAttribute("src") ?? "",
		),
	);
	for (const name of availableCars) {
		const source = `${carDirectory}/${name}`;
		if (!templates.includes(source))
			issues.push(`${source}: missing carousel template`);
	}
	for (const source of new Set(templates)) {
		if (
			!availableCars.some((name) => source === `${carDirectory}/${name}`)
		) {
			issues.push(`${source}: template is not an available car sprite`);
		}
		if (templates.filter((candidate) => candidate === source).length > 1) {
			issues.push(`${source}: duplicate carousel template`);
		}
	}
	if (templates.length === 0)
		issues.push("Student gallery: no car templates");
	for (const car of cars) {
		if (
			!car.matches(".road-car") ||
			car.querySelectorAll(":scope > img").length !== 1
		) {
			issues.push(
				"Student gallery: each group child must be a car template with one sprite",
			);
		}
		if (car.querySelectorAll(".road-photo img").length !== 1) {
			issues.push(
				"Student gallery: each car template needs exactly one fallback photo",
			);
		}
	}

	const {
		directory: photoDirectory,
		names: numberedPhotos,
		issues: photoIssues,
	} = await discoverStudentPhotos(pageDir);
	issues.push(...photoIssues);
	for (const name of numberedPhotos) {
		await inspectSource(`${photoDirectory}/${name}`);
	}

	// Load the generated JavaScript as a module so formatting cannot change its meaning.
	const listPath = "js/road-photo-sources.js";
	try {
		const module = await readFile(path.join(pageDir, listPath), "utf8");
		const { roadPhotoSources: sources } = await import(
			`data:text/javascript;charset=utf-8,${encodeURIComponent(module)}`,
		);
		for (const source of Object.values(sources))
			await inspectSrcset(source.srcset);
		const listedNames = Object.keys(sources).map(
			(number) => `${number}.png`,
		);
		if (
			listedNames.length !== numberedPhotos.length ||
			numberedPhotos.some((name) => !listedNames.includes(name))
		)
			issues.push(
				`${listPath}: photo list is stale; run npm run optimize:media`,
			);
		for (const name of numberedPhotos) {
			const bytes = await readFile(
				path.join(pageDir, photoDirectory, name),
			);
			if (sources[parseInt(name)]?.originalBytes !== bytes.length)
				issues.push(
					`${listPath}: ${name} metadata is stale; run npm run optimize:media`,
				);
		}
	} catch (error) {
		issues.push(
			`${listPath}: cannot read generated photo list (${error.message}); run npm run optimize:media`,
		);
	}

	const fallback = cars.flatMap((car) => [
		...car.querySelectorAll(".road-photo img"),
	]);
	fallback.forEach((image, index) => {
		const expectedSource = `${photoDirectory}/${index + 1}.png`;
		if (
			cleanReference(image.getAttribute("src") ?? "") !== expectedSource
		) {
			issues.push(
				`Student gallery fallback ${index + 1}: expected ${expectedSource}`,
			);
		}
	});
}

async function runCli() {
	const audit = await auditSiteMedia({
		rootDir: process.cwd(),
	});
	if (audit.issues.length === 0) {
		console.log(
			`Site media OK: ${audit.assets.length} image references across ${audit.pages.length} pages`,
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
