import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const expectedHashes = new Map([
	[
		"assets/images/stop-sign.png",
		"74c8b03d12564dcfbe001e9016d1b6e940abc513de21e5b706f45ea44affedc3",
	],
]);

test("road-media declarations match their files", async () => {
	const audit = await auditRoadMedia({ rootDir, htmlPath: "index.html" });
	assert.deepEqual(audit.issues, []);
	assert.ok(audit.assets.some(asset => asset.source === "assets/images/stop-sign.png"));
});

test("current road-media bytes remain unchanged", async () => {
	for (const [relativePath, expectedHash] of expectedHashes) {
		const bytes = await readFile(path.join(rootDir, relativePath));
		const actualHash = createHash("sha256").update(bytes).digest("hex");
		assert.equal(actualHash, expectedHash, relativePath);
	}
});

test("missing road media is reported while remaining images are audited", async () => {
	const temporaryRoot = await mkdtemp(
		path.join(os.tmpdir(), "road-media-integrity-"),
	);
	try {
		await writeFile(
			path.join(temporaryRoot, "index.html"),
			'<img data-road-media src="missing.jpg" width="1" height="1" alt="missing"><img data-road-media src="existing.jpg" width="2" height="2" alt="existing">',
		);
		await writeFile(path.join(temporaryRoot, "existing.jpg"), testJpeg);

		const audit = await auditRoadMedia({ rootDir: temporaryRoot });
		assert.equal(audit.assets.length, 1);
		assert.equal(audit.assets[0].source, "existing.jpg");
		assert.deepEqual(audit.issues, ["missing.jpg: file does not exist"]);
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
});

test("image metadata supports JPEG, WebP, and PNG", async () => {
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
		inspectImage(await readFile(path.join(rootDir, "assets/images/stop-sign.png"))),
		{ format: "png", mime: "image/png", width: 1254, height: 1254 },
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

async function galleryFixture(t, { photos = [1, 2, 3], sprites = ["cyan"], fallback = 1 } = {}) {
	const rootDir = await mkdtemp(path.join(os.tmpdir(), "gallery-media-"));
	t.after(() => rm(rootDir, { recursive: true, force: true }));
	await mkdir(path.join(rootDir, "assets/images/cars"), { recursive: true });
	await mkdir(path.join(rootDir, "assets/images/students-pass"), { recursive: true });
	const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
	for (const name of sprites) await writeFile(path.join(rootDir, `assets/images/cars/car-${name}.png`), png);
	for (const number of photos) await writeFile(path.join(rootDir, `assets/images/students-pass/${number}.png`), png);
	await writeFile(path.join(rootDir, "index.html"), `<div data-road-carousel><ul class="road-carousel-group"><li class="road-car road-car-cyan">
		<img data-road-media src="assets/images/cars/car-cyan.png" width="1" height="1" alt="מכונית">
		<span class="road-photo"><img src="assets/images/students-pass/${fallback}.png" width="1" height="1" alt="תמונה"></span>
	</li></ul></div>`);
	return rootDir;
}

test("gallery audit includes every numbered photo without a fixed maximum", async (t) => {
	const rootDir = await galleryFixture(t, { photos: Array.from({ length: 27 }, (_, index) => index + 1) });
	const audit = await auditRoadMedia({ rootDir });
	assert.deepEqual(audit.issues, []);
	assert.equal(audit.assets.length, 28, "one car plus all 27 unique student photos");
});

test("gallery audit reports a numbering gap even when later photos exist", async (t) => {
	const rootDir = await galleryFixture(t, { photos: [1, 3, 4] });
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(audit.issues.some(issue => issue.includes("2.png") && issue.includes("numbering gap")));
	assert.ok(audit.assets.some(asset => asset.source.endsWith("/4.png")), "continue inspecting beyond the gap");
});

test("gallery audit owns palette checks and ignores the composite source artwork", async (t) => {
	const rootDir = await galleryFixture(t, { sprites: ["cyan", "red"] });
	await writeFile(path.join(rootDir, "assets/images/cars/cars.png"), "source artwork");
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(audit.issues.some(issue => issue.includes("car-red.png") && issue.includes("template")));
	assert.ok(audit.issues.every(issue => !issue.includes("cars.png")));
});

test("gallery audit reports missing sprites, broken photos and fallback metadata together", async (t) => {
	const rootDir = await galleryFixture(t, { sprites: [], photos: [1, 2], fallback: 3 });
	await writeFile(path.join(rootDir, "assets/images/students-pass/2.png"), "broken image");
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(audit.issues.some(issue => issue.includes("car-cyan.png") && issue.includes("file does not exist")));
	assert.ok(audit.issues.some(issue => issue.includes("3.png") && issue.includes("file does not exist")));
	assert.ok(audit.issues.some(issue => issue.includes("2.png") && issue.includes("unsupported image format")));
});

test("gallery audit checks fallback dimensions, order and canonical photo names", async (t) => {
	const rootDir = await galleryFixture(t, { photos: [1, 2, "03"], fallback: 2 });
	const htmlPath = path.join(rootDir, "index.html");
	const html = await readFile(htmlPath, "utf8");
	await writeFile(htmlPath, html.replace('2.png" width="1"', '2.png" width="9"'));
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(audit.issues.some(issue => issue.includes("2.png") && issue.includes("declared 9x1")));
	assert.ok(audit.issues.some(issue => issue.includes("fallback") && issue.includes("1.png")));
	assert.ok(audit.issues.some(issue => issue.includes("03.png") && issue.includes("filename")));
});

test("gallery audit rejects duplicate and non-sprite templates", async (t) => {
	const rootDir = await galleryFixture(t);
	const htmlPath = path.join(rootDir, "index.html");
	const html = await readFile(htmlPath, "utf8");
	await writeFile(htmlPath, html.replace('</ul>', '<li class="road-car"><img src="assets/images/cars/car-cyan.png" width="1" height="1" alt="מכונית"></li><li class="road-car"><img src="assets/images/students-pass/1.png" width="1" height="1" alt="תמונה"></li></ul>'));
	const audit = await auditRoadMedia({ rootDir });
	assert.ok(audit.issues.some(issue => issue.includes("duplicate carousel template")));
	assert.ok(audit.issues.some(issue => issue.includes("not an available car sprite")));
	assert.ok(audit.issues.some(issue => issue.includes("exactly one fallback photo")));
});

for (const mutation of ["move car outside group", "remove group", "wrap car in another element"]) {
	test(`gallery audit rejects runtime template mismatch: ${mutation}`, async (t) => {
		const rootDir = await galleryFixture(t);
		const htmlPath = path.join(rootDir, "index.html");
		const dom = new JSDOM(await readFile(htmlPath, "utf8"));
		t.after(() => dom.window.close());
		const document = dom.window.document;
		const gallery = document.querySelector("[data-road-carousel]");
		const group = gallery.querySelector(".road-carousel-group");
		if (mutation === "move car outside group") gallery.append(group.firstElementChild);
		if (mutation === "remove group") group.replaceWith(...group.children);
		if (mutation === "wrap car in another element") {
			const wrapper = document.createElement("li");
			wrapper.append(group.firstElementChild);
			group.append(wrapper);
		}
		await writeFile(htmlPath, document.documentElement.outerHTML);
		const audit = await auditRoadMedia({ rootDir });
		assert.ok(audit.issues.length > 0, "invalid runtime templates must fail the audit");
	});
}
