import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";

import {
	auditRoadMedia,
	inspectImage,
} from "../scripts/road-media-integrity.mjs";

const rootDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const testJpeg = Buffer.from(
	"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
	"base64",
);
test("road-media declarations match their files", async () => {
	const audit = await auditRoadMedia({ rootDir, htmlPath: "index.html" });
	assert.deepEqual(audit.issues, []);
	assert.ok(
		audit.assets.some(
			(asset) => asset.source === "assets/images/stop-sign.png",
		),
	);
});

test("image metadata supports JPEG, WebP, and PNG", () => {
	const webp = Buffer.alloc(30);
	webp.write("RIFF", 0);
	webp.writeUInt32LE(22, 4);
	webp.write("WEBP", 8);
	webp.write("VP8X", 12);
	webp[20] = 0x20;
	webp[24] = 99;
	webp[27] = 49;

	assert.deepEqual(inspectImage(testJpeg), {
		format: "jpeg",
		mime: "image/jpeg",
		width: 2,
		height: 2,
	});
	assert.deepEqual(inspectImage(webp), {
		format: "webp",
		mime: "image/webp",
		width: 100,
		height: 50,
	});
	assert.deepEqual(
		inspectImage(
			Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
		),
		{ format: "png", mime: "image/png", width: 1, height: 1 },
	);
});

test("corrupt and unsupported images become issues while later images are audited", async () => {
	const temporaryRoot = await mkdtemp(
		path.join(os.tmpdir(), "road-media-integrity-"),
	);
	try {
		await writeFile(
			path.join(temporaryRoot, "index.html"),
			[
				'<link rel="preload" as="image" href="metadata.jpg?cache=1" type="image/webp">',
				'<img data-road-media src="missing.jpg" width="1" height="1" alt="missing">',
				'<img data-road-media src="corrupt.jpg" width="1" height="1" alt="corrupt">',
				'<img data-road-media src="unsupported.jpg" width="1" height="1" alt="unsupported">',
				'<img data-road-media src="metadata.jpg?rev=1" width="1" height="1" alt="metadata">',
				'<img data-road-media src="valid.jpg" width="2" height="2" alt="valid">',
			].join(""),
		);
		await writeFile(
			path.join(temporaryRoot, "corrupt.jpg"),
			Buffer.from([0xff, 0xd8, 0xff]),
		);
		// A complete 1x1 GIF is readable metadata, but outside the road-media format policy.
		await writeFile(
			path.join(temporaryRoot, "unsupported.jpg"),
			Buffer.from(
				"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
				"base64",
			),
		);
		await writeFile(path.join(temporaryRoot, "metadata.jpg"), testJpeg);
		await writeFile(path.join(temporaryRoot, "valid.jpg"), testJpeg);

		const audit = await auditRoadMedia({ rootDir: temporaryRoot });
		assert.deepEqual(
			audit.assets.map(({ source }) => source),
			["metadata.jpg", "valid.jpg"],
		);
		assert.deepEqual(audit.issues, [
			"missing.jpg: file does not exist",
			"corrupt.jpg: image metadata could not be read",
			"unsupported.jpg: unsupported image format",
			"metadata.jpg: declared 1x1, file is 2x2",
			"metadata.jpg: preload type is image/webp, expected image/jpeg",
		]);
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
});

async function galleryFixture(
	t,
	{ photos = [1, 2, 3], sprites = ["cyan"], fallback = 1 } = {},
) {
	const rootDir = await mkdtemp(path.join(os.tmpdir(), "gallery-media-"));
	t.after(() => rm(rootDir, { recursive: true, force: true }));
	await mkdir(path.join(rootDir, "assets/images/cars"), { recursive: true });
	await mkdir(path.join(rootDir, "assets/images/students-pass"), {
		recursive: true,
	});
	const png = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
		"base64",
	);
	for (const name of sprites)
		await writeFile(
			path.join(rootDir, `assets/images/cars/car-${name}.png`),
			png,
		);
	for (const number of photos)
		await writeFile(
			path.join(rootDir, `assets/images/students-pass/${number}.png`),
			png,
		);
	await mkdir(path.join(rootDir, "js"));
	await writeFile(path.join(rootDir, "js/road-photo-sources.js"),
		`export const roadPhotoSources = ${JSON.stringify(Object.fromEntries(photos.map(number => [number, { originalBytes: png.length }])))};\n`);
	await writeFile(
		path.join(rootDir, "index.html"),
		`<div data-road-carousel><ul class="road-carousel-group"><li class="road-car road-car-cyan">
		<img data-road-media src="assets/images/cars/car-cyan.png" width="1" height="1" alt="מכונית">
		<span class="road-photo"><img src="assets/images/students-pass/${fallback}.png" width="1" height="1" alt="תמונה"></span>
	</li></ul></div>`,
	);
	return rootDir;
}

