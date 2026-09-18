import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import * as media from "../../scripts/road-media-integrity.mjs";

const png = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
	"base64",
);

async function fixture(t, files) {
	const rootDir = await mkdtemp(path.join(os.tmpdir(), "site-media-"));
	t.after(() => rm(rootDir, { recursive: true, force: true }));
	for (const [name, contents] of Object.entries(files)) {
		await mkdir(path.dirname(path.join(rootDir, name)), {
			recursive: true,
		});
		await writeFile(path.join(rootDir, name), contents);
	}
	return rootDir;
}

test("ordinary image sources and responsive candidates are audited on a focused page", async (t) => {
	const rootDir = await fixture(t, {
		"index.html":
			'<img src="missing.png" srcset="also-missing.png 1w, pixel.png 9w"><picture><source srcset="missing-picture.png 2x"><img src="pixel.png" width="42" height="42"></picture>',
		"pixel.png": png,
	});
	const audit = await media.auditRoadMedia({ rootDir });
	assert.deepEqual(audit.issues, [
		"missing.png: file does not exist",
		"also-missing.png: file does not exist",
		"pixel.png: srcset declares 9w, file is 1px wide",
		"missing-picture.png: file does not exist",
	]);
});

test("image preloads audit responsive candidates and optional declared MIME", async (t) => {
	const rootDir = await fixture(t, {
		"index.html":
			'<link rel="preload" as="image" href="pixel.png" imagesrcset="missing.png 1w, pixel.png 3w"><link rel="preload" as="image" imagesrcset="pixel.png 1w">',
		"pixel.png": png,
	});
	const audit = await media.auditRoadMedia({ rootDir });
	assert.deepEqual(audit.issues, [
		"missing.png: file does not exist",
		"pixel.png: srcset declares 3w, file is 1px wide",
	]);
});

test("ordinary SVGs require valid SVG XML while scaled raster sizes are allowed", async (t) => {
	const rootDir = await fixture(t, {
		"index.html":
			'<img src="pixel.png" width="42" height="42"><img src="icon.svg" width="24" height="24"><img src="wrong.svg"><img src="broken.svg">',
		"pixel.png": png,
		"icon.svg":
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 0"/></svg>',
		"wrong.svg": '<html xmlns="http://www.w3.org/1999/xhtml"/>',
		"broken.svg": '<svg xmlns="http://www.w3.org/2000/svg">',
	});
	const audit = await media.auditRoadMedia({ rootDir });
	assert.equal(audit.assets.length, 2);
	assert.equal(audit.issues.length, 2);
	assert.ok(
		audit.issues.some(
			(issue) => issue.startsWith("wrong.svg:") && issue.includes("SVG"),
		),
	);
	assert.ok(
		audit.issues.some(
			(issue) => issue.startsWith("broken.svg:") && issue.includes("SVG"),
		),
	);
});

test("site audit discovers authored pages and identifies the page for every finding", async (t) => {
	assert.equal(
		typeof media.auditSiteMedia,
		"function",
		"site-wide audit must be available",
	);
	const rootDir = await fixture(t, {
		"index.html": '<img src="shared.png" width="42" height="42">',
		"course.html": '<img src="course-missing.png">',
		"lessons/lesson.html":
			'<img src="../shared.png?rev=2#image"><img src="/shared.png"><img src="local.png"><link rel="preload" as="image" href="missing-preload.png" type="image/png">',
		"shared.png": png,
		"lessons/local.png": png,
		".superpowers/screen.html": '<img src="missing.png">',
		"tests/fixtures/page.html": '<img src="missing.png">',
		"node_modules/library/index.html": '<img src="missing.png">',
		"scripts/report.html": '<img src="missing.png">',
		"assets/source.html": '<img src="missing.png">',
		"docs/reference/example.html": '<img src="missing.png">',
	});
	const audit = await media.auditSiteMedia({ rootDir });
	assert.deepEqual(audit.pages, [
		"course.html",
		"index.html",
		"lessons/lesson.html",
	]);
	assert.deepEqual(audit.issues, [
		"course.html: course-missing.png: file does not exist",
		"lessons/lesson.html: missing-preload.png: file does not exist",
	]);
	assert.ok(
		audit.assets.some(
			(asset) =>
				asset.htmlPath === "index.html" &&
				asset.source === "shared.png",
		),
	);
	assert.ok(
		audit.assets.some(
			(asset) =>
				asset.htmlPath === "lessons/lesson.html" &&
				asset.source === "local.png",
		),
	);
});

