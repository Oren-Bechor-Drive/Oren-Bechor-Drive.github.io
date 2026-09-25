# Topic quiz preview implementation plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan task by task.

**Goal:** Give each of the ten learning topics one static 20-question quiz preview and require every answer before finishing.

**Architecture:** Authored lesson HTML owns one topic-level quiz link. `scripts/learning-content.mjs` remains the single development-time interpreter, and `course/js/quiz.js` owns shared interaction. No runtime content registry, fabricated answer keys or backend claims.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js test runner, JSDOM and Playwright.

**Spec:** `docs/plans/paid-release-scope.md`, first implementation milestone.

## Global constraints

- Preserve all existing learning section anchors and supplied image bytes.
- Visitor copy is Hebrew with ASCII punctuation, RTL layout and DESIGN.md styling.
- Preserve independent static HTML, keyboard access, pointer focus behavior and reduced-motion support.
- Preserve noindex on preview and transition pages; do not expand the sitemap.
- Tests use authored questions in order, not numeric question IDs or hardcoded question counts in shared interaction.
- The user's implementation instruction authorizes this milestone. Work on branch `feat/topic-quiz-launch` in its isolated worktree. Do not publish, deploy or modify hosted data.

## Task 1: Topic ownership, pages and structural verification

**Files:** `scripts/learning-content.mjs`, `tests/unit/learning-content*.test.mjs`, the ten `course/<topic>/index.html` files, ten new `course/<topic>/quiz/index.html` files, four old quiz transition pages, and browser callers of interpreted quiz ownership.

**Interfaces:** Each `.lesson-content` has a stable `id="topic"` and `aria-labelledby="topic-title"`; the page h1 has that ID. Exactly one `.lesson-quiz-link` belongs to the topic, outside individual `.lesson-section` elements. Sections keep their IDs/headings and lose the obsolete `data-lesson-format` attribute. Quiz return links target `../#topic`. Interpreter lesson records expose `title`, `topicAnchor` and `quizFile`; quiz records expose `topicAnchor` instead of `sectionId`. Section records no longer expose `format` or `quizFile`.

- [x] Add failing fixture tests for topic ownership, multi-section topics, missing/duplicate/misplaced quiz links, missing topic headings/anchors, duplicate quiz ownership, bad return destinations and all ten authored topic relationships.

```js
assert.equal(content.lessons[0].quizFile, "practice.html");
assert.equal(content.quizzes[0].topicAnchor, "topic");
assert.deepEqual(content.issues, []);
```

- [x] Run `node --test tests/unit/learning-content*.test.mjs` and confirm the new contract fails before implementation.
- [x] Change only the interpreter's ownership logic; retain file-specific malformed-question, heading, local-resolution and unlinked-quiz diagnostics.
- [x] Migrate authored pages using their existing h1 titles; move quiz links outside sections, add `id="topic"`/declared title, preserve formatting and reference assets. Copy the existing quiz shell into the ten topic directories with correct relative paths and topic titles. Keep 20 placeholder questions and notices. Replace the four old quiz bodies with simple Hebrew transition notices and native links, using the existing shell styles.
- [x] Update all browser path/ownership callers, keeping behavioral assertions intact. Add transition-link tests with JavaScript disabled. Run structural tests, `npm run check:links`, `npm run check:media` and affected browser tests.

## Task 2: Complete-answer finishing rule

**Files:** `course/js/quiz.js`, `course/css/quiz.css` only if needed, the ten quiz shells, `tests/browser/lesson-quiz-browser.test.mjs`, `tests/browser/cross-browser-smoke.test.mjs`.

**Interfaces:** A `[data-quiz-validation]` status region announces missing answers without showing the result. `showQuestion` retains native radio selections and question focus. Completing all questions keeps the existing placeholder result and review flow.

- [x] Add a failing browser journey that answers the first/last questions, attempts finishing, sees no result, returns to the first unanswered question, then answers the remaining questions and finishes successfully. Exercise one- and five-question fixtures too, retaining arbitrary IDs and media placement.
- [x] Run focused browser tests to confirm premature finishing currently succeeds.
- [x] Implement the guard using authored fieldsets rather than a hardcoded count:

```js
const firstUnanswered = questions.findIndex(question => !question.querySelector("input:checked"));
if (firstUnanswered !== -1) {
    showQuestion(firstUnanswered);
    validation.textContent = "יש לענות על כל השאלות לפני סיום השאלון.";
    return;
}
```

- [x] Clear stale validation after the learner resolves missing answers. Keep navigation/skipping before finish available, and route form submission through the same guard. Do not show scores for placeholders.
- [x] Update Hebrew instructions and Firefox/WebKit journeys. Verify keyboard validation focus, pointer rings, mobile bounds, JavaScript disabled and blocked fallbacks.

## Task 3: Documentation, review and full verification

**Files:** `README.md`, `PRODUCT.md`, `CONTEXT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/reference/course-topic-coverage.md` and this plan/spec.

- [x] Describe implemented topic ownership and complete-answer behavior in current docs. Record future score, trial, completion and retention requirements as target scope, not shipped features. Replace contradictory backlog decisions and retain historical verification evidence with explicit limits.
- [x] Run `npm test`, `npm run check:media`, `npm run check:links`, and `git diff --check`.
- [x] Verify the affected desktop/mobile path in the collaborative browser; if unavailable use local Playwright and report the limitation.
- [x] Review the full diff for the agreed scope and security limits. Fix findings and record verification evidence. Keep unavailable content, billing and protected publication visible as remaining work.

## Verification, 2026-09-25

Implemented on `feat/topic-quiz-launch` in `.worktrees/topic-quiz-launch`.

- Baseline: 416 tests passed.
- Final `npm test`: 448 passed, zero failures or skips. Includes database/gateway tests, gallery/image delivery, all ten topic quiz journeys, disabled/blocked JavaScript, and Firefox/WebKit smoke checks.
- `npm run check:media`: 171 image references across 34 pages passed.
- `npm run check:links`: 508 local references across 34 pages passed.
- `git diff --check`: passed.
- DOM comparison against the starting revision preserved all 22 reading sections and their text/anchors, 16 video placeholders and 12 image/diagram placeholders. Supplied assets are unchanged.
- Local Playwright verified desktop at 1440px and mobile at 390px, inspected screenshots, and exercised a completely unanswered quiz, validation focus and horizontal bounds. Automated journeys verify pointer/keyboard focus, complete recovery and form submission. Legacy transition keyboard skip navigation, inline-script CSP rejection and configured account navigation were also checked.
- Collaborative browser navigation and a desktop DOM check worked, but snapshot/resize failed and the automation host then became unavailable. Remaining visual verification used local Playwright. This does not claim manual screen-reader or physical-device verification.
- Independent review approved the final implementation. Review corrections restored original-section return links and account/header safeguards on legacy URLs. A full-suite failure exposed a dropdown test target covered by an upward menu after the longer instructions; the outside-click check now uses the unobstructed header and retains real pointer, closed-state and inert assertions. The focused test reproduced the failure before correction; the complete rerun passed.

No production deployment or hosted data changes were performed. Scores, explanations, persistence, topic completion, retention cleanup, trials, real billing and protected course publication remain subsequent milestones in the release scope. All new quiz content is explicitly placeholder material.
