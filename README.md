# Driving course welcome page

This is the first welcome-page concept for Oren Bachor's Hebrew driving course. The current direction is a **Learning journey** that introduces the course, explains how it connects theory to real road situations, and lets visitors preview the learning topics.

The hero fills the available viewport below the navigation and ends with the student-photo road carousel. A smaller stop sign and compact spacing keep the full composition visible on typical laptop and phone screens. On mobile, the cyan stop-sign illustration appears above the course introduction. Shorter screens and enlarged text can extend the hero naturally.

## Current page flow

The page moves through the hero with its student-photo road carousel, instructor introduction, course explanation, and learning-topic preview, followed directly by the site footer. The main navigation links to the course explanation, topic preview, and instructor introduction. The instructor's amber section aligns directly below the sticky header when reached through `#instructor`.

The hero learning action leads to the topic preview. The topbar learning action still uses `href="#"` to reserve a future account-page destination; no account or enrollment flow exists yet.

The footer includes Instagram, TikTok, YouTube, and WhatsApp links, currently pointing to `#`. Their icons load from Font Awesome kit `a138530222`; Hebrew link labels remain visible if the external kit is unavailable.

## Open locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

No installation or build step is required.

## Add student photos

Place photos in `assets/images/students-pass/` with consecutive names: `1.png`, `2.png`, `3.png`, and so on. Add the next number and publish the files as usual; no code or photo-count setting needs updating.

The carousel discovers the files on page load and shows them in numeric order, then repeats. There is no maximum count. Keep the numbering consecutive: discovery stops at the first missing file. Car colors are randomized independently, and adding photos preserves the travel speed. The gallery calculates loop duration from the rendered row width and car spacing, and recalculates it on viewport resize. The approved cadence is about 11.11 seconds per car on desktop and 9.46 seconds on phones; tune `--road-seconds-per-car` in the corresponding CSS rule to change it. Car sizing follows road height with a separate car-scale setting.

Discovery makes one sequential `HEAD` request per photo, followed by a request for the first missing number. The server must return an image content type for existing photos and HTTP 404 for missing files. Each discovered photo must decode before motion starts, so larger galleries take longer to initialize.

During discovery and decoding, the gallery's `aria-busy` state shows the supplied wheel rotating over a light white blur. The overlay clears as the gallery becomes ready or falls back after an empty result or error. Reduced motion keeps the loading wheel still. Without JavaScript, the overlay stays hidden.

The HTML provides six initial static photos while discovery runs, when it fails, or when JavaScript is unavailable. Keep those declarations synchronized if you replace or remove the initial photos. With reduced motion enabled, the discovered row stays static and its duplicate is hidden. The road clips horizontal overflow in every mode; it has no drag, click, or pause controls.

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
- `js/road-carousel.js` discovers numbered student photos and builds the looping car gallery.
- `scripts/road-media-integrity.mjs` audits marked JPEG, WebP, and PNG road media, car templates, and numbered student photos during development.
- `assets/images/` contains the stop-sign illustration, road background, car artwork, and numbered student photos. `assets/icons/` contains the course icon. Typography uses Varela Round globally and loads it from Google Fonts.
- `docs/reference/the-idea.pdf` is the supplied course brief.
- `docs/superpowers/` preserves historical implementation plans and specifications. Those files can contain obsolete paths, media counts, and markup from earlier versions. Use this README for the current structure and paths.
- `tests/` contains static page, behavior-level, media-integrity, and Chromium gallery tests.

Development checks require Node.js 20 or newer and Playwright’s Chromium browser. Install the development dependencies and browser once, then run the checks:

```bash
npm install
npx playwright install chromium
npm test
npm run check:media
git diff --check
```

The media audit checks marked HTML images and their preload metadata, matches car templates to the `car-*.png` files, and inspects every numbered student photo without a fixed maximum. It validates the scrolling group’s direct child templates, matching runtime initialization, and reports misplaced or malformed templates, numbering gaps, invalid PNG filenames, missing or duplicate templates, and incorrect fallback photo references or metadata. The supplied `cars.png` composite is excluded. It checks image headers and dimensions, not full decoding, roof alignment, or the CSS road background.

Tests also check runtime discovery, failure preservation, and loop timing across row sizes and viewport changes. `npm test` includes a focused Chromium check that loads the actual page, stylesheets, scripts, and images at desktop and phone sizes, including resizing and reduced motion. It intercepts local requests to serve repository files and blocks external font requests, so no dev server or network connection is needed after setup. Verify layout and interaction changes in the collaborative browser at desktop and phone sizes, including reduced motion.

## Documentation

- [PRODUCT.md](PRODUCT.md): current audience, scope, and supplied evidence.
- [DESIGN.md](DESIGN.md): visual system and the approved welcome-page composition.
- [CONTEXT.md](CONTEXT.md): course and gallery terminology.
- [AGENTS.md](AGENTS.md): contributor boundaries and required checks.
- [Original welcome-page spec](docs/superpowers/specs/2026-09-10-learning-journey-welcome-page-design.md) and [plan](docs/superpowers/plans/2026-09-10-learning-journey-welcome-page.md): archived initial implementation.
- [Architecture-hardening spec](docs/superpowers/specs/2026-09-11-architecture-hardening-design.md) and [plan](docs/superpowers/plans/2026-09-11-architecture-hardening.md): archived refactor rationale.

## Todo

- Update `image-size` when a release fixes its ICNS/JXL/HEIF parser advisories. The audit imports only the JPEG, WebP, and PNG parser subpaths, so the affected parsers are not loaded. `npm audit` still reports the package-level advisory.

- Build the **Instructor-led welcome** direction around Oren Bachor's story and teaching approach.
- Build the **Course-dashboard preview** direction with lesson modules and realistic course navigation.
- Introduce a **shared course-content module** when the second runtime page creates a real seam between two page adapters.
- Revisit the **visual-system interface** after another page reveals which layout and styling decisions genuinely repeat.
- Expand to **full browser automation** beyond the focused gallery check when continuous integration or multiple interactive pages justify broader coverage.