test("ordinary external and embedded references are skipped without fetching", async (t) => {
	const rootDir = await fixture(t, {
		"index.html":
			'<img src="https://example.invalid/image.png"><img src="//example.invalid/image.png"><img src="data:image/png;base64,AAAA" srcset="data:image/png;base64,AAAA 1x, local.png 2x"><img src="image%20name.png">',
		"local.png": png,
		"image name.png": png,
	});
	const audit = await media.auditRoadMedia({ rootDir });
	assert.deepEqual(audit.issues, []);
	assert.equal(audit.assets.length, 2);
});

test("responsive-only preload MIME declarations are checked against their candidates", async (t) => {
	const rootDir = await fixture(t, {
		"index.html":
			'<link rel="preload" as="image" imagesrcset="pixel.png 1w" type="image/webp">',
		"pixel.png": png,
	});
	const audit = await media.auditRoadMedia({ rootDir });
	assert.deepEqual(audit.issues, [
		"pixel.png: preload type is image/webp, expected image/png",
	]);
});

for (const [name, srcset] of [
	["empty", ""],
	["whitespace", " \t "],
	["commas", " , ,, \t,"],
]) {
	for (const element of ["image", "preload"]) {
		test(`${element} without a source rejects ${name} responsive candidates`, async (t) => {
			const rootDir = await fixture(t, {
				"index.html":
					element === "image"
						? `<img srcset="${srcset}">`
						: `<link rel="preload" as="image" imagesrcset="${srcset}">`,
			});
			const audit = await media.auditRoadMedia({ rootDir });
			assert.ok(
				audit.issues.some((issue) => issue.includes("source is empty")),
			);
		});
	}
}

test("srcset-only external and embedded candidates remain exempt from local inspection", async (t) => {
	const rootDir = await fixture(t, {
		"index.html": [
			'<img srcset="https://example.invalid/image.png 1x">',
			'<img srcset="data:image/png;base64,AAAA 1x">',
			'<link rel="preload" as="image" imagesrcset="//example.invalid/image.png 1x">',
			'<link rel="preload" as="image" imagesrcset="data:image/png;base64,AAAA 1x">',
		].join(""),
	});
	const audit = await media.auditRoadMedia({ rootDir });
	assert.deepEqual(audit.issues, []);
});

test("marked images still require an original source alongside delivery candidates", async (t) => {
	const rootDir = await fixture(t, {
		"index.html":
			'<img data-road-media srcset="pixel.png 1w" width="1" height="1" alt="image">',
		"pixel.png": png,
	});
	const audit = await media.auditRoadMedia({ rootDir });
	assert.ok(audit.issues.some((issue) => issue.includes("source is empty")));
});

test("media CLI fails on a broken ordinary image outside the welcome page", async (t) => {
	const rootDir = await fixture(t, {
		"index.html": "<!doctype html><title>Home</title>",
		"quiz.html": '<img src="missing.png">',
	});
	const script = fileURLToPath(
		new URL("../../scripts/road-media-integrity.mjs", import.meta.url),
	);
	await assert.rejects(
		promisify(execFile)(process.execPath, [script], { cwd: rootDir }),
		(error) => {
			assert.equal(error.code, 1);
			assert.match(
				error.stderr,
				/quiz\.html: missing\.png: file does not exist/,
			);
			return true;
		},
	);
});
