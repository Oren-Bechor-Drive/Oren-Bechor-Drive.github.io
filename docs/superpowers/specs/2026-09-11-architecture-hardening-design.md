# Architecture Hardening Design

## Goal

Deepen the parts of the welcome page that already create maintenance friction: road-media replacement, topic-preview behavior, and verification. Preserve the current Hebrew experience, the supplied design system, and the learner's no-JavaScript reading path.

## Approved scope

This change includes:

- A road-media integrity module and corrections to metadata surrounding the user's replacement photos.
- A deeper topic-preview module with a smaller interface and behavior-level tests.
- Stronger automated verification for media and interaction invariants.
- A README `Todo` section recording work that does not yet justify a seam.

This change excludes:

- Editing, converting, recompressing, or replacing the user's photo pixels.
- A shared course-content module before a second page exists.
- A broad visual-system restructure before another page demonstrates genuine reuse.
- A production framework or build step.

## Baseline and isolation

The untouched site is committed on `main` as `58a4e0b` and pushed to the private GitHub repository `w0x7y/driving-course-website`. Implementation occurs in the isolated worktree `.worktrees/architecture-hardening` on branch `architecture/deepen-current-modules`.

## Road-media integrity

### Current friction

The replacement hero photo is named `learning-road.webp` but contains JPEG bytes. The preload advertises WebP, the HTML dimensions describe the previous image, and the alternative text still describes a roundabout. The two supporting road photos also have stale declared dimensions. The existing tests pass despite all of these mismatches.

### Design

Add the Node-only road-media integrity module `scripts/road-media-integrity.mjs`. Its small interface accepts the project root and HTML entry file, then returns a structured audit containing discovered road media and actionable issues. Running that file directly prints those issues and exits nonzero when the audit fails.

Images opt into the audit through one semantic marker in `index.html`. The implementation hides byte-format detection, JPEG and WebP dimension parsing, extension-to-MIME mapping, preload inspection, file existence checks, intrinsic-dimension comparison, and nonempty alternative-text checks.

Preserve the hero photo bytes by renaming the file to `.jpg`. Update its preload MIME, HTML path, intrinsic width and height, and human-reviewed Hebrew alternative text. Update the two supporting images' declared intrinsic dimensions without modifying their files. Crop behavior remains CSS-owned and receives a browser review at desktop and mobile sizes.

Only the local-file adapter exists. No replaceable adapter seam will be introduced.

### Failure behavior

Every audit issue identifies the image and the mismatched fact. The command exits with status `1` for integrity failures and reserves thrown errors for unreadable project inputs or malformed invocation.

## Topic-preview depth

### Current friction

The topic preview's effective interface consists of global selectors, data attributes, accessibility state, duplicated initial content, timing rules, and CSS state spread across `index.html`, `script.js`, and `styles.css`.

### Design

Create `topic-explorer.js` as the deep topic-preview module. Its external interface initializes one topic-preview root. The implementation owns discovery of topic controls and the live panel, the single-selection invariant, panel synchronization, right-to-left arrow navigation, Home and End behavior, reduced-motion handling, and transition state.

`script.js` remains the browser entry module. It owns page-level navigation behavior and initializes the topic preview without knowing its internal selectors or state transitions. `index.html` changes its script to an ES module and marks the topic-preview root. The button's visible label becomes the source for the selected title, eliminating the redundant title data attribute. The first description remains in the rendered panel so the page stays useful without JavaScript; initialization reconciles it with the active topic when JavaScript is available.

The module throws a clear development error when an existing topic-preview root is missing required internal elements. If no topic-preview root exists on a future page, the entry module skips initialization.

## Verification

Add a development-only `package.json` and lockfile with `jsdom@26.1.0`. The website still runs as static HTML without installation or a build step. Development tests use Node's built-in test runner; `tests/road-media-integrity.test.mjs` audits files and markup, while `tests/topic-explorer.test.mjs` exercises the topic-preview module in JSDOM.

Verification covers:

- Actual image byte format, extension, preload MIME, file existence, and declared dimensions.
- A nonempty alternative text value for every marked road image.
- Exactly one selected learning topic.
- Topic selection synchronizing visual state, accessibility state, title, and description.
- Right-to-left arrow navigation plus Home and End behavior.
- Reduced-motion selection without a delayed transition.
- Existing Hebrew, RTL, design-token, mobile, navigation, and README contracts.
- Desktop and mobile browser checks for cropping, overflow, focus behavior, and the mobile menu.

Tests exercise the topic-preview interface rather than searching its implementation text. Static tests remain only for document-level contracts that do not require behavior.

## Deferred work

The README `Todo` section will record:

- Build the Instructor-led welcome direction.
- Build the Course-dashboard direction.
- Introduce a shared course-content module when a second runtime page creates two real adapters.
- Revisit the visual-system interface after another page reveals which styling decisions genuinely repeat.
- Add full browser automation when continuous integration or multiple interactive pages justify its installation and maintenance cost.

## Success criteria

- The user's three replacement photos are byte-for-byte identical to the baseline commit.
- The road-media audit passes after surrounding metadata is corrected.
- Topic-preview behavior passes DOM-level tests through one module interface.
- The original static tests continue to pass.
- The website remains a Hebrew RTL static page with no production dependency or build requirement.
- `main` remains at the pushed rollback baseline until the feature branch is reviewed and deliberately integrated.
