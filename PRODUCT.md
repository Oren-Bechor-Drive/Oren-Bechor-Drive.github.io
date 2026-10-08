# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS, and browser JavaScript, as requested by the user. A separate local Node.js gateway supports development of Supabase account flows.

## Users

The primary users are new visitors who are learning to drive or want to understand correct driving more clearly. They do not yet know what the course offers and need a simple introduction before choosing where to begin.

## Product purpose

The website introduces a digital interactive course about correct driving. It helps visitors understand road rules and the reasoning behind safe actions through explanations and videos based on real driving situations.

## Positioning

The course connects driving theory to situations that occur on the road. It supports practical driving lessons and does not replace a driving instructor.

## Operating context

Visitors first see a concrete course promise and links to the instructor and topic preview. The compact instructor introduction and student gallery follow, sharing a viewport. The course introduction explains the audience, specific topics and examples, and how to review material between practical lessons. Its concise introduction leads into three learning steps and the full topic preview in one continuous section below the instructor. On phones, the instructor title, photo, and single description stack vertically. A six-row FAQ follows the course section, immediately before the closing public-preview action. The centered footer follows that action.

## Capabilities and constraints

- The welcome page is the only public page in the sitemap. Its FAQ at `#faq` uses six native `details` and `summary` rows: the former help page's first five questions and a current-availability question. Desktop and mobile navigation link to the FAQ. The separate help page and footer FAQ link no longer exist. `llms.txt` links directly to the homepage FAQ.
- The FAQ video and practice-quiz answers use the requested completed-course marketing copy. The copy does not mean that those runtime features are available in the current preview. Course pages remain `noindex` with placeholder lesson media, and full-course enrollment remains unavailable. Public theory practice provides scoring and answer review without saved account progress. Account controls are available only through the configured local gateway.
- `404.html` is a noindex recovery page for missing paths. It contains one centered error message, a large yellow ring with centered 404 text, and actions to the welcome page and course library. It has no header, footer, or topic preview. Its local references are root-absolute because GitHub Pages can return it for missing URLs at any directory depth.
- `course/index.html` is an approved preview for the next course area: an open library of ten learning topics, optional search, a desktop topic list with a separate reading panel, and compact expandable outlines on smaller screens or without JavaScript. The welcome preview and library share the same ten-topic order, including foundations, priority hierarchy and licensing information from the supplied PDF. The [PDF coverage map](docs/reference/course-topic-coverage.md) distinguishes developed lessons from subjects listed without teaching material. Learners can choose any topic at any time. Every developed PDF topic has a static reading page, and right-of-way includes left-turn, right-turn, U-turn and narrow/steep-road priority sections. Definitions, a course recap and new-driver/accompaniment explanations were added from the [2026-09-25 source review](docs/reference/israeli-lesson-sources-2026-09-25.md); these additions extend the PDF material. The pages are marked `noindex`; enrollment and video playback are not available. The shared course header links home and to learning topics; the unavailable profile fallback is hidden, then enhanced to an account link when the local gateway is configured. Instructor review of the adapted teaching copy and video assets remain outstanding.
- Each sub-subject is a separate reading section. The lessons now consolidate missing media into 19 compact section notes. The original media requirements remain outstanding; collapsing placeholders does not supply those assets. Each topic owns one public practice quiz at `course/<topic>/quiz/`. At the owner's request, quiz lengths follow coverage rather than a fixed 20-question quota. There are 140 distinct theory-bank questions, including all 118 initial candidates and 22 additions, each assigned once. Original Ministry question diagrams are hosted locally. Updated source questions are labelled as adaptations; each quiz credits the Ministry's CC BY dataset. Every question has four choices and a course-authored explanation. Submission requires all questions to be answered, then an editable summary and an explicit grading action, and reports the number correct and a percentage. Review locks submitted answers, identifies the learner's choice and offers linked mistakes or review of only the mistakes. The focused results heading includes the score; unanswered feedback lists the missing question numbers. The question selector distinguishes unanswered/answered and correct/incorrect states. Retry clears the attempt and review state. With JavaScript disabled or blocked, native disclosures provide self-check answers. Public results do not grant topic completion or persist to an account. The four former quiz URLs remain noindex transition pages. See [question review](docs/reference/theory-quiz-review-2026-09-25.md).
- The primary hero action scrolls to the topic explorer; its secondary action opens the instructor. Navigation also links to the homepage FAQ. Section links align immediately below the sticky header, or at the viewport top when the mobile fallback header scrolls with the page. The header and closing section link to the public library at `course/`, under the owner's 2026-10-08 decision. The closing copy distinguishes available reading/practice from unavailable videos and enrollment.
- Navigation and all ten topic descriptions remain usable without JavaScript or when the entry module fails to load. Successful initialization enables the mobile menu and interactive topic preview.
- The instructor gallery presents student photos in numeric order on cars moving left across a road. Car colors vary independently of photo order. The gallery uses a generated photo list with no maximum-count setting. After changing photos, run `npm run optimize:media` and publish its output with the originals; see [README.md](README.md#add-or-update-student-photos) for the full maintenance steps.
- The moving gallery is noninteractive. A static row remains during initial loading, after startup failure, and without JavaScript. A later loading failure preserves the already moving row and its responsive timing. Reduced motion disables animation and exposes the complete row through native horizontal scrolling.
- Hebrew account screens and a local session gateway support registration, login, confirmation guidance, recovery/reset, Google handoff, and sign-out in development. They reuse the current colors and font in standalone cards with a home-link brand. Live Auth requires server credentials, callback settings, and email/Google configuration. GitHub Pages has no account backend; unavailable profile controls remain hidden unless the gateway confirms support. Worker packaging, durable sessions and registration admission are implemented and tested locally; the hosted service is not deployed. See [hosting preparation](docs/hosting.md).
- Two synthetic sections in the protected learning catalog exercise account-only free access and paid test access through the local gateway. Authorized bodies open in `account/reader.html` after server checks. A trusted development SQL operation grants temporary access; the browser cannot purchase or grant it. These test texts contain no driving instruction. The reader saves scroll position, restores it in another signed-in browser, and requires reload after a stale-save conflict. Local browser/API tests prove expiry blocks paid reads and saves, renewal before ten days retains progress, and a 31-day lapse clears progress before renewal while learners remain isolated. The hosted development seed predates the protected-learning migration and needs titled republication before the catalog can show it. This is a development-entitlement simulation, without billing or a cancellation endpoint. See [synthetic sections](docs/test-lessons.md) and the [manual walkthrough](docs/manual-test-lessons.md).
- The local protected learner area implements database grading, saved attempts/history, manual completion after at least 85% with the required answer count rounded up, saved reading positions and authenticated private media delivery. A ten-day unrenewed lapse clears learning data except completed topics. It is tested with synthetic content; the new migration and cleanup schedule are not deployed. See [protected learning](docs/protected-learning.md). Enrollment, payments and publication of actual approved course material remain unavailable. Existing static course files remain public.
- Visitor-facing website copy is Hebrew and uses a right-to-left reading direction.
- Search and sharing descriptions, structured data, and the public `llms.txt` overview describe the same course and instructor facts as the welcome page. The sitemap contains only the homepage, and `llms.txt` links to its FAQ anchor. These files do not imply that enrollment or lesson playback is available on this site.
- The page must work on desktop and mobile without a framework or a build step to serve the checked-in files. Updating gallery photos requires the maintenance step above.
- Course content stays in independently editable learning and topic-level practice-quiz pages. Development checks discover their relationships and report missing or inconsistent links before publication. A separate site-link audit checks local `href`, `src`, and HTML fragment targets across authored pages without network requests. These checks do not run in the learner's browser. A separate maintenance publisher writes the theory-bank selection into the checked-in quiz HTML; serving the site needs no build.
- Site-wide image checks cover the course preview as well as the welcome page. Student galleries use an explicit student photo list for each initialization; this does not add learner-facing controls or change gallery behavior.

## Approved next release

The [paid-release scope](docs/plans/paid-release-scope.md) records the owner-approved target: all ten topics and their supplied media, ten graded quizzes, saved learning progress, paid content protection and a monthly subscription with a once-only three-day trial. Passing at 85% with the required answer count rounded up permits optional topic completion. After ten days without renewal following subscription expiry, all saved learning progress except completed topics is deleted. The local protected-learning implementation now supplies grading, persistence, completion, retention and authenticated text/media delivery. The owner set ILS 150.00/month and explicitly left billing disabled. Supplied content, hosted deployment, business/support details, provider selection and policy review remain launch dependencies.

## Brand commitments

- The course is presented by Oren Bachor, a certified driving instructor with more than eight years of experience.
- The supplied `DESIGN.md` is the visual authority.
- The tone is practical, clear, optimistic, and welcoming.

## Evidence on hand

- `docs/reference/the-idea.pdf` contains the course introduction, instructor facts, lesson topics, explanations, and examples.
- `docs/reference/official-source-review-2026-09-22.md` records the bounded review of official lesson resources and time-sensitive claims. It does not replace Oren's approval of the teaching material or future recurring review.
- `DESIGN.md` contains the complete Solar Serenity palette, typography, spacing, shapes, and component treatments.
- The supplied road background, car artwork, and photos of Oren with students are in `assets/images/`. Student photos are gallery content, not written testimonials or evidence for a pass-rate claim.
- The owner supplied a future monthly price of ILS 150.00 on 2026-09-25. No written testimonials, enrollment URL, or numerical performance claims were supplied. Future work must not invent them.
- Public business contact details and real social-profile URLs are not available yet. The homepage shows the original labeled social icons as noninteractive placeholders with a notice that links will be added later, under the owner's request. Public footers provide home and library navigation. Add working social destinations only when supplied.

## Product principles

- Explain the course before asking the visitor to act.
- Connect every learning topic to real road decisions.
- Support driving lessons rather than suggesting the course replaces them.
- Use only supplied facts for the instructor and course.
- Keep the first experience focused on learning.

## Accessibility and inclusion

The page must support keyboard navigation, visible focus, reduced-motion preferences, readable contrast, semantic landmarks, and correct Hebrew right-to-left flow.

## Design critique decisions, 2026-10-08

The owner approved a red stop sign, native scrollbars, document scrolling on short account screens and print support. Rubik was rejected after visual review; Fredoka is the rounded replacement with real font weights. The owner chose at least 12 Unicode characters, with the provider maximum of 72 UTF-8 bytes and no composition rules for registration and reset, and kept quiz feedback after submission. Continuous student-gallery motion without a pause control remains the earlier explicit preference. Instructor review, contact details, teaching media and hosted deployment remain separate release dependencies.
