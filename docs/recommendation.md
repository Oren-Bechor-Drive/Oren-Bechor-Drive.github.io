# Project recommendations

Use this file for future project recommendations. Keep each recommendation dated, link its evidence, and distinguish proposals from owner decisions and completed work. Update superseded advice here instead of creating a separate recommendation file.

## 2026-09-25: Hosting, database, private media and account emails

Owner constraint, clarified on 2026-09-25: use free plans that restrict or stop service rather than charge for excess usage. No automatic infrastructure overage billing, paid upgrades or paid add-ons. The owner accepts an annual domain-registration fee as a specific exception; the domain and price are still to be selected. The owner may change the hosting policy later; until then, service interruption is preferable to a charge. Course billing also remains disabled. The provider choices below are recommendations, not completed purchases or deployed services. Any future-price examples use USD before taxes; no ILS conversion is assumed.

Owner confirmed on 2026-09-25: no domain is owned yet. The owner accepts a fixed annual registration expense and prefers a name such as `orenbechor.drive`, or an ending related to wheels or learning. Use a free website address for initial testing until the chosen domain is registered and verified. No exact domain, quoted price or purchase has been finalized.

The owner already has a Cloudflare account. Its current plan, connected deployment access and available resources have not been verified; account ownership alone does not establish that hosting is configured.

Google Cloud and Resend accounts need to be created. The supplied display/sender name is `oren-bechor`; it is not a supplied legal business identity or email address. A learner-support inbox remains unspecified.

The owner confirmed that Google sign-in still needs configuration and explicitly requires both Google sign-in and email/password registration in the first public version. A Google-only release is not acceptable. The existing local implementation does not establish a working hosted Google login. Google provider setup, final redirect configuration, public email delivery and live checks for both methods remain required.

The owner requested that remaining questions be sent together in one message, rather than one question per turn. Do not repeat resolved questions about budget, audience, registration methods, domain ownership, Cloudflare account ownership or the unknown learner forecast.

### Owner's rollout decision

The first hosted version is for the owner and Oren to test for three days. After that testing period, registration can open to anyone only after the owner's explicit go-ahead. Do not open registration automatically on a timer. The testing start date and public-opening time are not set; this is a rollout decision, not a completed deployment.

The owner's tester email has been supplied and saved outside the repository in `../Oren-Bechor-Drive-review/setup-private.md`, relative to the repository root. Oren's tester email is not yet known. Do not copy tester addresses into public documentation, use them as a public support contact, or infer Oren's address.

The owner does not have a first-month learner forecast. Leave it unknown rather than inventing a target or requiring a guess. Recommendation: plan within the selected Free-plan quotas, monitor actual registrations and resource usage after opening, and retain the no-overage policy. This does not establish that the free capacity will meet demand; monitoring still needs setup.

This shared testing period is separate from the planned once-per-learner three-day trial in the [paid-release scope](plans/paid-release-scope.md). It does not resume billing or automatically grant full-course access to public registrants. The owner confirmed that public registrants receive only the account-only free basic material while billing remains disabled, preserving the existing access model. Paid lessons, explanations, media and quizzes remain restricted; registration does not start a paid-content trial. Domain/email setup, hosted verification and approved content remain outstanding.

The owner confirmed that the free basic material still needs Oren's review and requested a draft prepared from the existing course text. Its selection and approval must be recorded for the exact revision before publishing it as approved learning content. The three-day testing period does not itself count as content approval.

A local Hebrew review draft now proposes ten short glossary entries, with source references and an item-by-item decision sheet. It is stored outside this public repository at `../Oren-Bechor-Drive-review/free-basic-material-for-oren.md`, relative to the repository root. No content has been approved, published or imported. The original PDF's undeveloped definitions chapter remains a source gap; this draft is an adaptation of existing lesson text, not a supplied definitions chapter.

The owner will send the draft to Oren. No review date or approval has been supplied. The owner now reports that final course files are not ready and will be supplied later; this supersedes the earlier report that finished files were awaiting delivery. Do not count unavailable texts, media, captions, questions, answer keys or explanations as import-ready.

Privacy/terms text and account-deletion rules still need preparation and review. The owner has no preference for the country in which learner data is stored. No backup destination is available for now; backups are not configured, and no paid backup service or local export destination is authorized by that answer.

### Domain recommendation

