# Architecture Hardening Implementation Plan

> Historical record: This document describes the site before the learning-method section and its two supporting road photographs were removed on September 12, 2026. Paths, media counts, markup samples, and commands below may no longer match the current tree. Use `README.md` for the current page structure and file paths.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect road-photo replacements from metadata drift, deepen the interactive topic preview behind one interface, and record deliberately deferred architecture work.

**Architecture:** Keep the production site dependency-free and static. Add one Node-only road-media audit module for development, one browser topic-preview module initialized by the existing page entry script, and behavior-level tests using JSDOM. Preserve all user-supplied image bytes and the no-JavaScript reading experience.

**Tech Stack:** HTML5, CSS, browser ES modules, Node.js 26 built-in test runner, JSDOM 26.1.0

**Spec:** `docs/superpowers/specs/2026-09-11-architecture-hardening-design.md`

## Global Constraints

- Work only in `.worktrees/architecture-hardening` on `architecture/deepen-current-modules`.
- Keep `main` at rollback commit `58a4e0b` until deliberate integration.
- Preserve the byte content of all three replacement photos.
- Keep visitor-facing copy in Hebrew and the document in right-to-left mode.
- Keep `DESIGN.md` as the visual authority.
- Keep the production website runnable with `python3 -m http.server 8000`; no production build step.
- Use test-first red-green-refactor cycles for every production change.
- Do not introduce shared course-content or visual-system seams in this change.

---

### Task 1: Add the road-media integrity module

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `scripts/road-media-integrity.mjs`
- Create: `tests/road-media-integrity.test.mjs`
- Rename: `assets/learning-road.webp` to `assets/learning-road.jpg`
- Modify: `index.html:13,70-77,192-198`

**Interfaces:**
- Produces: `auditRoadMedia({ rootDir, htmlPath }) -> Promise<{ assets, issues }>`.
- Produces: `inspectImage(buffer) -> { format, mime, width, height }`.
- Produces: `npm run check:media` and `npm test` development commands.
- Consumes: `<img data-road-media>` declarations and matching preload declarations from `index.html`.

- [ ] **Step 1: Add the development test manifest**

Create `package.json` with no production dependencies:

```json
{
  "name": "driving-course-website",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "check:media": "node scripts/road-media-integrity.mjs"
  },
  "devDependencies": {
    "jsdom": "26.1.0"
  }
}
```

Run `npm install` to create `package-lock.json` and install the pinned test dependency.

- [ ] **Step 2: Write the failing road-media tests**

Create `tests/road-media-integrity.test.mjs`. The production change that makes these tests pass is the new audit module plus synchronized image metadata.

```js
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { auditRoadMedia } from '../scripts/road-media-integrity.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedHashes = new Map([
  ['assets/learning-road.jpg', 'bcb8095abd13e0f730ee6bc7977c8422d405d9367836dabd8d1d6095d43bb73f'],
  ['assets/source-road-000.jpg', '692d892f7ac25af2a99ce24cd083bad11c8daad4092ef6a35888e3197d863cfb'],
  ['assets/source-road-001.jpg', '804377c8a085a12e70a93b8523725bc6dbe43b3be92a2d67036ae7508e6e3e91'],
]);

test('road-media declarations match their files', async () => {
  const audit = await auditRoadMedia({ rootDir, htmlPath: 'index.html' });
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.assets.length, 3);
});

test('replacement photo bytes remain unchanged', async () => {
  for (const [relativePath, expectedHash] of expectedHashes) {
    const bytes = await readFile(path.join(rootDir, relativePath));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, relativePath);
  }
});
```

- [ ] **Step 3: Run the focused test and observe RED**

Run:

```bash
node --test tests/road-media-integrity.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/road-media-integrity.mjs`. This proves the test requires the missing production module.

- [ ] **Step 4: Implement image inspection and HTML auditing**

Create `scripts/road-media-integrity.mjs` with these responsibilities behind its two exported functions:

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';

const EXTENSION_FORMATS = new Map([
  ['.jpg', 'jpeg'],
  ['.jpeg', 'jpeg'],
  ['.webp', 'webp'],
]);

const FORMAT_MIMES = new Map([
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
]);

