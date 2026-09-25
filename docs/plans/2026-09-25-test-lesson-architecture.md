# Test-lesson architecture implementation plan

**Goal:** Implement both architecture candidates approved on 2026-09-25: coordinated lesson loading and owned browser reader lifetime.

**Architecture:** Extend the existing learner-account module's lesson read to return safe lesson data, saved position and CSRF together under one session operation. Keep independent position reads and writes. Within the existing browser page module, one private reader owns state, cancellation and transitions; rendering derives controls from explicit state.

**Constraints:** Preserve the current working tree, Hebrew RTL copy, focus behavior, static fallback, server access checks, expired paid-position visibility, conflict recovery and private/no-store responses. No dependencies, shared framework, database migration or hosted changes. Combined reads are not a transactional database snapshot.

## Coordinated lesson read

- [x] Extend gateway tests to require `{ lesson, position, csrf }`, null and existing saved positions, one admission check, refreshed learner credentials, safe failure responses and invalidation during preparation.
- [x] Run the new expectations before implementation and confirm failure.
- [x] Keep preparation inside `readLesson`. Read position before the authorized lesson body so the body check follows preparation. Pass only the session's CSRF value into the private operation, never expose the session record.
- [x] Preserve separate position reads after paid expiry and all write validation. Run gateway and real PostgreSQL access-journey tests.

## Browser reader lifetime

- [x] Add browser tests for one-request loading and delayed load/save completion overtaken by hide, reload and persisted restoration. Assert rendered text, editable state and focus, not private implementation state.
- [x] Replace separate load/save ownership variables with one private reader, explicit phases and one pending operation. Invalidation cancels pending work and discards reading state. Every completion checks ownership before changing state.
- [x] Render controls from state rather than reading DOM flags to decide whether a save is allowed. Preserve draft input during conflict or network failure and require explicit conflict reload.
- [x] Use the coordinated read response. Keep page events and form listeners thin, with focus restoration tied to the load that requested it.
- [x] Run existing and new browser checks at desktop and phone sizes, including keyboard/pointer focus and disabled/blocked JavaScript.

## Verification

- [x] Update the lesson contract and module ownership documentation.
- [x] Run `npm test` and `git diff --check`.
- [x] Verify desktop/mobile in the collaborative browser, or report its limitation and use local Chromium.
- [x] Obtain focused review and resolve findings.

## Verification evidence

- Gateway tests first failed on missing position/CSRF fields, partial success after a position-read failure, and body authorization preceding preparation. All 50 gateway tests passed after the coordinated read change.
- Browser tests first reproduced the three-request loading protocol and a superseded conflict reload stealing focus after restoration. All 14 focused browser tests passed after the reader change, including existing conflict/access journeys and new delayed-response cases at 1440px and 390px.
- `npm test`: 416 passed, 0 failed, 0 skipped. This includes gallery/image-delivery checks and disabled/blocked JavaScript paths.
- The collaborative browser opened and read the lesson, but desktop/mobile resize calls timed out. Local Chromium screenshots at 1440px and 390px were inspected. Both sizes saved 42.5 percent, retained RTL layout with no horizontal overflow, showed no pointer focus outline and a solid keyboard focus outline, and stored no browser data.
- Focused independent review found no material issues. `git diff --check` passed.
- The [manual browser/API walkthrough](../manual-test-lessons.md) uses the existing disposable fixture. Its documented API helper and two-learner lifecycle were exercised with local Chromium and real PostgreSQL.
- No hosted data, database schema, dependencies, public layout or production service changes. The follow-up publication request includes the saved-position work, lifecycle tests, both architecture changes and relevant documentation in one commit and push.
