import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { discoverStudentPhotos } from "./student-photos.mjs";

// Run after changing gallery photos. The generated files are served directly.
const outputDirectory = "assets/images/optimized";
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

async function delivery(source, name, widths, encoding, sizes, smallEncoding = {}, declarationKey = source) {
	const bytes = await readFile(source);
	const metadata = await sharp(bytes).metadata();
	const candidates = [];
	const uniqueWidths = [...new Set(widths.map((width) => Math.min(width, metadata.width)))];
	for (const [index, width] of uniqueWidths.entries()) {
		const src = `${outputDirectory}/${name}${index ? `-${width}` : ""}.webp`;
		await mkdir(path.dirname(src), { recursive: true });
		const result = await sharp(bytes)
			.resize({ width, withoutEnlargement: true })
			.webp({ ...encoding, effort: 6, ...(index === 0 ? smallEncoding : {}) })
			.toFile(src);
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

const { directory: photoDirectory, names: photoNames, issues } = await discoverStudentPhotos(process.cwd());
if (issues.length) throw new Error(issues.join("\n"));
for (const name of photoNames) {
	const source = `${photoDirectory}/${name}`;
	const { width, height } = await sharp(source).metadata();
	// object-fit: cover can require a wider source than the photo's visible box.
	const fraction = Math.max(0.62, (260 / 460) * 0.68 * (width / height));
	const smallWidth = Math.ceil((254 * 1.3 * 1.15 * fraction) / 20) * 20;
	const largeWidth = Math.min(width, Math.max(smallWidth * 2, Math.ceil(264 * 1.3 * 1.15 * fraction * 2)));
	// Intermediate candidates serve phones; keep the larger copy when widths differ by less than 5%.
	const widths = [smallWidth, ...[320, 360, 400].filter(width => width > smallWidth && width * 1.05 <= largeWidth), largeWidth];
	sources[parseInt(name)] = await delivery(
		source, `students-pass/${path.parse(name).name}`,
		widths, { quality: 65 }, roadSizes(fraction),
		// Preserve the reviewed desktop copies, including photo 11's denser background.
		{ quality: name === "11.png" ? 55 : 78 },
	);
}

const css = await readFile("css/welcome.css", "utf8");
for (const name of (await readdir("assets/images/cars")).filter((name) => /^car-.*\.png$/.test(name))) {
	const car = path.parse(name).name;
	const rule = css.match(new RegExp(`\\.${car.replace("car-", "road-car-")}\\s*\\{([^}]+)\\}`));
	const artWidth = rule?.[1].match(/--car-art-width:\s*([\d.]+)%/);
	if (!artWidth) throw new Error(`Missing --car-art-width for ${car}`);
	const fraction = Number(artWidth[1]) / 100;
	const source = `assets/images/cars/${name}`;
	const { width } = await sharp(source).metadata();
	const smallWidth = Math.ceil((254 * 1.3 * 1.15 * fraction) / 10) * 10;
	// Quantize the red sprite's alpha channel; RGB quality and source artwork stay unchanged.
	const encoding = { quality: 80, ...(car === "car-red" ? { alphaQuality: 73 } : {}) };
	await delivery(source, `cars/${car}`, [smallWidth, width], encoding, roadSizes(fraction));
}

await delivery(
	"assets/images/cars/car-red.png", "hero-car", [80, 160], { quality: 80 },
	"clamp(40px, 5vw, 80px)", {}, "hero-road-car",
);

await delivery(
	"assets/images/wheel.png", "wheel", [128, 256], { quality: 65, alphaQuality: 60 }, "128px",
);
await delivery(
	"assets/images/stop-sign.png", "stop-sign", [144, 380, 760, 800], { quality: 85 },
	"(max-width: 768px) clamp(96px, 16svh, 144px), clamp(220px, 40svh, 400px)",
);
await delivery("assets/icons/course-icon.png", "course-icon", [42, 84], { quality: 85 }, "42px");
await delivery(
	"assets/images/oren.jpg", "oren", [400, 640, 1080], { quality: 78 },
	"(max-width: 440px) calc(100vw - 32px), (max-width: 768px) calc(100vw - 40px), (max-width: 1024px) calc((100vw - 104px) / 2), (max-width: 1216px) calc((100vw - 136px) / 2), 540px",
);
// A separate favicon prevents the browser tab from downloading the 512px original.
await sharp("assets/icons/course-icon.png")
	.resize({ width: 32, withoutEnlargement: true })
	.png()
	.toFile(`${outputDirectory}/favicon.png`);

await writeFile(
	"js/road-photo-sources.js",
	`// Generated by npm run optimize:media. Complete gallery list and responsive delivery metadata. Regenerate after photo changes.\nexport const roadPhotoSources = ${JSON.stringify(sources, null, "\t")};\n`,
);

// Update only image attributes, keeping the hand-authored page and its formatting.
const html = await readFile("index.html", "utf8");
const updated = html.replace(/<img\b[^>]*>/g, (tag) => {
	const source = tag.match(/\bsrc="([^"]+)"/)?.[1];
	const classes = tag.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) ?? [];
	const declaration = declarations.get(classes.includes("hero-road-car") ? "hero-road-car" : source);
	if (!declaration) return tag;
	const indent = tag.match(/\n([\t ]+)\S/)?.[1] ?? "\t";
	for (const [name, value] of Object.entries(declaration)) {
		if (source === "assets/icons/course-icon.png" && ["width", "height"].includes(name)) continue;
		const attribute = new RegExp(`\\b${name}="[^"]*"`);
		if (attribute.test(tag)) tag = tag.replace(attribute, `${name}="${value}"`);
		else tag = tag.replace(/\s*\/?>$/, `\n${indent}${name}="${value}"\n${indent.slice(0, -1)}/>`);
	}
	return tag;
}).replace(/(<link\b[^>]*rel="icon"[^>]*href=")[^"]+/, `$1${outputDirectory}/favicon.png`);
await writeFile("index.html", updated);
// Only this generated directory is cleaned; supplied artwork stays untouched.
for (const name of await readdir(outputDirectory, { recursive: true })) {
	const source = `${outputDirectory}/${name}`;
	if (name.endsWith(".webp") && !generatedPaths.has(source)) await rm(source);
}
const originalBytes = [...originalSourceBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
console.log(`Responsive image delivery: ${originalBytes} original bytes; ${smallBytes} bytes in smallest WebP variants. Actual downloads depend on viewport and density.`);
