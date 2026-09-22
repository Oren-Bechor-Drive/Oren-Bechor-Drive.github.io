import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { discoverStudentPhotos } from "./student-photos.mjs";

// Run after changing gallery photos. The generated files are served directly.
const outputDirectory = "assets/images/optimized";

async function prepareMedia(rootDir, stagingDir) {
	const declarations = new Map();
	const generatedPaths = new Set();
	const sources = {};
	const originalSourceBytes = new Map();
	let smallBytes = 0;

	// Match welcome.css and responsive.css: road height × 1.3 × car scale.
	// The browser evaluates these even for detached images and with JS disabled.
	function roadSizes(fraction) {
		const clamp = (min, vh, max, scale) => {
			const factor = 1.3 * scale * fraction;
			const value = (number) => Number((number * factor).toFixed(3));
			return `clamp(${value(min)}px, ${value(vh)}svh, ${value(max)}px)`;
		};
		return `(max-width: 768px) ${clamp(140, 21, 188, 1.25)}, ${clamp(180, 27, 264, 1.15)}`;
	}

	async function delivery(
		source,
		name,
		widths,
		encoding,
		sizes,
		smallEncoding = {},
		declarationKey = source,
	) {
		const bytes = await readFile(path.join(rootDir, source));
		const metadata = await sharp(bytes).metadata();
		const candidates = [];
		const uniqueWidths = [
			...new Set(widths.map((width) => Math.min(width, metadata.width))),
		];
		for (const [index, width] of uniqueWidths.entries()) {
			const src = `${outputDirectory}/${name}${index ? `-${width}` : ""}.webp`;
			await mkdir(path.dirname(path.join(stagingDir, src)), { recursive: true });
			const result = await sharp(bytes)
				.resize({ width, withoutEnlargement: true })
				.webp({
					...encoding,
					effort: 6,
					...(index === 0 ? smallEncoding : {}),
				})
				.toFile(path.join(stagingDir, src));
			candidates.push(`${src} ${result.width}w`);
			generatedPaths.add(src);
			if (!index) smallBytes += result.size;
		}
		const declaration = {
			srcset: candidates.join(", "),
			sizes,
			width: metadata.width,
			height: metadata.height,
		};
		declarations.set(declarationKey, declaration);
		originalSourceBytes.set(source, bytes.length);
		return { srcset: declaration.srcset, sizes, originalBytes: bytes.length };
	}

	const {
		directory: photoDirectory,
		names: photoNames,
		issues,
	} = await discoverStudentPhotos(rootDir);
	if (issues.length) throw new Error(issues.join("\n"));
	for (const name of photoNames) {
		const source = `${photoDirectory}/${name}`;
		const { width, height } = await sharp(path.join(rootDir, source)).metadata();
		// object-fit: cover can require a wider source than the photo's visible box.
		const fraction = Math.max(0.62, (260 / 460) * 0.68 * (width / height));
		const smallWidth = Math.ceil((254 * 1.3 * 1.15 * fraction) / 20) * 20;
		const largeWidth = Math.min(
			width,
			Math.max(smallWidth * 2, Math.ceil(264 * 1.3 * 1.15 * fraction * 2)),
		);
		// Intermediate candidates serve phones; keep the larger copy when widths differ by less than 5%.
		const widths = [
			smallWidth,
			...[320, 360, 400].filter(
				(width) => width > smallWidth && width * 1.05 <= largeWidth,
			),
			largeWidth,
		];
		sources[parseInt(name)] = await delivery(
			source,
			`students-pass/oren-bachor-students-${path.parse(name).name}`,
			widths,
			{ quality: 65 },
			roadSizes(fraction),
			// Preserve the reviewed desktop copies, including photo 11's denser background.
			{ quality: name === "11.png" ? 55 : 78 },
		);
	}

	const css = await readFile(path.join(rootDir, "css/welcome.css"), "utf8");
	const carNames = await readdir(path.join(rootDir, "assets/images/cars"));
	for (const name of carNames.filter((name) => /^car-.*\.png$/.test(name))) {
		const car = path.parse(name).name;
		const rule = css.match(
			new RegExp(`\\.${car.replace("car-", "road-car-")}\\s*\\{([^}]+)\\}`),
		);
		const artWidth = rule?.[1].match(/--car-art-width:\s*([\d.]+)%/);
		if (!artWidth) throw new Error(`Missing --car-art-width for ${car}`);
		const fraction = Number(artWidth[1]) / 100;
		const source = `assets/images/cars/${name}`;
		const { width } = await sharp(path.join(rootDir, source)).metadata();
		const smallWidth = Math.ceil((254 * 1.3 * 1.15 * fraction) / 10) * 10;
		// Quantize the red sprite's alpha channel; RGB quality and source artwork stay unchanged.
		const encoding = {
			quality: 80,
			...(car === "car-red" ? { alphaQuality: 73 } : {}),
		};
		await delivery(
			source,
			`cars/${car}`,
			[smallWidth, width],
			encoding,
			roadSizes(fraction),
		);
	}

	await delivery(
		"assets/images/cars/car-red.png",
		"hero-car",
		[80, 160],
		{ quality: 80 },
		"clamp(40px, 5vw, 80px)",
		{},
		"hero-road-car",
	);

	await delivery(
		"assets/images/wheel.png",
		"wheel",
		[128, 256],
		{ quality: 65, alphaQuality: 60 },
		"128px",
	);
	await delivery(
		"assets/images/stop-sign.png",
		"stop-sign",
		[144, 380, 760, 800],
		{ quality: 80 },
		"(max-width: 768px) clamp(96px, 16svh, 144px), clamp(220px, 40svh, 400px)",
	);
	await delivery(
		"assets/icons/course-icon.png",
		"course-icon",
		[42, 84],
		{ quality: 85 },
		"42px",
	);
	await delivery(
		// 544px covers the desktop frame's slight cover crop; intermediate widths avoid
		// sending 1080px to phones. The largest copy covers the 728px tablet frame at 2x.
		"assets/images/oren.jpg",
		"oren",
		[400, 480, 544, 680, 768, 960, 1080, 1460],
		{ quality: 50 },
		"(max-width: 440px) calc(100vw - 32px), (max-width: 768px) calc(100vw - 40px), (max-width: 1024px) calc((100vw - 104px) / 2), (max-width: 1216px) calc((100vw - 136px) / 2), 540px",
	);
	// A separate favicon prevents the browser tab from downloading the full-size original.
	await sharp(path.join(rootDir, "assets/icons/course-icon.png"))
		.resize({ width: 32, withoutEnlargement: true })
		.png()
		.toFile(path.join(stagingDir, outputDirectory, "favicon.png"));
	generatedPaths.add(`${outputDirectory}/favicon.png`);

	// Home-screen and pinned-site icons reuse the supplied square course artwork.
	for (const [name, size] of [
		["apple-touch-icon", 180],
		["android-chrome-192x192", 192],
		["android-chrome-512x512", 512],
		["mstile-144x144", 144],
	]) {
		await sharp(path.join(rootDir, "assets/icons/course-icon.png"))
			.resize({
				width: size,
				height: size,
				fit: "contain",
				background: "#f2f5fc",
			})
			.png()
			.toFile(path.join(stagingDir, outputDirectory, `${name}.png`));
		generatedPaths.add(`${outputDirectory}/${name}.png`);
	}

	await mkdir(path.join(stagingDir, "js"));
	await writeFile(
		path.join(stagingDir, "js/road-photo-sources.js"),
		`// Generated by npm run optimize:media. Complete gallery list and responsive delivery metadata. Regenerate after photo changes.\nexport const roadPhotoSources = ${JSON.stringify(sources, null, "\t")};\n`,
	);

	// Update only image attributes, keeping the hand-authored page and its formatting.
	const html = await readFile(path.join(rootDir, "index.html"), "utf8");
	const updated = html
		.replace(/<img\b[^>]*>/g, (tag) => {
			const source = tag.match(/\bsrc="([^"]+)"/)?.[1];
			const classes = tag.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) ?? [];
			const declaration = declarations.get(
				classes.includes("hero-road-car") ? "hero-road-car" : source,
			);
			if (!declaration) return tag;
			const indent = tag.match(/\n([\t ]+)\S/)?.[1] ?? "\t";
			for (const [name, value] of Object.entries(declaration)) {
				if (
					source === "assets/icons/course-icon.png" &&
					["width", "height"].includes(name)
				)
					continue;
				const attribute = new RegExp(`\\b${name}="[^"]*"`);
				if (attribute.test(tag))
					tag = tag.replace(attribute, `${name}="${value}"`);
				else
					tag = tag.replace(
						/\s*\/?>$/,
						`\n${indent}${name}="${value}"\n${indent.slice(0, -1)}/>`,
					);
			}
			return tag;
		})
		.replace(
			/(<link\b[^>]*rel="icon"[^>]*href=")[^"]+/,
			`$1${outputDirectory}/favicon.png?v=2`,
		);
	await writeFile(path.join(stagingDir, "index.html"), updated);
	const originalBytes = [...originalSourceBytes.values()].reduce(
		(sum, bytes) => sum + bytes,
		0,
	);
	return {
		files: [...generatedPaths, "index.html", "js/road-photo-sources.js"],
		originalBytes,
		smallBytes,
	};
}

