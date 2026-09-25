# Driving course website

This repository contains the public welcome page with its FAQ, a static 404 recovery page, and the course-library preview for Oren Bachor's Hebrew driving course. The welcome page introduces the course. The preview adds independently accessible reading sections and scored public practice quizzes; it remains marked noindex.

The hero fills the available viewport below the navigation with the course promise, two actions, and the stop sign. The student-photo road carousel now sits below the compact instructor introduction; together they fit one viewport below the sticky header on typical laptop and phone screens. On mobile, the instructor content stacks in reading order: title, image, then one description. The blue stop-sign illustration appears above the hero copy. Shorter screens and enlarged text can extend the hero naturally.

## Current page flow

The page moves through the hero, instructor introduction with its student-photo road carousel, one combined section with the three learning steps and learning-topic preview, the FAQ at `#faq`, and a closing first-lesson action before the footer. Under `#about`, the course has one heading, three introductory paragraphs, a compact learning-step strip, and the complete topic explorer. The paragraphs explain the audience, topics and examples, and how to review material alongside practical driving lessons. Desktop and mobile navigation link to the instructor, course, and FAQ. Section links align their destination immediately below the sticky header, or at the viewport top when the mobile fallback header scrolls with the page.

The hero's main action, "מנחה הקורס", leads to the instructor; its secondary action leads to the unified course section at `#about`. The course-start controls in the topbar and closing section are disabled buttons labeled "הלמידה עדיין אינה זמינה" until a real course URL is supplied. The published static preview has no course playback or enrollment flow. Local account screens and their gateway are described below.

Without JavaScript, or if the entry module fails to load, mobile navigation links remain visible in a header in normal document flow. Successful initialization enables the sticky header and collapsible menu. All seven topic descriptions are readable in the baseline HTML; initialization uses those descriptions for the interactive preview and hides the static summaries.

On mobile, pointer and touch input open the navigation and learning-topic list with a 180ms transition and close them over 150ms. Their trigger buttons provide subtle press feedback. Keyboard and assistive activation remain immediate. Closing menus stop accepting input as soon as they close, while CSS finishes the exit; rapid toggles reverse the transition. Reduced motion uses short opacity fades without movement. Browsers without discrete display transitions show and hide the menus immediately. `js/disclosure-motion.js` shares input handling and visibility state between these two controls.

Topic previews update immediately for keyboard and assistive activation. Pointer and touch selections animate the changing title and description while the explanatory note stays still. Reselecting the active topic does nothing. Reduced motion is read live and settles a pending topic change when enabled.

The instructor and unified course section reveal once on scroll. Focus immediately settles the containing section, and printing exposes all content even before it has been scrolled into view.

The footer centers its social row and contact-status note at desktop and mobile sizes. It shows Instagram, TikTok, YouTube, and WhatsApp as unavailable, noninteractive items, with a visible Hebrew note that contact and social links will be added later. Their four SVG icons are served locally from `assets/icons/social/`, with the upstream Font Awesome license and provenance alongside them. The page makes no requests to an external icon kit.

## Repository and publishing

The page folders follow the learning flow. Each page has its own `index.html`, so ordinary static hosting serves directory URLs:

```text
index.html
404.html                       Domain-root recovery page for missing URLs
account/                       Hebrew account screens, CSS and browser behavior
server/                        Local Node session gateway, never public runtime assets
course/
  index.html
  css/                         Shared course, lesson and quiz styles
  js/                          Library search and quiz interaction
  <topic>/
    index.html                 Reading sections and one topic quiz link
    quiz/index.html            Topic practice quiz with an authored question count
  priority-hierarchy/quizzes/priority/index.html
  right-of-way/quizzes/        Former quiz URLs with links to their replacement
css/                           Site-wide base and homepage styles
js/                            Homepage enhancements and generated photo list
assets/                        Shared images, fonts and icons
scripts/                       Maintenance and verification tools
tests/
  unit/                        Node checks
  browser/                     Playwright browser journeys
  helpers/                     Shared test utilities
docs/                          Architecture, supplied references and plans
```

Open the homepage FAQ at `/#faq`, the library at `/course/`, a reading page at `/course/<topic>/`, and quizzes at `/course/<topic>/quiz/`. Ordinary learning pages keep links and assets relative so the same files can also be served under a directory prefix. Account API calls and gateway redirects assume domain-root deployment. `404.html` is the exception: GitHub Pages can return it at any missing nested URL, so it uses domain-root paths for its assets and recovery links. The current organization site is published at the domain root. Any host or path-prefix migration must update and retest those 404 references.

