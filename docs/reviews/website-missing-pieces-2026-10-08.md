# Website missing-pieces audit - 2026-10-08

The public preview has a working foundation. Its largest gaps are teaching completeness, missing instructional media and support, and the work needed to turn locally tested protected learning into a verified hosted service. Three independent subagents reviewed public content, protected learning/launch readiness, and technical quality. The parent checked their findings against source, exercised the collaborative browser and ran repository checks.

This audit covers checkout `b6fabef`. It changes no application behavior and does not authorize deployment, opening registration, enabling billing, publishing new teaching, or creating issues. External provider settings and approval records were not inspected. "Unverified" means the repository and this audit do not establish the external state.

## What already works

- Ten public topics, ten reading pages containing 25 learning sections, and ten scored practice quizzes containing 140 distinct questions.
- Topic search, a suggested starting topic, lesson contents, road scenarios, native self-checks, quiz validation, grading, mistake review and retry.
- Hebrew RTL, responsive layouts, keyboard focus, reduced motion, baseline public content without JavaScript, print support and a 404 recovery page.
- Local account flows and protected grading, saved attempts/history, optional completion, reading positions, retention, authorization, durable sessions and private media streaming.
- First-party images/fonts, original theory diagrams with provenance, search/sharing metadata, local structural audits and substantial CI/browser coverage.

The current release boundaries are recorded in [PRODUCT.md](../../PRODUCT.md). Protected features being implemented locally does not establish deployed availability.

## Prioritized missing pieces

### 1. Align the teaching with the quizzes

**Impact: high. Status: current content gap, requiring instructor review.**

The existing [coverage draft](../reference/design-teaching-coverage.md), lines 16-27, classifies the 140 questions as 48 covered, 25 partial, 11 taught elsewhere and 56 missing. Thus 81 questions need missing propositions or answer-critical qualifications at their assessed teaching placement. The draft is an editorial assessment, not an independent determination of current law or teaching approval. The content reviewer checked representative current sections and independently counted the pages/questions.

Foundations has seven gaps among nine questions. Priority hierarchy has ten gaps among fifteen. Driving-test preparation has eight gaps and four partial entries among fourteen, with the other two taught elsewhere. Existing answer explanations help after a mistake, but reading the corresponding lesson does not prepare learners for much of its quiz.

Start with the draft's exact question IDs. Have Oren approve the missing teaching or narrow the selected questions. Preserve existing scenarios, self-checks, source adaptations and stable section anchors. Record approval for the exact revision through [Operations](../OPERATIONS.md), line 36.

### 2. Make review links lead to an actual explanation

**Impact: high for mistake recovery. Status: confirmed content/navigation defect.**

[Trip-planning question 0988](../../course/trip-planning/quiz/index.html), lines 517-568, asks about engine braking on a sustained descent. Its "return to explanation" link points to `../#obstacle`. The [destination lesson](../../course/trip-planning/index.html), line 165, teaches road obstructions, not descending or engine braking. The [coverage draft](../reference/design-teaching-coverage.md), line 179, identifies this as a nearest-section destination.

This link passes the automated link audit because its anchor exists. Add approved teaching and target it accurately, or avoid labeling unrelated reading as this question's explanation. Eleven other "Elsewhere" destinations were already corrected; this finding does not mean every review link is wrong.

### 3. Supply the instructional media

**Impact: high. Status: acknowledged missing owner assets.**

Reading pages contain no instructional images or video elements. They have 19 compact future-media notes. The approved [paid-release scope](../plans/paid-release-scope.md), line 7, still calls for 16 videos and 12 images/diagrams. Consolidating placeholders did not deliver those assets.

The clearest immediate weakness is sign recognition. The [signs lesson](../../course/signs-and-speed/index.html), lines 124-164, lists signs without showing them, and its 14-question quiz contains no image-bearing question. Eight official originals already illustrate ten questions elsewhere; they are not a complete sign set. See the [media inventory](../reference/design-teaching-coverage.md), lines 430-473.

Prioritize an approved sign visual set, then turns, intersections and roundabout demonstrations. Obtain source rights, instructor approval and accessible alternatives before publication. Preserve supplied original bytes. The preview already discloses unavailable media, so this is not a broken player.

### 4. Provide a usable contact and teaching-error reporting route

**Impact: high for the current public site. Status: missing owner input.**

The homepage has no working email, phone or external contact/social destination. [PRODUCT.md](../../PRODUCT.md), line 66, records that those details have not been supplied, and [Operations](../OPERATIONS.md), line 108, records no public support address or form.

A learner cannot report a confusing question, unsafe wording or broken media through the site. Obtain an approved destination and publish a simple Hebrew contact/report route that carries the topic and question identifier. A supplied email can precede a form. The six-row FAQ and internal intake procedure already exist. Do not invent contact details or treat student photos as testimonials.

### 5. Verify the hosted learner experience

**Impact: high before a pilot/public signup. Status: deployment and external verification gap.**

