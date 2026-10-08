import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { inspectImage } from "../../scripts/road-media-integrity.mjs";
import { optimizeRoadMedia } from "../../scripts/optimize-road-media.mjs";

const run = promisify(execFile);
const root = new URL("../../", import.meta.url);

async function publicationFixture(t) {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "media-publication-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const png = await sharp({
		create: { width: 4, height: 4, channels: 3, background: "white" },
	}).png().toBuffer();
	const files = {
		"assets/images/students-pass/1.png": png,
		"assets/images/students-pass/2.png": png,
		"assets/images/cars/car-red.png": png,
		"assets/images/wheel.png": png,
		"assets/images/stop-sign.png": png,
		"assets/images/oren.jpg": await sharp(png).jpeg().toBuffer(),
		"assets/icons/course-icon.png": png,
		"css/welcome.css": ".road-car-red { --car-art-width: 100%; }",
		"index.html": '<img src="assets/images/students-pass/1.png" alt="תמונה">',
		"js/road-photo-sources.js": "previous photo list",
		"assets/images/optimized/students-pass/oren-bachor-students-1.webp": "previous delivery",
		"assets/images/optimized/students-pass/obsolete.webp": "obsolete delivery",
		"assets/images/optimized/students-pass/z-obsolete.webp": "another obsolete delivery",
		"assets/images/optimized/favicon.png": "previous favicon",
		"favicon.ico": "previous default favicon",
	};
	for (const [file, bytes] of Object.entries(files)) {
		await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
		await writeFile(path.join(cwd, file), bytes);
	}
	const optimize = (preload) => run(process.execPath, [
		...(preload ? ["--import", `data:text/javascript,${encodeURIComponent(preload)}`] : []),
		fileURLToPath(new URL("scripts/optimize-road-media.mjs", root)),
	], { cwd });
	return { cwd, optimize };
}

// Only filesystem faults are injected; the command still encodes and publishes real files.
function filesystemFailure(setup) {
	return `
		import fs from 'node:fs/promises';
		import path from 'node:path';
		import { syncBuiltinESMExports } from 'node:module';
		${setup}
		syncBuiltinESMExports();
	`;
}

async function snapshotFiles(directory) {
	const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
		.filter((entry) => entry.isFile());
	return Object.fromEntries(await Promise.all(files.map(async (entry) => {
		const file = path.join(entry.parentPath, entry.name);
		return [path.relative(directory, file), await readFile(file)];
	})));
}

test("independent media trees keep their own photo lists without changing the working directory", async (t) => {
	const first = await publicationFixture(t);
	const second = await publicationFixture(t);
	await rm(path.join(second.cwd, "assets/images/students-pass/2.png"));
	const originalCwd = process.cwd();
	await Promise.all([optimizeRoadMedia(first.cwd), optimizeRoadMedia(second.cwd)]);
	assert.equal(process.cwd(), originalCwd);
	for (const [directory, expected] of [[first.cwd, ["1", "2"]], [second.cwd, ["1"]]]) {
		const generated = await readFile(path.join(directory, "js/road-photo-sources.js"), "utf8");
		const { roadPhotoSources } = await import(`data:text/javascript,${encodeURIComponent(generated)}`);
		assert.deepEqual(Object.keys(roadPhotoSources), expected);
	}
});

