# Driving course website

This repository contains the public welcome page and the course-library preview for Oren Bachor's Hebrew driving course. The welcome page introduces the course. The preview adds independently accessible reading sections and placeholder practice quizzes; it remains marked noindex.

The hero fills the available viewport below the navigation with the course promise, two actions, and the stop sign. The student-photo road carousel now sits below the compact instructor introduction; together they fit one viewport below the sticky header on typical laptop and phone screens. On mobile, the instructor content stacks in reading order: title, image, then one description. The blue stop-sign illustration appears above the hero copy. Shorter screens and enlarged text can extend the hero naturally.

## Current page flow

The page moves through the hero, instructor introduction with its student-photo road carousel, one combined section with the three learning steps and learning-topic preview, and a closing first-lesson action before the footer. Under `#about`, the course has one heading, three introductory paragraphs, a compact learning-step strip, and the complete topic explorer. The paragraphs explain the audience, topics and examples, and how to review material alongside practical driving lessons. The main navigation has one link to the instructor and one to the course. Section links align their destination immediately below the sticky header, or at the viewport top when the mobile fallback header scrolls with the page.

The hero's main action, "מנחה הקורס", leads to the instructor; its secondary action leads to the unified course section at `#about`. The course-start controls in the topbar and closing section are disabled buttons labeled "הלמידה עדיין אינה זמינה" until a real course URL is supplied. No course playback, account, or enrollment flow exists yet.

Without JavaScript, or if the entry module fails to load, mobile navigation links remain visible in a header in normal document flow. Successful initialization enables the sticky header and collapsible menu. All seven topic descriptions are readable in the baseline HTML; initialization uses those descriptions for the interactive preview and hides the static summaries.

On mobile, pointer and touch input open the navigation and learning-topic list with a 180ms transition and close them over 150ms. Their trigger buttons provide subtle press feedback. Keyboard and assistive activation remain immediate. Closing menus stop accepting input as soon as they close, while CSS finishes the exit; rapid toggles reverse the transition. Reduced motion uses short opacity fades without movement. Browsers without discrete display transitions show and hide the menus immediately. `js/disclosure-motion.js` shares input handling and visibility state between these two controls.

Topic previews update immediately for keyboard and assistive activation. Pointer and touch selections animate the changing title and description while the explanatory note stays still. Reselecting the active topic does nothing. Reduced motion is read live and settles a pending topic change when enabled.

The instructor and unified course section reveal once on scroll. Focus immediately settles the containing section, and printing exposes all content even before it has been scrolled into view.

The footer shows Instagram, TikTok, YouTube, and WhatsApp as unavailable, noninteractive items, with a visible Hebrew note that contact and social links will be added later. Their four SVG icons are served locally from `assets/icons/social/`, with the upstream Font Awesome license and provenance alongside them. The page makes no requests to an external icon kit.

## Repository and publishing

The page folders follow the learning flow. Each page has its own `index.html`, so ordinary static hosting serves directory URLs:

```text
index.html
course/
  index.html
  css/                         Shared course, lesson and quiz styles
  js/                          Library search and quiz interaction
  right-of-way/
    index.html
    quizzes/
      priority/index.html
      left-turn/index.html
      right-turn/index.html
      u-turn/index.html
css/                           Site-wide base and homepage styles
js/                            Homepage enhancements and generated photo list
assets/                        Shared images, fonts and icons
scripts/                       Maintenance and verification tools
tests/
  unit/                        Node checks
  browser/                     Playwright Chromium journeys
  helpers/                     Shared test utilities
docs/                          Architecture, supplied references and plans
```

Open the library at `/course/`, the reading page at `/course/right-of-way/`, and quizzes at `/course/right-of-way/quizzes/<section-id>/`. The former root-level preview URLs have moved; update saved preview bookmarks. Links and assets stay relative so the same files can also be served under a directory prefix. The public homepage and crawler URLs are unchanged.

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

### Course library preview

