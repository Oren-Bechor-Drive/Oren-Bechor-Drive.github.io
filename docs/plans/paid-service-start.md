# Paid service decisions and first setup

Status: Product decisions agreed in conversation on 2026-09-23. The Supabase development project is connected through MCP and its database foundation is applied and verified. The local session gateway and Hebrew browser account flows are implemented and tested. Billing, production hosting, and protected publication of actual course material remain unimplemented.

Current project: `zurpazevlvtylnzvagoo`. MCP authentication and read access are verified; no keys need to be sent in chat. See the [database and access design](supabase-database-design.md) for the implemented first database slice and its verification boundaries.

## Agreed product rules

| Area | Decision |
| --- | --- |
| Plans | Free and paid. Both require a learner account to read learning content. |
| Public experience | The welcome page and topic descriptions remain available without signing in. |
| Free learning content | General driving information, such as rules and definitions. |
| Paid learning content | Free content plus Oren's teaching approach, deeper explanations, videos, and practice quizzes. |
| Billing | An automatically renewing monthly subscription in NIS, currency code `ILS`. The live price has not been supplied. |
| Cancellation | Stop future renewals. Retain paid access until the already-paid period ends, then return to free access. |
| Expiration | Deny further paid-content access when the entitlement ends. Free access remains available to the signed-in learner. |
| Sign-in | Email and password, plus Google sign-in. |
| Progress | Preserve progress when a subscription expires, including after a month without renewal. A returning subscriber can resume. |
| Learning order | Learners may open any learning topic within their access. Payment does not create a mandatory sequence. |

Website-only viewing is the requested experience. Enforce access on the server, keep protected content out of public deployment artifacts, and offer no course-content download feature. Technical protection cannot guarantee that a viewer cannot copy text, capture the screen, or retain content already received. Expiring access cannot erase an existing copy.

The agreement to preserve progress does not define account-deletion policy or a limit on detailed quiz-attempt history. Those remain separate decisions.

## First development milestone

Use synthetic learner accounts and clearly identified test lessons to demonstrate this journey:

1. Register, verify an email address, sign in, recover a password, and sign out. Also test Google sign-in.
2. Read an account-only free test lesson. A signed-out direct request must return no lesson body.
3. Receive a paid test entitlement through a privileged development operation. Learners must not be able to grant or extend their own access.
4. Read a paid test lesson and save a position.
5. Schedule cancellation and confirm access remains until the entitlement end time.
6. Expire the entitlement and deny the paid lesson through both the interface and direct requests. Keep the free lesson available.
7. Renew the test entitlement and restore access with the saved position intact.
8. Sign in as a second learner and prove that neither learner can access or overwrite the other's progress.

These tests simulate commercial events. They do not prove checkout, payment verification, refunds, or a payment provider's renewal behavior. Those need a later provider integration and sandbox tests.

The public preview remains a preview during this milestone. Protecting a new test lesson does not protect the existing static course files. Before real account-only or paid publication, classify each lesson body and asset and remove restricted material from public delivery. Keep public descriptions and navigation usable without JavaScript.

## Create the development project

1. Sign in to the [Supabase dashboard](https://supabase.com/dashboard). Create or choose a Free organization intended for course development.
2. Create a project named `oren-course-dev`. Generate a strong database password and save it in a password manager. Do not send the password in chat or commit it.
3. Choose a region. Frankfurt is a development suggestion for the expected audience in Israel, not a claim about required data location. Supabase lists available choices in its [region documentation](https://supabase.com/docs/guides/platform/regions). Revisit production data location before using real learner data.
4. Wait for provisioning. Open the project's Connect dialog to find the project URL and publishable key. Keys are also available under Settings > API Keys. Follow the current [API key documentation](https://supabase.com/docs/guides/getting-started/api-keys) if dashboard labels change.
5. Obtain the project URL and the publishable key beginning with `sb_publishable_` for the local gateway configuration. MCP can read these, so there is no need to send them in chat. These are public configuration. Put runtime credentials directly in `.env.local` as described in [local account setup](../local-accounts.md). Do not provide a secret key, legacy service-role key, database password, or personal access token in chat.

The project URL and publishable key identify the development project; they do not give this agent permission or credentials to manage it. Any CLI or deployment authentication must be established separately through a local authenticated session, without pasting secrets into chat.

Google sign-in requires an OAuth application and its callback configuration. Verification and recovery for arbitrary email addresses require a custom mail sender: Supabase's default sender is limited to project team addresses. Configure these after the development URLs are fixed. See [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google) and [email delivery](https://supabase.com/docs/guides/auth/auth-smtp).

## Current implementation and next slice

Completed: the six-table database, explicit grants and RLS, trusted provisioning and publication, subscription-expiry checks, and revision-checked reading positions. Hosted checks proved access denial, isolation, expiry with progress retained, renewal, and session revocation. Temporary accounts and content were removed. The local Node gateway and Hebrew account screens now support email/password, confirmation guidance, recovery/reset, Google sign-in, and sign-out. Local browser tests use a deterministic provider; they do not establish real email delivery or Google configuration. See [database verification evidence](../../supabase/tests/README.md) and [local account setup and limits](../local-accounts.md).

Next: connect the gateway to an account-only free test lesson, a paid test lesson, and saved reading position. Prove direct-request denial, entitlement expiry, retained progress, renewal, and cross-account isolation through the browser and API. This remains a local milestone with synthetic content and privileged test entitlements. Classifying and removing restricted material from public delivery is still required before publishing the real course. Monthly price and payment-provider decisions can proceed alongside this work; production hosting, durable sessions, and deployed email/Google checks remain launch requirements.

## Engineering sequence

1. Finalize the account-and-access design using Supabase Auth, PostgreSQL, and a trusted API. Resolve session handling and the development origins explicitly against the [architecture draft](paid-service-architecture.md); the draft's preferred service-owned cookie sessions must not silently become browser-stored provider sessions.
2. Write the scoped implementation plan with migrations, API contracts, account pages, private test fixtures, and authorization tests. Preserve the plain HTML, CSS, and JavaScript frontend.
3. Implement the isolated test journey above, using server-controlled entitlement records and current access checks. Never treat a browser plan flag or user-editable profile field as authority.
4. Verify direct access denial, cross-account isolation, expiry without deleting progress, and renewal. Check account pages at desktop and mobile sizes, including keyboard use and recovery states.
5. Run the repository's required checks for the changed paths, including `npm test`, relevant media checks, and `git diff --check`. Report which external flows were actually exercised.

## Decisions needed before real billing

- Monthly price and the seller's business identity and registration location.
- Payment provider eligibility and recurring NIS billing support.
- Failed-payment handling, refunds, disputes, support ownership, and account-deletion rules.
- Approved content classification and instructor-approved launch material.
- Production domains, email sender, video service, operating budget, and applicable reviewed policies.

These do not block a synthetic account-and-access test. They do block treating that test as a paid launch.