test("gallery audit includes every numbered photo without a fixed maximum", async (t) => {
	const rootDir = await galleryFixture(t, {
		photos: Array.from({ length: 27 }, (_, index) => index + 1),
	});
	const audit = await auditRoadMedia({ rootDir });
	assert.deepEqual(audit.issues, []);
	assert.equal(
		audit.assets.length,
		28,
		"one car plus all 27 unique student photos",
	);
});

test("gallery audit collects invalid names and multiple gaps while inspecting later photos", async (t) => {
	const rootDir = await galleryFixture(t, { photos: [1, 3, 12] });
	const directory = path.join(rootDir, "assets/images/students-pass");
	await writeFile(path.join(directory, "01.png"), "invalid name");
	await writeFile(path.join(directory, "2.PNG"), "invalid name");
	await writeFile(path.join(directory, "notes.txt"), "not a photo");
	await mkdir(path.join(directory, "2.png"));
	const audit = await auditRoadMedia({ rootDir });
	assert.equal(audit.issues.length, 4);
	for (const name of ["01.png", "2.PNG"])
		assert.ok(audit.issues.some(issue => issue.includes(name) && issue.includes("filename")));
	for (const name of ["2.png", "4.png"])
		assert.ok(audit.issues.some(issue => issue.includes(name) && issue.includes("numbering gap")));
	assert.deepEqual(audit.assets.filter(asset => asset.source.includes("students-pass"))
		.map(asset => path.basename(asset.source)), ["1.png", "3.png", "12.png"]);
});

for (const missing of [false, true]) {
	test(`gallery audit continues after an ${missing ? "absent" : "empty"} photo directory`, async (t) => {
		const rootDir = await galleryFixture(t, { photos: [] });
		if (missing) await rm(path.join(rootDir, "assets/images/students-pass"), { recursive: true });
		const audit = await auditRoadMedia({ rootDir });
		assert.ok(audit.issues.some(issue => issue.includes("no numbered student photos")));
		assert.equal(audit.issues.some(issue => issue.includes("directory does not exist")), missing);
		assert.ok(audit.assets.some(asset => asset.source.endsWith("car-cyan.png")));
	});
}

test("gallery audit owns palette checks and ignores the composite source artwork", async (t) => {
	const rootDir = await galleryFixture(t, { sprites: ["cyan", "red"] });
	await writeFile(
		path.join(rootDir, "assets/images/cars/cars.png"),
		"source artwork",
	);
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(
		audit.issues.some(
			(issue) => issue.includes("car-red.png") && issue.includes("template"),
		),
	);
	assert.ok(audit.issues.every((issue) => !issue.includes("cars.png")));
});

test("gallery audit reports missing sprites, broken photos and fallback metadata together", async (t) => {
	const rootDir = await galleryFixture(t, {
		sprites: [],
		photos: [1, 2],
		fallback: 3,
	});
	await writeFile(
		path.join(rootDir, "assets/images/students-pass/2.png"),
		"broken image",
	);
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(
		audit.issues.some(
			(issue) =>
				issue.includes("car-cyan.png") && issue.includes("file does not exist"),
		),
	);
	assert.ok(
		audit.issues.some(
			(issue) =>
				issue.includes("3.png") && issue.includes("file does not exist"),
		),
	);
	assert.ok(
		audit.issues.some(
			(issue) =>
				issue.includes("2.png") && issue.includes("unsupported image format"),
		),
	);
});

test("gallery audit checks fallback dimensions, order and canonical photo names", async (t) => {
	const rootDir = await galleryFixture(t, {
		photos: [1, 2, "03"],
		fallback: 2,
	});
	const htmlPath = path.join(rootDir, "index.html");
	const html = await readFile(htmlPath, "utf8");
	await writeFile(
		htmlPath,
		html.replace('2.png" width="1"', '2.png" width="9"'),
	);
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(
		audit.issues.some(
			(issue) => issue.includes("2.png") && issue.includes("declared 9x1"),
		),
	);
	assert.ok(
		audit.issues.some(
			(issue) => issue.includes("fallback") && issue.includes("1.png"),
		),
	);
	assert.ok(
		audit.issues.some(
			(issue) => issue.includes("03.png") && issue.includes("filename"),
		),
	);
});

