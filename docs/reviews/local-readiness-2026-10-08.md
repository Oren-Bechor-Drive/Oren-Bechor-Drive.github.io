# Independent local readiness verification on 2026-10-08

All 13 autonomous tasks in the [implementation plan](../superpowers/plans/2026-10-08-independent-audit-improvements.md) are complete. This records local implementation and synthetic verification. Teaching approval, hosted deployment and human/device verification remain separate gates in the [owner input sheet](../launch-inputs.md). The [original audit](website-missing-pieces-2026-10-08.md) remains the baseline.

Runtime/tool checkpoint: `bc49088a37eace5d2a4be252dada9c9c2dde27be`, on `t3/audit-missing-website-pieces`. The final commands ran against that clean checkout; this report and its companion evidence updates are documentation-only changes afterward. No hosted configuration, migration, withdrawal, email, deployment or opening was performed.

## Implemented results

| Tasks | Completed local deliverable |
| --- | --- |
| 1 | Scope and ten-day learning-retention documentation, foundation-only hosted history and safe fixture-teardown boundaries. Account deletion remains separate. |
| 2 | Serialized reading-position suspension flushing, immediate fresh authorization, exact own-acknowledgement reconciliation across repeated restores and real initial/republished zero-position persistence. |
| 3 | Strict shared protected-return allowlist for password and synthetic Google sign-in; normalized destination stored in the encrypted durable server flow. |
| 4 | Actual local/PostgreSQL cooldown decisions and Hebrew retry guidance. Unknown provider waits stay generic; the old boolean RPC remains a single-count compatibility wrapper. |
| 5 | Reviewed-source generation of 81 neutral topic references and 59 explanation references across 140 public questions. Question text, answer keys, provenance and original media are preserved. |
| 6 | Authorized same-version Hebrew native captions and bounded plaintext transcripts, with private cache controls, lifetime cancellation and private-DOM clearing. Actual approved media remains absent. |
| 7 | Immutable service-only protected quiz withdrawal, safe draft denial, explicit empty replacement attempts and preserved submitted history/completion. |
| 8 | Finite privacy-safe startup/dependency diagnostics, generic learner errors and duplicate suppression. Cloud collection remains disabled in checked-in configuration; alert destinations and responders remain unresolved. |
| 9 | Owned disposable database export/restore, atomic integrity checks, withdrawal/history/retention preservation, session-key exercises and separate synthetic media copy/hash. |
| 10 | Unpublished instructor packet for 81 question mappings, 39 Hebrew draft groups, 28 production briefs and a factual owner/data-policy input sheet. The 42 source-unverified mappings remain held; no teaching is approved. |
| 11 | Protected Firefox/WebKit journeys and Chromium accessibility checks, with current desktop/mobile collaborative verification and a separate unperformed human checklist. |
| 12 | Reproducible desktop/mobile timing, transfer, resource and bounded-concurrency benchmark, with separate error/429 counts and local measurement limits. |
| 13 | Local-only pilot checker, reliable CLI failure exits, integrated verification and this dated report. |

Only two new migrations were introduced: [cooldown decisions](../../supabase/migrations/20261008134127_gateway_rate_limit_decisions.sql) and [quiz withdrawal](../../supabase/migrations/20261008134150_protected_quiz_withdrawal.sql). The local fixtures apply all nine checked-in migrations. Historical migrations were not rewritten. The decision migration must precede a future new hosted caller, and rollback must not reactivate withdrawn instruction.

## Final command evidence

| Command | Actual result |
| --- | --- |
| `npm test` | 837 passed, 0 failed, 0 skipped; 62.75 seconds. Includes unit, gateway, database, Worker and Chromium/Firefox/WebKit checks. |
| `node scripts/publish-theory-quizzes.mjs --check` | 140 distinct questions across 10 topics; no generated drift. |
| `npm run check:links` | 793 local references across 35 authored pages. |
| `npm run check:media` | 188 image references across 35 authored pages. |
| `npm run check:search` | Canonical/indexable sitemap matches. |
| `npm run package:worker` | 240 allowed public files plus generated `_headers`; private source, fixtures, drafts and credentials excluded. |
| `npm run check:pilot:local` | 9/9 local checks; exact checkpoint SHA, nine migrations and nine unresolved external gates retained. |
| `npm run rehearse:recovery` | 11/11 checks in 1303 ms, including withdrawal, history/completion, authorization, corruption rollback, session keys and separate media hash. |
| `npm run benchmark:local` | 28 scenarios, 200 successful samples, 0 unexpected errors, 5 deliberate 429 responses reported separately; 23.58 seconds. |
| `git diff --check b6fabef` | Passed cumulative implementation/working-tree whitespace check. |
| `npm run check:hosting` | Unperformed: no authorized `.env.hosted.local` exists. Hosted configuration remains an external input. |

