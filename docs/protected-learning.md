# Protected learning development

The local gateway supports titled free definitions and paid lesson text, saved reading positions, protected media, server-graded topic quizzes, attempt history and manual topic completion. It uses plain checked-in HTML/CSS/JavaScript and the existing Supabase account/session boundary.

Billing is disabled by the owner's instruction. The configured offer is ILS 150.00 per month with a three-day trial; `server/subscription-offer.mjs` records it and `/api/learning` returns it as read-only metadata. No endpoint creates checkout, collects a card, starts a trial or charges a learner. Development grants remain the way to test paid access.

This is not a deployed paid service. The local launcher still refuses production mode because sessions and rate limits are process-local. No new migration, Cron job, instructional content or private media has been deployed to hosted Supabase by this change. The public `course/` preview remains publicly retrievable and contains placeholders. Never put approved restricted texts, questions, answer keys or media into its HTML/JavaScript/assets.

## Local use

Follow [account setup](local-accounts.md), apply both checked-in migrations to the intended development database, then run `npm run dev`. The original foundation migration is unchanged. Open `/account/learning.html` after signing in. Newly created databases contain no course content.

- `/account/learning.html` lists accessible published learning sections and available quizzes. Opening a quiz resumes the one unfinished attempt for that topic or starts a fresh attempt.
- Answers save after each choice. Failed saves keep the visible choices and offer retry. A conflicting revision requires explicitly loading the saved attempt.
- All 20 questions must be answered. Submission grades in PostgreSQL, returns `x/20` and explanations, and preserves that attempt's immutable quiz version. A score of 17 or more enables manual topic completion. Retrying creates another attempt; it never overwrites history.
- `/account/reader.html` fetches one entitled section, resumes its saved position, and saves scroll progress. Updated content starts from the top with a notice. The explicit save button also saves the current reading position.
- Pages clear private content on pagehide/background and fetch fresh authorization when restored. Private responses are not cached. Public topic descriptions and navigation continue to work without JavaScript.

## Publication

Only a trusted publisher can call these public SECURITY INVOKER RPCs; their private implementations have restricted execution privileges. Learners cannot publish content or write answer keys, scores, entitlement rows or completion records directly.

`publish_learning_section(p_section_id uuid, p_source_key text, p_expected_revision integer, p_title text, p_free_text text, p_paid_text text)` publishes an explicit Hebrew title and immutable text revision atomically. Expected revision 0 creates a section. Use null to omit an access level. Free text must contain only approved basic definitions; full explanations belong in paid text. Legacy `publish_section` stays compatible but new untitled legacy publications do not appear in the reader catalog. Republishing with the titled operation brings them into the catalog.

`publish_quiz(p_topic_key text, p_title text, p_questions jsonb, p_approval_reference text)` creates an immutable quiz version. The owner supplies the reference to Oren's recorded approval. Each of exactly 20 questions has these properties:

```json
{
  "id": "q1",
  "prompt": "Approved Hebrew question text",
  "options": [
    { "id": "a", "text": "Approved Hebrew answer text" },
    { "id": "b", "text": "Approved Hebrew alternative text" }
  ],
  "correctOptionId": "a",
  "explanation": "Approved Hebrew explanation"
}
```

The example describes the schema, not publishable course content. IDs are unique within their scope. Each question has 2-6 choices. Publication rejects missing explanations, invalid correct choices and malformed questions. No real questions or approvals are seeded. The existing ten topic slugs should be used for the real course. Oren's supplied content and the owner's approval records are still required before launch.

## Private media

Media files must live outside the checked-in site and outside any directory containing the site. Set `PRIVATE_MEDIA_ROOT` and `PRIVATE_MEDIA_MANIFEST` together in the server environment. The manifest is an array of server-owned descriptors:

```json
[
  {
    "id": "right-of-way-video-1",
    "sectionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "contentVersionId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "file": "right-of-way/video-1.mp4",
    "type": "video/mp4",
    "title": "Approved Hebrew media description"
  }
]
```

Replace example identifiers with the published section and paid content-version UUIDs and use the supplied file and Hebrew description. Accepted types are MP4/WebM video and PNG/JPEG/WebP images. Startup rejects duplicate IDs, traversal, symlinks and missing files. Republished section versions need matching media descriptors; an old version's URL stops working.