[Hosting preparation](../hosting.md), lines 3-16 and 102-113, records a locally tested Worker, outstanding provider setup and the explicit private-pilot/public-opening gates. [Wrangler configuration](../../wrangler.jsonc), lines 7-19, has no public workers.dev route, closed admission and Google disabled. These checked-in defaults do not prove current external configuration.

GitHub Pages cannot provide this gateway. Both the newer migrations and the documented learning/session cleanup schedules need deployment verification. Google OAuth, actual confirmation/recovery/resend delivery, Hebrew SMTP templates, hosted password settings, HTTPS cookies, restarts, private playback and cross-device behavior remain unverified. Synthetic tests do not establish them. See [local Auth settings](../local-accounts.md), lines 34-52.

Prepare the target configuration and approved free content, then run the owner's three-day owner/Oren pilot when deployment is explicitly requested. Do not open registration on a timer. Keep billing disabled under the existing decision.

### 6. Add a caption/transcript contract for private video

**Impact: high before instructional video publication. Status: implementation gap.**

[Media policy](../../server/media-policy.mjs), lines 2 and 15-22, accepts only video/image types and exposes no caption or transcript descriptors. The [reader](../../account/reader.js), lines 69-78, creates native video controls and a figure caption, but no caption tracks or transcript interface. [Hosting preparation](../hosting.md), line 100, explicitly leaves this work outstanding.

Extend the authorized manifest/delivery and reader contracts so approved Hebrew captions and transcripts can be delivered with each video. Apply the same current-access checks to separate caption/transcript files. Native controls and video range streaming already work; burned-in captions could fit the current video format, but no actual media has been supplied or inspected. W3C explains the role of synchronized captions and the alternative-text exception in [SC 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html).

### 7. Complete privacy, deletion and support workflows before public accounts

**Impact: high before public signup. Status: unresolved policy inputs and product workflow.**

[Owner decisions](../recommendation.md), line 35, record unprepared privacy/terms and account-deletion rules. The [account page](../../account/index.html), line 35, offers account details, learning and logout, without a removal/support route. [README.md](../../README.md), lines 459 and 493, lists the missing policy pages and export/deletion workflows.

Ten-day learning cleanup is not account deletion. Define the approved retention/deletion behavior and publish reviewed Hebrew policies, then provide a supported request-and-operator workflow. This does not require a full staff console. This audit makes no determination of legal compliance.

### 8. Establish monitoring and tested restoration

**Impact: high before relying on live learner data. Status: operational gap.**

[Wrangler configuration](../../wrangler.jsonc), line 22, disables observability. [Worker initialization](../../server/worker.mjs), lines 10-11, catches invalid configuration and creates an unavailable gateway without recording the cause. Generic learner-facing failures are sensible, but do not supply operator diagnosis. A healthy public homepage can conceal failing account/database/media operations.

Add privacy-safe internal error categories, dependency checks and actionable alerts with an assigned responder. Also agree on an authorized backup destination and retention policy, then prove restoration into a non-production environment. [Hosting preparation](../hosting.md), line 113, and [owner decisions](../recommendation.md), line 35, explicitly record unresolved backups. Durable sessions and passing tests do not prove recovery from database loss. Actual provider quotas, media egress and representative-phone playback still need measurement.

### 9. Define how to withdraw an unsafe protected quiz draft

**Impact: medium now, high if real instructional content needs urgent correction. Status: source-confirmed operational gap; not runtime-reproduced.**

The [protected-learning migration](../../supabase/migrations/20260925090715_protected_learning.sql), lines 303-335, resumes an existing unfinished attempt on its original immutable version. Republishing a correction changes the current quiz, but does not replace that draft. Setting `current_version_id` to null prevents starting from the catalog, while direct attempt read/save still checks ownership/access rather than withdrawal. The [submission function](../../supabase/migrations/20260925200109_quiz_percentage_threshold.sql), lines 71-90, likewise uses the attempt's original version.

Preserving submitted history is intentional and useful. The missing piece is targeted withdrawal of an unsafe unfinished version. Document a trusted workflow that stops affected work, publishes the approved correction and invalidates only affected drafts under the existing learner lock, or add an explicit withdrawal state respected by draft operations. Preserve submitted history and completions.

Existing section retirement and learner suspension already block the corresponding protected reads. Also, gateway admission closure does not itself disable Supabase's direct Auth/API entry points; [Hosting preparation](../hosting.md), lines 106 and 111, documents that boundary. Emergency shutdown procedures must state their scope.

### 10. Preserve reading position when leaving before autosave

**Impact: medium. Status: reproduced defect.**

The [reader](../../account/reader.js), lines 23-25 and 121-129, schedules a save 600 ms after scrolling. [Protected-page suspension](../../account/protected-page.js), lines 12-15 and 28-30, immediately clears the reader and cancels that timer.

The technical reviewer executed the actual modules in JSDOM with a controlled API and geometry: a persisted 20% position was changed to 75%, immediate suspension sent zero saves, and restoration returned to 20%. The parent independently exercised the actual disposable gateway in the collaborative browser: scrolling a long free section to a displayed 65%, then dispatching `pagehide` before the delay, left the authorized server position null after 750 ms. Private DOM was correctly cleared. This simulates the real suspension handler; it is not a physical-device tab-close test.

