import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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
	assert.equal(audit.assets.length, 1);
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
