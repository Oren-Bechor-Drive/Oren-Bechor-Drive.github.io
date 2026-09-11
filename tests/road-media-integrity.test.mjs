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
const expectedHashes = new Map([
	[
		"assets/images/learning-road.jpg",
		"bcb8095abd13e0f730ee6bc7977c8422d405d9367836dabd8d1d6095d43bb73f",
	],
	[
		"assets/images/source-road-000.jpg",
		"692d892f7ac25af2a99ce24cd083bad11c8daad4092ef6a35888e3197d863cfb",
	],
	[
		"assets/images/source-road-001.jpg",
		"804377c8a085a12e70a93b8523725bc6dbe43b3be92a2d67036ae7508e6e3e91",
	],
]);

test("road-media declarations match their files", async () => {
	const audit = await auditRoadMedia({ rootDir, htmlPath: "index.html" });
	assert.deepEqual(audit.issues, []);
	assert.equal(audit.assets.length, 3);
});

test("replacement photo bytes remain unchanged", async () => {
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
			'<img data-road-media src="missing.jpg" width="1" height="1" alt="missing"><img data-road-media src="existing.jpg" width="843" height="692" alt="existing">',
		);
		await writeFile(
			path.join(temporaryRoot, "existing.jpg"),
			await readFile(
				path.join(rootDir, "assets/images/source-road-000.jpg"),
			),
		);

		const audit = await auditRoadMedia({ rootDir: temporaryRoot });
		assert.equal(audit.assets.length, 1);
		assert.equal(audit.assets[0].source, "existing.jpg");
		assert.deepEqual(audit.issues, ["missing.jpg: file does not exist"]);
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
});

test("image metadata supports JPEG and WebP", async () => {
	const jpeg = await readFile(
		path.join(rootDir, "assets/images/source-road-000.jpg"),
	);
	const webp = Buffer.alloc(30);
	webp.write("RIFF", 0);
	webp.writeUInt32LE(22, 4);
	webp.write("WEBP", 8);
	webp.write("VP8X", 12);
	webp[20] = 0x20;
	webp[24] = 99;
	webp[27] = 49;

	assert.deepEqual(inspectImage(jpeg), {
		format: "jpeg",
		mime: "image/jpeg",
		width: 843,
		height: 692,
	});
	assert.deepEqual(inspectImage(webp), {
		format: "webp",
		mime: "image/webp",
		width: 100,
		height: 50,
	});
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
				'<img data-road-media src="valid.jpg" width="843" height="692" alt="valid">',
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
		await writeFile(
			path.join(temporaryRoot, "metadata.jpg"),
			await readFile(
				path.join(rootDir, "assets/images/source-road-000.jpg"),
			),
		);
		await writeFile(
			path.join(temporaryRoot, "valid.jpg"),
			await readFile(
				path.join(rootDir, "assets/images/source-road-000.jpg"),
			),
		);

		const audit = await auditRoadMedia({ rootDir: temporaryRoot });
		assert.deepEqual(
			audit.assets.map(({ source }) => source),
			["metadata.jpg", "valid.jpg"],
		);
		assert.deepEqual(audit.issues, [
			"missing.jpg: file does not exist",
			"corrupt.jpg: image metadata could not be read",
			"unsupported.jpg: unsupported image format",
			"metadata.jpg: declared 1x1, file is 843x692",
			"metadata.jpg: preload type is image/webp, expected image/jpeg",
		]);
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
});
