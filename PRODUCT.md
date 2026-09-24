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

Visitors first see a concrete course promise and links to the instructor and topic preview. The compact instructor introduction and student gallery follow, sharing a viewport. The course introduction explains the audience, specific topics and examples, and how to review material between practical lessons. Its three paragraphs lead into three learning steps and the full topic preview in one continuous section below the instructor. On phones, the instructor title, photo, and single description stack vertically. A five-row FAQ follows the course section, immediately before the closing first-lesson action. The centered footer follows that action.

## Capabilities and constraints

- The welcome page is the only public page in the sitemap. Its FAQ at `#faq` uses five native `details` and `summary` rows based on the former help page's first five questions. Desktop and mobile navigation link to the FAQ. The separate help page and footer FAQ link no longer exist. `llms.txt` links directly to the homepage FAQ.
- The FAQ video and practice-quiz answers use the requested completed-course marketing copy. The copy does not mean that those runtime features are available in the current preview. Course pages remain `noindex` with placeholder media and questions, and enrollment controls remain disabled. Account controls are available only through the configured local gateway. The preview has no grading or saved progress.
- `404.html` is a noindex recovery page for missing paths. It contains one centered error message, a large yellow ring with centered 404 text, and actions to the welcome page and course library. It has no header, footer, or topic preview. Its local references are root-absolute because GitHub Pages can return it for missing URLs at any directory depth.
- `course/index.html` is an approved preview for the next course area: an open library of ten learning topics, optional search, a desktop topic list with a separate reading panel, and compact expandable outlines on smaller screens or without JavaScript. The library preserves the welcome page's seven topics and adds learning foundations, a separate priority-hierarchy topic, and new-driver, licensing and penalty-points information from the supplied PDF. The [PDF coverage map](docs/reference/course-topic-coverage.md) distinguishes developed lessons from subjects listed without teaching material. Learners can choose any topic at any time. Every developed PDF topic has a static reading page, and right-of-way is expanded into left-turn, right-turn and U-turn sections. The pages are marked `noindex`; enrollment and video playback are not available. The shared course header has a home-link brand and a disabled profile fallback, enhanced to an account link when the local gateway is configured. Instructor review of the adapted teaching copy and video assets remain outstanding.
- Each sub-subject is a separate reading section. Media is selected by teaching purpose: video for movement and timing, images or diagrams for recognition and layouts, and text alone for summaries and administrative explanations. The lessons reserve 16 videos and 12 images/diagrams; assets remain outstanding. The three turn sections and the separate priority-hierarchy section retain 20-question multiple-choice quiz previews. Questions and answers are placeholders. Quiz media will be chosen when scenarios are authored, without fixed video positions. The remaining sections are explicitly reading-only and do not invent quizzes. Learners can select and revisit quiz answers, skip questions, and review their selections without scores or access restrictions. Source labels are omitted from the learning interface and preserved in maintenance documentation.
- The hero actions scroll to the instructor and unified course section. Navigation also links to the homepage FAQ. Section links align immediately below the sticky header, or at the viewport top when the mobile fallback header scrolls with the page. Course-start controls in the header and closing section are disabled and clearly labeled unavailable until a real destination is supplied.
- Navigation and all seven topic descriptions remain usable without JavaScript or when the entry module fails to load. Successful initialization enables the mobile menu and interactive topic preview.
- The instructor gallery presents student photos in numeric order on cars moving left across a road. Car colors vary independently of photo order. The gallery uses a generated photo list with no maximum-count setting. After changing photos, run `npm run optimize:media` and publish its output with the originals; see [README.md](README.md#add-or-update-student-photos) for the full maintenance steps.
- The gallery is noninteractive. A static row remains during initial loading, after startup failure, and without JavaScript. A later loading failure preserves the already moving row and its responsive timing. Reduced motion disables scrolling; horizontal overflow remains clipped.
- Hebrew account screens and a local session gateway support registration, login, confirmation guidance, recovery/reset, Google handoff, and sign-out in development. They reuse the current colors and font in compact standalone cards without a top bar. Live Auth requires server credentials, callback settings, and email/Google configuration. GitHub Pages has no account backend; course profile controls remain disabled unless the gateway confirms support. Production hosting and durable sessions are not implemented.
- Two synthetic test lessons at `account/test-lessons.html` exercise account-only free access and paid test access through the local gateway and the existing learner-scoped database function. Bodies load only after server-side checks. A trusted development SQL operation grants temporary access; the browser cannot purchase or grant it. These are test texts, with no driving instruction or saved positions. See [local test lessons](docs/test-lessons.md).
- Enrollment, payments, protected publication of actual course material, and course playback are outside this release. Existing static course files remain public.
- Visitor-facing website copy is Hebrew and uses a right-to-left reading direction.
- Search and sharing descriptions, structured data, and the public `llms.txt` overview describe the same course and instructor facts as the welcome page. The sitemap contains only the homepage, and `llms.txt` links to its FAQ anchor. These files do not imply that enrollment or lesson playback is available on this site.
- The page must work on desktop and mobile without a framework or a build step to serve the checked-in files. Updating gallery photos requires the maintenance step above.
- Course content stays in independently editable learning and practice-quiz pages. Development checks discover their relationships and report missing or inconsistent links before publication. A separate site-link audit checks local `href`, `src`, and HTML fragment targets across authored pages without network requests. These checks do not generate content or run in the learner's browser.
- Site-wide image checks cover the course preview as well as the welcome page. Student galleries use an explicit student photo list for each initialization; this does not add learner-facing controls or change gallery behavior.

## Brand commitments

- The course is presented by Oren Bachor, a certified driving instructor with more than eight years of experience.
- The supplied `DESIGN.md` is the visual authority.
- The tone is practical, clear, optimistic, and welcoming.

## Evidence on hand

- `docs/reference/the-idea.pdf` contains the course introduction, instructor facts, lesson topics, explanations, and examples.
- `docs/reference/official-source-review-2026-09-22.md` records the bounded review of official lesson resources and time-sensitive claims. It does not replace Oren's approval of the teaching material or future recurring review.
- `DESIGN.md` contains the complete Solar Serenity palette, typography, spacing, shapes, and component treatments.
- The supplied road background, car artwork, and photos of Oren with students are in `assets/images/`. Student photos are gallery content, not written testimonials or evidence for a pass-rate claim.
- No written testimonials, prices, enrollment URL, or numerical performance claims were supplied. Future work must not invent them.
- Public business contact details and real social-profile URLs are not available yet. The footer centers the unavailable social-channel row and its shared status note at desktop and mobile sizes until the owner supplies destinations.

## Product principles

- Explain the course before asking the visitor to act.
- Connect every learning topic to real road decisions.
- Support driving lessons rather than suggesting the course replaces them.
- Use only supplied facts for the instructor and course.
- Keep the first experience focused on learning.

## Accessibility and inclusion

The page must support keyboard navigation, visible focus, reduced-motion preferences, readable contrast, semantic landmarks, and correct Hebrew right-to-left flow.
