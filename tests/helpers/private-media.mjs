import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createPrivateMedia } from "../../server/private-media.mjs";
import { startLessonGateway } from "./test-lessons.mjs";
import { testSectionPath, testSections } from "../fixtures/test-sections.mjs";

export const syntheticTranscript = 'תמלול סינתטי לבדיקה.\n<script>window.privateTranscriptRan = true</script>\n<img src="x" onerror="window.privateTranscriptRan = true">';

export async function privateMediaReader(t, { width = 390, reducedMotion = "reduce", transcript = Buffer.from(syntheticTranscript), forcedColors = "none", quiz = false, quizCount = 3 } = {}) {
	const root = await mkdtemp(path.join(tmpdir(), "oren-private-media-browser-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const browser = await chromium.launch();
	t.after(() => browser.close());
	const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion, forcedColors, hasTouch: width <= 390 });
	page.setDefaultTimeout(8000);
	// Generate a playable, silent synthetic WebM using Chromium's native encoder.
	// Nothing is copied from supplied media or written into static website assets.
	const recording = await page.evaluate(async () => {
		const canvas = document.createElement("canvas");
		canvas.width = 320; canvas.height = 180;
		const context = canvas.getContext("2d");
		const stream = canvas.captureStream(10);
		const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
		const chunks = [];
		recorder.ondataavailable = event => chunks.push(event.data);
		const stopped = new Promise(resolve => { recorder.onstop = resolve; });
		recorder.start();
		for (let frame = 0; frame < 4; frame++) {
			context.fillStyle = frame % 2 ? "#264796" : "#edf1fa";
			context.fillRect(0, 0, canvas.width, canvas.height);
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		recorder.stop();
		await stopped;
		stream.getTracks().forEach(track => track.stop());
		return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
	});
	await writeFile(path.join(root, "video.webm"), Buffer.from(recording));
	await writeFile(path.join(root, "captions.vtt"), "WEBVTT\n\n00:00.000 --> 00:01.000\nכתוביות סינתטיות לבדיקה.\n");
	await writeFile(path.join(root, "transcript.txt"), transcript);
	let media = await createPrivateMedia({ root, entries: [] });
	const app = await startLessonGateway({ quiz, quizCount, media: {
		lookup: (...args) => media.lookup(...args), forSection: (...args) => media.forSection(...args), send: (...args) => media.send(...args),
	} });
	t.after(app.close);
	const email = `private-media-${width}@example.test`;
	await page.goto(app.origin + "/account/login.html");
	await page.getByLabel("כתובת אימייל").fill(email);
	await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
	await page.getByRole("button", { name: "כניסה לחשבון", exact: true }).click();
	await page.waitForURL(app.origin + "/account/");
	await app.grant(email);
	const data = await (await page.request.get(app.origin + testSectionPath("paid"))).json();
	const common = { sectionId: testSections.paid, contentVersionId: data.lesson.id };
	media = await createPrivateMedia({ root, entries: [
		{ ...common, id: "video", file: "video.webm", type: "video/webm", title: "סרטון סינתטי לבדיקה",
			captions: [{ id: "captions-he", language: "he", label: "עברית" }], transcript: { id: "transcript-he", language: "he", label: "תמלול בעברית" } },
		{ ...common, id: "captions-he", file: "captions.vtt", type: "text/vtt", title: "כתוביות לבדיקה" },
		{ ...common, id: "transcript-he", file: "transcript.txt", type: "text/plain; charset=utf-8", title: "תמלול לבדיקה" },
	] });
	const open = async () => {
		await page.goto(`${app.origin}/account/reader.html?section=${testSections.paid}&access=paid`);
		await page.locator("[data-reading]").waitFor();
	};
	return { app, page, email, open, summary: page.getByText("תמלול הסרטון", { exact: true }), transcript: page.locator(".reading-transcript-text") };
}