The reader receives `/api/media/<id>` paths. Every GET/HEAD request requires a live ordinary learner session and current paid access to the exact published version. The endpoint supports single byte ranges for video, rejects invalid ranges, sends `private, no-store`, and exposes no filesystem path or public storage URL. It prevents unauthorized fetching and casual URL sharing. It cannot revoke bytes already delivered to an authorized learner or prevent screen capture. DRM and learner-specific watermarking remain future work.

## Retention

Reading positions, unfinished attempts and submitted attempts remain while subscribed and during the ten-day lapse window. At the deadline, direct learner queries hide old records. The shared learner lock serializes cleanup, writes and entitlement changes. A late or backdated renewal cannot restore expired data, even if a scheduled sweep was delayed. Topics explicitly marked complete are preserved. Accounts and entitlement history are not deleted by this policy.

`public.sweep_expired_learning()` is service-only and returns the number of learners whose rows were deleted. For unattended cleanup, enable Supabase Cron after deploying the migration, then run [schedule-learning-cleanup.sql](../supabase/operations/schedule-learning-cleanup.sql) as the database owner. It installs/replaces one named job that runs every minute. Inspect `cron.job` and `cron.job_run_details`, verify a successful run and monitor failures. No Cron job has been installed by the local tests. See [Supabase Cron documentation](https://supabase.com/docs/guides/cron/quickstart).

Request-time cleanup also runs through the learning/section/progress RPCs. Entitlement updates clear due records before extension, and entitlement deletion is refused; revoke access while retaining its timing record. Normal revocation is effective immediately and starts its retention window. Fresh free-definition progress created after an old cutoff remains until a subsequent subscription lapse makes it due. Backup retention remains a separate operational policy.

## API and test ownership

All learner routes use the signed-in learner; none accept learner IDs. POST routes require same-origin JSON and the session CSRF token. Invalid fields are rejected. Database conflicts map to 409, inaccessible content to 404 and expired sessions to 401. Safe errors omit provider payloads.

| Route | Operation |
| --- | --- |
| `GET /api/learning` | Quiz topics, durable completion dates, paid-access state and disabled subscription offer |
| `GET /api/sections` | Accessible current section IDs, Hebrew titles and access levels |
| `GET /api/sections/<uuid>/<free-or-paid>` | Authorized body, saved position, CSRF and authorized media descriptors |
| `POST /api/sections/<uuid>/<free-or-paid>/position` | Save contentVersionId, position 0-10000, expectedRevision |
| `POST /api/quizzes/<topic>/start` | Resume or create draft |
| `GET /api/attempts/<uuid>` | Own authorized draft or submitted result |
| `POST /api/attempts/<uuid>/save` | Save answers map and expectedRevision, starting at 0 |
| `POST /api/attempts/<uuid>/submit` | Grade all saved answers using expectedRevision |
| `GET /api/quizzes/<topic>/history?before=<uuid>` | Latest 50 submitted attempts; nextCursor reaches older attempts |
| `POST /api/topics/<topic>/complete` | Mark complete only after a passing attempt |
| `GET/HEAD /api/media/<id>` | Authorized private media bytes |

`tests/database/protected-learning.test.mjs` owns real-role/ACL/RLS, grading, revision, pagination and lock-race evidence. `tests/helpers/test-lessons.mjs` owns deterministic Auth plus a disposable PostgreSQL database and optional synthetic quiz/long-text fixtures. The HTTP and Chromium journeys use those real database operations. The fixture's backdated expiry moves its pre-expiry progress/attempt timestamps too; application clocks stay real. These tests do not prove hosted Auth, REST, Cron, SMTP or payment-provider setup.

## Billing investigation

The owner confirmed an Israeli business and Israeli business bank account, then chose to leave billing disabled. Stripe's [supported-country list](https://stripe.com/global) does not include Israel as a direct payments merchant country. Charging in ILS is a separate capability from merchant eligibility. PayPlus documents [recurring ILS payments and delayed first charges](https://docs.payplus.co.il/reference/post_recurringpayments-add), but no provider was selected and no account was created. Exact trial cutoff, cancellation, retries and receipts still need provider sandbox verification when billing resumes.