Open `/course/` to review the approved open subject-library layout. Its nine learning topics include the welcome page's seven topics plus learning foundations and new-driver, licensing and penalty-points information. Searchable descriptions and expandable outlines cover the subjects in `docs/reference/the-idea.pdf`, including subjects listed only in its contents or resource pages. The [PDF coverage map](docs/reference/course-topic-coverage.md) records every source page and its library destination. All topics can be opened independently. Search also matches outline text and common topic synonyms. The last opened topic is saved in this browser only, under `oren-course:last-topic`; a return link appears on the next visit. No viewed/completed progress or accounts are implied.

This is a course preview, marked `noindex` and omitted from the public sitemap. Expanding the right-of-way and turns topic reveals a "ללמידה" link to `/course/right-of-way/`. This first reading draft adapts PDF pages 12-18 into four independently accessible sections: priority, left turns, right turns, and U-turns. `course/css/lesson.css` supplies its reading layout; native contents links work without JavaScript. The supplied PDF remains the content source, with the [official road-safety textbook](https://www.gov.il/BlobFolder/reports/driving_textbook/he/publications_2017_nohagim_aheret_nohagim_nachon.pdf) consulted for the priority hierarchy. Per the user's direction, source labels and links appear only in maintenance documentation, not on the learning page. Oren's review of the edited teaching copy remains a release prerequisite; generalized claims about pedestrian priority and fixed steering amounts in the PDF are not reproduced as instructions. Videos and the other learning pages are still outstanding, so the welcome page's course-start controls remain unavailable.

Each sub-subject has its own white section and compact descriptive video placeholders after key points. These use text with accessible labels, without missing media requests. Each section's practice button opens its own static page: `/course/right-of-way/quizzes/priority/`, `/course/right-of-way/quizzes/left-turn/`, `/course/right-of-way/quizzes/right-turn/`, or `/course/right-of-way/quizzes/u-turn/`. Each page owns its title, lesson return links, and 20 placeholder questions, including six video questions and four placeholder choices per question. Editing one quiz's content does not affect the others. The shared `course/js/quiz.js` reads the question fieldsets from that page and supplies direct question selection, previous/next navigation, and a selection-count summary with review. It contains no subject registry or lesson destinations. There is no answer key, grading, locking, or persistence across reloads. Selected choices remain while navigating within the current quiz. Without JavaScript, all 20 questions remain visible and usable. Replace placeholder content with instructor-approved questions and actual video assets in a future content pass; do not infer correct answers from placeholder options.

The library, learning page and practice-quiz pages use a clickable home brand and a blank profile slot reserved for future account actions. No profile menu or login state is implemented. At 900px and above, the enhanced library has a stable topic list on the right and a reading panel on the left. The list is a vertical tablist with Up/Down, Home/End and Tab support. Selection highlights a row and reads the title, description and outline from baseline HTML. Filtering chooses a matching outline when needed and hides the panel for empty results. Automatic initial and search selections do not overwrite remembered history.

Below 900px, or without JavaScript, topics appear as compact expandable rows. They share the native `details` name `course-topics`, allowing one open topic at a time in supporting browsers; older browsers retain usable disclosures without exclusivity. Viewport changes carry the selected topic and keyboard focus into the other presentation. The browsing order runs from foundations through road decisions to test preparation and licensing, without prerequisites. Search and remembered topics are optional enhancements. `course/css/course.css` extends the existing tokens, and `course/js/course-library.js` builds the desktop view from the baseline HTML. No generated images or new dependencies are needed.

The learning page's contents links use native smooth scrolling, scoped to `html.lesson-page`. Sub-subject sections are not programmatically focusable, so navigating to them does not focus or outline the whole reading section. Reduced motion uses immediate scrolling. Fragment URLs, keyboard links, and navigation with JavaScript disabled retain their native behavior.

The preview is served with the same command above. On the tailnet, use `http://<tailscale-ip>:8000/course/`. Its browser tests cover desktop and phone sizes, search and recovery, return visits, keyboard topic selection, disabled or blocked JavaScript, and unavailable or stale browser storage.

For a preview over an already configured Tailscale connection, keep this server running and use `http://<tailscale-ip>:8000/` from another device on the same tailnet. Find the address with `tailscale ip -4` and check the connection with `tailscale status`. On Linux, start a stopped daemon with `sudo systemctl start tailscaled`, then connect with `tailscale up`. This is a development preview; the public canonical URL remains the GitHub Pages address.

### Add learning sections and quizzes

Keep teaching content in static HTML so it remains usable without JavaScript. Create each learning page at `course/<topic>/index.html` with `.lesson-content` and link to its directory from `course/index.html` with `.subject-learn`. Keep the homepage as the only root HTML page.

1. Give each `.lesson-section` a unique, stable `id` and an `aria-labelledby` pointing to its heading. Add a matching `.lesson-contents` anchor. Keep the ID when changing a heading so bookmarks still work.
2. Copy a quiz page to `course/<topic>/quizzes/<section-id>/index.html`. Set its `<title>`, `<h1>`, and both `[data-lesson-link]` destinations to the correct lesson section, such as `../../#priority`. Link the section's `.lesson-quiz-link` to `quizzes/<section-id>/`, without a subject query parameter. Rebase relative home, stylesheet, script, font and image paths when changing folder depth. Keep shared course styles in `course/css/` and interaction modules in `course/js/`.
3. Edit that quiz's `.quiz-question` fieldsets, legends, referenced prompts, video slots, and radio labels. Keep unique question IDs, a distinct radio-group name per question, and unique choice values within the group. Keep loading `course/js/quiz.js`; no new subject registration or JavaScript change is needed. Current forms use `data-quiz-placeholder` to identify the approved placeholder layout. Remove that marker and update visible notices only when real content is approved.
4. Run `npm test`, `npm run check:media` when adding pages, image declarations or preloads, and `git diff --check`. `scripts/learning-content.mjs` discovers nested learning pages through `scripts/site-pages.mjs` and interprets their relationships once for structural and browser checks. Directory links and explicit `index.html` links resolve to the same authored page; malformed relationships retain file-specific diagnostics. Tests exercise every valid quiz with JavaScript enabled, disabled and blocked. Interaction checks use discovered question counts and video positions; the separate 20-question/four-choice assertions apply to forms marked `data-quiz-placeholder`.

The former shared `quiz.html?subject=...` preview has been replaced by these static quiz pages. Use the current links on the learning page.

## Page source maintenance

`index.html` is checked in with compact whitespace and remains directly editable and servable. After editing `index.html`, run `npm run minify:html` before publishing. This command only formats the welcome page. Preserve the existing formatting in course, learning and quiz HTML; content changes do not require a formatting pass. Run it after `npm run optimize:media` when updating images. The command preserves single spaces between inline elements, literal whitespace in `pre` and `textarea`, SVG attribute casing, and image metadata. It reports both raw and gzip byte counts; gzip is a comparison here, not a server configuration change.

The entry script uses `type="module"`, so browsers defer its execution automatically. Keeping it in the head lets its download start early. Every HTML image has an `alt` attribute. The brand icon uses the requested Hebrew alternative `alt="לוגו"`; the enclosing link retains its descriptive accessible name.

## Search and sharing metadata

`index.html` includes a Hebrew search title and description, a canonical URL, Open Graph and X card metadata, and JSON-LD describing the website, welcome page, course, and instructor. Keep these descriptions aligned with the visible course and instructor copy. The sharing image reuses the supplied `assets/images/oren.jpg`; no separate artwork or image-generation step is required. Social sharing metadata works without having social-profile accounts.

The public canonical URL is `https://oren-bechor-drive.github.io/`. If the site moves, update the canonical link, social URLs, JSON-LD identifiers and URLs, `robots.txt`, `sitemap.xml`, and `llms.txt` together. The sitemap lists the single public welcome page; section anchors are not separate pages. Add new published pages when they exist, and add `lastmod` only if an accurate modification date can be maintained. `robots.txt` allows public crawling and points to the sitemap.

`llms.txt` provides a short Hebrew overview and links to the existing course and instructor sections, following the [llms.txt proposal](https://llmstxt.org/). The page links it with `rel="describedby"`. Keep the summary and links aligned with the page when course facts, section IDs, or available enrollment/playback capabilities change. It is maintained directly, with no generation or runtime step, and does not replace the page or sitemap.

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

Interface arrows and chevrons use the eight selected Font Awesome Classic Solid SVGs in [`assets/icons/directions/`](assets/icons/directions/README.md). `css/base.css` applies them as local CSS masks in the control's current text color. The homepage topic dropdown, course topic controls, lesson/quiz return links and quiz question selector share this icon family. No icon font or external kit is loaded. CSS mask requests are outside the media audit's coverage; check their delivery in the browser from both root and nested pages when changing paths.

Varela Round's `@font-face` declarations live in `css/base.css` with `font-display: swap`. The original Google Fonts v21 WOFF2 subsets are served from `assets/fonts/`, with their SIL Open Font License and source URLs in that directory. Hebrew and Latin are preloaded in the HTML so they download alongside CSS. Both are used by the initial page, including punctuation and digits. Only Hebrew and Latin subsets are included; the unused Vietnamese and extended Latin files and declarations have been removed.

Font preloads require `crossorigin` even for local files so CSS can reuse them. Keep preload paths synchronized with the CSS when updating fonts. No Google Fonts stylesheet or preconnect is needed at runtime. The browser delivery test holds CSS responses to verify early font and high-priority logo downloads and checks that the page uses both fonts without duplicate requests.

## Maintain road artwork

`assets/images/road.jpg` is the repeating background. The six active car sprites are cyan, gray, green, orange, red, and yellow in `assets/images/cars/car-*.png`. Their static HTML entries also serve as JavaScript templates. Changing the car palette requires updating those entries and the matching `.road-car-*` alignment rules in `css/welcome.css`.

Alignment compensates for transparent margins in each source image. Student photos sit over the roofs with 8px rounded corners and a subtle 3px edge fade applied in CSS. Preserve original image bytes during layout changes. `assets/images/cars/cars.png` is supplied source artwork and is intentionally not loaded by the page.

## Project files

- `index.html` contains the Hebrew, right-to-left welcome page. `course/index.html` contains the open learning-topic library; `course/right-of-way/index.html` contains its first reading draft; each `course/right-of-way/quizzes/*/index.html` page owns one learning section's practice questions.
- `course/css/course.css`, `course/css/lesson.css`, and `course/css/quiz.css` style the course preview. `course/js/course-library.js` enhances library search and last-topic return; `course/js/quiz.js` enhances independently authored question fieldsets.
- `robots.txt` and `sitemap.xml` expose the canonical welcome page to crawlers; `llms.txt` summarizes the course and links to its public sections.
- `css/base.css` defines design tokens, global defaults, and shared layout widths.
- `css/components.css` styles the header and navigation.
- `css/welcome.css` styles the welcome-page sections and their controls.
- `css/responsive.css` contains interaction states, animations, breakpoints, and accessibility preferences. Load the four stylesheets in this order to preserve the cascade.
- `js/script.js` adds the mobile menu and initializes page enhancements.
- `js/topic-explorer.js` owns the topic preview interaction.
- `js/disclosure-motion.js` shares mobile menu and topic-list visibility, input handling, and press feedback.
- `js/hero-road-car.js` animates the small red car along the hero's SVG road.
- `js/scroll-reveal.js` reveals the instructor and unified course section once as each enters the viewport.
- `js/road-carousel.js` builds the looping student gallery from the supplied photo list. `js/script.js` supplies the lazily imported generated list in production.
- `scripts/site-pages.mjs` discovers authored HTML for both learning and media checks, sharing the directory exclusions listed in [Architecture](docs/ARCHITECTURE.md#media-verification).
- `scripts/road-media-integrity.mjs` audits local image sources, responsive candidates and preloads across those pages, including ordinary SVGs and scaled brand images. Marked road media, car templates and numbered student photos retain their stricter checks.
- `scripts/learning-content.mjs` interprets and validates learning sections and their practice-quiz relationships for structural and browser tests. It returns plain records and file-specific issues without a runtime content registry.
- `js/road-photo-sources.js` is the generated complete photo list and responsive delivery metadata.
- `scripts/optimize-road-media.mjs` regenerates that list and WebP delivery copies without changing originals.
- `scripts/student-photos.mjs` owns student photo discovery, numeric ordering, and filename diagnostics for the optimizer and media audit. The optimizer stops on findings; the audit collects them and continues checking media.
- `assets/images/` contains the stop-sign illustration, road background, car artwork, instructor photo, and numbered student photos. `assets/icons/` contains the course icon. Typography uses Varela Round globally, with local WOFF2 files under `assets/fonts/`.
- `docs/reference/the-idea.pdf` is the supplied course brief.
- `tests/unit/` contains Node checks for static pages, behavior, learning content, media integrity and maintenance scripts. Run them with `npm run test:unit`.
- `tests/browser/` contains Chromium journeys for the welcome page, course, quizzes, accessibility, motion and image delivery. Run them with `npm run test:browser`; `npm test` runs both groups.
- `tests/helpers/road-media.mjs` serves repository files and directory index pages in browser tests with consistent MIME types and original byte counts for HEAD requests. Individual tests own delays, failures, and download observations.

### Automated checks

[The Tests workflow](.github/workflows/tests.yml) runs on every push and pull request, and can also be started manually from GitHub Actions. It uses Node.js 24 on GitHub's hosted Ubuntu 24.04 runner, `ubuntu-24.04`, installs the locked dependencies with `npm ci`, checks them with `npm audit`, and installs Chromium with its system dependencies, then runs `npm run check:media` and the full `npm test` suite. This includes static and behavior tests, optimizer tests, and all Chromium gallery and image-delivery checks. New tests matching `tests/*/*.test.mjs` are included automatically.

The workflow uses `actions/setup-node` with `cache: npm` to reuse downloaded dependencies between runs.

Animation regressions cover focus during section entrances, visibility in print, immediate keyboard topic selection, live reduced-motion changes, and keeping unchanged topic text still. Hero-car checks cover road position, orientation, and elapsed-time preservation on resize. Gallery tests cover refilling metadata request slots, deferred photo additions at a real animation loop boundary, and resizing the preserved row after a later loading failure. Scroll-reveal tests bound their animation-capture waits so a missing reveal fails instead of hanging the suite.

`tests/browser/progressive-enhancement-browser.test.mjs` exercises navigation and topic selection at desktop and phone widths. It also checks visible navigation and all seven descriptions with JavaScript disabled or the entry module blocked. Section-alignment tests distinguish the sticky header from the mobile fallback's zero scroll offset. The unavailable-IntersectionObserver test checks for browser errors and verifies that topic selection initializes and the local footer icons remain available.

Learning-content fixture tests exercise malformed authored HTML through the same verifier used by the real-page tests. Quiz browser tests follow authored order rather than fixed question IDs; additional one-question and five-question fixtures cover nonnumeric IDs and a video in the first question. Gallery behavior tests supply independent photo lists and verify that concurrent instances do not mutate generated metadata. The site-media tests cover nested pages, ordinary logos/SVGs, missing candidates and preloads, and command failure outside the welcome page.

`tests/unit/seo-metadata.test.mjs` checks consistent canonical and sharing metadata, the existing sharing image's type and dimensions, and linked structured-data entities. `tests/unit/crawler-discovery.test.mjs` checks crawl access, sitemap consistency, and that `llms.txt` links point to real page sections. These checks validate the repository files, not search ranking or production deployment.

CI audits the checked-in media. Photo and artwork changes still require running `npm run optimize:media` locally and publishing its output with the originals. The workflow does not deploy the site.

### Local checks

Development checks require Node.js 22.22.2 or newer in the 22.x line, 24.15.0 or newer in the 24.x line, or 26 or newer, plus Playwright's Chromium browser. CI uses Node.js 24. Install the locked development dependencies and browser once, then run the checks:

```bash
npm ci
npx playwright install chromium
npm audit
npm test
npm run check:media
git diff --check
```

The media audit discovers authored root and nested HTML pages and reports each finding with its page. It checks local `img` sources, `srcset`, picture candidates and image preload `href`/`imagesrcset`; declared preload MIME types must match. Ordinary JPEG, WebP and PNG headers and responsive widths are checked, while ordinary SVGs must be valid SVG XML. Display-sized logos may differ from intrinsic image dimensions. Marked road media retains exact original dimensions and alternative-text checks. Student-gallery checks still cover car templates, numeric photo order, generated delivery copies and stale photo-list metadata. The supplied `cars.png` composite remains excluded from car templates. External/embedded URLs are skipped without fetching. This audit does not discover CSS image URLs, validate video files, decode full raster images or inspect rendered cropping. See [media verification](docs/ARCHITECTURE.md#media-verification) for discovery exclusions and focused test interfaces.

Browser tests derive the gallery count and last photo from the generated list. Progressive-append scenarios require enough photos to fill the initial viewport and leave a later photo pending; smaller galleries skip those scenarios. Tests also check loading from the generated photo list without missing-file probes, failure preservation, and loop timing across row sizes and viewport changes. `npm test` includes Chromium checks that load the actual page, stylesheets, scripts, and images at desktop and phone sizes, including resizing and reduced motion. They intercept local requests to serve repository files and block external requests, so no dev server or network connection is needed after setup. Verify layout and interaction changes in the collaborative browser at desktop and phone sizes, including reduced motion. If collaborative preview is unavailable, use local Playwright Chromium and report the limitation.

## Documentation

- [PRODUCT.md](PRODUCT.md): current audience, scope, and supplied evidence.
- [DESIGN.md](DESIGN.md): visual system and the approved welcome-page composition.
- [CONTEXT.md](CONTEXT.md): course and gallery terminology.
- [Architecture](docs/ARCHITECTURE.md): content verification, site-wide media coverage and student-gallery ownership.
- [AGENTS.md](AGENTS.md): contributor boundaries and required checks.
- [Font sources and license](assets/fonts/README.md): the local font files and their delivery requirements.
- [Supplied course brief](docs/reference/the-idea.pdf): original instructor and course material.

## Licensing

Website code is available under the [MIT License](LICENSES/MIT.txt).
The four social icons are Font Awesome Free 7.3.1 assets under CC BY 4.0; see [their license and attribution](assets/icons/social/README.md).
Course content, photos, artwork, and branding are excluded.
See [LICENSE](LICENSE) for the complete scope.

## Todo

- Defer a shared course-content module until a second runtime page needs the same course content.
- Revisit shared header markup when profile behavior exists; the preview already shares course, lesson and quiz styles.
- Add Firefox and WebKit smoke checks for page loading, navigation, and topic selection.


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

The referrer policy and supported CSP directives are implemented in HTML. Header-only audits may still report them as absent because the host does not emit equivalent headers. The four external stylesheets remain separate: the audit's estimated 40ms render-blocking saving does not justify inline CSS, a required build step, or a flash of unstyled content. About information, instructor expertise, and sharing metadata already exist. Captions, sharing buttons, policy pages, editorial statements, publication dates, and a physical address were not established as requirements for this welcome page; add them when useful and supported by real facts, not to satisfy generic audit heuristics.
