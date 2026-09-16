# Driving course welcome page

This is the first welcome-page concept for Oren Bachor's Hebrew driving course. The current direction is a **Learning journey** that introduces the course, explains how it connects theory to real road situations, and lets visitors preview the learning topics.

The hero fills the available viewport below the navigation with the course promise, two actions, and the stop sign. The student-photo road carousel now sits below the compact instructor introduction; together they fit one viewport below the sticky header on typical laptop and phone screens. On mobile, the instructor content stacks in reading order: title, image, then one description. The cyan stop-sign illustration appears above the hero copy. Shorter screens and enlarged text can extend the hero naturally.

## Current page flow

The page moves through the hero, instructor introduction with its student-photo road carousel, one combined section with the three learning steps and learning-topic preview, and a closing first-lesson action before the footer. The course uses one heading and introduction, a compact learning-step strip, and the complete topic explorer under `#about`. The main navigation has one link to the instructor and one to the course. Section links align their destination immediately below the sticky header, or at the viewport top when the mobile fallback header scrolls with the page.

The hero’s main action, “מנחה הקורס”, leads to the instructor; its secondary action leads to the unified course section at `#about`. The course-start actions in the topbar and closing section intentionally use `href="#"`, as requested, until a real course URL is supplied. No course playback, account, or enrollment flow exists yet.

Without JavaScript, or if the entry module fails to load, mobile navigation links remain visible in a header in normal document flow. Successful initialization enables the sticky header and collapsible menu. All seven topic descriptions are readable in the baseline HTML; initialization uses those descriptions for the interactive preview and hides the static summaries.

On mobile, pointer and touch input open the navigation and learning-topic list with a 180ms transition and close them over 150ms. Their trigger buttons provide subtle press feedback. Keyboard and assistive activation remain immediate. Closing menus stop accepting input as soon as they close, while CSS finishes the exit; rapid toggles reverse the transition. Reduced motion uses short opacity fades without movement. Browsers without discrete display transitions show and hide the menus immediately. `js/disclosure-motion.js` shares input handling and visibility state between these two controls.

Topic previews update immediately for keyboard and assistive activation. Pointer and touch selections animate the changing title and description while the explanatory note stays still. Reselecting the active topic does nothing. Reduced motion is read live and settles a pending topic change when enabled.

The instructor and unified course section reveal once on scroll. Focus immediately settles the containing section, and printing exposes all content even before it has been scrolled into view.

The footer includes Instagram, TikTok, YouTube, and WhatsApp links, currently pointing to `#`. Their icons load from Font Awesome kit `a138530222` when the footer is within 300px of the viewport. Hebrew link labels remain visible if the external kit is unavailable. Browsers without IntersectionObserver request the kit after page load.

## Open locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

