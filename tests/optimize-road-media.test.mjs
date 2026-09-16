import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { inspectImage } from "../scripts/road-media-integrity.mjs";

const run = promisify(execFile);
const root = new URL("../", import.meta.url);

for (const [names, expected] of [
	[["1.png", "01.png"], /01\.png: filename must be a positive number/],
	[["1.png", "2.PNG"], /2\.PNG: filename must be a positive number/],
	[[], /no numbered student photos/],
]) {
	test(`optimizer rejects invalid photo inventory before writing: ${JSON.stringify(names)}`, async (t) => {
		const cwd = await mkdtemp(path.join(os.tmpdir(), "invalid-photo-inventory-"));
		t.after(() => rm(cwd, { recursive: true, force: true }));
		const directory = path.join(cwd, "assets/images/students-pass");
		await mkdir(directory, { recursive: true });
		await mkdir(path.join(cwd, "js"));
		await mkdir(path.join(cwd, "assets/images/optimized"));
		await mkdir(path.join(cwd, "assets/images/cars"));
		await mkdir(path.join(cwd, "assets/icons"));
		await mkdir(path.join(cwd, "css"));
		await writeFile(path.join(cwd, "css/welcome.css"), "");
		const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
		for (const file of ["assets/images/wheel.png", "assets/images/stop-sign.png", "assets/icons/course-icon.png"])
			await writeFile(path.join(cwd, file), png);
		for (const name of names) await writeFile(path.join(directory, name), png);
		const published = ["index.html", "js/road-photo-sources.js", "assets/images/optimized/keep.webp"];
		for (const file of published) await writeFile(path.join(cwd, file), "published content");
		await assert.rejects(
			run(process.execPath, [fileURLToPath(new URL("scripts/optimize-road-media.mjs", root))], { cwd }),
			expected,
		);
		for (const file of published)
			assert.equal(await readFile(path.join(cwd, file), "utf8"), "published content");
		assert.deepEqual(await readdir(path.join(cwd, "assets/images/optimized")), ["keep.webp"]);
		for (const name of names) assert.deepEqual(await readFile(path.join(directory, name)), png);
	});
}

test("optimizer preserves originals, discovers later photos and synchronizes responsive metadata deterministically", async (t) => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "responsive-media-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	for (const dir of ["assets/icons", "assets/images/students-pass", "assets/images/cars", "css", "js"])
		await mkdir(path.join(cwd, dir), { recursive: true });
	await writeFile(path.join(cwd, "css/welcome.css"), await readFile(new URL("css/welcome.css", root)));
	const png = await sharp({ create: { width: 405, height: 210, channels: 4, background: "#6dcdd680" } }).png().toBuffer();
	const originals = [
		"assets/icons/course-icon.png", "assets/images/wheel.png", "assets/images/stop-sign.png",
		"assets/images/cars/car-cyan.png", "assets/images/cars/car-red.png",
		...Array.from({ length: 27 }, (_, index) => `assets/images/students-pass/${index + 1}.png`),
	];
	for (const source of originals) await writeFile(path.join(cwd, source), png);
	const instructorPhoto = await sharp(png).jpeg().toBuffer();
	await writeFile(path.join(cwd, "assets/images/oren.jpg"), instructorPhoto);
	await writeFile(path.join(cwd, "index.html"), '<!doctype html><html lang="he" dir="rtl"><head><link rel="icon" href="assets/icons/course-icon.png" type="image/png"></head><body><img src="assets/images/students-pass/1.png" width="1" height="1" alt="תמונה"><img class="hero-road-car" src="assets/images/cars/car-red.png"><img class="gallery-car" src="assets/images/cars/car-red.png"></body></html>');
	const optimize = () => run(process.execPath, [fileURLToPath(new URL("scripts/optimize-road-media.mjs", root))], { cwd });
	await optimize();
	const html = await readFile(path.join(cwd, "index.html"), "utf8");
	const generated = await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8");
	const { roadPhotoSources } = await import(`data:text/javascript,${encodeURIComponent(generated)}`);
	assert.equal(Object.keys(roadPhotoSources).length, 27);
	for (const source of originals) assert.deepEqual(await readFile(path.join(cwd, source)), png);
	assert.deepEqual(await readFile(path.join(cwd, "assets/images/oren.jpg")), instructorPhoto);
	for (const { srcset, originalBytes } of Object.values(roadPhotoSources)) {
		assert.equal(originalBytes, png.length);
		const widths = srcset.split(", ").map(candidate => parseInt(candidate.split(" ")[1]));
		assert.equal(widths.at(-1), 405, "retain full source coverage");
		assert.ok(widths.every((width, index) => index === 0 || width >= widths[index - 1] * 1.05),
			"avoid nearly identical responsive candidates");
		for (const candidate of srcset.split(", ")) {
			const [source, width] = candidate.split(" ");
			const metadata = inspectImage(await readFile(path.join(cwd, source)));
			assert.equal(metadata.width, parseInt(width));
			assert.ok(metadata.width <= 405, "never enlarge the supplied source");
			assert.ok(Math.abs(metadata.height - metadata.width * 210 / 405) <= 1);
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
	assert.notEqual(heroCar.srcset, galleryCar.srcset, "the hero must not download gallery-sized copies");
	assert.deepEqual(heroCar.srcset.split(", ").map(candidate => parseInt(candidate.split(" ")[1])), [80, 160]);
	const directory = path.join(cwd, "assets/images/optimized");
	const names = (await readdir(directory, { recursive: true })).filter(name => /\.(webp|png)$/.test(name));
	const before = await Promise.all(names.map(name => readFile(path.join(directory, name))));
	await writeFile(path.join(directory, "students-pass/1-obsolete.webp"), "old generated copy");
	await optimize();
	assert.equal(await readFile(path.join(cwd, "index.html"), "utf8"), html);
	assert.equal(await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8"), generated);
	assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(directory, name)))), before);
	await assert.rejects(readFile(path.join(directory, "students-pass/1-obsolete.webp")), { code: "ENOENT" });
	await rm(path.join(cwd, "assets/images/students-pass/27.png"));
	await optimize();
	const reducedModule = await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8");
	const reduced = await import(`data:text/javascript,${encodeURIComponent(reducedModule)}`);
	assert.equal(Object.keys(reduced.roadPhotoSources).length, 26);
	assert.equal(reduced.roadPhotoSources[27], undefined);
	await assert.rejects(readFile(path.join(directory, "students-pass/27.webp")), { code: "ENOENT" });
	await rm(path.join(cwd, "assets/images/students-pass/2.png"));
	await assert.rejects(optimize(), /numbering gap/);
	assert.equal(await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8"), reducedModule,
		"invalid numbering must not overwrite the published list");
});