const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readJpegDimensions(buffer) {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (JPEG_START_OF_FRAME.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error('JPEG dimensions could not be read');
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpDimensions(buffer) {
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: readUint24LE(buffer, 24) + 1,
      height: readUint24LE(buffer, 27) + 1,
    };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}

export function inspectImage(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { format: 'jpeg', mime: 'image/jpeg', ...readJpegDimensions(buffer) };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { format: 'webp', mime: 'image/webp', ...readWebpDimensions(buffer) };
  }
  throw new Error('Unsupported image format');
}

function cleanReference(reference) {
  return reference.split(/[?#]/, 1)[0];
}

export async function auditRoadMedia({ rootDir, htmlPath = 'index.html' }) {
  const absoluteHtmlPath = path.resolve(rootDir, htmlPath);
  const html = await readFile(absoluteHtmlPath, 'utf8');
  const document = new JSDOM(html).window.document;
  const issues = [];
  const assets = [];

  for (const image of document.querySelectorAll('img[data-road-media]')) {
    const source = cleanReference(image.getAttribute('src') ?? '');
    const absoluteImagePath = path.resolve(path.dirname(absoluteHtmlPath), source);
    const inspected = inspectImage(await readFile(absoluteImagePath));
    const declaredFormat = EXTENSION_FORMATS.get(path.extname(source).toLowerCase());
    const declaredWidth = Number(image.getAttribute('width'));
    const declaredHeight = Number(image.getAttribute('height'));
    const alt = image.getAttribute('alt')?.trim() ?? '';
    const preload = document.querySelector(`link[rel="preload"][as="image"][href="${source}"]`);

    if (declaredFormat !== inspected.format) {
      issues.push(`${source}: extension declares ${declaredFormat ?? 'unknown'}, bytes are ${inspected.format}`);
    }
    if (declaredWidth !== inspected.width || declaredHeight !== inspected.height) {
      issues.push(`${source}: declared ${declaredWidth}x${declaredHeight}, file is ${inspected.width}x${inspected.height}`);
    }
    if (!alt) issues.push(`${source}: alternative text is empty`);
    if (preload && preload.getAttribute('type') !== FORMAT_MIMES.get(inspected.format)) {
      issues.push(`${source}: preload type is ${preload.getAttribute('type')}, expected ${FORMAT_MIMES.get(inspected.format)}`);
    }

    assets.push({ source, alt, ...inspected });
  }

  return { assets, issues };
}

async function runCli() {
  const audit = await auditRoadMedia({ rootDir: process.cwd(), htmlPath: 'index.html' });
  if (audit.issues.length === 0) {
    console.log(`Road media OK: ${audit.assets.length} images`);
    return;
  }
  for (const issue of audit.issues) console.error(`- ${issue}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
```

- [ ] **Step 5: Run the focused test and observe the metadata RED**

Run:

```bash
node --test tests/road-media-integrity.test.mjs
```

Expected: FAIL because the HTML has no marked road media and the hero still has the old extension and metadata. The production module now loads; the failure has advanced to the real asset contract.

- [ ] **Step 6: Synchronize metadata without changing photo bytes**

Run:

```bash
git mv assets/learning-road.webp assets/learning-road.jpg
```

Update `index.html`:

- Change the hero preload to `href="assets/learning-road.jpg"` and `type="image/jpeg"`.
- Change the hero image to `src="assets/learning-road.jpg"`, `width="1920"`, `height="880"`, `data-road-media`, and `alt="כביש בין־עירוני מחולק העובר בין שדות ירוקים"`.
- Add `data-road-media` to both supporting images.
- Set `source-road-001.jpg` to `width="797" height="437"`.
- Set `source-road-000.jpg` to `width="843" height="692"`.
- Preserve the supporting images' existing Hebrew alternative text.

- [ ] **Step 7: Verify GREEN and byte preservation**

Run:

```bash
npm run check:media
npm test
sha256sum assets/learning-road.jpg assets/source-road-000.jpg assets/source-road-001.jpg
```

Expected:

```text
Road media OK: 3 images
bcb8095abd13e0f730ee6bc7977c8422d405d9367836dabd8d1d6095d43bb73f  assets/learning-road.jpg
692d892f7ac25af2a99ce24cd083bad11c8daad4092ef6a35888e3197d863cfb  assets/source-road-000.jpg
804377c8a085a12e70a93b8523725bc6dbe43b3be92a2d67036ae7508e6e3e91  assets/source-road-001.jpg
```

- [ ] **Step 8: Commit the road-media module**

```bash
git add package.json package-lock.json scripts/road-media-integrity.mjs tests/road-media-integrity.test.mjs index.html assets/learning-road.jpg
git commit -m "feat: validate road media metadata"
```

---

### Task 2: Deepen the topic-preview module

**Files:**
- Create: `topic-explorer.js`
- Create: `tests/topic-explorer.test.mjs`
- Modify: `script.js:1-83`
- Modify: `index.html:15,102-185`
- Test: `tests/static-page.test.mjs`

**Interfaces:**
- Produces: `initTopicExplorer(rootElement)`.
- Consumes: one `[data-topic-explorer]` root containing `.topic-card` controls and one `[data-topic-panel]` live panel.
- Preserves: `data-active`, `aria-expanded`, Hebrew panel copy, RTL keyboard order, and reduced-motion behavior.

- [ ] **Step 1: Write failing topic-preview behavior tests**

Create `tests/topic-explorer.test.mjs` using `JSDOM`. Import the missing production module and build a fixture with three topic buttons and one panel. Include these tests:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { initTopicExplorer } from '../topic-explorer.js';

function setup({ reducedMotion = true } = {}) {
  const dom = new JSDOM(`<!doctype html><div data-topic-explorer>
    <button class="topic-card" data-active="true" aria-expanded="true" data-topic-description="תיאור ראשון">נושא ראשון</button>
    <button class="topic-card" data-active="false" aria-expanded="false" data-topic-description="תיאור שני">נושא שני</button>
    <button class="topic-card" data-active="false" aria-expanded="false" data-topic-description="תיאור שלישי">נושא שלישי</button>
    <div data-topic-panel><h3 data-topic-panel-title>ישן</h3><p data-topic-panel-description>ישן</p></div>
  </div>`, { pretendToBeVisual: true });
  dom.window.matchMedia = () => ({ matches: reducedMotion });
  const root = dom.window.document.querySelector('[data-topic-explorer]');
  initTopicExplorer(root);
  return { dom, root, cards: [...root.querySelectorAll('.topic-card')] };
}

test('initialization reconciles the panel with the active topic', () => {
  const { root } = setup();
  assert.equal(root.querySelector('[data-topic-panel-title]').textContent, 'נושא ראשון');
  assert.equal(root.querySelector('[data-topic-panel-description]').textContent, 'תיאור ראשון');
});

test('selection updates one complete selected-state invariant', () => {
  const { dom, root, cards } = setup();
  cards[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(cards.map((card) => card.dataset.active), ['false', 'true', 'false']);
  assert.deepEqual(cards.map((card) => card.getAttribute('aria-expanded')), ['false', 'true', 'false']);
  assert.equal(root.querySelector('[data-topic-panel-title]').textContent, 'נושא שני');
  assert.equal(root.querySelector('[data-topic-panel-description]').textContent, 'תיאור שני');
});

test('RTL arrows, Home, and End move focus in display order', () => {
  const { dom, cards } = setup();
  cards[0].focus();
  cards[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(dom.window.document.activeElement, cards[1]);
  cards[1].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(dom.window.document.activeElement, cards[0]);
  cards[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.equal(dom.window.document.activeElement, cards[2]);
  cards[2].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.equal(dom.window.document.activeElement, cards[0]);
});

test('missing panel hooks fail at the module interface', () => {
  const dom = new JSDOM('<div data-topic-explorer><button class="topic-card">נושא</button></div>');
  const root = dom.window.document.querySelector('[data-topic-explorer]');
  assert.throws(() => initTopicExplorer(root), /missing required topic panel/i);
});

test('the latest selection wins while motion is pending', async () => {
  const { dom, root, cards } = setup({ reducedMotion: false });
  cards[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  cards[2].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 130));
  assert.equal(root.querySelector('[data-topic-panel-title]').textContent, 'נושא שלישי');
  assert.equal(root.querySelector('[data-topic-panel-description]').textContent, 'תיאור שלישי');
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```bash
node --test tests/topic-explorer.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `topic-explorer.js`.

- [ ] **Step 3: Implement the deep topic-preview module**

Create `topic-explorer.js`. Keep every internal selector, state transition, timer, and keyboard rule inside this file. The external interface is only `initTopicExplorer(root)`.

```js
export function initTopicExplorer(root) {
  const cards = [...root.querySelectorAll('.topic-card')];
  const panel = root.querySelector('[data-topic-panel]');
  const title = panel?.querySelector('[data-topic-panel-title]');
  const description = panel?.querySelector('[data-topic-panel-description]');

  if (cards.length === 0 || !panel || !title || !description) {
    throw new Error('Missing required topic panel elements');
  }

  const browserWindow = root.ownerDocument.defaultView;
  const reducedMotion = browserWindow?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let pendingUpdate;

  function updateContent(card) {
    title.textContent = card.textContent.trim();
    description.textContent = card.dataset.topicDescription ?? '';
    panel.dataset.updating = 'false';
  }

  function select(card, { animate = true } = {}) {
    cards.forEach((candidate) => {
      const selected = candidate === card;
      candidate.dataset.active = String(selected);
      candidate.setAttribute('aria-expanded', String(selected));
    });

    browserWindow?.clearTimeout(pendingUpdate);
    if (!animate || reducedMotion) {
      updateContent(card);
      return;
    }

    panel.dataset.updating = 'true';
    pendingUpdate = browserWindow?.setTimeout(() => updateContent(card), 110);
  }

  cards.forEach((card, index) => {
    card.addEventListener('click', () => select(card));
    card.addEventListener('keydown', (event) => {
      let nextIndex;
      if (event.key === 'ArrowLeft') nextIndex = (index + 1) % cards.length;
      if (event.key === 'ArrowRight') nextIndex = (index - 1 + cards.length) % cards.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = cards.length - 1;
      if (nextIndex === undefined) return;
      event.preventDefault();
      cards[nextIndex].focus();
    });
  });

  const initiallyActive = cards.find((card) => card.dataset.active === 'true') ?? cards[0];
  select(initiallyActive, { animate: false });
}
```

- [ ] **Step 4: Verify the module GREEN**

Run:

```bash
node --test tests/topic-explorer.test.mjs
```

Expected: 5 tests pass and 0 fail.

- [ ] **Step 5: Write a failing entry-module contract test**

Modify the existing progressive-enhancement test in `tests/static-page.test.mjs` to require:

```js
assert.match(script, /import\s+\{\s*initTopicExplorer\s*\}\s+from\s+'\.\/topic-explorer\.js'/);
assert.match(script, /initTopicExplorer\(topicExplorer\)/);
assert.doesNotMatch(script, /querySelectorAll\('\.topic-card'\)/);
```

Add HTML assertions for `type="module"`, `data-topic-explorer`, and the absence of `data-topic-title`.

- [ ] **Step 6: Run the static test and observe RED**

Run:

```bash
node --test tests/static-page.test.mjs
```

Expected: FAIL because `script.js` still owns topic internals and `index.html` still exposes the redundant title attributes.

- [ ] **Step 7: Narrow the entry-module and HTML interfaces**

Modify `script.js`:

```js
import { initTopicExplorer } from './topic-explorer.js';

const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
const topicExplorer = document.querySelector('[data-topic-explorer]');
const topicSection = document.querySelector('#topics');

if (topicExplorer) initTopicExplorer(topicExplorer);
```

Keep the existing mobile-menu and topic-link focus behavior below this entry setup. Delete all topic-card discovery, rendering, timing, and keyboard implementation from `script.js`.

Modify `index.html`:

- Change the page entry to `<script src="script.js?v=20260911" type="module"></script>`.
- Add `data-topic-explorer` to `.topic-explorer`.
- Remove every `data-topic-title` attribute; the visible Hebrew button label is the title source.
- Keep every `data-topic-description`, initial panel title, and initial panel description for progressive enhancement.

- [ ] **Step 8: Verify all topic and static tests GREEN**

Run:

```bash
npm test
```

Expected: all topic, road-media, and static tests pass.

- [ ] **Step 9: Commit the topic-preview module**

```bash
git add topic-explorer.js tests/topic-explorer.test.mjs script.js index.html tests/static-page.test.mjs
git commit -m "refactor: deepen topic preview module"
```

---

### Task 3: Record deferred architecture work

**Files:**
- Modify: `README.md`
- Modify: `tests/static-page.test.mjs`

**Interfaces:**
- Produces: a visible `## Todo` section containing every deliberately deferred finding.
- Preserves: local opening instructions and both future welcome directions.

- [ ] **Step 1: Write the failing README contract**

Extend the README test to require the following phrases under a `## Todo` heading:

```js
assert.match(readme, /^## Todo$/m);
assert.match(readme, /shared course-content module/i);
assert.match(readme, /visual-system interface/i);
assert.match(readme, /full browser automation/i);
```

- [ ] **Step 2: Run the README test and observe RED**

Run:

```bash
node --test --test-name-pattern="README" tests/static-page.test.mjs
```

Expected: FAIL because the README does not yet have the deferred-work section.

- [ ] **Step 3: Update project instructions and add Todo**

Update `README.md` so runtime instructions still require no installation. Add development instructions:

```bash
npm install
npm test
npm run check:media
```

Replace `## Future directions` with this section so deferred work has one source of truth:

```markdown
## Todo

- Build the **Instructor-led welcome** direction around Oren Bachor's story and teaching approach.
- Build the **Course-dashboard preview** direction with lesson modules and realistic course navigation.
- Introduce a **shared course-content module** when the second runtime page creates a real seam between two page adapters.
- Revisit the **visual-system interface** after another page reveals which layout and styling decisions genuinely repeat.
- Add **full browser automation** when continuous integration or multiple interactive pages justify the dependency and maintenance cost.
```

Update the project-file list to mention `topic-explorer.js`, `scripts/road-media-integrity.mjs`, and the behavior-level tests. Describe `assets/` as containing the current road media without claiming the replacement hero was generated.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test
npm run check:media
```

Expected: all tests pass and the media audit reports three valid images.

- [ ] **Step 5: Commit the documentation**

```bash
git add README.md tests/static-page.test.mjs
git commit -m "docs: record deferred architecture work"
```

---

### Task 4: Verify the complete visitor path and refresh evidence

**Files:**
- Modify: `.impeccable/review/hero-repro.png`
- Modify: `.impeccable/review/desktop.png`
- Modify: `.impeccable/review/mobile.png`

**Interfaces:**
- Consumes: the static page served from the isolated worktree.
- Produces: fresh desktop and mobile visual evidence reflecting the replacement photos and refactored behavior.

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
npm test
npm run check:media
node --check script.js
node --check topic-explorer.js
git diff --check main...HEAD
```

Expected: zero failed tests, `Road media OK: 3 images`, valid JavaScript syntax, and no whitespace errors.

- [ ] **Step 2: Start the static server from the worktree**

Run:

```bash
python3 -m http.server 8001
```

Use port `8001` so the worktree preview cannot be confused with the baseline server on port `8000`.

- [ ] **Step 3: Verify desktop behavior in the collaborative browser**

At 1280×800, confirm:

- The replacement divided-highway hero photo loads with a useful crop.
- The hero action reaches and focuses `#topics`.
- Selecting `תכנון נסיעה` leaves exactly one active topic and updates the Hebrew panel title and description.
- Rapidly selecting two topics leaves the final selection visible.
- No horizontal overflow occurs.
- Browser console and network logs contain no page-owned errors.

- [ ] **Step 4: Verify mobile behavior in the collaborative browser**

At 390×844, confirm:

- The hero heading remains two lines and the replacement image crop still communicates a road environment.
- The page has no horizontal overflow.
- Every topic target remains at least 44 pixels tall.
- The menu opens, Escape closes it, and focus returns to the menu button.
- Topic selection and horizontal topic navigation remain usable.

- [ ] **Step 5: Refresh screenshots**

Save the current first viewport to `.impeccable/review/hero-repro.png`, the full desktop page to `.impeccable/review/desktop.png`, and the full mobile page to `.impeccable/review/mobile.png`. Inspect each capture for stale imagery, clipped Hebrew text, blank regions, and layout drift from `DESIGN.md`.

- [ ] **Step 6: Verify the photo bytes against the baseline commit**

Run:

```bash
git show 58a4e0b:assets/learning-road.webp | sha256sum
sha256sum assets/learning-road.jpg
git show 58a4e0b:assets/source-road-000.jpg | sha256sum
sha256sum assets/source-road-000.jpg
git show 58a4e0b:assets/source-road-001.jpg | sha256sum
sha256sum assets/source-road-001.jpg
```

Expected: each baseline/current pair has the same SHA-256 value.

- [ ] **Step 7: Commit refreshed evidence and push the branch**

```bash
git add .impeccable/review/hero-repro.png .impeccable/review/desktop.png .impeccable/review/mobile.png
git commit -m "test: refresh architecture review evidence"
git push
```

- [ ] **Step 8: Run the final verification gate**

Run:

```bash
npm test
npm run check:media
git status --short
git log --oneline --decorate main..HEAD
```

Expected: all tests and the media audit pass, the worktree is clean, and the feature commits are listed above `main`.
