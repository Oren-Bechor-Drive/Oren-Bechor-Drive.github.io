# Course architecture

The site serves checked-in HTML, CSS and JavaScript directly. Development tools inspect those files; no content generator, runtime registry, framework or build step is required to serve them.

## Learning content

The course library links to independently authored learning pages. Each learning section owns a stable anchor, a declared heading, explanations and video placeholders. A section either links to its own practice-quiz page or declares `data-lesson-format="reading"` and has no quiz link. These states are mutually exclusive. Each quiz owns its title, questions and return links. `course/js/quiz.js` enhances that HTML with question navigation and answer review; the baseline stays usable when JavaScript is unavailable.

`scripts/learning-content.mjs` owns development-time interpretation through `readLearningContent(rootDir)`. It uses `scripts/site-pages.mjs` to discover root and nested HTML and returns plain `lessons`, `quizzes` and `issues`, not live DOM elements. It closes the documents after reading them. Section titles follow `aria-labelledby`, and the same interpreted relationships feed structural checks and browser journeys. Directory URLs resolve to their `index.html`, including quiz return links with lesson anchors. Returned file paths always name the actual HTML file.

The module reports malformed headings, anchors, contents links, lesson formats, quiz destinations, titles, return links and radio groups with their file and section/question location. Reading-only sections reject quiz links, and quiz sections still require exactly one local destination. It also catches unlinked quiz files. Invalid authored content produces diagnostics rather than a browser-test registration error caused by dereferencing a missing element.

Tests at this interface use real temporary HTML files, including invalid reading-only and quiz relationships. Browser checks continue exercising every actual quiz with JavaScript enabled, disabled and blocked. Generic interaction scenarios follow question order and discovered counts; controlled one-question and five-question fixtures prove arbitrary IDs and video placement. The four current forms carry `data-quiz-placeholder`, which opts them into separate assertions for the approved 20-question/four-choice layout. This marker does not control runtime behavior or imply a grading system.

Keep interpretation in this module when new content needs more checks. Do not add a parallel subject registry or repeat the same heading/link interpretation in test callers. Content editing instructions live in [README](../README.md#add-learning-sections-and-quizzes).

`course/js/course-library.js` owns the enhanced learning-topic disclosures. Its internal disclosure lifecycle keeps exclusive opening, animation reversal, height cleanup and mobile tap-position preservation together. Filtering and fragment navigation use its small intent-level interface; keyboard, viewport, pointer and reduced-motion interruptions remain inside the lifecycle so callers do not coordinate animation and scroll state. Browser tests exercise this module through the course library DOM, including JavaScript-disabled and blocked-module fallbacks.

## Media verification

`scripts/road-media-integrity.mjs` owns discovery and checks behind `auditSiteMedia({ rootDir })`. The command `npm run check:media` uses that interface and returns page-specific findings. Its `pages` list describes inspected HTML; each returned asset includes `htmlPath`. A file reused by several pages is counted once per page, so the summary is image references rather than unique files.

The focused `auditRoadMedia({ rootDir, htmlPath })` remains available for tests of one page. Both interfaces inspect ordinary image sources, image and picture candidates, image preloads and responsive preload candidates. Local JPEG, WebP and PNG headers must match their extensions and declared responsive widths. Ordinary SVGs must parse as SVG XML. Scaled ordinary images do not need width/height attributes equal to file dimensions. Marked road media and student-gallery images retain their stricter original-dimension, alternative-text, template and numbered-photo checks.

`scripts/site-pages.mjs` owns discovery for both the media audit and learning verification. Discovery includes root and nested `.html`/`.htm` files. It excludes hidden entries, symlinks and these directories: `assets`, `css`, `js`, `docs`, `scripts`, `tools`, `tests`, `test`, `fixtures`, `node_modules`, `vendor`, `coverage`, `dist`, and `build`. Put learner-facing pages outside these directories. Both consumers inspect the same authored pages without maintaining separate directory rules.

External and embedded image URLs are skipped without network requests. CSS image URLs, video sources, full image decoding, rendered cropping and browser candidate selection remain outside this audit. Playwright delivery tests cover the actual browser behavior. The optimizer continues to own image generation and the generated student photo list; this audit does not rewrite content or assets.

## Student gallery

`initRoadCarousel(root, photoSources)` receives the complete student photo list for that initialization. Both numeric enumeration and optimized-delivery selection use this supplied list. The module owns loading, decoding, fallback, ordered publication and motion continuity together.

`js/script.js` is the production composition point. It lazily imports the gallery module and `js/road-photo-sources.js` together near the viewport, then supplies the generated list. Test fixtures supply owned frozen lists with frozen metadata. They do not mutate or restore the generated module. Independent galleries can therefore exercise different list sizes in the same test without shared fixture state.

The list is read-only for the initialization's lifetime. It retains the existing consecutive numeric keys and responsive metadata generated by the media optimizer. Image generation and photo publishing instructions remain in [README](../README.md#add-or-update-student-photos).

## Why these seams

- Multiple structural and browser-test consumers justify one learning-content interpretation module; a selector-only helper would leave the duplicate knowledge in callers.
- The growing set of authored pages justifies one site-wide media command; callers should not each decide which pages count.
- Generated and fixture photo lists are two real adapters at the gallery seam; a forwarding module or a new loading framework would add no useful depth.

These changes preserve separate static quiz content and the small runtime interaction modules. The shared profile control remains disabled until profile behavior exists. For product scope, see [PRODUCT](../PRODUCT.md); for terms, see [CONTEXT](../CONTEXT.md); for visual requirements, see [DESIGN](../DESIGN.md).
