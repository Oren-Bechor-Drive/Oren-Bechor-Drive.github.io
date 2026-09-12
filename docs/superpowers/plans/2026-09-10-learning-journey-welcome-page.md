# Learning Journey Welcome Page Implementation Plan

> Historical record: This document describes the site before the learning-method section and its two supporting road photographs were removed on September 12, 2026. Paths, media counts, markup samples, and commands below may no longer match the current tree. Use `README.md` for the current page structure and file paths.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive Hebrew welcome page that explains Oren Bachor's driving course and scrolls new visitors to an interactive preview of its learning topics.

**Architecture:** The site is a dependency-free static page. Semantic content lives in `index.html`, the complete visual system and responsive behavior live in `styles.css`, and progressive interactions live in `script.js`. A generated road image supplies the hero atmosphere without inventing a likeness of the instructor.

**Tech Stack:** HTML5, CSS, browser JavaScript, Node.js built-in test runner, generated WebP image

**Spec:** `docs/superpowers/specs/2026-09-10-learning-journey-welcome-page-design.md`

## Global constraints

- All visitor-facing copy is Hebrew and the document uses `dir="rtl"`.
- `DESIGN.md` is the source of truth for colors, typography, spacing, shapes, surfaces, and shadows.
- The release includes one welcome page only. It does not include enrollment, payment, accounts, or course playback.
- The main hero button scrolls to the topic preview and moves keyboard focus to the topic heading.
- JavaScript is progressive enhancement. Content and anchor navigation remain usable without it.
- Multi-column layouts become one column below 768 pixels and interactive targets remain at least 44 pixels tall.
- No framework or build step is introduced.
- The project is not currently a Git repository, so task checkpoints cannot be committed unless the user initializes Git later.

---

### Task 1: Create the visual asset and static page contract

**Files:**
- Create: `assets/learning-road.webp`
- Create: `tests/static-page.test.mjs`

**Interfaces:**
- Consumes: Visual palette and road-learning concept from `DESIGN.md` and the design spec.
- Produces: `assets/learning-road.webp` at a wide hero aspect ratio and a Node test contract for the files and semantic hooks required by later tasks.

- [ ] **Step 1: Generate the hero road image**

Generate a wide editorial photograph of an Israeli-style road approaching a calm intersection in clear morning light. Keep the composition uncluttered, leave quiet sky and roadside space behind the Hebrew copy area, echo the cyan and warm amber palette, exclude people, text, logos, watermarks, and identifiable license plates, and export it as `assets/learning-road.webp`.

- [ ] **Step 2: Write the failing static contract test**

Create `tests/static-page.test.mjs` with Node's built-in test runner. Read `index.html`, `styles.css`, `script.js`, and `README.md`; assert that the page declares Hebrew and RTL, contains `#topics`, `#about`, `#instructor`, `.topic-card`, `[data-menu-toggle]`, and `[data-topic-panel]`; assert that the CSS contains the design color tokens `#6dcdd6`, `#f6db78`, and `#d96c6c`, a `prefers-reduced-motion` query, and a mobile query at 768 pixels; assert that the JavaScript references the menu and topic hooks; assert that README names both future concepts.

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('page exposes its Hebrew semantic structure', async () => {
  const html = await read('index.html');
  assert.match(html, /<html[^>]+lang="he"[^>]+dir="rtl"/);
  for (const hook of ['id="topics"', 'id="about"', 'id="instructor"', 'class="topic-card', 'data-menu-toggle', 'data-topic-panel']) {
    assert.ok(html.includes(hook), `Missing HTML hook: ${hook}`);
  }
});

test('styles preserve the supplied design system and responsive contract', async () => {
  const css = (await read('styles.css')).toLowerCase();
  for (const token of ['#6dcdd6', '#f6db78', '#d96c6c', 'prefers-reduced-motion', 'max-width: 768px']) {
    assert.ok(css.includes(token), `Missing CSS contract: ${token}`);
  }
});

test('script progressively enhances navigation and topic details', async () => {
  const script = await read('script.js');
  for (const hook of ['[data-menu-toggle]', '.topic-card', '[data-topic-panel]']) {
    assert.ok(script.includes(hook), `Missing script hook: ${hook}`);
  }
});

test('README records the later welcome-page concepts', async () => {
  const readme = await read('README.md');
  assert.match(readme, /Instructor-led welcome/i);
  assert.match(readme, /Course-dashboard preview/i);
});
```

- [ ] **Step 3: Run the test and confirm the page files fail the contract**

Run: `node --test tests/static-page.test.mjs`

Expected: FAIL because `index.html`, `styles.css`, and `script.js` do not exist.

### Task 2: Build the semantic Hebrew page and responsive design

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Test: `tests/static-page.test.mjs`

**Interfaces:**
- Consumes: `assets/learning-road.webp` and the required hooks in `tests/static-page.test.mjs`.
- Produces: A complete no-JavaScript reading and anchor-navigation experience plus stable DOM hooks for `script.js`.

- [ ] **Step 1: Create the semantic HTML structure**

Build `index.html` with a skip link, compact header, one `main`, and a footer. Use these section IDs and headings:

```html
<section class="hero" aria-labelledby="hero-title">...</section>
<section id="about" aria-labelledby="about-title">...</section>
<section id="topics" aria-labelledby="topics-title" tabindex="-1">...</section>
<section id="method" aria-labelledby="method-title">...</section>
<section id="instructor" aria-labelledby="instructor-title">...</section>
<section class="closing" aria-labelledby="closing-title">...</section>
```

Use the approved hero copy `ללמוד לקרוא את הכביש`, the subtitle `קורס דיגיטלי שמחבר בין חוקי הדרך למצבים שפוגשים באמת בנהיגה.`, and a primary anchor labeled `לנושאי הלימוד` that points to `#topics`.

