# Project instructions

## Product

- Build the public learning experience for Oren Bachor's driving course.
- Write all visitor-facing website copy in Hebrew and preserve right-to-left layout and reading order.
- Communicate with the user in English.

## Sources of truth

- Before changing layout, typography, color, spacing, components, or motion, read `DESIGN.md` and keep the result consistent with it.
- When changing domain language or content structure, read `CONTEXT.md` and use its terms.
- Use `README.md` for local setup and current project scope. Its Todo section records future suggestions; implement them only when the user explicitly requests them.
- Use `PRODUCT.md` for audience, release boundaries, and supplied evidence.

## Technical boundaries

- Keep production code in plain HTML, CSS, and JavaScript with no build step to run or serve the checked-in site. Gallery photo changes require the maintenance command below.
- Preserve semantic HTML, keyboard access, visible focus, mobile behavior, progressive enhancement, and reduced-motion support.
- Keep navigation and all topic descriptions usable when JavaScript is disabled or the entry module fails to load. Use the baseline HTML descriptions as the interactive preview's content source.
- Preserve user-supplied image bytes unless the user explicitly requests an image edit. Keep marked road-media metadata accurate when paths or images change.
- For gallery maintenance, follow `README.md`: preserve numeric photo order and the generated photo list without a fixed maximum. Keep car templates, sprite files, and CSS alignment consistent. The supplied `cars.png` composite is source artwork, not dead code.
- After adding, replacing, removing, or renumbering student photos, follow the publishing steps in `README.md`: run `npm run optimize:media`, `npm run check:media`, and `npm test`; publish the originals, generated delivery files, `js/road-photo-sources.js`, and updated `index.html` together.
- Make focused changes. Introduce shared modules only after a real second consumer creates a clear need.

## Verification

- Add or update tests for behavior changes and run `npm test`, including the Chromium gallery check. Follow `README.md` for test dependencies and browser installation.
- Run `npm run check:media` after changing HTML image declarations, preload metadata, or files under `assets/`.
- Run `git diff --check` before completion.
- For visual or interaction changes, verify the affected path at desktop and mobile sizes in the collaborative browser. If it is unavailable, use local Playwright Chromium and report that limitation.
- When changing navigation or topic selection, verify both the enhanced interaction and the baseline experience with JavaScript disabled or the entry module blocked.
