# Learner-account and disclosure architecture implementation plan

> Execute the two independent tasks with parallel agents, then review and verify their integration. The user approved both candidates from the visual architecture report and explicitly requested commit and push. Work in the shared checkout to include the accumulated account/database implementation.

**Goal:** Concentrate learner-account lifecycle rules and native-details transition rules behind interfaces that hide mutable implementation state.

**Architecture:** Keep HTTP parsing, cookies and response formatting in the gateway. A learner-account module owns private records, refresh, admission, one-use flows, expiry, recovery and revocation, retaining the existing real/test provider adapter seam. A shared native-details module owns measurement, logical open state, reversal and cleanup; FAQ and course-library modules retain their distinct interaction policies.

**Tech stack:** Plain JavaScript, Node.js, native details elements, browser animations, existing Playwright and Node tests. No new dependency or frontend build.

**Approved design:** The two candidates reviewed in conversation on 2026-09-23. Preserve the ownership constraints in `docs/ARCHITECTURE.md`, the account design in `docs/plans/session-gateway-design.md`, and all timings and baseline behavior in `DESIGN.md`.

## Task 1: Learner-account lifecycle

Files: `server/gateway.mjs`, `server/sessions.mjs`, a learner-account module if needed, and `tests/gateway/`.

- [x] Run existing gateway tests before editing. Keep all HTTP/cookie/CSRF and concurrent recovery regression behavior.
- [x] Move session state and lifecycle operations under one owner. The gateway passes opaque browser tokens and validated operation inputs, never session records or lock callbacks. Returned data contains only response data and cookie changes; provider tokens and verifiers stay private.
- [x] Preserve serial refresh, absolute expiry, bounded storage, identity revalidation, callback consumption, in-flight reset invalidation, and truthful outcomes after successful password changes. Retain provider adapter contract tests.
- [x] Remove obsolete mutable-record exports and migrate tests to observable outcomes at the new interface or HTTP interface. Add regression coverage where the refactor exposes an untested lifecycle case, and demonstrate failure before a behavior fix.
- [x] Run `npm run test:gateway` and report interface ownership and verification evidence.

## Task 2: Native-details transition lifecycle

Files: `js/faq-disclosures.js`, `course/js/course-library.js`, shared `js/details-motion.js`, and relevant browser tests.

- [x] Run existing FAQ/course-library browser tests before editing.
- [x] Share complete transition ownership: rendered/target height, logical open state, reversal, cancellation, finish cleanup and immediate settling. Callers must not hold animation handles or transition maps.
- [x] Preserve FAQ 220ms and library 200ms timing, keyboard and reduced-motion behavior, FAQ data attributes, library exclusivity/scroll tracking/filter/fragment behavior, and native fallback with JavaScript disabled or blocked.
- [x] Keep `js/disclosure-motion.js` unchanged: it owns a different CSS-driven interaction. Avoid a generic animation framework.
- [x] Run affected browser tests and verify desktop/mobile and baseline experiences.

## Integration and publication

- [x] Review both implementations against the approved directions and inspect test assertions for behavior coverage.
- [x] Update architecture and maintenance documentation for actual module ownership. Keep future hosting, protected lessons and billing deferred.
- [x] Run `npm test`, `npm run check:media`, `npm run check:links`, `npm audit` and whitespace checks on the final tree. Inspect changed visual paths with local Playwright if collaborative browser tooling is unavailable.
- Publication procedure: review staged paths, exclude ignored credentials and temporary artifacts, and commit the accumulated implementation and refactors.
- Publication procedure: fetch/check the existing upstream, push without force, and verify the remote commit. Report the commit and remaining deployment limits.

## Verification evidence

- Both refactors completed and independently reviewed. Learner-account state is private behind `server/learner-accounts.mjs`; `server/sessions.mjs` was removed. Shared native-details motion lives in `js/details-motion.js`.
- Added regressions for detached account snapshots, queued logout, capacity/expiry, natural disclosure completion, unavailable browser animation, and a blocked shared module. Reproduced and fixed a session-read/logout race and missing-animation fallback before final verification.
- All 378 repository tests passed with no skips or failures. Focused gateway tests passed 27 cases. Media audit passed 151 references across 23 pages; link audit passed 345 references; dependency audit found zero known vulnerabilities.
- Desktop/mobile FAQ, course-library, and account screenshots were inspected using local Playwright. The collaborative browser opened but its resize timed out and subsequent operations reported no available automation host. Existing browser tests cover reduced motion, keyboard, and disabled/blocked JavaScript.
- No hosted database changes, live emails, payment integration or hosting changes. The final commit includes the accumulated local accounts/database work and these refactors, as requested.
