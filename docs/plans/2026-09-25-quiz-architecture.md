# Practice quiz architecture implementation

The owner approved both candidates in the architecture review: deepen public Practice quiz publication and concentrate protected Quiz attempt editing. Existing question content, public variable counts and protected 20-question grading remain separate.

## Publication

- Reproduce stale metadata passing `--check` in an owned temporary tree.
- Keep the maintenance command and its testable publication operation in one module. Resolve every input and output against the supplied root.
- Identify authored regions structurally, preserve unrelated bytes, and reject missing or duplicate regions with file-specific diagnostics.
- Prepare and validate all output before writing; check mode uses the same preparation without mutation.
- Exercise the real operation and command on stale, malformed and valid authored files. Retain source-fidelity and media-provenance checks.

## Protected Quiz attempt editing

- Introduce `createQuizAttemptEditor()` as the owner of saved/current/held answers, revision conflicts and save/submission coordination.
- Let the page load authorized attempt snapshots, record choices, suspend or clear editing, and render copied views. Keep rendering, Hebrew feedback and focus in `account/learning.js`.
- Keep request cancellation and authorization lifetime in `account/protected-page.js`. The editor accepts requests from that lifetime and rejects completions for replaced editing state.
- Preserve unsaved choices across failed saves and repeated suspension. Restore only after an authorized attempt read; conflicts retain the original revision until explicit reload.
- Test queued edits, retries, conflicts, held drafts, submitted answers and stale responses through the editor's interface. Retain browser acceptance journeys and add a pending-save journey with multiple edits and keyboard focus.

## Integration

- Update module ownership and maintenance instructions.
- Run focused regressions, the full `npm test` suite, media/link checks, publication `--check`, and `git diff --check`.
- Verify affected desktop/mobile behavior and obtain focused independent review.
- Preserve all earlier uncommitted content work. No hosted changes, dependency changes, commit or deployment are part of this implementation.

## Verification evidence

- Publication tests reproduced the stale-description false success and missed lesson-region updates before the fix. The actual publisher now verifies all 140 questions across ten topics without changing current HTML.
- Editor tests exercise queued edits and submission, conflicts, repeated restoration, retry, copied views and obsolete responses. Review found that reverting a choice during a pending write could look clean; two failing regressions now prove preservation through both pending and ambiguously failed writes.
- `npm test`: 604 passed, 0 failed, 0 skipped. This includes the pending-save browser journey, existing desktop/mobile protected-learning journeys, gallery/image delivery and hosting checks.
- `npm run check:media`, `npm run check:links`, publication `--check` and `git diff --check` passed.
- Independent focused review found no remaining concrete defects after the reverted-choice fix.
- Collaborative-browser resizing timed out. Local Chromium at 1440px and 390px verified saving, RTL reflow, hidden pointer outlines, visible keyboard focus and no browser storage. Disabled and blocked JavaScript retained the baseline access message without private content.
- Publication validates all prepared content before authored writes. Filesystem failures during final sequential writes do not have rollback recovery.