The repository is [Oren-Bechor-Drive/Oren-Bechor-Drive.github.io](https://github.com/Oren-Bechor-Drive/Oren-Bechor-Drive.github.io), owned by the `Oren-Bechor-Drive` organization. The public site is [https://oren-bechor-drive.github.io/](https://oren-bechor-drive.github.io/).

GitHub Pages publishes from the root of `main`, using the "Deploy from a branch" source in the repository's Pages settings. The repository name matches the organization account's `<owner>.github.io` name, so the site is served at the domain root with no repository path prefix. See [GitHub's site types](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#types-of-github-pages-sites). Keep asset paths and the manifest's `start_url` relative.

For an existing clone that still points to the previous repository, update its remote:

```bash
git remote set-url origin https://github.com/Oren-Bechor-Drive/Oren-Bechor-Drive.github.io.git
git remote -v
```

## Open locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

No installation or build step is required.

### Homepage FAQ and missing-page recovery

The homepage FAQ at `#faq` sits immediately before `#start`. It uses five native `details` and `summary` rows for the former help page's first five questions: the audience, the relationship to practical lessons, free topic order, videos, and practice quizzes. The navigation links to the section at desktop and mobile sizes. The rows remain usable without JavaScript.

The FAQ uses the requested completed-course marketing copy for its video and practice-quiz answers. Course pages remain `noindex`. The reading pages still reserve 16 videos and 12 image/diagram slots. Public practice quizzes now contain real theory-bank questions, local diagrams, scoring and answer review. Enrollment remains disabled and public quiz results are not saved to an account.

`404.html` is a noindex recovery page for arbitrary missing paths. It contains one centered error message and two recovery actions for the welcome page and course library. A large yellow ring contains the centered 404 text. The page has no header, footer, topic preview, canonical URL, or JavaScript, and it stays out of the sitemap.

### Course library preview

Open `/course/` to review the approved open subject-library layout. Its ten learning topics include the welcome page's seven topics, learning foundations, a separate priority-hierarchy topic, and new-driver, licensing and penalty-points information. Searchable descriptions and expandable outlines cover the subjects in `docs/reference/the-idea.pdf`. The [PDF coverage map](docs/reference/course-topic-coverage.md) distinguishes developed teaching material from subjects listed only in the contents. All topics can be opened independently, and search matches outline text and common topic synonyms. No viewed/completed progress or accounts are implied.

This is a course preview, marked `noindex` and omitted from the public sitemap. Every developed teaching topic in the supplied PDF now has a reading page. Right-of-way and turns covers left, right and U-turns plus meeting on narrow, steep roads; priority hierarchy is a separate topic. Foundations now includes definitions and a recap, and licensing explains ordinary new-driver and accompaniment requirements. The [2026-09-25 source review](docs/reference/israeli-lesson-sources-2026-09-25.md) records the evidence and its limits. `course/css/lesson.css` supplies the shared reading layout, and native contents links work without JavaScript. PDF provenance labels remain in maintenance documentation, while the licensing page preserves the official government resources supplied as PDF annotations. Oren's review of the edited teaching copy remains a release prerequisite. The [official theory-question research](docs/reference/theory-question-bank-2026-09-25.md) led to the [published question review](docs/reference/theory-quiz-review-2026-09-25.md). All 118 initial questions and 22 additions are assigned once across the ten topics. Outdated wording is corrected in explicitly labelled adaptations, with original wording and sources retained. Lesson adaptations preserve the source scenarios while avoiding blanket claims about pedestrian priority, fixed steering amounts and priority that depend on the actual road arrangement. Videos remain outstanding, and enrollment controls remain unavailable.

Each sub-subject has its own white section. Reserve video for movement, timing and developing hazards, images or diagrams for recognition and road layouts, and no media for sufficient text explanations or repeated summaries. Reading lessons retain 16 video and 12 image/diagram placeholders. Each topic links to its own `/course/<topic>/quiz/`. The public quizzes contain 140 distinct questions, each assigned to one primary topic, with counts based on coverage rather than a fixed quota. Every question has four choices, a correct answer and a course-authored explanation. Image questions use the original Ministry diagrams hosted locally.

`course/js/quiz.js` reads the authored fieldsets and supplies question selection, previous/next navigation, complete-answer validation, scoring, locked answer review and a fresh-attempt action. Missing answers announce Hebrew feedback and focus the first unanswered question. Results show correct answers out of the actual count and a rounded percentage, without a pass/fail designation or paid-course completion. Without JavaScript, all questions and native answer disclosures remain available for self-checking. This public practice does not save account progress or change protected-learning grading.

The library, learning pages and practice-quiz pages use a clickable home brand and a disabled profile fallback on static hosting. The configured local gateway enables a link to login or the signed-in account page. At 900px and above, the enhanced library has a stable topic list on the right and a reading panel on the left. The list is a vertical tablist with Up/Down, Home/End and Tab support. Selection highlights a row and reads the title, description and outline from baseline HTML. Filtering chooses a matching outline when needed and hides the panel for empty results.

Below 900px, or without JavaScript, topics appear as compact expandable rows. Baseline HTML shares the native `details` name `course-topics`, allowing one open topic at a time in supporting browsers. After enhancement, JavaScript manages exclusivity and animates each complete card's height when opening or closing. Keyboard and reduced-motion interactions settle immediately. Viewport changes carry the selected topic and keyboard focus into the other presentation. The browsing order runs from foundations through road decisions to test preparation and licensing, without prerequisites. Search is an optional enhancement. `course/css/course.css` extends the existing tokens, and `course/js/course-library.js` builds the desktop view from the baseline HTML. No generated images or new dependencies are needed.

The learning page's contents links use native smooth scrolling, scoped to `html.lesson-page`. Sub-subject sections are not programmatically focusable, so navigating to them does not focus or outline the whole reading section. Reduced motion uses immediate scrolling. Fragment URLs, keyboard links, and navigation with JavaScript disabled retain their native behavior.

The preview is served with the same command above. On the tailnet, use `http://<tailscale-ip>:8000/course/`. Its browser tests cover desktop and phone sizes, search and recovery, fragment navigation, keyboard topic selection, and disabled or blocked JavaScript.

For a preview over an already configured Tailscale connection, keep this server running and use `http://<tailscale-ip>:8000/` from another device on the same tailnet. Find the address with `tailscale ip -4` and check the connection with `tailscale status`. On Linux, start a stopped daemon with `sudo systemctl start tailscaled`, then connect with `tailscale up`. This is a development preview; the public canonical URL remains the GitHub Pages address.

### Add learning sections and quizzes

Keep teaching content in static HTML so it remains usable without JavaScript. Create each learning page at `course/<topic>/index.html` with `.lesson-content` and link to its directory from `course/index.html` with `.subject-learn`. Keep learner pages in their topic directories. The required root-level `404.html` is reserved for GitHub Pages recovery behavior.

1. Give each `.lesson-section` a unique, stable `id` and an `aria-labelledby` pointing to its heading. Add a matching `.lesson-contents` anchor. Keep the ID when changing a heading so bookmarks still work.
2. Give `.lesson-content` a stable `id="topic"` and `aria-labelledby="topic-title"`; give the page's `<h1>` that title ID. Create one quiz at `course/<topic>/quiz/index.html`. Set its `<title>` and `<h1>` to `שאלון: <topic title>` and both `[data-lesson-link]` destinations to `../#topic`. Add exactly one `.lesson-quiz-link` to the topic, outside the individual `.lesson-section` elements, pointing to `quiz/`. Sections keep their reading anchors but have no separate quiz ownership or `data-lesson-format` attribute. The verifier rejects missing, duplicate and section-level quiz links.
3. Edit that quiz's `.quiz-question` fieldsets, legends, referenced prompts, any scenario-specific media, and radio labels. Choose text, an image or a video from the actual question scenario; do not assign videos by question number. Keep unique question IDs, a distinct radio-group name per question, and unique choice values within the group. Keep loading `course/js/quiz.js`; no new subject registration or JavaScript change is needed. Scored forms use `data-quiz-graded`; each question declares `data-correct-answer` matching a choice value and includes native `details[data-quiz-feedback]` with a summary, the correct answer and `[data-quiz-explanation]`. Keep the public theory source ID in `data-source-question`. Placeholder fixtures remain ungraded.
4. Run `npm test`, `npm run check:media` when adding pages, image declarations or preloads, and `git diff --check`. `scripts/learning-content.mjs` discovers nested learning pages through `scripts/site-pages.mjs` and interprets their relationships once for structural and browser checks. Directory links and explicit `index.html` links resolve to the same authored page; malformed relationships retain file-specific diagnostics. Tests exercise every valid quiz with JavaScript enabled, disabled and blocked. Interaction checks use discovered question counts and video positions; the separate 20-question/four-choice assertions apply to forms marked `data-quiz-placeholder`.

The four former section quiz URLs remain noindex transition pages with native links to their topic quiz and original reading section. Keep them usable for bookmarks; do not duplicate quiz forms there. The older shared `quiz.html?subject=...` preview is no longer used.

The enhanced quiz allows navigation before every question is answered, but finishing requires a selection in every fieldset. Missing answers produce Hebrew feedback and focus the first unanswered question. The static fallback presents all questions and return links. Graded public practice reports the score, locks the submitted answers for review and lets the learner start a fresh attempt. These official public-bank questions and keys are intentionally public. Private paid content and its answer keys still require protected server publication.

### Maintain public theory quizzes

The maintenance source is `docs/reference/theory-quiz-content.json`; each question has exactly one `topicId`. It retains source identity, answer order, explanations and any documented adaptations. `docs/reference/theory-media.json` maps source image URLs to inspected local originals, dimensions, alt text and hashes. The original candidate collection is historical evidence, not a second publication source.

After reviewing a content change, run `node scripts/publish-theory-quizzes.mjs`. It updates the ten checked-in quiz pages and lesson question counts. Run `node scripts/publish-theory-quizzes.mjs --check` to detect drift without writing. Both modes validate source provenance, original media and every required authored region, then check all prepared learning pages before publication. Missing or duplicate regions fail with their file names; reordering HTML attributes does not bypass verification. The publisher preserves bytes outside its owned regions. Tests exercise the same `publishTheoryQuizzes(rootDir, { check })` operation on disposable copies without changing the working directory. This is a maintenance step, not a build required to serve the site. Run `npm test`, `npm run check:links`, `npm run check:media` and `git diff --check` before publication. The publication test checks that every initial question is retained once, each selected question belongs to its assigned topic, and its text, choices, answer key and explanation match the maintenance source.

Theory diagrams in `assets/images/theory/originals/` are small, unmodified 350px-wide JPEGs, delivered directly without upscaling or generated variants. Keep their dimensions, visible content, neutral Hebrew alt text and source provenance aligned. They are separate from gallery media and do not enter the student photo list. Replacing them requires updating the media map, republishing quizzes and the media checks below. The source attribution and CC BY link on every quiz must remain; adaptations and course explanations must not imply Ministry endorsement.

## Page source maintenance

`index.html` is checked in with compact whitespace and remains directly editable and servable. After editing `index.html`, run `npm run minify:html` before publishing. This command only formats the welcome page. Preserve the existing formatting in course, learning and quiz HTML; content changes do not require a formatting pass. Run it after `npm run optimize:media` when updating images. The command preserves single spaces between inline elements, literal whitespace in `pre` and `textarea`, SVG attribute casing, and image metadata. It reports both raw and gzip byte counts; gzip is a comparison here, not a server configuration change.

The entry script uses `type="module"`, so browsers defer its execution automatically. Keeping it in the head lets its download start early. Every HTML image has an `alt` attribute. The brand icon uses the requested Hebrew alternative `alt="לוגו"`; the enclosing link retains its descriptive accessible name.

## Search and sharing metadata

`index.html` includes a Hebrew search title and description, a canonical URL, Open Graph and X card metadata, and JSON-LD describing the website, welcome page, course, and instructor. Keep these descriptions aligned with the visible course and instructor copy. The sharing image reuses the supplied `assets/images/oren.jpg`; no separate artwork or image-generation step is required. Social sharing metadata works without having social-profile accounts.

The public canonical URL is `https://oren-bechor-drive.github.io/`. If the site moves, update the canonical links, social URLs, JSON-LD identifiers and URLs, `robots.txt`, `sitemap.xml`, and `llms.txt` together. The sitemap lists only the public welcome page; section anchors are not separate pages. The course preview remains `noindex` and excluded. `404.html` is also `noindex` and excluded because it represents arbitrary missing URLs. Add `lastmod` only if an accurate modification date can be maintained. `robots.txt` allows public crawling and points to the sitemap.

`llms.txt` provides a short Hebrew overview and links to the existing course, instructor, topic, and FAQ sections on the homepage, following the [llms.txt proposal](https://llmstxt.org/). The page links it with `rel="describedby"`. Keep the summary and links aligned with the page when course facts, section IDs, or available enrollment/playback capabilities change. It is maintained directly, with no generation or runtime step, and does not replace the page or sitemap.

After editing metadata, run `npm run minify:html`, `npm test`, and `git diff --check`. Run `npm run check:media` as well when changing HTML image declarations, preload metadata, or assets. Publish `index.html`, `robots.txt`, `sitemap.xml`, and `llms.txt` together. After deployment, check those public URLs and use Search Console URL Inspection to verify what Google can fetch. Repository tests cannot confirm indexing or social-platform preview caches.

## Production caching

The public site is hosted at `https://oren-bechor-drive.github.io/` on GitHub Pages. On September 17, 2026, live HTTP checks at this address confirmed that the page, crawler files, and the stylesheet, JavaScript, font, and image URLs listed below returned HTTP 200 with `Expires` and `Cache-Control: max-age=600`. The browser can reuse fresh cached responses for ten minutes. When both headers are present, [`Cache-Control: max-age` takes precedence](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Expires).

GitHub Pages controls response headers and provides no repository setting for longer cache lifetimes. See the [GitHub Pages caching discussion](https://github.com/orgs/community/discussions/11884). Adding `.htaccess`, `_headers`, or HTML meta tags does not configure its HTTP cache policy. An "Add Expires headers" audit can still flag the short lifetime; inspect its affected URLs before choosing a fix.

Check the deployed responses with:

```bash
curl -I https://oren-bechor-drive.github.io/
curl -I 'https://oren-bechor-drive.github.io/css/base.css?v=2'
curl -I https://oren-bechor-drive.github.io/js/script.js
curl -I https://oren-bechor-drive.github.io/assets/fonts/varela-round-v21-hebrew.woff2
curl -I https://oren-bechor-drive.github.io/assets/images/road.jpg
```

Longer lifetimes require a host or CDN with configurable response headers. Before assigning long-lived caching, use versioned asset URLs that change whenever file contents change; current image and module paths can be replaced in place. Keep HTML short-lived so it can reference updated assets. The social icons use the same first-party caching policy as the other assets.

## Hero road car

The small red car drives along the hero road for 15 seconds, then waits five seconds before repeating. `js/hero-road-car.js` samples the SVG route and animates position and rotation with the Web Animations API. It recalculates the route after resizing while preserving elapsed time. Reduced motion shows a parked car; without JavaScript the decorative car stays hidden. The original car artwork is unchanged.

## Stop-sign entrance

The hero stop sign enters from the left while tilted, travels slightly past its resting position, then moves back as it tilts right and settles upright. It plays once per page load. Reduced motion shows the sign immediately without movement.

Adjust `--stop-sign-duration` in the `.hero-visual` rules in `css/responsive.css` to change the speed. Desktop uses `3s`; the mobile rule at widths of 768px and below uses `2s` with `animation-delay: 400ms`. A shorter duration makes every movement faster. The sign settles at 48% of its timeline, so it finishes moving after 1.44 seconds on desktop and 1.36 seconds on mobile, including the mobile delay.

To change only the final correction, adjust the `48%` endpoint in `@keyframes brake`, keeping it above the preceding `46%` keyframe. Each percentage point takes 30ms on desktop and 20ms on mobile. The current final correction takes 60ms and 40ms respectively. Keep the `100%` endpoint fixed so the sign stays upright afterward.

Open [the welcome page](http://localhost:8000/) and reload it to inspect the once-per-load stop-sign entrance. Check a desktop viewport above 768px and a phone viewport at or below 768px; their timing differs as described above. Enable reduced motion in browser emulation to verify that the sign appears immediately. The full motion specification is recorded in [DESIGN.md](DESIGN.md).

## Add or update student photos

Place photos in `assets/images/students-pass/` with consecutive names: `1.png`, `2.png`, `3.png`, and so on. There is no maximum count or photo-count setting.

After adding, replacing, removing, or renumbering photos:

1. Keep the filenames consecutive, starting at `1.png`. The optimizer rejects numbering gaps, invalid PNG names such as `01.png` or `2.PNG`, and an empty photo directory before writing any generated files. If initial photos were removed or renumbered, keep the six static fallback image references in `index.html` valid.
2. Run the maintenance and verification commands:

   ```bash
   npm run optimize:media
   npm run minify:html
   npm run check:media
   npm test
   ```

3. Publish the original PNG changes, `assets/images/optimized/`, generated `js/road-photo-sources.js`, and updated `index.html` together, including any deletions.

The generated module is the complete gallery list. Original PNG filenames remain numeric; generated WebP filenames use `oren-bachor-students-N` with optional width suffixes to describe the delivered images. New photos appear only after regenerating and publishing it. Regenerate after replacements too, including replacements with the same byte count. Do not edit the generated module by hand. `check:media` catches added or removed photos missing from the list and original-size mismatches.

The optimizer prepares all output in a temporary `.road-media-*` directory before changing published files. A bad input leaves the previous output intact. If publication fails, it restores replaced and obsolete files and removes newly installed files. Fix the reported cause and run the command again. If rollback itself fails, the error names a retained recovery directory; its `backup/` tree holds any originals that could not be restored. Restore those files to their matching repository paths before retrying, and remove the recovery directory only after checking the result. Run one optimizer at a time per repository. This recovery covers ordinary command failures, not process termination or machine crashes.

The carousel loads listed photos in numeric order, then repeats. Car colors are randomized independently, and adding photos preserves the travel speed. The gallery calculates loop duration from the rendered row width and car spacing, and recalculates it on viewport resize. The approved cadence is about 11.11 seconds per car on desktop and 9.46 seconds on phones; tune `--road-seconds-per-car` in the corresponding CSS rule to change it. Car sizing follows road height with a separate car-scale setting.

When the road is within 300px of the viewport, the entry script lazily imports the gallery module and generated student photo list together, then calls `initRoadCarousel(root, photoSources)` once. Each initialization reads its supplied list; tests use owned frozen fixture lists instead of rewriting the generated module. Browsers without IntersectionObserver initialize it immediately. Static car sprites, student photos, and the loading wheel use native lazy loading; the six baseline photos remain available without JavaScript. Dynamic photos decode eagerly after initialization so off-DOM lazy loading cannot stall startup.

The browser runs up to four `HEAD` requests concurrently for listed photos to check their content type and original byte count, refilling each available request slot immediately. Confirmed photos start decoding immediately; only consecutive decoded photos enter the visible row. Requests use normal browser caching. It never probes a missing next number to find the end, avoiding routine 404 console errors. A failed request for a listed file is treated as a loading failure.

Motion starts once six consecutive photos have decoded, or all photos for a smaller gallery. Wider viewports require enough cars to cover the viewport with one car of spare space. Later decoded photos join in numeric order while preserving the visible cars' position and travel speed. If the repeated row is visible, the append waits for the next loop boundary. Reduced motion shows available photos without waiting for that boundary.

Photo completions and resize events share one update per animation frame. Each update reads geometry before changing the row. New loop distances use the measured equal car widths, gap, end padding, and minimum row width, avoiding a layout read after inserting cars. Keep that calculation consistent with `.road-car` and `.road-carousel-group` if their layout changes.

Startup and individual requests/decodes have an eight-second deadline. A stalled initial load uncovers the static fallback. A later failure freezes photo additions but keeps the already working row responsive. Resizing updates its duration while preserving its position within the animation cycle. Photos after the initial row receive lower download priority than the initial row.

Until the initial row is ready, the gallery's `aria-busy` state shows the supplied wheel rotating over a light white blur. The overlay clears as the initial row becomes ready or falls back after an empty result, error, or timeout. Reduced motion keeps the loading wheel still. Without JavaScript, the overlay stays hidden.

The HTML provides six initial static photos while listed photos load, when loading fails, or when JavaScript is unavailable. Keep those declarations synchronized if you replace or remove the initial photos. With reduced motion enabled, the loaded row stays static and its duplicate is hidden. The road clips horizontal overflow in every mode; it has no drag, click, or pause controls.

## Optimize delivery images

Original image files stay in their supplied paths. The page uses responsive WebP delivery copies for the course icon, wheel, stop sign, car sprites, student photos, and instructor photo. Resizing preserves aspect ratios and transparent margins, so car and roof alignment stay unchanged. The browser tab uses a separate 32px PNG favicon.

The optimizer also creates a 180px Apple touch icon, 192px and 512px Android icons, and a 144px Windows tile icon from the supplied square course icon. HTML links the Apple icon and Windows tile metadata; `site.webmanifest` declares the Android icons and Hebrew name. The manifest uses normal browser display. Publish the generated PNGs, manifest, and HTML together. If icon paths or dimensions change, update both declarations and the optimizer. Tests verify the declared icon dimensions against the PNG files.

The instructor photo comes from `assets/images/oren.jpg`. The same optimizer generates 400px, 480px, 544px, 680px, 768px, 960px, 1080px, and 1460px WebP copies at quality 50 without changing the JPEG. Its lazy-loaded image declares responsive sizes matching the instructor layout. The 544px copy covers the desktop frame, intermediate sizes reduce phone downloads, and the 1460px copy covers the widest tablet frame at 2x density. The header logo requests high fetch priority directly in HTML, alongside the hero stop sign. Publish the original, generated copies, and HTML together after replacing the photo.

The photo-maintenance command above also regenerates responsive delivery copies for all road media. After changing artwork, delivery widths, compression settings, or generated sizing hints, run:

```bash
npm run optimize:media
npm run minify:html
npm run check:media
npm test
```

Publish generated files with their originals as described under [Add or update student photos](#add-or-update-student-photos). The optimizer synchronizes image candidates and dimensions in the HTML, refreshes the complete photo list, and removes obsolete WebPs only within the generated directory. This maintenance step is required when source images or delivery settings change; opening or serving the checked-in site still requires no build. Student-photo runtime loading falls back to the PNG if a delivery copy fails to decode or the original's Content-Length no longer matches the generated metadata.

The HTML keeps original road-image dimensions and uses width descriptors in `srcset` plus `sizes` for delivery copies. Smaller variants serve ordinary desktop screens; larger variants support high-density screens without enlarging an original. Photo sizing accounts for the `object-fit: cover` crop. The optimizer's size formulas follow the road height, car scale, and photo frame in `css/welcome.css` and `css/responsive.css`; update them if that geometry changes. Car sprite sizing reads each color's `--car-art-width` rule. The hero car uses separate 80px and 160px WebP copies of the red-car artwork with `sizes="clamp(40px, 5vw, 80px)"`, matching its smaller CSS width. Module preload hints fetch the initial topic, disclosure, scroll-reveal, and hero-car modules alongside the entry script. Gallery code and its generated photo list load only when the road approaches the viewport. The below-fold road background is not preloaded.

Student photos include intermediate 320px, 360px, and 400px candidates between the smallest desktop copy and the largest copy, capped at the original width. Candidates within 5% of the largest source are omitted in favor of that larger copy. These let phones select a closer fit without downloading the desktop 2x image. Width descriptors always reflect the generated file's actual width.

WebP quality is 65 for intermediate and large student photos, 78 for the smallest student photos, 80 for cars and the stop sign, and 85 for the logo. The red gallery car keeps RGB quality 80 with alpha quality 73 to reduce transparency data; the other cars and the small hero copies retain the default alpha quality. The smallest version of photo 11 uses quality 55 for its dense background. Both wheel sizes use quality 65 and alpha quality 60. Check faces, lettering, and transparent edges at their displayed sizes after changing these settings.

`tests/browser/image-delivery-browser.test.mjs` checks actual browser source selection, image bytes, high-density coverage, and rendering without JavaScript. It covers desktop at 1x and 2x, phones at 1x, 1.75x, and 2x, and a 768px tablet at 2x. Density checks include the hero car and instructor photo, account for cover cropping, and allow 0.5% for fractional rendering geometry. Road-media download budgets scale with the generated photo count: desktop allows 115 KiB plus 9 KiB per photo, and mobile allows 120 KiB plus 12 KiB per photo. With 15 photos these are 250 KiB and 300 KiB. The instructor photo has separate budgets of 50 KiB at 1x, 90 KiB on high-density phones, 180 KiB on 2x desktop, and 300 KiB on the widest 2x tablet. Its selected source must stay within 20% of the required width. Both desktop and phone delivery are checked with JavaScript disabled. The high-density 412px phone check also limits oversized student-photo candidates. The 128px and 256px wheel downloads are capped at 6 KiB and 13 KiB; the smallest photo 11 is capped at 8 KiB.

## Font delivery

Interface arrows and chevrons use the eight selected Font Awesome Classic Solid SVGs in [`assets/icons/directions/`](assets/icons/directions/README.md). The course profile and search use two more local Font Awesome SVGs documented in [`assets/icons/interface/`](assets/icons/interface/README.md). Shared CSS applies them as local masks in the control's current text color. The homepage topic dropdown, course topic controls, lesson/quiz return links, quiz question selector, profile and search share this delivery approach. No icon font or external kit is loaded. CSS mask requests are outside the media audit's coverage; check their delivery in the browser from both root and nested pages when changing paths.

Varela Round's `@font-face` declarations live in `css/base.css` with `font-display: swap`. The original Google Fonts v21 WOFF2 subsets are served from `assets/fonts/`, with their SIL Open Font License and source URLs in that directory. Hebrew and Latin are preloaded in the HTML so they download alongside CSS. Both are used by the initial page, including punctuation and digits. Only Hebrew and Latin subsets are included; the unused Vietnamese and extended Latin files and declarations have been removed.

Font preloads require `crossorigin` even for local files so CSS can reuse them. Keep preload paths synchronized with the CSS when updating fonts. No Google Fonts stylesheet or preconnect is needed at runtime. The browser delivery test holds CSS responses to verify early font and high-priority logo downloads and checks that the page uses both fonts without duplicate requests.

## Maintain road artwork

`assets/images/road.jpg` is the repeating background. The six active car sprites are cyan, gray, green, orange, red, and yellow in `assets/images/cars/car-*.png`. Their static HTML entries also serve as JavaScript templates. Changing the car palette requires updating those entries and the matching `.road-car-*` alignment rules in `css/welcome.css`.

Alignment compensates for transparent margins in each source image. Student photos sit over the roofs with 8px rounded corners and a subtle 3px edge fade applied in CSS. Preserve original image bytes during layout changes. `assets/images/cars/cars.png` is supplied source artwork and is intentionally not loaded by the page.

## Project files

- `index.html` contains the Hebrew, right-to-left welcome page and its five-row FAQ. `404.html` handles missing paths at the domain root. `course/index.html` contains the ten-topic library; each topic directory contains its own reading page and one `quiz/` directory owning its practice questions. The four former quiz URLs contain transition links.
- `course/css/course.css`, `course/css/lesson.css`, and `course/css/quiz.css` style the course preview. `course/js/course-library.js` enhances library search and topic browsing; `course/js/quiz.js` enhances independently authored question fieldsets.
- `robots.txt` and `sitemap.xml` expose the canonical welcome page to crawlers; `llms.txt` summarizes the course and links to its homepage sections.
- `css/base.css` defines design tokens, global defaults, and shared layout widths.
- `css/components.css` styles the header and navigation.
- `css/welcome.css` styles the welcome-page sections and their controls.
- `css/faq.css` styles the homepage FAQ and its responsive layout.
- `css/responsive.css` contains interaction states, animations, breakpoints, and accessibility preferences. Load the five stylesheets in the order used by `index.html` to preserve the cascade.
- `js/script.js` adds the mobile menu and initializes page enhancements.
- `js/topic-explorer.js` owns the topic preview interaction.
- `js/disclosure-motion.js` shares mobile menu and topic-list visibility, input handling, and press feedback.
- `js/details-motion.js` owns native-details height transitions, logical open state, reversal and cleanup for the homepage FAQ and course-library disclosures. Their callers retain independent-toggle and exclusive-selection/scroll policies respectively.
- `js/hero-road-car.js` animates the small red car along the hero's SVG road.
- `js/scroll-reveal.js` reveals the instructor and unified course section once as each enters the viewport.
- `js/road-carousel.js` builds the looping student gallery from the supplied photo list. `js/script.js` supplies the lazily imported generated list in production.
- `scripts/site-pages.mjs` discovers authored HTML for both learning and media checks, sharing the directory exclusions listed in [Architecture](docs/ARCHITECTURE.md#media-verification).
- `scripts/road-media-integrity.mjs` audits local image sources, responsive candidates and preloads across those pages, including ordinary SVGs and scaled brand images. Marked road media, car templates and numbered student photos retain their stricter checks.
- `scripts/learning-content.mjs` interprets and validates learning sections and topic-owned practice-quiz relationships for structural and browser tests. It returns plain records and file-specific issues without a runtime content registry.
- `scripts/site-links.mjs` audits local `href`, `src`, and HTML fragment targets across authored pages. It resolves directory URLs and an optional deployment prefix without fetching external destinations.
- `js/road-photo-sources.js` is the generated complete photo list and responsive delivery metadata.
- `scripts/optimize-road-media.mjs` regenerates that list and WebP delivery copies without changing originals.
- `scripts/student-photos.mjs` owns student photo discovery, numeric ordering, and filename diagnostics for the optimizer and media audit. The optimizer stops on findings; the audit collects them and continues checking media.
- `assets/images/` contains the stop-sign illustration, road background, car artwork, instructor photo, and numbered student photos. `assets/icons/` contains the course icon. Typography uses Varela Round globally, with local WOFF2 files under `assets/fonts/`.
- `docs/reference/the-idea.pdf` is the supplied course brief.
- `tests/unit/` contains Node checks for static pages, behavior, learning content, media integrity and maintenance scripts. Run them with `npm run test:unit`.
- `tests/browser/` contains exhaustive Chromium journeys plus focused Firefox and WebKit smoke journeys for desktop, mobile, navigation, lessons, quizzes, and progressive-enhancement fallbacks. Run them with `npm run test:browser`; `npm test` runs these groups and the database tests.
- `tests/database/` verifies account isolation, content access, subscription expiry, and concurrent progress saves against a disposable PostgreSQL 17 instance. Run it with `npm run test:database`; no hosted credentials or Docker are required.
- `tests/helpers/road-media.mjs` serves repository files and directory index pages in browser tests with consistent MIME types and original byte counts for HEAD requests. Individual tests own delays, failures, and download observations.

### Automated checks

[The Tests workflow](.github/workflows/tests.yml) runs on every push and pull request, and can also be started manually from GitHub Actions. It uses Node.js 24 on GitHub's hosted Ubuntu 24.04 runner, `ubuntu-24.04`, installs the locked dependencies with `npm ci`, checks them with `npm audit`, and installs Chromium, Firefox, and WebKit with their system dependencies. It then runs `npm run check:media`, `npm run check:links`, and the full `npm test` suite. This includes static and behavior tests, optimizer tests, database authorization/concurrency tests, exhaustive Chromium coverage, and focused Firefox and WebKit smoke coverage. New tests matching `tests/*/*.test.mjs` are included automatically.

The workflow uses `actions/setup-node` with `cache: npm` to reuse downloaded dependencies between runs.

Animation regressions cover focus during section entrances, visibility in print, immediate keyboard topic selection, live reduced-motion changes, and keeping unchanged topic text still. Hero-car checks cover road position, orientation, and elapsed-time preservation on resize. Gallery tests cover refilling metadata request slots, deferred photo additions at a real animation loop boundary, and resizing the preserved row after a later loading failure. Scroll-reveal tests bound their animation-capture waits so a missing reveal fails instead of hanging the suite.

`tests/browser/progressive-enhancement-browser.test.mjs` exercises navigation and topic selection at desktop and phone widths. It also checks visible navigation and all seven descriptions with JavaScript disabled or the entry module blocked. Section-alignment tests distinguish the sticky header from the mobile fallback's zero scroll offset. The unavailable-IntersectionObserver test checks for browser errors and verifies that topic selection initializes and the local footer icons remain available.

Learning-content fixture tests exercise malformed authored HTML through the same verifier used by the real-page tests. Quiz browser tests follow authored order rather than fixed question IDs; additional one-question and five-question fixtures cover nonnumeric IDs and a video in the first question. Gallery behavior tests supply independent photo lists and verify that concurrent instances do not mutate generated metadata. The site-media tests cover nested pages, ordinary logos/SVGs, missing candidates and preloads, and command failure outside the welcome page.

`tests/unit/seo-metadata.test.mjs` checks consistent canonical and sharing metadata, the existing sharing image's type and dimensions, and linked structured-data entities. `tests/unit/crawler-discovery.test.mjs` checks crawl access, sitemap consistency, and that `llms.txt` links point to real page sections. These checks validate the repository files, not search ranking or production deployment.

CI audits the checked-in media. Photo and artwork changes still require running `npm run optimize:media` locally and publishing its output with the originals. The workflow does not deploy the site.

### Local checks

Development checks require Node.js 22.22.2 or newer in the 22.x line, 24.15.0 or newer in the 24.x line, or 26 or newer, plus Playwright's Chromium, Firefox, and WebKit engines. CI uses Node.js 24 on Ubuntu 24.04. Install the locked development dependencies and supported browser engines once, then run the checks:

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm audit
npm run check:media
npm run check:links
npm test
git diff --check
```

`npm run check:links` discovers the same authored HTML pages as the media audit. It checks local `href` and `src` declarations, directory pages, query strings, and HTML fragments. It reports missing files, missing fragments, malformed local references, empty `src` values, unreadable HTML, and references outside a configured deployment prefix. It skips external and embedded URLs and makes no network requests. Responsive image candidates, CSS URLs, image metadata, MIME types, and rendered navigation stay with the media audit and browser tests. The CLI checks the current domain-root deployment; use `auditSiteLinks({ rootDir, deploymentPrefix })` in a focused test for a prefixed deployment.

The media audit discovers authored root and nested HTML pages and reports each finding with its page. It checks local `img` sources, `srcset`, picture candidates and image preload `href`/`imagesrcset`; declared preload MIME types must match. Ordinary JPEG, WebP and PNG headers and responsive widths are checked, while ordinary SVGs must be valid SVG XML. Display-sized logos may differ from intrinsic image dimensions. Marked road media retains exact original dimensions and alternative-text checks. Student-gallery checks still cover car templates, numeric photo order, generated delivery copies and stale photo-list metadata. The supplied `cars.png` composite remains excluded from car templates. External/embedded URLs are skipped without fetching. This audit does not discover CSS image URLs, validate video files, decode full raster images or inspect rendered cropping. See [media verification](docs/ARCHITECTURE.md#media-verification) for discovery exclusions and focused test interfaces.

Browser tests derive the gallery count and last photo from the generated list. Progressive-append scenarios require enough photos to fill the initial viewport and leave a later photo pending; smaller galleries skip those scenarios. Tests also check loading from the generated photo list without missing-file probes, failure preservation, and loop timing across row sizes and viewport changes. `npm test` includes Chromium checks that load the actual page, stylesheets, scripts, and images at desktop and phone sizes, including resizing and reduced motion. Focused Firefox and WebKit smoke journeys cover desktop and mobile navigation, topic selection, lessons, quizzes, and JavaScript-disabled or blocked fallbacks. The tests intercept local requests to serve repository files and block external requests, so no dev server or network connection is needed after setup. Verify layout and interaction changes in the collaborative browser at desktop and phone sizes, including reduced motion. If collaborative preview is unavailable, use local Playwright Chromium and report the limitation.

## Supabase development foundation

The account/access migration is applied to development project `zurpazevlvtylnzvagoo`. It provides learner identities, separate free and paid text versions, development entitlements, and saved reading positions. Database policies enforce verified live sessions, account isolation, current publication, and entitlement expiry. Progress survives expiry and renewal.

The local account gateway now uses verified Auth and learner provisioning. Its Hebrew registration, login, recovery, and account pages reuse the current site styles. The static course files are still public. The local protected-learning area supports saved reading positions, graded quizzes, completion, ten-day retention and authenticated private media. Actual approved content and production deployment remain outstanding; billing is disabled. Google and real email delivery still need provider configuration. Do not put actual restricted lesson text or assets into this public repository.

### Local account screens and gateway

```bash
npm run dev
```

Open `http://localhost:3000/account/login.html`. This previews the screens immediately. To enable real authentication, copy `.env.example` to `.env.local`, fill the publishable and server-only Supabase keys, and restart. See [local account setup](docs/local-accounts.md) for the callback allowlist, Google, SMTP, and verification steps. MCP authentication does not configure runtime keys.

For a disposable browser/API environment without hosted credentials, follow the [manual protected-learning walkthrough](docs/manual-test-lessons.md). It covers section reading, scrolling, the synthetic quiz, expiry, renewal, and learner isolation using real local PostgreSQL. This fixture is separate from `npm run dev`.

`npm run test:gateway` exercises cookie sessions, CSRF, PKCE, isolation, expiry, revocation, concurrent refresh/reset, and the Supabase adapter. `npm test` also includes the Hebrew account browser journeys. The fixtures send no real email and do not verify live Google/SMTP setup.

The local launcher uses bounded Node memory; restarting signs users out. It binds to loopback and refuses production mode. The separate [hosted gateway](docs/hosting.md) adds a Cloudflare Worker, encrypted durable Supabase sessions, shared request limits and a private pilot gate. Hosted deployment and verification remain outstanding. On GitHub Pages, account forms explain that the service is unavailable and course profile controls stay disabled.

Run the isolated database suite:

```bash
npm ci
npm run test:database
```

The suite uses pinned native PostgreSQL 17.6 binaries, a temporary directory and a loopback port, then removes its fixtures. Run it as a regular user. Linux x64 is verified locally and is used in CI. The package's symlink setup script is approved in `package.json` for npm 12; if an existing installation predates that approval, run `npm rebuild @embedded-postgres/linux-x64`. Other platforms need their corresponding native package's setup script reviewed and approved when npm blocks it.

`supabase/config.toml` configures an optional local Supabase stack with only `public` exposed and explicit API grants. Running that full stack requires Docker; the database suite does not. Local Auth configuration does not change hosted settings. Use the pinned CLI through `npx --no-install supabase`, consult its `--help`, and create future migrations with `supabase migration new <name>`. Do not edit an already-applied migration.

See [database ownership](docs/ARCHITECTURE.md#accounts-and-access-development-database), the [approved design](docs/plans/supabase-database-design.md), and [database/API verification](supabase/tests/README.md) for function contracts and test limits. Migration `20260923154100_account_access_foundation.sql` matches hosted migration history.

## Documentation

- [PRODUCT.md](PRODUCT.md): current audience, scope, and supplied evidence.
- [DESIGN.md](DESIGN.md): visual system and the approved welcome-page composition.
- [CONTEXT.md](CONTEXT.md): course and gallery terminology.
- [Architecture](docs/ARCHITECTURE.md): content verification, media/gallery ownership, local account sessions and test-lesson reader boundaries.
- [Synthetic learning sections](docs/test-lessons.md): setup, section and reading-position API contracts, and verification limits.
- [Manual browser/API walkthrough](docs/manual-test-lessons.md): disposable local cancellation, expiry, retention, renewal and learner-isolation scenarios.
- [Paid-service architecture draft](docs/plans/paid-service-architecture.md): provider-neutral future service boundaries, data model and failure handling. It does not describe shipped capabilities.
- [Paid-service decisions and first setup](docs/plans/paid-service-start.md): agreed free/paid access rules, monthly billing behavior, sign-in methods, progress retention, and the first Supabase development milestone.
- [Supabase database and access design](docs/plans/supabase-database-design.md): implemented development tables, permissions, progress rules, and database acceptance tests. The local account gateway and [synthetic learning sections](docs/test-lessons.md) use this foundation; billing and publication of actual approved course material remain future work.
- [Operations](docs/OPERATIONS.md): current content review, publication, live checks, support intake and rollback procedures.
- [Official source review](docs/reference/official-source-review-2026-09-22.md): dated official-resource audit, evidence and limits.
- [Site quality review](docs/reviews/site-quality-2026-09-22.md): current responsive, accessibility and local resource audit with remaining manual checks.
- [AGENTS.md](AGENTS.md): contributor boundaries and required checks.
- [Font sources and license](assets/fonts/README.md): the local font files and their delivery requirements.
- [Supplied course brief](docs/reference/the-idea.pdf): original instructor and course material.

## Licensing

Website code is available under the [MIT License](LICENSES/MIT.txt).
The social, direction and interface icons are Font Awesome Free 7.3.1 assets under CC BY 4.0; see their attribution and license notes in [`assets/icons/social/`](assets/icons/social/README.md), [`assets/icons/directions/`](assets/icons/directions/README.md), and [`assets/icons/interface/`](assets/icons/interface/README.md).
Course content, photos, artwork, and branding are excluded.
See [LICENSE](LICENSE) for the complete scope.

## Protected learning development

The local gateway now includes [saved learning and protected delivery](docs/protected-learning.md): graded topic quizzes, resumable drafts, paginated attempt history, manual completion after 17/20, a titled lesson reader with saved scroll position, and authenticated private media streaming. Learning progress expires ten days after an unrenewed subscription ends; completed topics remain. The new migration is locally tested and has not been applied to hosted Supabase. Install its documented Cron job when deploying.

Open `/account/learning.html` through `npm run dev` after publishing approved content into the development database. Synthetic fixtures test the complete flow without real driving questions. Billing stays disabled by the owner's request; the future offer is ILS 150.00/month and a three-day trial. Real content, hosted deployment/verification and provider setup remain release requirements. The [hosting implementation and operating guide](docs/hosting.md) covers the locally tested production adapters. The static `course/` preview remains public, with local scoring and no account progress.

## Todo

The owner currently requires free infrastructure that restricts or stops service instead of charging overages. An annual domain-registration fee is the approved exception; other paid upgrades remain deferred unless the owner changes this policy. Current and future recommendations are recorded in [Project recommendations](docs/recommendation.md); provider proposals there are not completed deployments.

Roadmap updated with the owner's 2026-09-25 [paid-release decisions](docs/plans/paid-release-scope.md) and the completed local topic-quiz/protected-learning milestones. This backlog covers the path from the current public welcome page and course preview to a paid learning service. It records future work, not available capabilities or authorization to implement every item. `PRODUCT.md` still describes the current release. Update it and the relevant architecture and domain documentation when each future capability is approved for implementation.

Already present: the public welcome page with its five-row FAQ, a noindex 404 page, a searchable ten-topic library, ten reading pages covering the developed PDF topics, ten topic-level scored public practice quizzes, responsive Hebrew RTL layouts, baseline navigation and reading without JavaScript, media and local-link audits, search/sharing metadata for the public page, and CI with unit and Chromium coverage plus Firefox and WebKit smoke checks. Extend these rather than rebuilding them. Reading lessons still have 16 video and 12 image/diagram placeholders. Public quizzes now have real questions and scoring, with no payments or persistent account progress. Accounts work through the local development gateway once provider credentials are configured. Separate synthetic test lessons support saved reading percentages and the verified local access lifecycle described below.

Work through the sections below in dependency order. Content production and public-page work can proceed alongside service planning. A paid launch depends on approved teaching material, working account and billing journeys, server-enforced access, and the launch checks below. Optional additions at the end are not launch requirements.

### Next development milestone

- [x] Replace the four section quizzes with ten topic-level 20-question previews, preserve former URLs as transition pages, and require every question to be answered before finishing. The initial placeholders were later replaced with variable-length, scored public theory practice; saved account progress remains separate.
- [x] Implement and locally verify protected quiz publication, server grading at 17/20, saved unfinished/submitted attempts and optional topic completion. Synthetic fixtures are used until Oren supplies and approves the real questions. See the [release scope and sequence](docs/plans/paid-release-scope.md).
- [x] Implement and locally verify ten-day post-expiry cleanup for reading positions and quiz data while retaining completed topics, including early/late renewal and lock races. Deployment of the migration and cleanup schedule is still required.
- [x] Implement and locally test Cloudflare hosting, encrypted durable Supabase sessions, shared rate limits, manual pilot admission and private Storage streaming. See [hosting preparation](docs/hosting.md).
- [ ] Configure the selected hosted providers, deploy the reviewed migrations and cleanup jobs, verify both login methods and the private pilot, then import Oren-approved content. Public registration waits for the owner's go-ahead. Billing remains disabled.

### Completed account development milestones

- [x] Connect the local gateway to one account-only free synthetic section and one paid synthetic section using learner-scoped database functions. The [fixture guide](docs/test-lessons.md) uses synthetic content and privileged development entitlements. Local gateway/browser tests use real PostgreSQL access checks. Hosted seed readback predates the protected-learning migration; the hosted catalog requires titled republication.
- [x] Connect saved reading positions to the protected reader. Scroll and the explicit save button support save/reload, stale-revision conflict recovery, and resuming on another signed-in browser. Gateway and desktop/mobile Chromium tests use real PostgreSQL; live hosted integration remains unverified. See [section and position contract](docs/test-lessons.md#section-and-position-contract).
- [x] Prove the local browser/API journey: signed-out requests receive no section body; a free learner cannot read paid text; simulated cancellation preserves the finite paid period; expiry blocks paid reads and saves while retaining free access; early renewal restores access and position; late renewal starts fresh; a second learner cannot read or overwrite the first learner's data. Gateway and desktop/mobile Chromium tests use real PostgreSQL, including a simulated 31-day lapse. Cancellation and renewal use development entitlements, not billing. See [expiry and verification](docs/test-lessons.md#expiry-renewal-and-verification).

### Existing items reviewed

- [x] Concentrate private learner-account lifecycle state behind one module, and share complete native-details transitions between the FAQ and course library. Preserve account concurrency rules, disclosure policies, motion timing and baseline navigation. See [architecture refactor verification](docs/superpowers/plans/2026-09-23-architecture-deepening.md).
- [ ] Keep shared runtime course-content extraction deferred until a second runtime consumer needs the same content. `scripts/learning-content.mjs` already shares development-time interpretation across verification tools; it does not justify a new browser content registry. Keep baseline HTML as the source for interactive descriptions.
- [ ] Revisit shared course-header markup when account/profile behavior is implemented. Course, reading and quiz pages already share styles; any reuse must preserve independently served HTML and the no-build-step frontend.
- [x] Add Firefox and WebKit smoke checks for page loading, navigation, library selection, reading anchors and quiz interaction. CI retains the exhaustive Chromium coverage and installs all three engines.
- [x] Add `npm run check:links` for local files and HTML fragments, with deployment-prefix fixtures and CI execution after the media audit.

### Product and owner decisions

- [x] Agree on the first paid release: all ten topics, 16 videos, 12 images/diagrams and ten 20-question quizzes. Oren approves instructional content; the owner records approvals/corrections and handles support, billing/refunds and publication with their agents. See [paid release scope](docs/plans/paid-release-scope.md).
- [x] Agree on the access model: the welcome page and topic descriptions stay public; all learning content requires a free account. Free content covers only basic information such as definitions of laws. Lessons, explanations, images, diagrams, videos and quizzes require paid or trial access. Topics remain accessible in any order within a learner's access.
- [ ] Classify each actual lesson, explanation, quiz and asset under the agreed public/free/paid model before protected publication.
- [ ] Supply the business identity, support contact, social-profile destinations and enrollment destination. Do not invent contact details, testimonials, outcome claims or a physical address.
- [x] Agree on two plans, free and paid, with an automatically renewing monthly paid subscription in NIS (`ILS`). Cancellation stops renewal and preserves access until the paid period ends. Expiry returns the learner to free access. After ten days without renewal, delete reading positions, unfinished quizzes and submitted attempt history; keep completed topics. The new development migration implements this cleanup; it has not been deployed to hosted Supabase.
- [x] Record the owner's monthly price of ILS150.00 and decision to leave billing disabled.
- [ ] Approve displayed purchase terms and select a payment provider eligible for the seller's business and recurring ILS billing. The release uses a standard monthly subscription and a once-per-learner three-day trial with all paid content. Payment details are required; automatic billing begins at trial end unless canceled. Trial cancellation preserves access to its end without a subsequent charge. Other purchase options are deferred.
- [ ] Agree on refunds, disputes, failed-payment grace and account-deletion policies. Define billing/audit retention and backup expiry separately from the agreed ten-day learning-data cleanup; submitted attempts have no rolling expiration while subscribed.
- [ ] Define which policy versions require acceptance, when to request it, and what acceptance evidence to retain.
- [x] Set the audience to anyone learning or improving their driving. Require a purchase declaration that the buyer is 18 or older or has guardian approval.
- [ ] Obtain qualified review of applicable consumer, privacy, accessibility, tax and minor-consent requirements, including the purchase declaration and acceptance evidence. Business details, support contact, policies and a reviewer have not been supplied.
- [ ] Turn the owner's launch requirement, a complete website/course with protected content, into measurable release checks. No launch date or usage forecast is set. The current infrastructure budget permits free plans that restrict service instead of charging overages, with annual domain registration as the exception. Establish service costs for video delivery, authentication, transactional email, payments and storage before proposing any budget change.

### Teaching content, media and practice

- [ ] Have Oren review every adapted reading page and the safety qualifications in the [coverage map](docs/reference/course-topic-coverage.md). Record approval and resolve corrections before treating preview copy as final teaching material.
- [ ] Obtain source material for definitions, summary/conclusions and uphill/downhill priority, which are currently listed without developed explanations. Decide whether each needs a new page or a section in an existing topic; resolve the unexplained resource label only when its meaning and destination are supplied.
- [x] Complete the bounded 2026-09-22 review of official resource links and higher-risk driving, licensing, penalty-points and right-of-way claims. Record the evidence and limits in the [official source review](docs/reference/official-source-review-2026-09-22.md).
- [ ] Assign and run recurring official-source reviews, resolve the documented publication-timing limit, and obtain Oren's approval of the teaching material. Do not copy stale numerical claims from the PDF.
- [ ] Receive the 16 planned videos, 12 images/diagrams and revised lesson texts from Oren. The owner's latest update is that the files are not ready and will be supplied later. Confirm each asset's teaching purpose, rights and permission to show identifiable people or vehicles; preserve supplied originals and record source/approval information.
- [ ] Add Hebrew captions, transcripts, useful alternative text and descriptions of essential visual information. Review text embedded in road diagrams for readability on phones.
- [ ] Add accessible video playback with keyboard controls, playback speed, captions, loading/error states and retry. Verify mobile playback, slow connections and delivery costs; choose hosting and encoding based on the approved public/paid split.
- [x] Replace public quiz placeholders with 140 sourced theory questions, including original diagrams, answer keys, explanations and variable topic counts. Source review and explicit adaptations are documented; this does not assert instructor approval of future paid quizzes.
- [x] Define quiz behavior: answer all 20 questions before submission, show score out of 20 and explanations after submission, allow unlimited retries, and unlock optional topic completion at 17/20. Retain history while subscribed, subject to the ten-day post-expiry cleanup.
- [x] Implement and locally test scoring, feedback, history and completion in the protected service. Hosted deployment and approved quiz content remain outstanding. The static preview scores complete attempts locally and makes no certification or driving-test claims.
- [x] Add one placeholder quiz to each existing topic and combine the turning quizzes into the right-of-way topic quiz.
- [ ] Have Oren approve all ten paid-course quizzes before launch; public theory practice does not constitute that approval.
- [x] Extend public learning-content verification for answer keys, native feedback and explanation relationships, with file-specific diagnostics. Verify theory-source fidelity and media provenance separately. Protected paid publication retains its own checks.

### Public pages and navigation

Proposed page names below describe responsibilities. Choose final paths during implementation and preserve existing course URLs and section anchors.

- [ ] Add a course-details and pricing page with actual inclusions, account-required free content, access duration, renewal terms and a working enrollment action once those facts are approved.
- [x] Add the homepage FAQ at `#faq` with the approved five completed-course questions and answers, native disclosures, and desktop and mobile navigation links. Retire the separate help page and its footer link.
- [ ] Expand the homepage FAQ with approved subscription, cancellation, refund, account-recovery and support information when those services and policies exist.
- [ ] Add a contact/support page with supplied destinations, response expectations and accessible success/error states. If using a form, provide server validation, abuse controls and a delivery/failure path.
- [ ] Add privacy, terms of use/sale, cancellation/refund and accessibility pages based on approved business practices and qualified review. Add cookie/storage disclosures and consent controls where the chosen services require them.
- [x] Add a noindex 404 page with a centered error message and root-absolute links to the welcome page and library. Keep its domain-root paths coordinated with any host or path migration.
- [ ] Add maintenance or service-unavailable recovery and return links for interrupted account or checkout journeys when those journeys exist.
- [ ] Replace disabled course-start and social controls only when real destinations are ready. Update navigation, footer links and the shared course header for the published page set.
- [ ] Review every new page and transactional message in Hebrew with RTL layout, mixed-direction email/number handling, keyboard access, visible focus, zoom and mobile behavior. Follow `DESIGN.md` for new UI.
- [x] Link `llms.txt` to the homepage FAQ and keep the sitemap limited to the canonical homepage. Keep the course preview and 404 page `noindex` and out of the sitemap.
- [ ] Publish future approved public pages with accurate metadata, sitemap entries and `llms.txt` content. Keep preview and private or account pages out of public discovery; `noindex` is not access control.

### Backend, hosting and data

- [x] Write a [provider-neutral paid-service architecture draft](docs/plans/paid-service-architecture.md) for identity, learner data, subscriptions, payment events, email and protected media. It is a future recommendation and does not implement or approve a service.
- [x] Implement and verify the approved Supabase development database foundation: learner identities, current free/paid text access, expiring development entitlements, retained reading positions, and atomic saves. This does not deliver account screens, billing, private media, or protection of the static preview.
- [ ] Approve the remaining service architecture, select providers, and implement and deploy the trusted service, database, private storage and adapters. Keep the public frontend in plain HTML, CSS and JavaScript without a required build step.
- [ ] Select hosting and service providers after confirming regional availability, business eligibility, Hebrew/RTL support, recurring billing needs, data handling, export options and operating costs. Record decisions before integrating provider-specific behavior.
- [ ] Decide the public and service domains, HTTPS setup, staging/production separation and migration plan. Resolve the documented GitHub Pages header/caching limitations where needed, with redirects and coordinated URL/metadata updates if the public host changes.
- [ ] Extend the implemented learner, entitlement and reading-position schema with the approved remaining models for staff roles, video/completion progress, quiz attempts, subscriptions, payment-event records and policy acceptance. Use stable identifiers and approved retention/deletion rules; preserve applied migrations and add new ones for changes.
- [ ] Implement server-side validation and authorization for each protected operation. Keep service credentials in managed server secrets, separate environments, and define rotation and recovery procedures.
- [ ] Define API error responses, retries, rate limits and concurrency behavior. Configure origin restrictions, CSRF protection where applicable and response security headers; update the current CSP only for the services actually integrated.
- [ ] Move all account-only lesson bodies, private answer data and protected media out of public delivery before launching the real course, including free lessons that require an account. Publish through trusted operations with stable section/version identifiers, and check deployment artifacts for restricted material. The current static preview is publicly retrievable; a client-side lock or hidden link cannot enforce access.
- [ ] Serve restricted content only after server-side entitlement checks, including direct URL requests. Use private media storage and scoped, expiring delivery access where needed; prevent shared caches from exposing private responses.
- [ ] Deliver paid media for website viewing without a course-content download feature. Bound media grants by the paid-access end and a short delivery lifetime, and verify expiry and private-origin access with the selected provider. Document that screen capture and copying content already delivered cannot be prevented completely.
- [ ] Set up backups, tested restores, deployment rollback and monitored database migrations before storing live learner or billing data.

### Accounts and learner area

- [x] Build and test the local Node session gateway and Hebrew registration/login, confirmation guidance, recovery/reset, and account screens. Use HttpOnly cookies and server-held tokens; preserve site colors and fonts. Local tests include expiry, revocation, replay, isolation, and concurrent reset. External provider delivery is not covered by these fixtures.
- [x] Choose email/password and Google sign-in. Complete the local account UI and code review, including the registration-only password requirements bar, keyboard focus, responsive layouts and reduced motion.
- [ ] Verify hosted Auth settings match [local account setup](docs/local-accounts.md#supabase-auth-settings): email confirmation enabled, minimum password length 9, and the correct Site URL/callback allowlist. Test valid 9-character registration and actual confirmation/recovery links. Editing local Supabase configuration does not change hosted settings.
- [ ] Complete Google OAuth consent/client configuration and a real browser sign-in. Configure custom SMTP and Hebrew confirmation/recovery templates, then test delivery to non-team addresses, expired/reused links, and same-browser callback requirements. Local fixtures do not verify these external services.
- [x] Add the separate Cloudflare hosting adapter with durable encrypted sessions, coordinated refresh/rotation/revocation, expiry cleanup, trusted client-address limits and closed/pilot/public admission. Local PostgreSQL and Workers-runtime tests cover these boundaries.
- [ ] Verify hosted HTTPS/Secure cookies, restarts, failure recovery, both authentication methods and cross-device behavior. The local launcher remains loopback-only; use the [Worker deployment guide](docs/hosting.md).
- [ ] Expand the implemented conditional profile link and basic account page with supported identity changes, notification preferences, and session management. Static hosting retains the unavailable profile fallback.
- [x] Add a learner page and protected reader with saved positions and independently reachable entitled sections. Optional bookmarks are not implemented.
- [x] Implement and locally test database-persisted reading positions, unfinished/submitted attempts and durable topic completion after 17/20, with conflict handling and versioned content. Hosted cross-device verification remains part of deployment. Video-position resume is outside the agreed initial requirement.
- [ ] Add account-data export and deletion workflows, reauthentication for sensitive changes, and approved handling of billing records and active subscriptions during deletion.
- [ ] Provide clear states for unverified, signed-out, expired-session, suspended and deleted accounts, with support and recovery routes. Public navigation and topic descriptions must remain usable if JavaScript or the account service fails.
- [ ] Configure transactional email delivery and sender authentication for verification, recovery, account changes and security notices. Use Hebrew templates, monitor delivery failures and separate optional marketing consent from service messages.

### Paid subscriptions and access

- [ ] Set up the approved payment provider, business verification and separate test/live credentials. Use provider-hosted payment collection or its supported secure components so the site does not collect raw card details.
- [ ] Build checkout entry, order review, payment-pending, success, cancellation and failure pages/states. Preserve the selected plan through sign-in and offer a safe retry without duplicate purchases.
- [ ] Create checkout sessions on the server from trusted plan identifiers and prices. Bind purchases to the correct learner and define how existing subscribers or duplicate checkout attempts are handled.
- [ ] Verify payment webhook signatures, deduplicate events, handle retries and out-of-order delivery, and reconcile missed events with the provider. A checkout return URL must never grant access by itself.
- [ ] Model subscription and entitlement changes for initial payment, renewal, failed payment, grace periods, scheduled cancellation, expiry, refunds and disputes. Define access timing for every supported state and enforce it on the server.
- [ ] Use the payment provider's actual monthly billing-period boundaries rather than a fixed 30-day timer. Replace development-only entitlement sources with verified billing operations while preserving progress and the agreed cancellation/expiry behavior.
- [ ] Add a billing/subscription page showing plan, status, next renewal or access-end date, payment-method management and billing history. Implement accessible cancellation and confirmation according to the approved policy.
- [ ] Deliver renewal, failed-payment, cancellation and refund messages with the correct dates and recovery links. Connect receipts/invoices and tax handling to the approved accounting process; verify actual issued documents.
- [ ] Implement refunds and payment-dispute handling for authorized staff, including access changes and an audit record. Provide reconciliation tools for cases where provider billing and local access disagree.
- [ ] Implement trials, coupons, upgrades/downgrades, prorations or pauses only if selected in the product decisions. Test their pricing and access transitions explicitly before advertising them.
- [ ] Test the full subscription lifecycle in the provider sandbox and complete a controlled live purchase, renewal-path verification, cancellation and refund check before opening paid enrollment.

### Administration and support

- [ ] Provide a restricted staff area or supported operational tools to find learners, inspect subscription/access state, resolve support requests and manage approved content releases. Start with the tasks staff actually need.
- [ ] Separate learner, support, content-editor and billing permissions as needed. Require strong staff authentication and audit sensitive access, refunds, entitlement overrides and account changes.
- [x] Document the current repository content-review, publication, live-check and rollback procedure in the [operations runbook](docs/OPERATIONS.md). This procedure records instructor approval but does not supply it.
- [ ] Obtain instructor approval for each required revision and decide whether repository editing remains sufficient before introducing a CMS.
- [ ] Add a way to report teaching errors, broken media and quiz issues with the relevant topic/question reference. Track resolution and notify affected learners when a correction warrants it.
- [x] Document current static-site support intake, source and rights escalation, technical outage triage, publication recovery and proposed maintenance cadence in the [operations runbook](docs/OPERATIONS.md).
- [ ] Write and rehearse future support procedures for lost access, duplicate purchases, billing failures, refunds and paid-service outages. Provide approved staff escalation paths and limits on access to learner data.

### Verification and launch

- [ ] Extend automated coverage for accounts, session expiry, authorization, learner-data isolation, progress, grading, checkout, webhook replay and subscription transitions. Verify denied access through direct page, API and media requests, not only hidden UI controls.
- [x] Audit the current static welcome, library, reading and quiz paths for responsive reflow, reduced motion, JavaScript fallbacks and local resource weight. Record findings and remaining manual checks in the [site quality review](docs/reviews/site-quality-2026-09-22.md).
- [ ] Exercise the future complete public-to-paid journey on desktop and mobile, including keyboard-only use, a screen reader, enlarged text, reduced motion, disabled or blocked JavaScript, slow networks and service failures.
- [ ] Complete the [remaining manual accessibility checks](docs/reviews/site-quality-2026-09-22.md#remaining-manual-checks-and-limits): VoiceOver or NVDA announcements/navigation, Windows forced colors, browser text-only enlargement, and physical iOS/Android behavior with browser chrome, virtual keyboards and safe areas. Include the account forms and password requirements feedback.
- [ ] Measure page weight, video startup, layout stability and service response times on representative phones/connections. Establish performance and cost budgets, then load-test expected concurrent playback and service traffic.
- [ ] Review authentication, payment and private-data handling before launch. Test privilege escalation, cross-account access, abusive requests, unsafe redirects and secret exposure, and resolve findings.
- [ ] Extend CI and staging checks for the new services and migrations while retaining `npm test`, `npm run check:media` and dependency checks. Keep credentials and private learner data out of repository fixtures and logs.
- [ ] Configure error monitoring, uptime checks and alerts for playback, login, payment-webhook and email failures. Redact personal data and credentials; identify who responds to each alert.
- [ ] Set operational targets for recovery time/data loss, service availability, rate limits, event deduplication retention, media-grant lifetime and alert thresholds. Rehearse them in staging and record support escalation owners.
- [ ] Add only the analytics needed to measure course discovery, checkout completion and learning use, subject to the approved privacy/consent decisions. Define events and retention before adding tracking services.
- [ ] Run a small instructor/learner pilot, collect issues and complete the paid-release acceptance checklist. Confirm all launch content, support routes, policy pages and operational owners are ready.
- [ ] Enable enrollment and publish the agreed public course pages only after acceptance. Update `PRODUCT.md`, `CONTEXT.md`, architecture and maintenance instructions to describe shipped behavior, then check live links, redirects, metadata, crawler responses and sharing previews.
- [ ] Verify backup restoration and rollback in staging, and document how to stop new purchases safely during an outage while preserving existing learner access where possible.

### Ongoing work and optional expansion

- [ ] Schedule teaching-content, official-link and policy reviews; renew asset permissions where needed and keep captions/transcripts aligned with revised media.
- [ ] Review failed payments, refunds, support volume, delivery errors, service costs and accessibility regressions. Reconcile billing and access regularly, maintain dependencies and rehearse recovery.
- [ ] Prioritize additional instructor-approved lessons and practice from learner feedback. Consider search within lessons and a glossary when the content supports them.
- [ ] Evaluate optional study reminders, offline public reading, additional languages, gift/group access and referral offers after the core paid service is stable. Each needs its own scope, accessibility/privacy review and cost justification.
- [ ] Add testimonials or outcome evidence only when real material and permission are supplied. Consider separate instructor/about or editorial pages only when there is enough distinct content to justify them.

## Security and unavailable actions

The page declares a Content Security Policy before its resource declarations. Scripts, images, fonts, and connections are restricted to the same origin. Inline JavaScript, plugins, frames, form submissions, and base-URL overrides are blocked. Inline styles remain permitted for the existing presentation and animation code. Keep production JavaScript in external modules and check the policy before adding an external service. `meta[name="referrer"]` declares `strict-origin-when-cross-origin` explicitly.

The browser security test verifies working navigation, topic selection, local icons, no external resource requests, and rejection of injected inline and external scripts. Header accessibility checks cover the visible brand wording in its accessible name and subtitle contrast. Unavailable course controls are disabled native buttons; unavailable social items are text with a shared explanation. Replace them with real links only when their destinations are supplied, and update the static-page tests and product/design documentation together.

## GitHub Pages limitations from the SEO audit

The following findings cannot be fully resolved by editing this repository while retaining the current GitHub Pages hosting. No inactive `_headers`, `.htaccess`, or misleading HTTP-header meta tags are included.

- **Longer cache lifetimes:** Pages currently sends `Cache-Control: max-age=600` and `Expires`. Longer asset caching requires a configurable host or CDN and asset URLs that change when their contents change. Keep HTML short-lived. See [Production caching](#production-caching).
- **Brotli delivery:** The current host negotiates gzip for HTML, CSS, and JavaScript. Brotli-only requests did not receive Brotli on the September 17, 2026 check. Committing `.br` files does not configure content negotiation; that requires host/CDN support. The audit's broader "no compression" warning is false.
- **Embedding protection:** `X-Frame-Options` and CSP `frame-ancestors` require HTTP response headers. The page's meta CSP cannot prevent other sites from framing it. See [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
- **MIME sniffing protection:** `X-Content-Type-Options: nosniff` requires a response header. Continue serving each file with its correct MIME type; HTML meta tags do not add this protection.
- **Browser capability policy:** `Permissions-Policy` for the top-level page requires a response header. The current site does not request camera, microphone, or geolocation access.
- **HSTS expansion:** Pages already sends `Strict-Transport-Security: max-age=31556952`. Adding `includeSubDomains` or changing preload status is a hosting/domain decision, not an HTML change. Existing HTTPS and HSTS protection are active; this is optional hardening, not missing TLS.

The referrer policy and supported CSP directives are implemented in HTML. Header-only audits may still report them as absent because the host does not emit equivalent headers. The five external stylesheets remain separate: the audit's estimated 40ms render-blocking saving does not justify inline CSS, a required build step, or a flash of unstyled content. About information, instructor expertise, and sharing metadata already exist. Captions, sharing buttons, policy pages, editorial statements, publication dates, and a physical address were not established as requirements for this welcome page; add them when useful and supported by real facts, not to satisfy generic audit heuristics.