// Keep replaced and obsolete files until every new file has been installed.
async function publishMedia(rootDir, workspace, files) {
	let previousFiles = [];
	try {
		previousFiles = await readdir(path.join(rootDir, outputDirectory), {
			recursive: true,
			withFileTypes: true,
		});
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	const generated = new Set(files);
	const obsolete = previousFiles
		.filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
		.map((entry) => path.relative(rootDir, path.join(entry.parentPath, entry.name))
			.split(path.sep).join("/"))
		.filter((file) => !generated.has(file));
	const journal = [];
	try {
		for (const file of [...files, ...obsolete]) {
			const destination = path.join(rootDir, file);
			const backup = path.join(workspace, "backup", file);
			const entry = { destination, backup, replaced: false, installed: false };
			journal.push(entry);
			let existing;
			try {
				existing = await lstat(destination);
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
			}
			if (existing) {
				if (!existing.isFile()) {
					throw new Error(`Media destination is not a regular file: ${file}`);
				}
				await mkdir(path.dirname(backup), { recursive: true });
				await rename(destination, backup);
				entry.replaced = true;
			}
			if (generated.has(file)) {
				await mkdir(path.dirname(destination), { recursive: true });
				await rename(path.join(workspace, "staged", file), destination);
				entry.installed = true;
			}
		}
	} catch (error) {
		const recoveryErrors = [];
		for (const entry of journal.reverse()) {
			try {
				if (entry.replaced) await rename(entry.backup, entry.destination);
				else if (entry.installed) await rm(entry.destination);
			} catch (recoveryError) {
				recoveryErrors.push(recoveryError);
			}
		}
		if (recoveryErrors.length) {
			const failure = new AggregateError(
				[error, ...recoveryErrors],
				`Media publication and rollback failed. Recovery files retained at ${workspace}`,
			);
			failure.recoveryDirectory = workspace;
			throw failure;
		}
		throw error;
	}
}

// Both the command and tests operate on an owned repository tree.
export async function optimizeRoadMedia(rootDir) {
	const root = path.resolve(rootDir);
	const workspace = await mkdtemp(path.join(root, ".road-media-"));
	let retainRecovery = false;
	try {
		const prepared = await prepareMedia(root, path.join(workspace, "staged"));
		await publishMedia(root, workspace, prepared.files);
		return {
			originalBytes: prepared.originalBytes,
			smallBytes: prepared.smallBytes,
		};
	} catch (error) {
		retainRecovery = Boolean(error.recoveryDirectory);
		throw error;
	} finally {
		if (!retainRecovery) {
			await rm(workspace, { recursive: true, force: true }).catch((error) => {
				console.warn(`Cannot remove temporary media directory ${workspace}: ${error.message}`);
			});
		}
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { originalBytes, smallBytes } = await optimizeRoadMedia(process.cwd());
	console.log(
		`Responsive image delivery: ${originalBytes} original bytes; ${smallBytes} bytes in smallest WebP variants. Actual downloads depend on viewport and density.`,
	);
}
