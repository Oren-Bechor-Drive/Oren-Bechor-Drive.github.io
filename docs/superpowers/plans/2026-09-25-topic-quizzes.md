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

- [ ] Add failing fixture tests for topic ownership, multi-section topics, missing/duplicate/misplaced quiz links, missing topic headings/anchors, duplicate quiz ownership, bad return destinations and all ten authored topic relationships.

```js
assert.equal(content.lessons[0].quizFile, "practice.html");
assert.equal(content.quizzes[0].topicAnchor, "topic");
assert.deepEqual(content.issues, []);
```

- [ ] Run `node --test tests/unit/learning-content*.test.mjs` and confirm the new contract fails before implementation.
- [ ] Change only the interpreter's ownership logic; retain file-specific malformed-question, heading, local-resolution and unlinked-quiz diagnostics.
- [ ] Migrate authored pages using their existing h1 titles; move quiz links outside sections, add `id="topic"`/declared title, preserve formatting and reference assets. Copy the existing quiz shell into the ten topic directories with correct relative paths and topic titles. Keep 20 placeholder questions and notices. Replace the four old quiz bodies with simple Hebrew transition notices and native links, using the existing shell styles.
- [ ] Update all browser path/ownership callers, keeping behavioral assertions intact. Add transition-link tests with JavaScript disabled. Run structural tests, `npm run check:links`, `npm run check:media` and affected browser tests.

## Task 2: Complete-answer finishing rule

**Files:** `course/js/quiz.js`, `course/css/quiz.css` only if needed, the ten quiz shells, `tests/browser/lesson-quiz-browser.test.mjs`, `tests/browser/cross-browser-smoke.test.mjs`.

**Interfaces:** A `[data-quiz-validation]` status region announces missing answers without showing the result. `showQuestion` retains native radio selections and question focus. Completing all questions keeps the existing placeholder result and review flow.

- [ ] Add a failing browser journey that answers the first/last questions, attempts finishing, sees no result, returns to the first unanswered question, then answers the remaining questions and finishes successfully. Exercise one- and five-question fixtures too, retaining arbitrary IDs and media placement.
- [ ] Run focused browser tests to confirm premature finishing currently succeeds.
- [ ] Implement the guard using authored fieldsets rather than a hardcoded count:

```js
const firstUnanswered = questions.findIndex(question => !question.querySelector("input:checked"));
if (firstUnanswered !== -1) {
    showQuestion(firstUnanswered);
    validation.textContent = "יש לענות על כל השאלות לפני סיום השאלון.";
    return;
}
```

- [ ] Clear stale validation after the learner resolves missing answers. Keep navigation/skipping before finish available, and route form submission through the same guard. Do not show scores for placeholders.
- [ ] Update Hebrew instructions and Firefox/WebKit journeys. Verify keyboard validation focus, pointer rings, mobile bounds, JavaScript disabled and blocked fallbacks.

## Task 3: Documentation, review and full verification

**Files:** `README.md`, `PRODUCT.md`, `CONTEXT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/reference/course-topic-coverage.md` and this plan/spec.

- [ ] Describe implemented topic ownership and complete-answer behavior in current docs. Record future score, trial, completion and retention requirements as target scope, not shipped features. Replace contradictory backlog decisions and retain historical verification evidence with explicit limits.
- [ ] Run `npm test`, `npm run check:media`, `npm run check:links`, and `git diff --check`.
- [ ] Verify the affected desktop/mobile path in the collaborative browser; if unavailable use local Playwright and report the limitation.
- [ ] Review the full diff for the agreed scope and security limits. Fix findings and record verification evidence. Keep unavailable content, billing and protected publication visible as remaining work.
