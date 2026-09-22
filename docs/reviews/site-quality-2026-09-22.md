# Site quality review - 2026-09-22

## Scope

This review covers the current public experience:

- Welcome page: `/`
- Course library: `/course/`
- Representative reading page: `/course/right-of-way/`
- Representative practice quiz: `/course/right-of-way/quizzes/left-turn/`

The checks used local Playwright Chromium. They covered 1440px desktop, 390px phone, 320px narrow phone, reduced motion, JavaScript enabled, JavaScript disabled, and a blocked entry module through the existing progressive-enhancement tests. Additional device-scale checks used 640 and 320 CSS-pixel viewports at a device scale factor of 2 as reflow proxies for enlarged browser content.

This was not a screen-reader audit and does not establish accessibility conformance. The collaborative browser could not be resized reliably, so the visual checks used local Chromium screenshots.

## Findings and changes

### Fixed: reduced-motion skip link still moved

The welcome-page skip link retained a nonzero transform transition when `prefers-reduced-motion: reduce` was active. The universal reduced-motion rule shortened it to 0.01ms, but Chromium could still defer the focused position until an animation frame. Immediately after keyboard focus, the link's bounding box was still above the viewport. The shared reduced-motion rules now remove that transition, so the link is visible in its final position as soon as it receives focus.

`tests/browser/site-quality-browser.test.mjs` reproduces the old off-screen state and checks the fixed behavior.

### Reflow and zoom

The four representative pages had no horizontal document overflow at 1440px, 390px, or 320px with JavaScript enabled or disabled. The same pages also fit 640 and 320 CSS-pixel viewports at device scale factor 2. Full-page screenshots showed readable RTL order, wrapping controls, and no clipped content in the inspected states.

The radio inputs are 18px, but each input sits inside a full-width label with a minimum height of 52px. Other enabled controls inspected in the rendered flows met the 44px minimum target dimension.

### Keyboard and semantics

Keyboard traversal exposed the skip links, header controls, navigation, library disclosures or tabs, lesson contents links, quiz selector, answer labels, and quiz navigation in the expected reading order. Focus indicators remained visible in the inspected states. The existing focused browser suites also verify sticky-header offsets, keyboard topic selection, menu disclosure, quiz listbox navigation, and focused answer styling.

DOM inspection found one `h1` on each representative page, expected heading nesting, main landmarks, and no unlabeled enabled form controls in the rendered states. This is structural evidence only. Accessible names and announcements still need a real screen reader check.

### Reduced motion

With reduced motion active, the welcome page had no running hero, road-car, or gallery animations after load. The course library, reading page, and quiz also had no running animations in their initial states. Existing tests cover live changes to reduced motion while disclosures and topic updates are active.

### JavaScript fallback

Navigation and authored topic descriptions remained visible with JavaScript disabled. Reading pages continued to use native anchors, and all quiz questions remained available when the quiz module was disabled or blocked. Existing browser tests cover both disabled and blocked module states.

## Local resource baseline

These measurements came from `python3 -m http.server` on loopback and Playwright `PerformanceResourceTiming`. `bodyBytes` sums `encodedBodySize` for the navigation and all resources present at `networkidle`. The local server does not compress responses, so these are uncompressed body bytes. They are not production transfer sizes. GitHub Pages compression and caching are documented separately in `README.md`.

| Case | Requests | Uncompressed body bytes |
| --- | ---: | ---: |
| Welcome, 1440px, JavaScript | 29 | 258,353 |
| Welcome, 390px, JavaScript | 25 | 169,407 |
| Welcome, 390px, no JavaScript | 33 | 263,651 |
| Library, 390px | 10 | 82,223 |
| Reading page, 390px | 9 | 71,705 |
| Quiz, 390px | 13 | 96,266 |

The larger no-JavaScript welcome-page result comes from the six authored gallery fallback entries. They are required for the baseline student gallery. The JavaScript path progressively loads a smaller initial visible set. No external requests or demonstrably redundant initial resource were found, so this review did not change asset compression, preloads, or module boundaries.

Run the measurement again from the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

In a second terminal:

```bash
node --input-type=module <<'EOF'
import { chromium } from "playwright";

const cases = [
	["home-desktop", "/", 1440, true],
	["home-mobile", "/", 390, true],
	["home-mobile-no-js", "/", 390, false],
	["library-mobile", "/course/", 390, true],
	["lesson-mobile", "/course/right-of-way/", 390, true],
	[
		"quiz-mobile",
		"/course/right-of-way/quizzes/left-turn/",
		390,
		true,
	],
];
const browser = await chromium.launch();

for (const [name, path, width, javaScriptEnabled] of cases) {
	const page = await browser.newPage({
		viewport: { width, height: 900 },
		javaScriptEnabled,
		reducedMotion: "reduce",
	});
	await page.goto(`http://127.0.0.1:4173${path}`, {
		waitUntil: "networkidle",
	});
	const result = await page.evaluate((caseName) => {
		const entries = [
			...performance.getEntriesByType("navigation"),
			...performance.getEntriesByType("resource"),
		];
		return {
			name: caseName,
			requests: entries.length,
			bodyBytes: entries.reduce(
				(total, entry) => total + entry.encodedBodySize,
				0,
			),
		};
	}, name);
	console.log(result);
	await page.close();
}

await browser.close();
EOF
```

## Remaining manual checks and limits

- Run VoiceOver or NVDA through the mobile menu, library search and disclosures, quiz selector, answer status, and quiz result announcement.
- Check Windows forced-colors mode and browser text-only enlargement. The automated reflow checks cover narrow effective widths, but they do not reproduce every browser's text zoom behavior.
- Recheck on physical iOS and Android devices for browser chrome, virtual keyboard, and safe-area behavior.
- The current design intentionally hides the visual document scrollbar, and an existing browser test preserves that behavior. Reconsidering it needs a design decision and an update to that shared contract.
- The performance figures do not include production compression, latency, cache reuse, CPU cost, Core Web Vitals, or assistive-technology overhead.