test("optimizer changes real image attributes while preserving unrelated authored bytes", async t => {
	const { cwd } = await publicationFixture(t);
	const before = [
		'<!doctype html><title>תמונות</title>',
		'<!-- <img src="assets/images/wheel.png" width="999"> -->',
		'<link data-href="leave this" href="old-icon.png" rel="icon" type="image/png">',
		'<img data-src="assets/images/wheel.png" src="assets/images/students-pass/1.png" data-width="999" width="1" data-height="888" height="1" data-srcset="keep candidates" srcset="old.webp 1w" data-sizes="keep sizes" sizes="1px" alt="תמונה">',
		'<img data-class="hero-road-car" class="gallery-car" src="assets/images/cars/car-red.png" alt="מכונית">',
		'<img src="unowned.png" data-width="keep this" width="9" alt="תמונה נוספת">',
	].join("\n");
	await writeFile(path.join(cwd, "index.html"), before);
	await optimizeRoadMedia(cwd);
	const html = await readFile(path.join(cwd, "index.html"), "utf8");
	const module = await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8");
	const { roadPhotoSources } = await import(`data:text/javascript,${encodeURIComponent(module)}`);
	const dom = new JSDOM(html);
	t.after(() => dom.window.close());
	const document = dom.window.document;
	const photo = document.querySelector("img");
	assert.equal(photo.srcset, roadPhotoSources[1].srcset);
	assert.equal(photo.sizes, roadPhotoSources[1].sizes);
	assert.equal(photo.width, 4);
	assert.equal(photo.height, 4);
	for (const [name, value] of Object.entries({
		"data-src": "assets/images/wheel.png", "data-width": "999", "data-height": "888",
		"data-srcset": "keep candidates", "data-sizes": "keep sizes",
	})) assert.equal(photo.getAttribute(name), value);
	const car = document.querySelector(".gallery-car");
	assert.equal(car.getAttribute("data-class"), "hero-road-car");
	assert.match(car.srcset, /optimized\/cars\/car-red/);
	assert.equal(document.querySelector("link").getAttribute("data-href"), "leave this");
	assert.equal(document.querySelector("link").getAttribute("href"), "assets/images/optimized/favicon.png?v=2");
	assert.ok(html.includes(before.split("\n")[1]), "commented image bytes stay unchanged");
	assert.ok(html.endsWith(before.split("\n").at(-1)), "unowned image bytes stay unchanged");
	let expected = before;
	for (const [old, updated] of [
		['href="old-icon.png"', 'href="assets/images/optimized/favicon.png?v=2"'],
		['width="1"', 'width="4"'], ['height="1"', 'height="4"'],
		['srcset="old.webp 1w"', `srcset="${roadPhotoSources[1].srcset}"`],
		['sizes="1px"', `sizes="${roadPhotoSources[1].sizes}"`],
		['alt="מכונית">', `alt="מכונית" srcset="${car.srcset}" sizes="${car.sizes}" width="4" height="4">`],
	]) expected = expected.replace(old, updated);
	assert.equal(html, expected, "only owned attribute spans and new attributes change");
	await optimizeRoadMedia(cwd);
	assert.equal(await readFile(path.join(cwd, "index.html"), "utf8"), html);
});

test("optimizer preserves single-quoted attributes, casing and values containing a closing angle", async t => {
	const { cwd } = await publicationFixture(t);
	const before = "<link HREF = 'old-icon.png' rel = 'shortcut icon' type='image/png'>\n<img ALT='תמונה > בדרך' SRC = 'assets/images/students-pass/1.png' WIDTH = '1' HEIGHT='1' SRCSET = 'old.webp 1w' SIZES='1px' />";
	await writeFile(path.join(cwd, "index.html"), before);
	await optimizeRoadMedia(cwd);
	const html = await readFile(path.join(cwd, "index.html"), "utf8");
	const dom = new JSDOM(html);
	t.after(() => dom.window.close());
	const image = dom.window.document.querySelector("img");
	assert.equal(image.width, 4);
	assert.equal(image.height, 4);
	assert.match(image.srcset, /oren-bachor-students-1/);
	assert.equal(image.getAttribute("alt"), "תמונה > בדרך");
	assert.equal(html, before
		.replace("HREF = 'old-icon.png'", "HREF = 'assets/images/optimized/favicon.png?v=2'")
		.replace("WIDTH = '1'", "WIDTH = '4'")
		.replace("HEIGHT='1'", "HEIGHT='4'")
		.replace("SRCSET = 'old.webp 1w'", `SRCSET = '${image.srcset}'`)
		.replace("SIZES='1px'", `SIZES='${image.sizes}'`));
	await optimizeRoadMedia(cwd);
	assert.equal(await readFile(path.join(cwd, "index.html"), "utf8"), html);
});