test("gallery audit rejects duplicate and non-sprite templates", async (t) => {
	const rootDir = await galleryFixture(t);
	const htmlPath = path.join(rootDir, "index.html");
	const html = await readFile(htmlPath, "utf8");
	await writeFile(
		htmlPath,
		html.replace(
			"</ul>",
			'<li class="road-car"><img src="assets/images/cars/car-cyan.png" width="1" height="1" alt="מכונית"></li><li class="road-car"><img src="assets/images/students-pass/1.png" width="1" height="1" alt="תמונה"></li></ul>',
		),
	);
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(
		audit.issues.some((issue) => issue.includes("duplicate carousel template")),
	);
	assert.ok(
		audit.issues.some((issue) => issue.includes("not an available car sprite")),
	);
	assert.ok(
		audit.issues.some((issue) => issue.includes("exactly one fallback photo")),
	);
});

for (const mutation of [
	"move car outside group",
	"remove group",
	"wrap car in another element",
]) {
	test(`gallery audit rejects runtime template mismatch: ${mutation}`, async (t) => {
		const rootDir = await galleryFixture(t);
		const htmlPath = path.join(rootDir, "index.html");
		const dom = new JSDOM(await readFile(htmlPath, "utf8"));
		t.after(() => dom.window.close());
		const document = dom.window.document;
		const gallery = document.querySelector("[data-road-carousel]");
		const group = gallery.querySelector(".road-carousel-group");
		if (mutation === "move car outside group")
			gallery.append(group.firstElementChild);
		if (mutation === "remove group") group.replaceWith(...group.children);
		if (mutation === "wrap car in another element") {
			const wrapper = document.createElement("li");
			wrapper.append(group.firstElementChild);
			group.append(wrapper);
		}
		await writeFile(htmlPath, document.documentElement.outerHTML);
		const audit = await auditRoadMedia({ rootDir });
		assert.ok(
			audit.issues.length > 0,
			"invalid runtime templates must fail the audit",
		);
	});
}

test("delivery images declared in srcset are audited", async (t) => {
	const rootDir = await galleryFixture(t);
	const htmlPath = path.join(rootDir, "index.html");
	const html = await readFile(htmlPath, "utf8");
	await writeFile(
		htmlPath,
		html.replace(
			'src="assets/images/students-pass/1.png"',
			'src="assets/images/students-pass/1.png" srcset="assets/images/optimized/students-pass/1.webp"',
		),
	);
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(
		audit.issues.some(
			(issue) =>
				issue.includes("optimized/students-pass/1.webp") &&
				issue.includes("file does not exist"),
		),
	);
});

test("responsive width descriptors must match the actual delivery file", async (t) => {
	const rootDir = await galleryFixture(t);
	const htmlPath = path.join(rootDir, "index.html");
	const html = await readFile(htmlPath, "utf8");
	await writeFile(htmlPath, html.replace(
		'src="assets/images/students-pass/1.png"',
		'src="assets/images/students-pass/1.png" srcset="assets/images/students-pass/1.png 240w" sizes="240px"',
	));
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(audit.issues.some(issue => issue.includes("240w") && issue.includes("1px")));
});

for (const change of ["added photo", "removed photo", "replaced photo", "missing list"]) {
	test(`gallery audit catches a stale generated photo list: ${change}`, async (t) => {
		const rootDir = await galleryFixture(t);
		const photo = path.join(rootDir, "assets/images/students-pass/3.png");
		if (change === "added photo")
			await writeFile(path.join(rootDir, "assets/images/students-pass/4.png"), await readFile(photo));
		if (change === "removed photo") await rm(photo);
		if (change === "replaced photo")
			await writeFile(photo, Buffer.concat([await readFile(photo), Buffer.from("changed")]));
		if (change === "missing list") await rm(path.join(rootDir, "js/road-photo-sources.js"));
		const audit = await auditRoadMedia({ rootDir });
		assert.ok(audit.issues.some(issue => issue.includes("road-photo-sources.js") && issue.includes("npm run optimize:media")));
	});
}

for (const problem of ["missing file", "wrong width", "valid candidate"]) {
	test(`generated-only delivery candidates are audited: ${problem}`, async (t) => {
		const rootDir = await galleryFixture(t);
		const listPath = path.join(rootDir, "js/road-photo-sources.js");
		const module = await readFile(listPath, "utf8");
		const sources = JSON.parse(module.match(/= (\{[\s\S]*\});/)[1]);
		const source = problem === "missing file" ? "missing-delivery.png" : "assets/images/students-pass/3.png";
		sources[3].srcset = `${source} ${problem === "wrong width" ? 240 : 1}w`;
		await writeFile(listPath, `export const roadPhotoSources = ${JSON.stringify(sources)};\n`);
		const audit = await auditRoadMedia({ rootDir });
		if (problem === "valid candidate") assert.deepEqual(audit.issues, []);
		else assert.ok(audit.issues.some(issue => issue.includes(source) &&
			issue.includes(problem === "missing file" ? "file does not exist" : "1px")));
	});
}
