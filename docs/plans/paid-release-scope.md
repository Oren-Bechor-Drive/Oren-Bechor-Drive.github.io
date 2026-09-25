# Agreed paid release scope

Decisions supplied by the owner on 2026-09-25. This document defines the target release, not currently available capabilities. Implementation began with the topic-quiz preview milestone described below. See PRODUCT.md for shipped behavior.

## Audience and launch

The first release accepts real payments and serves anyone learning to drive or improving their driving. All ten existing learning topics, the 16 planned videos, the 12 planned images/diagrams, and ten topic quizzes must be complete before launch. The owner reports that the final media and revised texts exist and will be supplied by Oren; they are not yet available in the repository.

Oren approves all instructional text, media, questions, answer keys and explanations. The owner records approvals and subsequent corrections. The owner and their agents handle learner support, billing/refunds and content publication. No launch date, usage forecast or operating budget has been set.

## Access and billing

- The welcome page and topic descriptions remain public. A free account permits only basic information such as definitions of laws.
- Lessons, explanations, images, diagrams, videos and quizzes require paid access or an active trial. Topics can be studied in any order.
- Offer a standard automatically renewing monthly subscription in ILS. The owner set the monthly price to ILS 150.00 on 2026-09-25. Billing remains disabled by their subsequent instruction.
- Each learner gets one three-day trial with all paid content. Payment details are required before the trial starts. Billing starts automatically after the trial unless canceled.
- Trial cancellation preserves access through the trial end and incurs no subscription charge afterward. Paid cancellation stops renewal and preserves access through the paid period.
- The purchase flow requires a declaration that the buyer is at least 18 or has guardian approval. Final Hebrew wording and the adequacy of this mechanism require policy review before sales.

## Quizzes and completion

- Exactly one quiz per learning topic: ten quizzes, each with 20 questions. The right-of-way quiz combines coverage of left turns, right turns and U-turns.
- Learners can navigate freely and change answers before submission, but must answer all 20 questions to submit.
- After submission, show a score out of 20 and explanations. Allow unlimited retries and retain submitted attempt history.
- A score of at least 17/20 unlocks an optional "Mark as complete" action for that topic. Passing does not automatically mark it complete or grant a certification.
- Reading positions, unfinished quizzes and completed topics must persist across signed-in sessions.

## Retention

There is no rolling one-month expiration for quiz history. While subscribed, retain learning data unless another explicit policy requires otherwise. Paid access ends immediately at subscription expiry. If the subscription is not renewed within ten days after expiry, delete reading positions, unfinished quizzes and submitted attempt history, including saved answers and scores. Keep completed topics. Renewing before that deadline preserves the saved data; renewing afterward starts fresh except for completed topics.

This cleanup rule does not delete learner accounts or billing/audit records. Their retention and backup expiry require separate policies. Production retention must be enforced by trusted server/database operations, including the renewal path, so a delayed cleanup job cannot restore expired progress. The protected-learning migration implements this policy locally; it and the unattended cleanup job still require deployment. See [protected learning](../protected-learning.md).

## Security and release dependencies

Prevent unauthorized access and casual sharing using server-enforced entitlement checks and private content/media delivery. Never expose paid lesson bodies, answer keys or private asset URLs in public static files. DRM and learner-specific watermarks are deferred. A learner can still photograph or record visible content.

Before accepting payments, supply the business identity and support destination; select eligible billing, hosting and media providers; define refund, failed-payment, account-deletion and acceptance-evidence policies; complete qualified policy review and production verification. The owner confirmed Israel for both business registration and banking. Stripe direct merchant eligibility does not cover Israel; no replacement provider was selected. Other listed inputs are missing. Existing public preview text is not protected merely because pages are noindex. Real protected material must not be added to the public repository as part of this milestone.

## First implementation milestone: topic-quiz preview

Move quiz ownership from individual learning sections to their learning topic. Each existing lesson page retains its section IDs, contents navigation, explanations and media placeholders. It gains one topic-wide quiz link, and each topic receives an independently authored `course/<topic>/quiz/index.html` with 20 explicitly placeholder questions. Keep the four former quiz URLs as noindex transition pages linking to the new topic quiz and their original reading anchor. They must not contain duplicate quizzes.

The shared quiz interaction refuses to finish while questions are unanswered, announces the problem in Hebrew and brings the first unanswered question into view. Existing answer navigation and review remain available. Finishing a complete placeholder quiz reports answer count only; it does not fabricate grades, explanations, stored progress or topic completion.

Keep static HTML usable with JavaScript disabled or the entry module blocked. All new copy is Hebrew with ASCII punctuation, with the existing RTL layout and DESIGN.md styling. Verify desktop/mobile layout, pointer and keyboard behavior, media and local links, and the complete test suite.

## Subsequent implementation milestones

1. Add protected, versioned quiz publication and server-side grading, resumable attempts and durable topic completion, using synthetic private fixtures until Oren's questions arrive. Enforce learner isolation, all-answer validation and the 17/20 threshold on the server.
2. Add the ten-day expiration cleanup with renewal concurrency and completion preservation, alongside real-course reading progress. Verify pre-deadline renewal, late renewal and repeated cleanup.
3. Deploy durable account sessions, protected lessons and private media delivery on approved infrastructure. Import only approved material, including captions and accessible descriptions.
4. Integrate the selected payment provider, once-only trials, checkout, cancellation, billing events and approved purchase declarations/policies. Confirm price and policy inputs before live billing.
5. Complete the full learner journey, accessibility/security/operational checks and controlled real-payment verification before enabling enrollment.
