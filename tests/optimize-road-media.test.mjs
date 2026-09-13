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

test("optimizer preserves originals, discovers later photos and synchronizes responsive metadata deterministically", async (t) => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "responsive-media-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	for (const dir of ["assets/icons", "assets/images/students-pass", "assets/images/cars", "css", "js"])
		await mkdir(path.join(cwd, dir), { recursive: true });
	await writeFile(path.join(cwd, "css/welcome.css"), await readFile(new URL("css/welcome.css", root)));
	const png = await sharp({ create: { width: 320, height: 210, channels: 4, background: "#6dcdd680" } }).png().toBuffer();
	const originals = [
		"assets/icons/course-icon.png", "assets/images/wheel.png", "assets/images/stop-sign.png",
		"assets/images/cars/car-cyan.png",
		...Array.from({ length: 27 }, (_, index) => `assets/images/students-pass/${index + 1}.png`),
	];
	for (const source of originals) await writeFile(path.join(cwd, source), png);
	await writeFile(path.join(cwd, "index.html"), '<!doctype html><html lang="he" dir="rtl"><head><link rel="icon" href="assets/icons/course-icon.png" type="image/png"></head><body><img src="assets/images/students-pass/1.png" width="1" height="1" alt="תמונה"></body></html>');
	const optimize = () => run(process.execPath, [fileURLToPath(new URL("scripts/optimize-road-media.mjs", root))], { cwd });
	await optimize();
	const html = await readFile(path.join(cwd, "index.html"), "utf8");
	const generated = await readFile(path.join(cwd, "js/road-photo-sources.js"), "utf8");
	const { roadPhotoSources } = await import(`data:text/javascript,${encodeURIComponent(generated)}`);
	assert.equal(Object.keys(roadPhotoSources).length, 27);
	for (const source of originals) assert.deepEqual(await readFile(path.join(cwd, source)), png);
	for (const { srcset, originalBytes } of Object.values(roadPhotoSources)) {
		assert.equal(originalBytes, png.length);
		for (const candidate of srcset.split(", ")) {
			const [source, width] = candidate.split(" ");
			const metadata = inspectImage(await readFile(path.join(cwd, source)));
			assert.equal(metadata.width, parseInt(width));
			assert.ok(metadata.width <= 320, "never enlarge the supplied source");
			assert.ok(Math.abs(metadata.height - metadata.width * 210 / 320) <= 1);
		}
	}
	const dom = new JSDOM(html);
	t.after(() => dom.window.close());
	const image = dom.window.document.querySelector("img");
	assert.equal(image.srcset, roadPhotoSources[1].srcset);
	assert.equal(image.sizes, roadPhotoSources[1].sizes);
	assert.equal(image.width, 320);
	assert.equal(image.height, 210);
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
