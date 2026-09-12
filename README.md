# Driving course welcome page

This is the first welcome-page concept for Oren Bachor's Hebrew driving course. The current direction is a **Learning journey** that introduces the course, explains how it connects theory to real road situations, and lets visitors preview the learning topics.

The hero fills the available viewport below the navigation. On mobile, the cyan stop-sign illustration appears above the course introduction.

## Current page flow

The page moves through the hero, course explanation, learning-topic preview, instructor introduction, and closing learning action. The main navigation links to the course explanation, topic preview, and instructor introduction.

## Open locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

No installation or build step is required.

## Project files

- `index.html` contains the Hebrew, right-to-left page content.
- `css/base.css` defines design tokens, global defaults, and shared layout widths.
- `css/components.css` styles the header and navigation.
- `css/welcome.css` styles the welcome-page sections and their controls.
- `css/responsive.css` contains interaction states, animations, breakpoints, and accessibility preferences. Load the four stylesheets in this order to preserve the cascade.
- `js/script.js` adds the mobile menu and initializes page enhancements.
- `js/topic-explorer.js` owns the topic preview interaction.
- `scripts/road-media-integrity.mjs` audits marked JPEG, WebP, and PNG road media during development.
- `assets/images/` contains the cyan stop-sign illustration. Typography uses Varela Round globally and loads it from Google Fonts.
- `docs/reference/the-idea.pdf` is the supplied course brief.
- `docs/superpowers/` preserves historical implementation plans and specifications. Those files can contain obsolete paths, media counts, and markup from earlier versions. Use this README for the current structure and paths.
- `tests/` contains static page, behavior-level, and media-integrity tests.

Development checks require Node.js and can be run with:

```bash
npm install
npm test
npm run check:media
```

## Todo

- Update `image-size` when a release fixes its ICNS/JXL/HEIF parser advisories. The audit imports only the JPEG, WebP, and PNG parser subpaths, so the affected parsers are not loaded. `npm audit` still reports the package-level advisory.

- Build the **Instructor-led welcome** direction around Oren Bachor's story and teaching approach.
- Build the **Course-dashboard preview** direction with lesson modules and realistic course navigation.
- Introduce a **shared course-content module** when the second runtime page creates a real seam between two page adapters.
- Revisit the **visual-system interface** after another page reveals which layout and styling decisions genuinely repeat.
- Add **full browser automation** when continuous integration or multiple interactive pages justify the dependency and maintenance cost.
