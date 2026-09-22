import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditSiteLinks } from "../../scripts/site-links.mjs";

async function fixture(t, files) {
	const rootDir = await mkdtemp(path.join(os.tmpdir(), "site-links-"));
	t.after(() => rm(rootDir, { recursive: true, force: true }));
	for (const [name, contents] of Object.entries(files)) {
		await mkdir(path.dirname(path.join(rootDir, name)), { recursive: true });
		await writeFile(path.join(rootDir, name), contents);
	}
	return rootDir;
}

test("site links resolve files, directory pages, queries and fragments without network access", async (t) => {
	const rootDir = await fixture(t, {
		"index.html": `
			<main id="home">
				<a href="#home">בית</a>
				<a href="course/?view=all#topic">נושא</a>
				<a href="/llms.txt?download=1">מידע</a>
				<link rel="stylesheet" href="css/site.css?v=2">
				<script src="js/site.js#module"></script>
				<img src="assets/icon.svg" srcset="assets/not-a-link-check.svg 2x">
				<a href="https://example.com/missing">חיצוני</a>
				<a href="mailto:teacher@example.com">דואר</a>
			</main>`,
		"course/index.html": '<h1 id="topic">נושא</h1><a href="../?from=course#home">בית</a>',
		"llms.txt": "Course overview",
		"css/site.css": "body {}",
		"js/site.js": "export {};",
		"assets/icon.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
	});

	const audit = await auditSiteLinks({ rootDir });

	assert.deepEqual(audit.pages, ["course/index.html", "index.html"]);
	assert.equal(audit.issues.length, 0, audit.issues.join("\n"));
	assert.equal(audit.links.length, 7);
});

test("site links support a configured deployment prefix for absolute and relative URLs", async (t) => {
	const rootDir = await fixture(t, {
		"index.html": '<a href="/preview/course/#topic">נושא</a>',
		"course/index.html": '<h1 id="topic">נושא</h1><script src="../../preview/js/site.js"></script>',
		"js/site.js": "export {};",
	});

	const audit = await auditSiteLinks({
		rootDir,
		deploymentPrefix: "/preview/",
	});

	assert.deepEqual(audit.issues, []);
});

test("site links resolve .htm directories and named anchors using the shared file identity", async (t) => {
	const rootDir = await fixture(t, {
		"index.html": '<a href="lesson/#old">ישן</a><a href="lesson">שיעור</a><a href="both/#html">ראשי</a><a href="both/index.htm#htm">חלופי</a>',
		"lesson/index.htm": '<a name="old"></a>',
		"both/index.html": '<h1 id="html">ראשי</h1>',
		"both/index.htm": '<h1 id="htm">חלופי</h1>',
	});
	const audit = await auditSiteLinks({ rootDir });
	assert.deepEqual(audit.issues, []);
	assert.deepEqual(audit.links.map((link) => link.target), [
		"lesson/index.htm", "lesson/index.htm", "both/index.html", "both/index.htm",
	]);
});

test("site links reject absolute and relative references that escape a configured deployment prefix", async (t) => {
	const rootDir = await fixture(t, {
		"index.html": `
			<a href="/course/#topic">נושא מחוץ לאתר</a>
			<a href="../course/#topic">נושא דרך נתיב יחסי</a>`,
		"course/index.html": '<h1 id="topic">נושא</h1>',
	});

	const { issues } = await auditSiteLinks({
		rootDir,
		deploymentPrefix: "/preview/",
	});

	assert.deepEqual(issues, [
		"index.html: href '/course/#topic' escapes deployment prefix '/preview/'",
		"index.html: href '../course/#topic' escapes deployment prefix '/preview/'",
	]);
});

test("site links report missing files, missing fragments and invalid local references with page context", async (t) => {
	const rootDir = await fixture(t, {
		"index.html": `
			<a href="missing.html?from=home#section">חסר</a>
			<a href="course/#missing">עוגן חסר</a>
			<script src=""></script>
			<a href="bad%ZZ.html">כתובת פגומה</a>`,
		"course/index.html": '<h1 id="present">נושא</h1>',
	});

	const { issues } = await auditSiteLinks({ rootDir });

	assert.deepEqual(issues, [
		"index.html: href 'missing.html?from=home#section' targets missing file 'missing.html'",
		"index.html: href 'course/#missing' targets missing fragment '#missing' in 'course/index.html'",
		"index.html: src is empty",
		"index.html: href 'bad%ZZ.html' is not a valid local reference",
	]);
});

test("the authored site has no broken local href, src or fragment targets", async () => {
	const audit = await auditSiteLinks({ rootDir: process.cwd() });
	assert.deepEqual(audit.issues, [], audit.issues.join("\n"));
});
