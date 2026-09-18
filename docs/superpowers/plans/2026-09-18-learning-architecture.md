# Learning architecture implementation plan

**Goal:** Implement the three approved architecture-review candidates, update project documentation, verify, commit, and push.

**Architecture:** Static HTML remains the teaching-content source. A development-only verification module interprets lesson and quiz relationships for structural and browser checks. The existing media audit owns site-wide page discovery. The student gallery receives its photo list per initialization rather than importing shared mutable state.

**Stack:** Plain HTML/CSS/JavaScript, Node.js tests, JSDOM, Playwright Chromium, existing image parsers. No new dependencies or serving build step.

**Specification:** The user approved all three candidates from the September 18 architecture report: deepen learning-content verification, extend road-media audit coverage, and isolate student-gallery test data.

## Constraints and ownership

- Preserve Hebrew RTL content, current HTML formatting, independent quiz files, placeholders, no-JavaScript navigation, and reduced motion.
- Preserve all supplied image bytes and generation settings.
- Main agent owns learning verification, its tests, all Markdown documentation, integration, commit and push.
- Media agent owns `scripts/road-media-integrity.mjs` and media-audit tests only.
- Gallery agent owns `js/road-carousel.js`, its initialization in `js/script.js`, and affected gallery tests only.
- Agents do not change documentation, stage files, commit, or push. They report exact commands/results and interface changes to the main agent.
- Existing course-preview files belong to this requested course work and will be included in the final reviewed commit. Exclude `.superpowers/` temporary mockups.

## 1. Learning-content verification

- [x] Add fixture-driven tests for valid relationships and useful diagnostics for missing headings, quiz links, destinations, duplicate IDs, and incorrect return links.
- [x] Run these tests against the old helper and confirm failures.
- [x] Replace raw-DOM discovery with one development-only module returning interpreted lessons, sections, quizzes, questions and issues. Consumers use `readLearningContent(rootDir)` and assert its issues are empty before registering journeys.
- [x] Migrate structural/browser checks to that shared interpretation. Keep explicit placeholder checks separate from arbitrary question navigation.
- [x] Exercise the real quiz interaction module with controlled one-question and variable-length quiz fixtures, nonnumeric question IDs, and different video placement.
- [x] Run content, course-library, quiz and lesson-navigation tests.

## 2. Site-wide media auditing

- [x] Add failing temporary-file tests for multiple authored HTML pages, ordinary scaled images, broken sources/srcsets/preloads, and page-specific diagnostics.
- [x] Extend the current audit with authored-page discovery, ordinary image checks, and existing marked-media/gallery-specific rules. Preserve the single-page audit for focused tests.
- [x] Keep fixture files and hidden/tool directories outside authored-page discovery. Resolve references relative to their page; do not fetch external assets.
- [x] Run media tests and `npm run check:media`; confirm new course/quiz images are inspected without changing bytes.

## 3. Student-gallery isolation

- [x] Add a failing test proving two gallery instances can use different photo lists without mutating the generated module.
- [x] Supply the generated list at the welcome-page initialization point and an owned fixture list in tests; use the supplied list consistently for loading and optimized delivery.
- [x] Remove mutation/restore machinery from gallery fixtures and migrate every caller. Keep loading, fallback, timeout, numeric order and animation implementation together.
- [x] Run gallery behavior and Chromium loading/motion tests.

## 4. Documentation and publication

- [x] Update README setup/maintenance/testing and project-file descriptions; update CONTEXT terminology, PRODUCT scope, DESIGN implementation notes, and AGENTS maintenance pointers.
- [x] Review asset documentation for affected references; preserve attribution facts and licenses.
- [x] Record the implemented architecture and rationale in project documentation, not temporary report files.
- [x] Run independent code review, `npm test`, `npm run check:media`, and `git diff --check`. Verify desktop/mobile and JavaScript-disabled paths in Chromium if collaborative preview is unavailable.
Publication follows the verified implementation: inspect the complete staged diff, commit the scoped course and architecture work, and push the current branch to origin without force. Report the commit and any publication blocker.

## Verification record

All 207 tests passed on the final combined tree. The site-media audit passed with 133 image references across seven pages. All local links in nine project-authored Markdown documents resolved. Independent code and documentation review found no remaining issues after fixing empty responsive-image declarations. Desktop/mobile course, quiz, return-link and gallery checks passed in local Chromium; collaborative preview was unavailable. JavaScript-disabled quiz navigation remained usable. Temporary `.superpowers/` layout mockups are excluded from publication.
