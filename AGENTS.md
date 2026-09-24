# Project instructions

## Product

- Build the public learning experience for Oren Bachor's driving course.
- Write all visitor-facing website copy in Hebrew and preserve right-to-left layout and reading order.
- Communicate with the user in English.
- Use ASCII punctuation in project-authored text, including Hebrew: `-`, `:`, `;`, `'`, `"`, `,`, `/`, `?`, and `.`. Preserve supplied reference documents, font files, and third-party license text.

## Sources of truth

- Before changing layout, typography, color, spacing, components, or motion, read `DESIGN.md` and keep the result consistent with it.
- When changing domain language or content structure, read `CONTEXT.md` and use its terms.
- When changing learning-content verification, media-audit coverage, or student-gallery initialization, read [Architecture](docs/ARCHITECTURE.md) for ownership and test seams.
- Use `README.md` for local setup and current project scope. Its Todo section records future suggestions; implement them only when the user explicitly requests them.
- Use `PRODUCT.md` for audience, release boundaries, and supplied evidence.
- When changing search metadata, structured data, crawler files, or public URLs, follow [Search and sharing metadata](README.md#search-and-sharing-metadata).

## Technical boundaries

- Keep production code in plain HTML, CSS, and JavaScript with no build step to run or serve the checked-in site. Image delivery changes require the maintenance steps in `README.md`.
- Preserve semantic HTML, keyboard access, visible focus, mobile behavior, progressive enhancement, and reduced-motion support.
- Keep navigation and all topic descriptions usable when JavaScript is disabled or the entry module fails to load. Use the baseline HTML descriptions as the interactive preview's content source.
- When adding learning sections or practice quizzes, follow [Add learning sections and quizzes](README.md#add-learning-sections-and-quizzes). Each quiz owns its static content and return links; `course/js/quiz.js` owns shared interaction. Preserve the current HTML formatting.
- Keep course copy, search and sharing metadata, structured data, and `llms.txt` consistent with supplied facts. Add real contact details, profile URLs, or enrollment destinations only when supplied.
- Preserve user-supplied image bytes unless the user explicitly requests an image edit. Keep marked road-media metadata accurate when paths or images change.
- When changing image sources, delivery widths, compression, or sizing hints, follow [Optimize delivery images](README.md#optimize-delivery-images) for regeneration, publishing, and browser delivery checks.
- For gallery maintenance, follow `README.md`: preserve numeric photo order and the generated photo list without a fixed maximum. Keep car templates, sprite files, and CSS alignment consistent. The supplied `cars.png` composite is source artwork, not dead code.
- Supply a student photo list to each gallery initialization. Tests own their fixture lists; the generated list stays unchanged during tests.
- After adding, replacing, removing, or renumbering student photos, follow the publishing steps in `README.md`: run `npm run optimize:media`, `npm run check:media`, and `npm test`; publish the originals, generated delivery files, `js/road-photo-sources.js`, and updated `index.html` together.
- Make focused changes. Introduce shared modules only after a real second consumer creates a clear need.

## Verification

- Add or update tests for behavior changes and run `npm test`, including the Chromium gallery and image-delivery checks. Follow `README.md` for test dependencies and browser installation.
- Run `npm run check:media` after changing HTML image declarations, preload metadata, or files under `assets/`.
- Keep learning relationships interpreted by `scripts/learning-content.mjs`, including file-specific diagnostics for malformed authored content. Keep placeholder-layout assertions separate from shared quiz interaction tests.
- The media audit discovers authored HTML pages and checks local image declarations. Preserve its stricter marked road-media rules while allowing scaled ordinary images. Check the documented exclusions before placing new pages in subdirectories.
- Run `git diff --check` before completion.
- For visual or interaction changes, verify the affected path at desktop and mobile sizes in the collaborative browser. If it is unavailable, use local Playwright Chromium and report that limitation.
- When changing navigation or topic selection, verify both the enhanced interaction and the baseline experience with JavaScript disabled or the entry module blocked.

## Agent skills

### Issue tracker

Before reading, creating or updating issues, follow [GitHub issue workflow](docs/agents/issue-tracker.md).

### Triage labels

When triaging issues, use the [triage role mapping](docs/agents/triage-labels.md).

### Domain docs

Before domain exploration or recording an architectural decision, follow the [single-context domain rules](docs/agents/domain.md).