No installation or build step is required.

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
   npm run check:media
   npm test
   ```

3. Publish the original PNG changes, `assets/images/optimized/`, generated `js/road-photo-sources.js`, and updated `index.html` together, including any deletions.

The generated module is the complete gallery list. New photos appear only after regenerating and publishing it. Regenerate after replacements too, including replacements with the same byte count. Do not edit the generated module by hand. `check:media` catches added or removed photos missing from the list and original-size mismatches.

The carousel loads listed photos in numeric order, then repeats. Car colors are randomized independently, and adding photos preserves the travel speed. The gallery calculates loop duration from the rendered row width and car spacing, and recalculates it on viewport resize. The approved cadence is about 11.11 seconds per car on desktop and 9.46 seconds on phones; tune `--road-seconds-per-car` in the corresponding CSS rule to change it. Car sizing follows road height with a separate car-scale setting.

The browser runs up to four `HEAD` requests concurrently for listed photos to check their content type and original byte count, refilling each available request slot immediately. Confirmed photos start decoding immediately; only consecutive decoded photos enter the visible row. Requests use normal browser caching. It never probes a missing next number to find the end, avoiding routine 404 console errors. A failed request for a listed file is treated as a loading failure.

Motion starts once six consecutive photos have decoded, or all photos for a smaller gallery. Wider viewports require enough cars to cover the viewport with one car of spare space. Later decoded photos join in numeric order while preserving the visible cars' position and travel speed. If the repeated row is visible, the append waits for the next loop boundary. Reduced motion shows available photos without waiting for that boundary.

Photo completions and resize events share one update per animation frame. Each update reads geometry before changing the row. New loop distances use the measured equal car widths, gap, end padding, and minimum row width, avoiding a layout read after inserting cars. Keep that calculation consistent with `.road-car` and `.road-carousel-group` if their layout changes.

Startup and individual requests/decodes have an eight-second deadline. A stalled initial load uncovers the static fallback. A later failure freezes photo additions but keeps the already working row responsive. Resizing updates its duration while preserving its position within the animation cycle. Photos after the initial row receive lower download priority than the initial row.

Until the initial row is ready, the gallery's `aria-busy` state shows the supplied wheel rotating over a light white blur. The overlay clears as the initial row becomes ready or falls back after an empty result, error, or timeout. Reduced motion keeps the loading wheel still. Without JavaScript, the overlay stays hidden.

The HTML provides six initial static photos while listed photos load, when loading fails, or when JavaScript is unavailable. Keep those declarations synchronized if you replace or remove the initial photos. With reduced motion enabled, the loaded row stays static and its duplicate is hidden. The road clips horizontal overflow in every mode; it has no drag, click, or pause controls.

## Optimize delivery images

Original image files stay in their supplied paths. The page uses responsive WebP delivery copies for the course icon, wheel, stop sign, car sprites, student photos, and instructor photo. Resizing preserves aspect ratios and transparent margins, so car and roof alignment stay unchanged. The browser tab uses a separate 32px PNG favicon.

The instructor photo comes from `assets/images/oren.jpg`. The same optimizer generates 400px, 640px, and 1080px WebP copies at quality 78 without changing the JPEG. Its lazy-loaded image declares responsive sizes matching the instructor layout. Publish the original, generated copies, and HTML together after replacing the photo.

The photo-maintenance command above also regenerates responsive delivery copies for all road media. To regenerate after changing artwork, run:

```bash
npm run optimize:media
npm run check:media
npm test
```

Publish generated files with their originals as described under [Add or update student photos](#add-or-update-student-photos). The optimizer synchronizes image candidates and dimensions in the HTML, refreshes the complete photo list, and removes obsolete WebPs only within the generated directory. This maintenance step is required when photos change; opening or serving the checked-in site still requires no build. Runtime loading falls back to the PNG if a delivery copy fails to decode or the original's Content-Length no longer matches the generated metadata.

The HTML keeps original road-image dimensions and uses width descriptors in `srcset` plus `sizes` for delivery copies. Smaller variants serve ordinary desktop screens; larger variants support high-density screens without enlarging an original. Photo sizing accounts for the `object-fit: cover` crop. The optimizer's size formulas follow the road height, car scale, and photo frame in `css/welcome.css` and `css/responsive.css`; update them if that geometry changes. Car sprite sizing reads each color's `--car-art-width` rule. The hero car uses separate 80px and 160px WebP copies of the red-car artwork with `sizes="clamp(40px, 5vw, 80px)"`, matching its smaller CSS width. Module preload hints fetch carousel dependencies alongside the entry script.

Student photos include intermediate 320px, 360px, and 400px candidates between the smallest desktop copy and the largest copy, capped at the original width. Candidates within 5% of the largest source are omitted in favor of that larger copy. These let phones select a closer fit without downloading the desktop 2x image. Width descriptors always reflect the generated file's actual width.

WebP quality is 65 for intermediate and large photos, 78 for the smallest photos, 80 for cars, and 85 for the logo and stop sign. The red gallery car keeps RGB quality 80 with alpha quality 73 to reduce transparency data; the other cars and the small hero copies retain the default alpha quality. The smallest version of photo 11 uses quality 55 for its dense background. Both wheel sizes use quality 65 and alpha quality 60. Check faces, lettering, and transparent edges at their displayed sizes after changing these settings.

`tests/image-delivery-browser.test.mjs` checks actual browser source selection, image bytes, high-density coverage, and rendering without JavaScript. It covers desktop at 1x and 2x, plus phones at 1.75x and 2x. Density checks include the hero car and instructor photo, account for cover cropping, and allow 0.5% for fractional rendering geometry. Road-media download budgets scale with the generated photo count: desktop allows 115 KiB plus 9 KiB per photo, and mobile allows 120 KiB plus 12 KiB per photo. With 15 photos these are 250 KiB and 300 KiB. The instructor photo has a separate budget of 100 KiB at 1x and 250 KiB at higher densities. The 412px phone check also limits oversized photo candidates. The 128px and 256px wheel downloads are capped at 6 KiB and 13 KiB; the smallest photo 11 is capped at 8 KiB.

## Font delivery

Varela Round's `@font-face` declarations live in `css/base.css` with `font-display: swap`. The original Google Fonts v21 WOFF2 subsets are served from `assets/fonts/`, with their SIL Open Font License and source URLs in that directory. Hebrew and Latin are preloaded in the HTML so they download alongside CSS. Both are used by the initial page, including punctuation and digits. Only Hebrew and Latin subsets are included; the unused Vietnamese and extended Latin files and declarations have been removed.

Font preloads require `crossorigin` even for local files so CSS can reuse them. Keep preload paths synchronized with the CSS when updating fonts. No Google Fonts stylesheet or preconnect is needed at runtime. The browser delivery test holds CSS responses to verify early font downloads and checks that the page uses both fonts without duplicate requests.

## Maintain road artwork

`assets/images/road.jpg` is the repeating background. The six active car sprites are cyan, gray, green, orange, red, and yellow in `assets/images/cars/car-*.png`. Their static HTML entries also serve as JavaScript templates. Changing the car palette requires updating those entries and the matching `.road-car-*` alignment rules in `css/welcome.css`.

Alignment compensates for transparent margins in each source image. Student photos sit over the roofs with 8px rounded corners and a subtle 3px edge fade applied in CSS. Preserve original image bytes during layout changes. `assets/images/cars/cars.png` is supplied source artwork and is intentionally not loaded by the page.

## Project files

- `index.html` contains the Hebrew, right-to-left page content.
- `css/base.css` defines design tokens, global defaults, and shared layout widths.
- `css/components.css` styles the header and navigation.
- `css/welcome.css` styles the welcome-page sections and their controls.
- `css/responsive.css` contains interaction states, animations, breakpoints, and accessibility preferences. Load the four stylesheets in this order to preserve the cascade.
- `js/script.js` adds the mobile menu and initializes page enhancements.
- `js/topic-explorer.js` owns the topic preview interaction.
- `js/disclosure-motion.js` shares mobile menu and topic-list visibility, input handling, and press feedback.
- `js/hero-road-car.js` animates the small red car along the hero's SVG road.
- `js/scroll-reveal.js` reveals the instructor and unified course section once as each enters the viewport.
- `js/road-carousel.js` loads the generated photo list and builds the looping car gallery.
- `scripts/road-media-integrity.mjs` audits marked JPEG, WebP, and PNG road media, image preloads, declared delivery copies, car templates, and numbered student photos during development.
- `js/road-photo-sources.js` is the generated complete photo list and responsive delivery metadata.
- `scripts/optimize-road-media.mjs` regenerates that list and WebP delivery copies without changing originals.
- `scripts/student-photos.mjs` owns student photo discovery, numeric ordering, and filename diagnostics for the optimizer and media audit. The optimizer stops on findings; the audit collects them and continues checking media.
- `assets/images/` contains the stop-sign illustration, road background, car artwork, instructor photo, and numbered student photos. `assets/icons/` contains the course icon. Typography uses Varela Round globally, with local WOFF2 files under `assets/fonts/`.
- `docs/reference/the-idea.pdf` is the supplied course brief.
- `tests/` contains static page, behavior-level, media-integrity, and Chromium gallery tests.
- `tests/helpers/road-media.mjs` serves repository files in browser tests with consistent MIME types and original byte counts for HEAD requests. Individual tests own delays, failures, and download observations.

### Automated checks

[The Tests workflow](.github/workflows/tests.yml) runs on every push and pull request, and can also be started manually from GitHub Actions. It uses Node.js 24 on Ubuntu, installs the locked dependencies with `npm ci`, checks them with `npm audit`, and installs Chromium with its system dependencies, then runs `npm run check:media` and the full `npm test` suite. This includes static and behavior tests, optimizer tests, and all Chromium gallery and image-delivery checks. New tests matching `tests/*.test.mjs` are included automatically.

Animation regressions cover focus during section entrances, visibility in print, immediate keyboard topic selection, live reduced-motion changes, and keeping unchanged topic text still. Hero-car checks cover road position, orientation, and elapsed-time preservation on resize. Gallery tests cover refilling metadata request slots, deferred photo additions at a real animation loop boundary, and resizing the preserved row after a later loading failure. Scroll-reveal tests bound their animation-capture waits so a missing reveal fails instead of hanging the suite.

`tests/progressive-enhancement-browser.test.mjs` exercises navigation and topic selection at desktop and phone widths. It also checks visible navigation and all seven descriptions with JavaScript disabled or the entry module blocked. Section-alignment tests distinguish the sticky header from the mobile fallback's zero scroll offset. The unavailable-IntersectionObserver test checks for browser errors and verifies that topic selection and footer icon loading still initialize.

CI audits the checked-in media. Photo and artwork changes still require running `npm run optimize:media` locally and publishing its output with the originals. The workflow does not deploy the site.

### Local checks

Development checks require Node.js 22.22.2 or newer in the 22.x line, 24.15.0 or newer in the 24.x line, or 26 or newer, plus Playwright’s Chromium browser. CI uses Node.js 24. Install the locked development dependencies and browser once, then run the checks:

```bash
npm ci
npx playwright install chromium
npm audit
npm test
npm run check:media
git diff --check
```

The media audit checks marked HTML images and independently checks every image preload's file and MIME type, including the preloaded `road.jpg` background. It matches car templates to the `car-*.png` files and inspects every numbered student photo without a fixed maximum. It validates the scrolling group’s direct child templates, matching runtime initialization, and reports misplaced or malformed templates, numbering gaps, invalid PNG filenames, missing or duplicate templates, incorrect fallback photo references or metadata, and a missing or stale generated photo list. The supplied `cars.png` composite is excluded. It checks delivery candidates from both the HTML and the generated gallery list, including missing files and incorrect width descriptors. It checks image headers and dimensions, not full decoding or roof alignment, and does not discover arbitrary image URLs in CSS.

Browser tests derive the gallery count and last photo from the generated list. Progressive-append scenarios require enough photos to fill the initial viewport and leave a later photo pending; smaller galleries skip those scenarios. Tests also check loading from the generated photo list without missing-file probes, failure preservation, and loop timing across row sizes and viewport changes. `npm test` includes Chromium checks that load the actual page, stylesheets, scripts, and images at desktop and phone sizes, including resizing and reduced motion. They intercept local requests to serve repository files and block external requests, so no dev server or network connection is needed after setup. Verify layout and interaction changes in the collaborative browser at desktop and phone sizes, including reduced motion. If collaborative preview is unavailable, use local Playwright Chromium and report the limitation.

## Documentation

- [PRODUCT.md](PRODUCT.md): current audience, scope, and supplied evidence.
- [DESIGN.md](DESIGN.md): visual system and the approved welcome-page composition.
- [CONTEXT.md](CONTEXT.md): course and gallery terminology.
- [AGENTS.md](AGENTS.md): contributor boundaries and required checks.
- [Supplied course brief](docs/reference/the-idea.pdf): original instructor and course material.

## Licensing

Website code is available under the [MIT License](LICENSES/MIT.txt).
Course content, photos, artwork, and branding are excluded.
See [LICENSE](LICENSE) for the complete scope.

## Todo

- Defer a shared course-content module until a second runtime page needs the same course content.
- Revisit shared layout and styling when a second page reveals what needs to repeat beyond the existing CSS tokens and styles.
- Add Firefox and WebKit smoke checks for page loading, navigation, and topic selection.
