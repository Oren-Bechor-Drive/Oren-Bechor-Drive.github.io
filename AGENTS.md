# Project instructions

## Product

- Build the public learning experience for Oren Bachor's driving course.
- Write all visitor-facing website copy in Hebrew and preserve right-to-left layout and reading order.
- Communicate with the user in English.

## Sources of truth

- Before changing layout, typography, color, spacing, components, or motion, read `DESIGN.md` and keep the result consistent with it.
- When changing domain language or content structure, read `CONTEXT.md` and use its terms.
- Use `README.md` for local setup and current project scope. Its Todo section records future suggestions; implement them only when the user explicitly requests them.
- Use `PRODUCT.md` for audience, release boundaries, and supplied evidence. Files under `docs/superpowers/` are historical records; their old paths, worktree instructions, and checklists are not current implementation tasks.

## Technical boundaries

- Keep production code in plain HTML, CSS, and JavaScript with no required build step.
- Preserve semantic HTML, keyboard access, visible focus, mobile behavior, progressive enhancement, and reduced-motion support.
- Preserve user-supplied image bytes unless the user explicitly requests an image edit. Keep marked road-media metadata accurate when paths or images change.
- For gallery maintenance, follow `README.md`: preserve numeric photo order and discovery without a fixed maximum. Keep car templates, sprite files, and CSS alignment consistent. The supplied `cars.png` composite is source artwork, not dead code.
- Make focused changes. Introduce shared modules only after a real second consumer creates a clear need.

## Verification

- Add or update tests for behavior changes and run `npm test`, including the Chromium gallery check. Follow `README.md` for test dependencies and browser installation.
- Run `npm run check:media` after changing HTML image declarations, preload metadata, or files under `assets/`.
- Run `git diff --check` before completion.
- For visual or interaction changes, verify the affected path at desktop and mobile sizes in the collaborative browser.
