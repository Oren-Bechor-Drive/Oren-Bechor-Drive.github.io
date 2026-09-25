# Protected reading architecture implementation plan

> Use subagent-driven-development to implement and review the tasks.

Goal: Implement the two approved architecture-report findings, then commit and push the feature branch.

Architecture: Synthetic test lessons use the actual section reader and section routes. A shared protected-page lifetime module owns invalidation and request completion acceptance for the section reader and quiz page. Rendering, draft preservation, revision conflicts and save scheduling remain with each page.

Source: Architecture report `/tmp/architecture-review-20260925-131543.html` and the owner's instruction to implement both findings.

Constraints: Plain JavaScript, no build step. Hebrew visitor copy and RTL stay intact. Existing learner authorization, retention and billing-disabled behavior remain. No database migration or deployment is needed. Parent owns staging and commits.

## Tasks

- [x] 1. Move gateway test callers to section routes and remove fixed lesson routes and account methods. Keep synthetic content and development entitlement fixtures. Standalone expired-position reads remain a database test concern, not a new browser operation.
- [x] 2. Move synthetic reader browser journeys to the actual reader. Preserve delayed load/save, expiry/renewal, learner isolation, two-browser conflicts, retry, focus and baseline navigation coverage. Replace percentage input interactions with actual scrolling or arrange stored positions through section writes. Retire the old HTML/CSS/JS and account link.
- [x] 3. Add a shared protected-page lifetime module and migrate reader and quiz callers. An operation receives owned request access; success, errors and finalization from invalidated operations cannot mutate a restored page. Page suspension invalidates all work and clears private rendering; resume reauthorizes before restoration. Add meaningful tests for late success/failure and lifecycle restore; retain quiz dirty-draft conflict tests.
- [x] 4. Update current setup, manual testing, design and ownership documents. Historical plans remain historical, with superseding notes where useful.
- [x] 5. Review changes, run targeted tests and full npm test, check links/media and git diff --check. Verify desktop/mobile behavior. Commit and push feat/topic-quiz-launch without merging or deployment.

## Verification

Implemented and reviewed against 9596d6d. All 493 tests passed, including native PostgreSQL, gateway contracts, Chromium journeys and the existing cross-browser checks. Link audit passed with 515 local references across 35 pages; media audit passed with 171 image references across 35 pages. `git diff --check` passed.

The reviewer reproduced a regression where manual reload after a failed tab restore discarded held quiz answers. A browser test first failed with zero restored questions, then passed after preserving held state on retry. Denied access still discards that state. Independent review passed 30 focused lifetime/quiz/reader tests and found no remaining blocking code or test issues.

The collaborative browser loaded and inspected the actual reader at desktop size, but its snapshot tool failed. Local Chromium verified reading and saving at 1440px and 390px without horizontal overflow; existing tests cover keyboard/pointer focus and disabled/blocked JavaScript navigation.

The owner subsequently requested merging into current main, pushing main, pulling locally, and removing merged local/remote branches. Finish integration only after this verified change is committed. Preserve existing uncommitted files in the older database worktree by detaching it before deleting its already-merged branch.
