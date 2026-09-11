# Driving course welcome page

This is the first welcome-page concept for Oren Bachor's Hebrew driving course. The current direction is a **Learning journey** that introduces the course, explains how it connects theory to real road situations, and lets visitors preview the learning topics.

## Open locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

No installation or build step is required.

## Project files

- `index.html` contains the Hebrew, right-to-left page content.
- `styles.css` implements the system defined in `DESIGN.md`.
- `script.js` adds the mobile menu and initializes page enhancements.
- `topic-explorer.js` owns the topic preview interaction.
- `scripts/road-media-integrity.mjs` audits marked road media during development.
- `assets/` contains the current road media and local fonts.
- `tests/` contains static page, behavior-level, and media-integrity tests.

Run the tests with:

```bash
node --test tests/static-page.test.mjs
```

Development checks require Node.js and can be run with:

```bash
npm install
npm test
npm run check:media
```

## Todo

- Update `image-size` when a release fixes its ICNS/JXL/HEIF parser advisories. The audit imports only the JPEG and WebP parser subpaths, so the affected parsers are not loaded. `npm audit` still reports the package-level advisory.

- Build the **Instructor-led welcome** direction around Oren Bachor's story and teaching approach.
- Build the **Course-dashboard preview** direction with lesson modules and realistic course navigation.
- Introduce a **shared course-content module** when the second runtime page creates a real seam between two page adapters.
- Revisit the **visual-system interface** after another page reveals which layout and styling decisions genuinely repeat.
- Add **full browser automation** when continuous integration or multiple interactive pages justify the dependency and maintenance cost.