test("obsolete delivery cleanup ignores directories with image-like names", async (t) => {
	const { cwd, optimize } = await publicationFixture(t);
	const kept = path.join(cwd, "assets/images/optimized/archive.webp/notes.txt");
	await mkdir(path.dirname(kept));
	await writeFile(kept, "keep this directory");
	await optimize();
	assert.equal(await readFile(kept, "utf8"), "keep this directory");
	await assert.rejects(
		readFile(path.join(cwd, "assets/images/optimized/students-pass/obsolete.webp")),
		{ code: "ENOENT" },
	);
});

for (const failure of ["corrupt later photo", "missing later asset"]) {
	test(`optimizer preserves published files after ${failure}`, async (t) => {
		const { cwd, optimize } = await publicationFixture(t);
		if (failure === "corrupt later photo") {
			await writeFile(path.join(cwd, "assets/images/students-pass/2.png"), "invalid image");
		} else {
			await rm(path.join(cwd, "assets/images/oren.jpg"));
		}
		const before = await snapshotFiles(cwd);
		await assert.rejects(optimize(), /unsupported image format|no such file|missing/i);
		assert.deepEqual(await snapshotFiles(cwd), before);
		assert.equal((await readdir(cwd)).some((name) => name.startsWith(".road-media-")), false);
	});
}

test("a present optional source read failure preserves publication and can retry", async (t) => {
	const { cwd, optimize } = await publicationFixture(t);
	const source = "assets/images/stop-sign-red.png";
	const delivery = "assets/images/optimized/stop-sign-red.webp";
	await writeFile(path.join(cwd, source), await readFile(path.join(cwd, "assets/images/stop-sign.png")));
	await writeFile(path.join(cwd, delivery), "previous red delivery");
	const before = await snapshotFiles(cwd);
	const preload = filesystemFailure(`
		const read = fs.readFile;
		fs.readFile = async (file, ...args) => {
			if (path.resolve(file) === path.resolve('${source}'))
				throw Object.assign(new Error('injected optional source read failure'), { code: 'ENOENT' });
			return read(file, ...args);
		};
	`);
	await assert.rejects(optimize(preload), /injected optional source read failure/);
	assert.deepEqual(await snapshotFiles(cwd), before);
	assert.equal((await readdir(cwd)).some((name) => name.startsWith(".road-media-")), false);
	await optimize();
	assert.equal(inspectImage(await readFile(path.join(cwd, delivery))).format, "webp");
	assert.deepEqual(await readFile(path.join(cwd, source)), before[source]);
});

test("a genuinely absent optional source still permits media publication", async (t) => {
	const { cwd, optimize } = await publicationFixture(t);
	await assert.rejects(readFile(path.join(cwd, "assets/images/stop-sign-red.png")), { code: "ENOENT" });
	await optimize();
	assert.equal(inspectImage(await readFile(path.join(cwd, "assets/images/optimized/stop-sign.webp"))).format, "webp");
	await assert.rejects(readFile(path.join(cwd, "assets/images/optimized/stop-sign-red.webp")), { code: "ENOENT" });
});