My first naming choice is `orenbechor.school`, which reflects the learning purpose. Compare its annual renewal price with `orenbechor.com` before choosing; the budget favors the lower recurring cost if both names are acceptable. `orenbechor.academy` is another naming option. These are candidates, not claims of availability or purchased addresses. The suffixes `.school`, `.com` and `.academy` appear in the [IANA delegated-domain list](https://data.iana.org/TLD/tlds-alpha-by-domain.txt), checked on 2026-09-25.

The same list does not contain `.wheel` or `.learn`. `.drive` is delegated to Google's Charleston Road Registry, but public registration availability was not established by this check, so do not make it a deployment dependency. [IANA .drive record](https://www.iana.org/domains/root/db/drive.html).

The `www` prefix is a subdomain of the registered name, not a separate domain purchase. The final site can use the selected root domain and redirect its `www` address consistently. Exact-name availability, first-year price, renewal price and registrar support must be checked before purchase. Cloudflare Registrar is a candidate because the owner already has an account and it advertises registration and renewal at registry cost; that does not establish support or a quote for every candidate. [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/).

### Recommended setup

Use Cloudflare Workers Free for the website and account API, keep Supabase Free for the database and authentication, and use its private Storage for small media tests. Resend Free remains the account-email recommendation once a sending domain is available. Defer R2 and the full video-library hosting decision under the owner's no-overage policy. This supersedes the earlier R2 starting recommendation.

| Responsibility | Recommendation | Free allowance and main constraint |
| --- | --- | --- |
| Website and account API | Cloudflare Workers Free with Static Assets | Static asset requests are free and unlimited when served without invoking the Worker. Dynamic requests have a shared 100,000/day allowance and 10 ms CPU limit per invocation. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://developers.cloudflare.com/workers/platform/limits/). |
| Database and authentication | Supabase Free | 500 MB database per project, 50,000 monthly active users, and two active free projects. Free projects can pause after one week of inactivity and do not include automatic backups. [Pricing](https://supabase.com/pricing). |
| Durable account sessions | Private tables in the same Supabase database | Implemented and locally tested using the existing database allowance, with encrypted payloads, fenced operations and shared request counters. Hosted deployment and verification remain outstanding. Supabase Auth does not persist this application's gateway sessions automatically. |
| Private video and teaching images | Supabase Free private Storage for small tests only | 1 GB storage, maximum 50 MB per file, and separate 5 GB uncached/5 GB cached egress allowances. Do not assume private streaming will use the cached allowance. Full-course suitability is unproven. [Storage pricing](https://supabase.com/docs/guides/storage/pricing), [file limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [plan allowances](https://supabase.com/pricing). |
| Account emails | Resend Free through Supabase custom SMTP | 3,000 emails/month, capped at 100/day. A domain with DNS access is required to send account emails to learners from a verified sender. [Resend limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [domain verification](https://resend.com/docs/dashboard/domains/introduction). |

Keep the selected accounts/organizations on Free with no paid subscriptions, trials that convert to paid plans, or billable add-ons. Annual domain registration is the approved budget exception, pending an exact name and price. No backup storage is currently available. The complete course may not fit: video sizes, viewing volume and expected learner numbers are still unknown. Reduce pilot scope or stop the affected service when capacity is exhausted; do not enable payment as an automatic fallback.

### What happens at the free limits

| Service | Expected behavior on Free |
| --- | --- |
| Cloudflare Workers | Dynamic requests above the daily allowance fail with error 1027. Use fail-closed behavior for access checks wherever route modes apply; never bypass authorization when the limit is reached. Static delivery has separate allowances. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). |
| Supabase | Free incurs no usage charges. Excess usage can result in warnings and then service restrictions under its fair-use policy, rather than an exact immediate cutoff at every quota. This meets the no-charge requirement, but does not guarantee uninterrupted accounts, media or cleanup scheduling. [Cost control](https://supabase.com/docs/guides/platform/cost-control), [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq). |
| Resend | Keep the Free transactional plan's daily/monthly quotas; paid-plan overage sending is excluded. Handle quota rejection as an email-delivery failure and wait for allowance to reset. [Account limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits). |

Verify the selected plan and quota-error behavior during hosted setup. These are documented provider behaviors and implementation requirements, not settings already applied to this project.

### Website hosting

Cloudflare is my preferred target because the public site, account API and private media checks can share one HTTPS origin. Keep the checked-in HTML, CSS and JavaScript usable without a frontend build. Deployment tooling can upload an allowlisted copy of those files alongside the Worker; it must not publish the repository root, server sources, credentials or restricted content. [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).

Keep public files on the static path and route account/API/media requests through the required server logic. Static asset delivery must never bypass an access check for protected content. Cloudflare supports selective Worker-first routing. [Worker routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

The [hosting implementation](hosting.md) now provides a separate Cloudflare Worker entry, encrypted durable sessions and hosted private media. The [local launcher](../server/start.mjs) still rejects production and binds only to loopback, using in-memory sessions and optional local private files. Local runtime verification does not establish a deployed service. Workers supports Node APIs with compatibility limits and a virtual filesystem, so verify the gateway on its actual runtime before committing to the migration. [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [filesystem](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/).

A supplied `workers.dev` address can support initial testing without buying a domain now. Use an owned domain for the production course; Cloudflare recommends custom domains or routes for production. A temporary website address does not supply an email-sending domain. [Workers domains](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).

### Database and durable sessions

Keep Supabase because the existing PostgreSQL migrations already implement learner isolation, access checks, grading and retention. Moving databases to chase another free tier would replace tested work. Reserve separate development and production projects where the account's free-project allowance permits; do not silently promote the current development project or copy its synthetic access grants.

Most usage allowances are pooled at organization level; database size is per project. The two-active-free-project limit counts projects across organizations the account owns or administers, so check existing usage before assuming a second free environment is available. [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase).

Persist gateway sessions in a private, server-only store. Preserve opaque HttpOnly cookies, store keyed hashes of browser session tokens, encrypt provider refresh/access tokens at rest with server-managed keys, and coordinate refresh, recovery, logout and revocation across requests and restarts. Replace process-local concurrency and rate-limit assumptions. These controls are implemented and locally tested in the new session adapter. An uncertain password update keeps a durable barrier until an operator reconciles the provider result; it does not reopen authentication automatically. Hosted setup remains pending. See [implemented account boundaries](ARCHITECTURE.md#local-account-gateway).

Use Supabase Cron for the existing ten-day cleanup job so it does not depend on a visitor opening the site. Deploy the migrations, install the [schedule](../supabase/operations/schedule-learning-cleanup.sql), and verify actual runs and retained completions in the target database. The local tests do not prove hosted deployment. See [retention operations](protected-learning.md#retention).

Free is appropriate for a pilot that tolerates service limits. The owner currently has no backup destination. Keep off-provider exports and a restore check as unresolved operational work before relying on recovery of real learner data; do not claim that durability alone provides a backup. Inactivity pausing and the lack of included automatic backups need reassessment before paid launch. Any paid database plan is deferred until the owner changes the hosting budget policy. [Backup guidance](https://supabase.com/docs/guides/platform/backups).

### Private video delivery

For a small pilot, use a private Supabase Storage bucket with no public read policy. Deliver through the application's `/api/media/` path: validate the learner session, current entitlement and published content version before fetching each object, including byte-range requests. Keep storage credentials server-side and private responses out of shared caches. Private buckets require authorized access; the gateway must not expose a privileged storage path or reusable public download link. The hosted adapter and seeking behavior are now locally tested, including the Worker runtime. Live bucket setup, actual supplied media and hosted playback still need verification. [Storage bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Start with small browser-compatible MP4 test copies, Hebrew captions and transcripts. Preserve supplied originals outside the public repository. Encoding, accessible playback, seeking and mobile performance remain our work. Measure all 16 videos and 12 images/diagrams before selecting full-course storage. A 300 MB video exceeds Supabase Free's 50 MB per-file limit; 16 such files would total about 4.8 GB, exceeding its storage allowance too. Do not degrade teaching-media readability just to fit a quota. If the approved course cannot fit, keep full video publication pending a revised budget or another verified no-charge option.

R2 is deferred. Its free allowance is part of usage-based billing, and budget alerts do not stop usage. This does not meet the owner's current requirement. Do not activate R2 based on an expectation that traffic will stay low. Reconsider only after the owner changes the policy or a verified provider-enforced no-charge option becomes available. [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/).

Cloudflare Stream is also deferred. If the owner later accepts paid hosting, reassess it for adaptive streaming and automatic encoding. Its published pricing is $5/month per 1,000 stored minutes, purchased in increments, plus $1 per 1,000 delivered minutes. [Stream pricing](https://developers.cloudflare.com/stream/pricing/).

### Account emails

Use Resend as Supabase Auth's SMTP provider for confirmation and password recovery. Supabase's built-in sender is restricted to project-team addresses and two messages/hour, so it cannot serve normal learner registration. [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

Configure an owner-controlled sending domain or subdomain, its verification records, and an approved sender name/address. Verify confirmation and recovery links against the final HTTPS origin. Test the existing Hebrew templates, expired links and resend throttling. New Free projects cannot customize templates while using Supabase's default sender; custom SMTP restores template customization. [June 2026 change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier). A new signup can consume several messages, so 100 emails/day does not mean 100 guaranteed new learners/day. Supabase custom SMTP initially adds a configurable 30-message/hour limit. [SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp).

Resend Free requires no card. For owner-only testing before buying a domain, its test sender can send to the Resend account owner's address; this does not enable learner registration emails. [Free transactional email](https://resend.com/products/transactional-emails), [test-sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Resend provides outbound account email, not a learner-support inbox. Domain purchase and a support mailbox, if needed, are separate decisions. Do not invent an address or use a test sender for public enrollment.

### Alternatives considered

| Alternative | Assessment for this project |
| --- | --- |
| Render Free Node web service | Less runtime adaptation than Workers, but still requires durable sessions and external media storage. It sleeps after 15 minutes without inbound traffic, takes about a minute to wake, and has an ephemeral filesystem. Useful for a temporary technical demo; not my preferred learner experience. [Free-service limits](https://render.com/docs/free). |
| GitHub Pages for the protected service | Keep the repository as source control, but Pages cannot run this gateway. Its published usage limits also exclude using Pages to operate an online business or commercial SaaS. [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). |
| Vercel Hobby | Its non-commercial restriction does not fit the intended paid course. [Hobby plan](https://vercel.com/docs/plans/hobby). |
| R2 for the full video library | Potential future option for larger files and repeated viewing, but excluded now because usage above its free allowance can be billed. Alerts are not a hard cap. [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/). |

### Remaining decisions before deployment

1. Check availability and registration/renewal prices for the domain candidates, then finalize the name and price. Annual registration is acceptable; automatic infrastructure overages are not.
2. Verify the existing Cloudflare account's Free plan and deployment access. Create Google Cloud and Resend accounts, configure both registration methods and verify the sending domain. These provider steps are not complete.
3. Keep development and production separate where the free allowances permit. Select a region based on service suitability; the owner has no country preference. Prepare the deployment, durable-session and migration work, including the cleanup job and hosted verification.
4. Obtain Oren's tester email, run the three-day private test, and wait for the owner's go-ahead before public registration with free basic material only. Use synthetic fixtures while real content remains unavailable; do not represent them as approved lessons.
5. The owner will send the free-material draft to Oren. Record his review and resolve corrections. Import only supplied, approved content with its access classification, following the [release scope](plans/paid-release-scope.md). Final course files are not ready.
6. Prepare and review policies, obtain a support email and establish a backup destination/recovery procedure. These remain outstanding despite the recorded preferences.
7. First-month learner count is unknown. Monitor actual demand after opening and measure media when it is supplied.

Record the owner's answers and any revised recommendations here. Provider selection alone does not complete the README milestone; hosted verification and approved content import are still required.

### Outstanding owner-supplied items

The grouped questionnaire has been answered. Do not ask it again. The items still to be supplied or finalized are the exact domain and price, Oren's tester email, a support email, approved content and review records, policy decisions/review and a backup destination. The owner will supply course files later and send the prepared draft to Oren. Public opening also requires the owner's explicit go-ahead after testing.


## 2026-09-25: Implementation status after development authorization

The repository now contains the [hosted gateway and operations guide](hosting.md), safe static packaging, durable encrypted sessions, shared rate counters, manual closed/pilot/public admission and private Storage streaming. The local launcher remains available. PostgreSQL and local Cloudflare-runtime tests verify these paths; no hosted resources, secrets, migrations, uploads or routes have been changed.

Use direct static routing for image/style/script assets. Existing HTML and directory routes pass through the Worker to preserve checked-in URLs and headers, so those requests consume its dynamic quota. A checked-in configuration keeps public routes and preview URLs disabled. Free provider plan settings and their actual quota behavior still require verification before deployment.

The three-day pilot and public opening remain operational decisions, not timers. Closing registration rejects existing gateway sessions on their next authorization check. Public mode requires Google enabled and does not grant a paid trial or entitlement. Keep actual tester addresses and the media registry in secret configuration.


## 2026-09-25: Shared private-media policy

Approved and implemented: keep one common policy module for validated immutable media descriptors, opaque section listings, strict single-range decisions and safe response headers. Keep filesystem and Storage I/O, filename rules, upstream verification and cleanup in their respective adapters. The gateway continues to authorize the learner and exact published version before delivery.

Use a compact catalog with a two-stage request plan: validate the request before fetching, then resolve the response after the source size is known. Separate exported policy functions would require more coordination in both adapters; a generic streaming module would combine different resource lifetimes. Both adapters now use strict string IDs and reject empty or overlong Range headers consistently. See [module ownership and verification seams](ARCHITECTURE.md#protected-learning-and-private-media).

## 2026-09-25: Security audit follow-up

The [repository security audit](security-audit-2026-09-25.md) found no confirmed exploitable issue in the inspected local paths and added SQL injection and browser-rendering regressions. This does not replace hosted verification.

Before deployment, verify effective database grants/RLS, private bucket policies, real authentication, secret storage and backup recovery. Gateway pilot admission and rate limits do not govern direct provider traffic. If closing registration must also block previously provisioned learners using direct provider tokens, add and verify that provider/database restriction before opening. Verify abuse controls and alerts within the agreed no-overage budget; capacity exhaustion can deny service even when data remains protected.
