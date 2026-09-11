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
- `script.js` adds the mobile menu, topic preview, and focus behavior.
- `assets/` contains the generated hero image, local fonts, and road examples taken from the supplied PDF.
- `tests/static-page.test.mjs` checks the page contract with Node's built-in test runner.

Run the tests with:

```bash
node --test tests/static-page.test.mjs
```

## Future directions

- **Instructor-led welcome:** Put Oren Bachor's story, experience, and teaching approach at the center before introducing the course topics.
- **Course-dashboard preview:** Present the welcome experience through realistic lesson modules, progress examples, and course navigation.