Supplied files under `assets/` and `index.html` are unchanged. No optimizer or homepage minification was needed. Reports used owned synthetic identities, content and temporary media outside public output; raw reports were kept outside the checkout. Cleanup and actual nonzero CLI failure exits have dedicated regressions.

The first integrated run passed 824/832 and exposed initial-zero persistence plus six stale diagnostic/review-link assertions. Those were corrected; the next run passed 834/834. Independent review then identified the adjacent republished-zero case, reproduced by real desktop/mobile publication tests before correction. The final 837/837 result above includes that fix. The review also caught repeated-restoration acknowledgement identity and an EOF formatting issue; both are corrected, with no outstanding Critical, Important or Minor findings.

## Browser and accessibility evidence

Public navigation, topic descriptions and quizzes remain usable with JavaScript disabled or the entry module blocked. Firefox and WebKit include password/allowed-return, acknowledged position restoration, suspension clearing, entitlement revocation and withdrawn/replacement quizzes. Chromium checks native roles and Hebrew names, radio/disclosure keyboard behavior, pointer/touch focus suppression, visible keyboard focus, RTL order, forced colors and 200% root-font sizing at 320px.

Collaborative T3 checks covered protected media/quiz controls at 1440px and 320px, and the final reader at 1440px and 390px. Fresh reader checks confirmed one initial zero save at revision 1, a nonzero save at revision 2, actual immutable republication and a zero save on the new version at revision 3 using expected revision 2. Reload showed the normal loaded state and current-version zero. Private text/media cleared on hide; focus and RTL behavior remained correct with no horizontal overflow.

T3 did not expose reduced-motion emulation. Local Playwright verified reduced motion for the affected desktop/mobile paths. Native accessibility-tree checks and font-size/forced-color emulation do not establish actual screen-reader or physical-device usability. The [human follow-up checklist](../manual-test-lessons.md#human-and-physical-device-follow-up-recorded-on-2026-10-08) remains unperformed.

## Final local benchmark

The clean-checkout five-iteration run used Node `v26.10.0`, Chromium `153.0.8010.12`, desktop 1440x900 at 1x CPU and mobile 390x844 at 4x renderer slowdown, both with 20 ms CDP latency, 20 Mbps download and 8 Mbps upload. Reduced motion and device scale 1 were fixed. Node gateway requests used native loopback without that browser throttle.

| Scenario | Successful count | Median ms | p95 ms |
| --- | ---: | ---: | ---: |
| Desktop cold homepage | 5 | 220.66 | 223.57 |
| Mobile cold homepage | 5 | 359.01 | 384.19 |
| Paid reads, concurrency 1 | 5 | 20.26 | 26.64 |
| Paid reads, concurrency 5 | 25 | 23.51 | 27.00 |
| Paid reads, concurrency 10 | 50 | 25.06 | 32.66 |

All public cold/warm, free/paid reader, position, quiz save/submit and authenticated range/native-playback scenarios succeeded. Browser transfer counts encoded HTTP delivery; Node transfer counts response bodies. Deliberate throttles are excluded from successful percentiles. Five-sample p95 is the maximum sample. These bounded local observations are not a hosted capacity forecast, provider quota check or real-media egress measurement. The [performance runbook](../local-performance.md) contains the first detailed baseline, resources, cache behavior and comparison method. No measured asset violation or supported regression justified an optimization or new budget.

## Gates that remain external

The local pilot report deliberately retains these nine gates:

- Instructor approval of exact teaching and question coverage revisions.
- Real instructional media, rights, accurate captions/transcripts and visual descriptions.
- Real approved contact/support destination and responder.
- Approved privacy, terms, data export/deletion and handling decisions.
- Hosted provider, Google, SMTP, origin, private storage and cleanup configuration.
- Backup destination/schedule/key custody, alert collection and operational responders.
- Authorized hosted migrations, deployment and real failure/HTTPS/cross-device verification.
- Owner/Oren's actual three-day pilot and explicit opening decision.
- Physical iOS/Android, screen-reader, actual text zoom and real-media checks.

Billing stays disabled, checked-in hosted admission stays closed, Google stays disabled, intentional course `noindex` stays in place and the recorded gallery-motion decision is preserved. Passing local commands does not authorize publication or open registration.
