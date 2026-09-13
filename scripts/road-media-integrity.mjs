import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Import only supported parsers; unrelated container parsers are never loaded.
import { JPG } from "image-size/types/jpg";
import { PNG } from "image-size/types/png";
import { WEBP } from "image-size/types/webp";
import { JSDOM } from "jsdom";

const EXTENSION_FORMATS = new Map([
	[".jpg", "jpeg"],
	[".jpeg", "jpeg"],
	[".webp", "webp"],
	[".png", "png"],
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

export async function auditRoadMedia({ rootDir, htmlPath = "index.html" }) {
	const absoluteHtmlPath = path.resolve(rootDir, htmlPath);
	const html = await readFile(absoluteHtmlPath, "utf8");
	const document = new JSDOM(html).window.document;
	const issues = [];
	const assets = [];

	const inspectedSources = new Map();

	async function inspectSource(source) {
		if (inspectedSources.has(source)) return inspectedSources.get(source);
		const absoluteImagePath = path.resolve(
			path.dirname(absoluteHtmlPath),
			source,
		);
		let inspected;
		try {
			inspected = inspectImage(await readFile(absoluteImagePath));
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

	for (const image of document.querySelectorAll(
		"img[data-road-media], [data-road-carousel] .road-car > img, [data-road-carousel] .road-photo img",
	)) {
		const source = cleanReference(image.getAttribute("src") ?? "");
		const inspected = await inspectSource(source);
		for (const candidate of (image.getAttribute("srcset") ?? "").split(",")) {
			const [deliverySource, descriptor] = candidate.trim().split(/\s+/);
			if (!deliverySource) continue;
			const delivery = await inspectSource(cleanReference(deliverySource));
			if (delivery && /^\d+w$/.test(descriptor) && parseInt(descriptor) !== delivery.width) {
				issues.push(`${deliverySource}: srcset declares ${descriptor}, file is ${delivery.width}px wide`);
			}
		}
		if (!inspected) continue;
		const declaredWidth = Number(image.getAttribute("width"));
		const declaredHeight = Number(image.getAttribute("height"));
		const alt = image.getAttribute("alt")?.trim() ?? "";
		const preload = [
			...document.querySelectorAll('link[rel="preload"][as="image"]'),
		].find(
			(link) =>
				cleanReference(link.getAttribute("href") ?? "") === source,
		);

		if (
			declaredWidth !== inspected.width ||
			declaredHeight !== inspected.height
		) {
			issues.push(
				`${source}: declared ${declaredWidth}x${declaredHeight}, file is ${inspected.width}x${inspected.height}`,
			);
		}
		if (!alt) issues.push(`${source}: alternative text is empty`);
		if (preload && preload.getAttribute("type") !== inspected.mime) {
			issues.push(
				`${source}: preload type is ${preload.getAttribute("type")}, expected ${inspected.mime}`,
			);
		}

		inspected.alt = alt;
	}

	const gallery = document.querySelector("[data-road-carousel]");
	if (gallery) {
		await auditGallery(
			gallery,
			path.dirname(absoluteHtmlPath),
			issues,
			inspectSource,
		);
	}
	return { assets, issues };
}

async function auditGallery(gallery, pageDir, issues, inspectSource) {
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

	const photoDirectory = "assets/images/students-pass";
	const photoFiles = (await filesIn(photoDirectory)).filter((name) =>
		/\.png$/i.test(name),
	);
	const numberedPhotos = [];
	for (const name of photoFiles) {
		if (!/^[1-9]\d*\.png$/.test(name)) {
			issues.push(
				`${photoDirectory}/${name}: filename must be a positive number followed by .png`,
			);
		} else numberedPhotos.push(name);
	}
	numberedPhotos.sort((a, b) => parseInt(a) - parseInt(b));
	let expected = 1;
	for (const name of numberedPhotos) {
		const number = parseInt(name);
		if (number !== expected)
			issues.push(
				`${photoDirectory}/${expected}.png: numbering gap before ${name}`,
			);
		expected = number + 1;
		await inspectSource(`${photoDirectory}/${name}`);
	}
	if (numberedPhotos.length === 0)
		issues.push(`${photoDirectory}: no numbered student photos`);

	// The generator writes a JSON object in this module; inspect data without executing it.
	const listPath = "js/road-photo-sources.js";
	try {
		const module = await readFile(path.join(pageDir, listPath), "utf8");
		const sources = JSON.parse(module.match(/export const roadPhotoSources = (\{[\s\S]*\});\s*$/)?.[1]);
		const listedNames = Object.keys(sources).map(number => `${number}.png`);
		if (listedNames.length !== numberedPhotos.length || numberedPhotos.some(name => !listedNames.includes(name)))
			issues.push(`${listPath}: photo list is stale; run npm run optimize:media`);
		for (const name of numberedPhotos) {
			const bytes = await readFile(path.join(pageDir, photoDirectory, name));
			if (sources[parseInt(name)]?.originalBytes !== bytes.length)
				issues.push(`${listPath}: ${name} metadata is stale; run npm run optimize:media`);
		}
	} catch (error) {
		issues.push(`${listPath}: cannot read generated photo list (${error.message}); run npm run optimize:media`);
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
	const audit = await auditRoadMedia({
		rootDir: process.cwd(),
		htmlPath: "index.html",
	});
	if (audit.issues.length === 0) {
		console.log(`Road media OK: ${audit.assets.length} images`);
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