Add a safe suspension-save or recovery strategy for the latest opaque reading position, preserving authorization, stale-revision handling and immediate private-DOM clearing. The current [lifetime browser test](../../tests/browser/test-lesson-lifetime.test.mjs), lines 112-125, covers an already-issued save rather than the pre-debounce interval.

### 11. Preserve the intended destination through Google sign-in

**Impact: medium. Status: source-confirmed and locally reproduced by the technical reviewer.**

The reader supplies an allowlisted login return URL, and password sign-in honors it. However, [the Google action](../../account/account.js), lines 245-248, sends an empty body, and [the successful callback](../../server/learner-accounts.mjs), line 109, always redirects to `/account/`. A learner trying to open a particular section must find it again after Google login.

Carry the validated local destination in the server-held PKCE flow and use it after successful authentication. Keep existing origin, redirect and session checks. The reviewer confirmed the current `/account/` redirect using the synthetic Google callback; live Google configuration was not tested.

### 12. Make rate-limit retry guidance match the actual limit

**Impact: medium. Status: source-confirmed and locally reproduced by the technical reviewer.**

[The gateway](../../server/gateway.mjs), line 156, always returns `Retry-After: 60` for HTTP 429. Its local mutation window is 900 seconds at line 162, and [production mutation limits](../../server/production.mjs), line 39, also use 900 seconds. The account UI advises a one-minute retry.

With an injected clock and a lowered local threshold, the reviewer confirmed a denied mutation was still denied after the advertised 60 seconds, and allowed only once the 900-second window expired. Return the actual remaining cooldown and display accurate guidance. Rate limiting itself is implemented; the existing [test](../../tests/gateway/session.test.mjs), line 233, only checks that the header exists.

## Decisions and later opportunities

- **Teaching approval remains outstanding.** Source research, provenance and adaptations are documented, but do not replace Oren's exact-revision approval of lessons, explanations, questions and media. See [README.md](../../README.md), lines 437-448. Assign recurring review for time-sensitive material.
- **Enrollment/billing is deliberately unavailable.** ILS 150/month is decided; enabling checkout, trial billing, cancellation and commercial pages requires provider/policy decisions and a changed owner instruction. Do not treat the public-preview CTA as broken. See [release scope](../plans/paid-release-scope.md), line 17.
- **Topic-specific search discovery is deliberately excluded.** Course pages use `noindex`; only the homepage is in the sitemap. Select approved genuinely public material for indexing when release scope permits. Existing canonical, sharing, structured data, verification tags and IndexNow automation should be extended, not rebuilt. Search-engine account status was not inspected.
- **Gallery motion needs an accessibility decision.** [DESIGN.md](../../DESIGN.md), lines 261-262, and [PRODUCT.md](../../PRODUCT.md), line 82, explicitly require continuous movement with no pause control. Reduced motion and static fallbacks are implemented. W3C's [SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) addresses automatically moving content lasting more than five seconds alongside other content. Revisit this intentional tradeoff before claiming conformity; the current result matches the owner's design choice.
- **Manual accessibility evidence is incomplete.** Automated Chromium and Firefox/WebKit smoke coverage does not replace screen-reader, forced-colors, text-only enlargement or physical iOS/Android checks. These are recorded in [the earlier quality review](site-quality-2026-09-22.md) and [README.md](../../README.md), lines 526-527.
- **The roadmap overstates some missing work.** Broad unchecked backend/auth/progress entries mix implemented local behavior with deployment/billing tasks. The [database verification guide](../../supabase/tests/README.md), line 25, also describes old 31-day retention, and line 66 instructs entitlement deletion that the newer [retention trigger](../../supabase/migrations/20260925090715_protected_learning.sql), line 101, refuses. Reconcile those statements before using the checklist or rerunning hosted smoke procedures.

## Verification and limits

After installing the repository's documented dependencies with `npm ci`:

- `npm test`: 727 passed, zero failed, zero skipped; approximately 59 seconds. Includes unit, gateway, disposable-database, Workers-runtime and browser checks.
- `npm run check:links`: 793 local references across 35 pages passed.
- `npm run check:media`: 188 image references across 35 pages passed.
- `npm run check:search`: sitemap matches canonical indexable HTML.
- Collaborative browser: desktop homepage/library, phone library/quiz, search/viewport behavior, and a synthetic protected reader using real disposable PostgreSQL. Existing tests supplied the disabled/blocked-JavaScript and reduced-motion coverage.
- Live HTTP: the public homepage and `/course/` returned 200; their visible title/FAQ and library `noindex` matched this checkout. This is a narrow public readback, not a full hosted-service or indexing verification.
- No hosted database mutations, provider configuration changes, deployments, messages to others or application edits occurred. Initial check failures were missing local dependencies, resolved by installation, and are not website defects.

The audit's findings explain behavior and readiness gaps despite passing tests. Recommended order: fix the three reproduced learner/account defects and misleading explanation destinations; close teaching/support inputs in parallel; then complete hosted pilot, accessible media delivery, policies, withdrawal and recovery checks before public accounts or paid publication.