Create seven topic buttons with `aria-expanded="false"` and a matching detail region marked `data-topic-panel`. The topics are `זכויות קדימה ופניות`, `זיהוי כבישים ונתיבים`, `מעגלי תנועה וצמתים`, `תמרורים ומהירויות`, `עקיפה ואיסורי עקיפה`, `תכנון נסיעה`, and `טעויות נפוצות בטסט`.

- [ ] **Step 2: Implement the supplied design system in CSS**

Define CSS custom properties for the exact primary, secondary, tertiary, surface, text, border, radius, and shadow values from `DESIGN.md`. Use a clean RTL grid, one dominant road image in the first viewport, varied section compositions, visible focus rings, a 44-pixel minimum hit area, and `scroll-margin-top` on anchored sections.

At `@media (max-width: 768px)`, switch every multi-column grid to one column, expose the mobile menu control, reduce display type to 36 pixels, and keep hero content above the image. At `@media (prefers-reduced-motion: reduce)`, remove smooth scrolling, transitions, and entrance movement.

- [ ] **Step 3: Run the static contract test**

Run: `node --test tests/static-page.test.mjs`

Expected: The HTML and CSS tests pass. The script and README tests still fail because those files are not complete.

### Task 3: Add progressive interactions

**Files:**
- Create: `script.js`
- Test: `tests/static-page.test.mjs`

**Interfaces:**
- Consumes: `[data-menu-toggle]`, `[data-menu]`, `.topic-card`, `[data-topic-panel]`, and `#topics` from `index.html`.
- Produces: Mobile menu state, accessible topic selection, and focus management after anchor scrolling.

- [ ] **Step 1: Implement mobile navigation state**

Query `[data-menu-toggle]` and `[data-menu]`. On click, invert `aria-expanded` and the menu's `data-open` value. Close the menu after any menu anchor is selected and when Escape is pressed, returning focus to the toggle after Escape.

- [ ] **Step 2: Implement topic detail selection**

Query every `.topic-card` and `[data-topic-panel]`. On click, set only the selected card to `aria-expanded="true"` and `data-active="true"`, copy its `data-topic-title` and `data-topic-description` into the panel, and reveal the panel. Keep all content in Hebrew. Arrow Left and Arrow Right move focus through the topic buttons according to visual RTL order.

- [ ] **Step 3: Implement hero focus management**

On the hero link click, allow the native `#topics` navigation and call `focus({ preventScroll: true })` on `#topics` after the hash target has scrolled into view. Do not prevent anchor navigation when JavaScript is unavailable.

- [ ] **Step 4: Run the static contract test**

Run: `node --test tests/static-page.test.mjs`

Expected: The page, style, and script tests pass. The README test still fails.

### Task 4: Document the project and verify the visitor path

**Files:**
- Modify: `README.md`
- Test: `tests/static-page.test.mjs`
- Create: `.impeccable/review/hero-repro.png`
- Create: `.impeccable/review/desktop.png`
- Create: `.impeccable/review/mobile.png`

**Interfaces:**
- Consumes: The completed page and the two future concepts approved by the user.
- Produces: Opening instructions, future design notes, passing automated checks, and visual evidence at desktop and mobile widths.

- [ ] **Step 1: Replace the README with project instructions and future directions**

Document that the current version is a Hebrew learning-journey welcome page, that it opens through `python3 -m http.server 8000`, and that `http://localhost:8000` is the local URL. Add a `Future directions` section with these entries:

```markdown
- **Instructor-led welcome:** Put Oren Bachor's story, experience, and teaching approach at the center before introducing the course topics.
- **Course-dashboard preview:** Present the welcome experience through realistic lesson modules, progress examples, and course navigation.
```

- [ ] **Step 2: Run all static tests**

Run: `node --test tests/static-page.test.mjs`

Expected: 4 tests pass and 0 fail.

- [ ] **Step 3: Verify the page in a real browser**

Start `python3 -m http.server 8000`. At a desktop viewport, confirm the hero explains the course within the first viewport, the primary button reaches and focuses the topic preview, each topic updates the detail panel, and the navigation links reach the correct sections. At a mobile viewport below 768 pixels, confirm the menu opens and closes, Escape returns focus, content has no horizontal overflow, and each target is at least 44 pixels tall.

- [ ] **Step 4: Capture and inspect visual evidence**

Save the settled first viewport as `.impeccable/review/hero-repro.png`, the full desktop page as `.impeccable/review/desktop.png`, and the full mobile page as `.impeccable/review/mobile.png`. Confirm each image contains the expected page, loaded hero art, unclipped Hebrew content, and no blank regions.

- [ ] **Step 5: Verify progressive enhancement and motion preferences**

Disable JavaScript and confirm all copy, sections, and anchors remain available. Emulate `prefers-reduced-motion: reduce` and confirm no nonessential transition or smooth scrolling remains.