for (const [failure, existingIcon] of [
	["installation", true],
	["installation", false],
	["obsolete-file removal", true],
]) {
	test(`optimizer rolls back ${failure}${existingIcon ? "" : " without a previous default icon"} and can retry`, async (t) => {
		const { cwd, optimize } = await publicationFixture(t);
		if (!existingIcon) await rm(path.join(cwd, "favicon.ico"));
		const before = await snapshotFiles(cwd);
		const preload = filesystemFailure(`
			const rename = fs.rename;
			let failed = false;
			fs.rename = async (source, destination) => {
				const matches = ${failure === "installation"
				? "path.resolve(destination) === path.resolve('js/road-photo-sources.js')"
				: "path.resolve(source) === path.resolve('assets/images/optimized/students-pass/z-obsolete.webp')"};
				if (!failed && matches) {
					failed = true;
					throw new Error('injected publication failure');
				}
				return rename(source, destination);
			};
		`);
		await assert.rejects(optimize(preload), /injected publication failure/);
		assert.deepEqual(await snapshotFiles(cwd), before);
		assert.equal((await readdir(cwd)).some((name) => name.startsWith(".road-media-")), false);
		await optimize();
		assert.match(await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8"), /export const roadPhotoSources/);
		await assert.rejects(readFile(path.join(cwd, "assets/images/optimized/students-pass/obsolete.webp")), { code: "ENOENT" });
	});
}

test("default ICO embeds the generated 32px PNG and follows course-icon changes", async (t) => {
	const { cwd, optimize } = await publicationFixture(t);
	let previousIcon;
	for (const background of ["#264796", "#d83243"]) {
		const original = await sharp({
			create: { width: 48, height: 48, channels: 3, background },
		}).png().toBuffer();
		await writeFile(path.join(cwd, "assets/icons/course-icon.png"), original);
		await optimize();
		const icon = await readFile(path.join(cwd, "favicon.ico"));
		const png = await readFile(path.join(cwd, "assets/images/optimized/favicon.png"));
		assert.deepEqual(icon.subarray(0, 6), Buffer.from([0, 0, 1, 0, 1, 0]), "one image in an ICO container");
		assert.equal(icon[6], 32);
		assert.equal(icon[7], 32);
		assert.equal(icon[8], 0);
		assert.equal(icon[9], 0);
		assert.equal(icon.readUInt16LE(10), 1);
		assert.equal(icon.readUInt16LE(12), 32);
		assert.equal(icon.readUInt32LE(14), png.length);
		assert.equal(icon.readUInt32LE(18), 22);
		assert.deepEqual(icon.subarray(22), png, "ICO and HTML favicon use identical PNG bytes");
		const dimensions = inspectImage(png);
		assert.equal(dimensions.width, 32);
		assert.equal(dimensions.height, 32);
		assert.deepEqual(await readFile(path.join(cwd, "assets/icons/course-icon.png")), original);
		if (previousIcon) assert.notDeepEqual(icon, previousIcon, "changing course artwork refreshes the default icon");
		previousIcon = icon;
	}
	await optimize();
	assert.deepEqual(await readFile(path.join(cwd, "favicon.ico")), previousIcon, "unchanged input regenerates identical ICO bytes");
});

test("optimizer retains recovery files when rollback itself fails", async (t) => {
	const { cwd, optimize } = await publicationFixture(t);
	const originalList = await readFile(path.join(cwd, "js/road-photo-sources.js"));
	await assert.rejects(optimize(filesystemFailure(`
		const rename = fs.rename;
		fs.rename = async (source, destination) => {
			if (path.resolve(destination) === path.resolve('js/road-photo-sources.js')) {
				throw new Error('persistent write failure');
			}
			return rename(source, destination);
		};
	`)), /Recovery files retained at/);
	const recovery = (await readdir(cwd)).filter((name) => name.startsWith(".road-media-"));
	assert.equal(recovery.length, 1);
	assert.deepEqual(
		await readFile(path.join(cwd, recovery[0], "backup/js/road-photo-sources.js")),
		originalList,
	);
});

for (const [names, expected] of [
	[["1.png", "01.png"], /01\.png: filename must be a positive number/],
	[["1.png", "2.PNG"], /2\.PNG: filename must be a positive number/],
	[[], /no numbered student photos/],
]) {
	test(`optimizer rejects invalid photo inventory before writing: ${JSON.stringify(names)}`, async (t) => {
		const cwd = await mkdtemp(
			path.join(os.tmpdir(), "invalid-photo-inventory-"),
		);
		t.after(() => rm(cwd, { recursive: true, force: true }));
		const directory = path.join(cwd, "assets/images/students-pass");
		await mkdir(directory, { recursive: true });
		await mkdir(path.join(cwd, "js"));
		await mkdir(path.join(cwd, "assets/images/optimized"));
		await mkdir(path.join(cwd, "assets/images/cars"));
		await mkdir(path.join(cwd, "assets/icons"));
		await mkdir(path.join(cwd, "css"));
		await writeFile(path.join(cwd, "css/welcome.css"), "");
		const png = await sharp({
			create: { width: 1, height: 1, channels: 3, background: "white" },
		})
			.png()
			.toBuffer();
		for (const file of [
			"assets/images/wheel.png",
			"assets/images/stop-sign.png",
			"assets/icons/course-icon.png",
		])
			await writeFile(path.join(cwd, file), png);
		for (const name of names)
			await writeFile(path.join(directory, name), png);
		const published = [
			"index.html",
			"js/road-photo-sources.js",
			"assets/images/optimized/keep.webp",
		];
		for (const file of published)
			await writeFile(path.join(cwd, file), "published content");
		await assert.rejects(
			run(
				process.execPath,
				[
					fileURLToPath(
						new URL("scripts/optimize-road-media.mjs", root),
					),
				],
				{ cwd },
			),
			expected,
		);
		for (const file of published)
			assert.equal(
				await readFile(path.join(cwd, file), "utf8"),
				"published content",
			);
		assert.deepEqual(
			await readdir(path.join(cwd, "assets/images/optimized")),
			["keep.webp"],
		);
		for (const name of names)
			assert.deepEqual(await readFile(path.join(directory, name)), png);
	});
}

test("optimizer preserves originals, discovers later photos and synchronizes responsive metadata deterministically", async (t) => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "responsive-media-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	for (const dir of [
		"assets/icons",
		"assets/images/students-pass",
		"assets/images/cars",
		"css",
		"js",
	])
		await mkdir(path.join(cwd, dir), { recursive: true });
	await writeFile(
		path.join(cwd, "css/welcome.css"),
		await readFile(new URL("css/welcome.css", root)),
	);
	const png = await sharp({
		create: {
			width: 405,
			height: 210,
			channels: 4,
			background: "#6dcdd680",
		},
	})
		.png()
		.toBuffer();
	const originals = [
		"assets/icons/course-icon.png",
		"assets/images/wheel.png",
		"assets/images/stop-sign.png",
		"assets/images/cars/car-cyan.png",
		"assets/images/cars/car-red.png",
		...Array.from(
			{ length: 27 },
			(_, index) => `assets/images/students-pass/${index + 1}.png`,
		),
	];
	for (const source of originals)
		await writeFile(path.join(cwd, source), png);
	const instructorPhoto = await sharp(png).jpeg().toBuffer();
	await writeFile(path.join(cwd, "assets/images/oren.jpg"), instructorPhoto);
	await writeFile(
		path.join(cwd, "index.html"),
		'<!doctype html><html lang="he" dir="rtl"><head><link rel="icon" href="assets/icons/course-icon.png" type="image/png"></head><body><img src="assets/images/students-pass/1.png" width="1" height="1" alt="תמונה"><img class="hero-road-car" src="assets/images/cars/car-red.png"><img class="gallery-car" src="assets/images/cars/car-red.png"></body></html>',
	);
	const optimize = () =>
		run(
			process.execPath,
			[fileURLToPath(new URL("scripts/optimize-road-media.mjs", root))],
			{ cwd },
		);
	await optimize();
	const html = await readFile(path.join(cwd, "index.html"), "utf8");
	const generated = await readFile(
		path.join(cwd, "js/road-photo-sources.js"),
		"utf8",
	);
	const { roadPhotoSources } = await import(
		`data:text/javascript,${encodeURIComponent(generated)}`
	);
	assert.equal(Object.keys(roadPhotoSources).length, 27);
	for (const source of originals)
		assert.deepEqual(await readFile(path.join(cwd, source)), png);
	assert.deepEqual(
		await readFile(path.join(cwd, "assets/images/oren.jpg")),
		instructorPhoto,
	);
	assert.deepEqual(
		Object.keys(roadPhotoSources),
		Array.from({ length: 27 }, (_, index) => String(index + 1)),
		"descriptive delivery filenames preserve numeric gallery order",
	);
	for (const [number, { srcset, originalBytes }] of Object.entries(
		roadPhotoSources,
	)) {
		assert.equal(originalBytes, png.length);
		const widths = srcset
			.split(", ")
			.map((candidate) => parseInt(candidate.split(" ")[1]));
		assert.equal(widths.at(-1), 405, "retain full source coverage");
		assert.ok(
			widths.every(
				(width, index) =>
					index === 0 || width >= widths[index - 1] * 1.05,
			),
			"avoid nearly identical responsive candidates",
		);
		for (const candidate of srcset.split(", ")) {
			const [source, width] = candidate.split(" ");
			assert.match(
				source,
				new RegExp(
					`^assets/images/optimized/students-pass/oren-bachor-students-${number}(?:-\\d+)?\\.webp$`,
				),
			);
			const metadata = inspectImage(
				await readFile(path.join(cwd, source)),
			);
			assert.equal(metadata.width, parseInt(width));
			assert.ok(
				metadata.width <= 405,
				"never enlarge the supplied source",
			);
			assert.ok(
				Math.abs(metadata.height - (metadata.width * 210) / 405) <= 1,
			);
		}
	}
	const dom = new JSDOM(html);
	t.after(() => dom.window.close());
	const image = dom.window.document.querySelector("img");
	assert.equal(image.srcset, roadPhotoSources[1].srcset);
	assert.equal(image.sizes, roadPhotoSources[1].sizes);
	assert.equal(image.width, 405);
	assert.equal(image.height, 210);
	const heroCar = dom.window.document.querySelector(".hero-road-car");
	const galleryCar = dom.window.document.querySelector(".gallery-car");
	assert.equal(heroCar.sizes, "clamp(40px, 5vw, 80px)");
	assert.match(galleryCar.sizes, /max-width: 768px/);
	assert.notEqual(
		heroCar.srcset,
		galleryCar.srcset,
		"the hero must not download gallery-sized copies",
	);
	assert.deepEqual(
		heroCar.srcset
			.split(", ")
			.map((candidate) => parseInt(candidate.split(" ")[1])),
		[80, 160],
	);
	const directory = path.join(cwd, "assets/images/optimized");
	const names = (await readdir(directory, { recursive: true })).filter(
		(name) => /\.(webp|png)$/.test(name),
	);
	const before = await Promise.all(
		names.map((name) => readFile(path.join(directory, name))),
	);
	const defaultIcon = await readFile(path.join(cwd, "favicon.ico"));
	const obsolete = [
		"1.webp",
		"1-405.webp",
		"oren-bachor-students-1-obsolete.webp",
	];
	for (const name of obsolete)
		await writeFile(
			path.join(directory, "students-pass", name),
			"old generated copy",
		);
	await optimize();
	assert.equal(await readFile(path.join(cwd, "index.html"), "utf8"), html);
	assert.equal(
		await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8"),
		generated,
	);
	assert.deepEqual(
		await Promise.all(
			names.map((name) => readFile(path.join(directory, name))),
		),
		before,
	);
	assert.deepEqual(await readFile(path.join(cwd, "favicon.ico")), defaultIcon);
	for (const name of obsolete)
		await assert.rejects(
			readFile(path.join(directory, "students-pass", name)),
			{ code: "ENOENT" },
		);
	await rm(path.join(cwd, "assets/images/students-pass/27.png"));
	await optimize();
	const reducedModule = await readFile(
		path.join(cwd, "js/road-photo-sources.js"),
		"utf8",
	);
	const reduced = await import(
		`data:text/javascript,${encodeURIComponent(reducedModule)}`
	);
	assert.equal(Object.keys(reduced.roadPhotoSources).length, 26);
	assert.equal(reduced.roadPhotoSources[27], undefined);
	assert.equal(
		(await readdir(path.join(directory, "students-pass"))).some((name) =>
			/^oren-bachor-students-27(?:-|\.)/.test(name),
		),
		false,
		"removing a source photo cleans up all of its delivery widths",
	);
	await rm(path.join(cwd, "assets/images/students-pass/2.png"));
	await assert.rejects(optimize(), /numbering gap/);
	assert.equal(
		await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8"),
		reducedModule,
		"invalid numbering must not overwrite the published list",
	);
});
