import { readdir } from "node:fs/promises";
import path from "node:path";

// Both maintenance commands use these findings: generation stops on issues,
// while the audit continues inspecting valid photos and other road media.
export async function discoverStudentPhotos(rootDir) {
	const directory = "assets/images/students-pass";
	const issues = [];
	const names = [];
	let entries = [];
	try {
		entries = await readdir(path.join(rootDir, directory), { withFileTypes: true });
	} catch (error) {
		issues.push(`${directory}: ${error.code === "ENOENT" ? "directory does not exist" : error.message}`);
	}
	for (const entry of entries) {
		if (!entry.isFile() || !/\.png$/i.test(entry.name)) continue;
		if (!/^[1-9]\d*\.png$/.test(entry.name)) {
			issues.push(`${directory}/${entry.name}: filename must be a positive number followed by .png`);
		} else names.push(entry.name);
	}
	names.sort((a, b) => parseInt(a) - parseInt(b));
	let expected = 1;
	for (const name of names) {
		const number = parseInt(name);
		if (number !== expected)
			issues.push(`${directory}/${expected}.png: numbering gap before ${name}`);
		expected = number + 1;
	}
	if (names.length === 0) issues.push(`${directory}: no numbered student photos`);
	return { directory, names, issues };
}
