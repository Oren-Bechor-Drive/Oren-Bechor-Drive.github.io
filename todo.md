# Design critique todo

Findings from the 2026-10-08 design critique of the whole site: welcome page, course library, lessons, practice quizzes, account and learner area, 404, and the shared design system. The review took a fresh-eyes view, so some original items conflict with `DESIGN.md`. Their completed, partial or retained disposition is recorded below. Checked items include implemented fixes and explicitly explained retained suggestions; unchecked items identify concrete remaining work. Sources, instructor approval and hosted deployment remain separate from local implementation.

Priority: **P0** blocks users or fails WCAG A/AA, **P1** significantly hurts the experience or trust, **P2** noticeable polish, **P3** nit.

## Implementation progress

2026-10-08: Implemented the compatible quick wins and the owner-approved welcome-page links to public reading and practice. Full-course enrollment and videos remain unavailable. The owner explicitly chose to retain the current continuous gallery motion without a pause control. Other unchecked decisions remain open.

Verification: `npm test` passed all 625 tests, including Chromium, Firefox/WebKit smoke coverage, gateway, disposable-database and hosting checks. `check:links`, `check:media`, `check:search` and `git diff --check` passed. Welcome-to-library/lesson/quiz navigation was also checked in the collaborative browser at 1440px and 390px. Reduced motion and JavaScript-disabled/blocked fallbacks were exercised by browser tests. These are local changes; no service was deployed.

Copy evidence: the licensing/roundabout clarification follows supplied PDF page 23 and reviewed question 0550 in `docs/reference/theory-quiz-content.json`. This clarifies the offence wording without adding penalties or teaching figures.

Batch 2 (2026-10-08): Added linked mistakes and optional mistakes-only review, answered/result selector states with a visible scrollbar, counted missing-answer feedback above the card, chosen-answer feedback, a score/outcome result heading, and accurate submitted/retry introduction text. Mobile review labels now sit below the answer text. No quiz content, keys, grading threshold, protected-learning flow or gallery motion changed. Verification: all 637 `npm test` checks passed, including the 12 new review regressions and Firefox/WebKit journeys. Link/media audits and the public-quiz publication drift check passed. The shared browser verified mistakes review, 44px result controls, keyboard/pointer focus and no horizontal overflow at 1440px and 320px. Reduced motion and JavaScript-disabled/blocked paths passed automated checks. No deployment was performed.

Batch 3 (2026-10-08): Implemented the shared design system, rounded Fredoka replacement, red sign and sharing artwork, ten-topic home preview, shorter motion, scrollable reduced-motion gallery, library search/effort improvements, lesson navigation and self-checks, public quiz summary/mobile/results/print flow, and account/reader feedback. Registration/reset follow the approved 12-code-point minimum and 72-byte provider maximum without composition rules. Verification has a session-bound masked address and real resend. All 11 misplaced review destinations now point to existing teaching. Native radio arrow navigation has visible keyboard focus while pointer text editing remains ring-free. The teaching audit and 21 draft additions are prepared for review.

Final verification: all 711 `npm test` checks passed, including Chromium, Firefox/WebKit, gateway, disposable PostgreSQL and hosting checks. `check:links` passed 789 references across 35 pages; `check:media` passed 184 image references across 35 pages. Search metadata and public-quiz publication drift checks passed; `git diff --check` is clean. The collaborative browser checked the affected desktop/mobile pages, verification resend/cooldown and pointer/keyboard input. Reduced motion and JavaScript-disabled/blocked paths passed automated browser checks. The review artifacts have 379 verified local file/HTML-anchor links. No services were deployed or hosted migrations applied. Live email delivery and hosted Auth remain unverified.

Architecture cleanup and final check (2026-10-08): Consolidated input-mode and password-policy ownership, centralized mutation admission, fixed optional media failure preservation and URL auditing, aligned search order with keyboard order, and added database-owned latest quiz summaries without per-topic history requests. The final review covered all branch changes against `9028721` plus repository security boundaries. Patched Sharp to 0.35.5, including Miniflare's dependency, and source-map-js to 1.2.2; `npm audit` reports zero vulnerabilities. All 727 `npm test` checks passed. Link/media checks passed 793 local references and 188 image references across 35 pages; search, 140-question publication and 237-file Worker packaging checks passed. Desktop/mobile collaborative preview, reduced-motion and baseline-navigation browser checks passed. Documentation now matches the social placeholders, closing heading and implemented hosting preparation. No hosted service, migration or real email delivery was verified or deployed.

The actual remaining dependencies are teaching review/content, supplied media/consent/contact information and the protected catalog's section-to-topic relationship. Optional local best scores, dark mode and automatic legacy forwarding retain the current documented behavior; they are not being presented as implemented features.

## Owner decisions

These block or reshape many items below.

- [x] Expose `/course/` and public practice through welcome-page navigation and the closing action. Approved by the owner on 2026-10-08; retain the library recovery link in `404.html`.
- [x] Record the gallery decision: the owner chose on 2026-10-08 to keep continuous motion without a pause control. Normal gallery cadence is retained; reduced motion now makes the complete row scrollable.
- [x] Decide on the hero stop sign: keep the blue sign, use the correct red Israeli sign, use real photography, or use a learner "ל" / "נהג חדש" plate.  Owner approved red. A separate red master and delivery files are implemented; blue original is preserved.
- [ ] Supply a photo of Oren in a teaching context and higher-resolution student photos. Confirm whether the phone number visible in student photo 1 may be shown. Still outstanding: no teaching-context portrait, higher-resolution student originals or phone-display consent was supplied.
- [x] Use the existing public library as the next step, approved on 2026-10-08. The welcome header and closing action now link there and explain the preview boundary. Contact and enrollment destinations remain outstanding.
- [x] Decide whether Varela Round is required. Options: Rubik (one family with real weights), or Varela Round headings with Assistant body text.  Owner rejected Rubik and requested shapes closer to the original. Fredoka is implemented with locally hosted real variable weights.
- [ ] Approve concrete, dated teaching figures (speed limits by vehicle type, penalty points, new-driver penalties, roundabout scanning and signalling rules) so lessons stop deferring to gov.il. Coverage was audited instead of inventing figures. Existing speed/accompaniment values are already taught; new figures and 21 proposed teaching blocks need Oren review. See [coverage draft](docs/reference/design-teaching-coverage.md).
- [x] Choose the quiz feedback model: per-question feedback by default with an optional end-only exam mode, or the reverse. Decide whether answer order may be shuffled.  Owner retained feedback after submission only. No immediate-feedback mode or shuffled answer order.
- [x] Decide whether quiz copy should reference the real theory-test format and supply the authoritative figures. Clarify whether 85% mirrors the real exam or is a course bar.  Practice now identifies its own 85% bar and is not presented as an official exam result. Real-exam format claims remain outside the preview.
- [ ] Decide whether signs-and-speed gains image-based sign questions and inline sign images (reusing the CC BY Ministry diagrams), or is retitled to focus on speed. Still outstanding: reviewed sign plates/questions and instructor approval. The existing Ministry diagrams cannot be relabeled as a new signs question bank.
- [x] Pick one password policy for registration, reset and the gateway. Suggested: 12+ characters without composition rules.  Owner approved at least 12 Unicode code points, maximum 72 UTF-8 bytes, no composition rules. Shared registration/reset/gateway validation is implemented; login retains existing-password compatibility. Hosted settings remain unverified.
- [x] Decide what a free account shows until billing exists, and whether Google sign-in is planned for launch.  Free accounts get truthful available-reading copy and public practice navigation. Unconfigured Google controls stay hidden; actual launch-provider configuration remains separate.
- [x] Decide whether the account "no document scroll" rule may be relaxed on small or short screens.  Owner approved document scrolling on short screens; implemented.
- [x] Choose canonical names: library ("נושאי הלימוד" or "ספריית הלימוד"), and whether the protected reader stops using "שיעור" for learning sections.  Public library is "נושאי הלימוד"; protected reader uses "קטע לימוד". Catalog titles and supplied Ministry wording remain unchanged.
- [x] Decide whether the home page and FAQ keep promising videos while every lesson says they will be added later.  Earlier requested completed-course marketing answers are retained. The nearby availability note and sixth FAQ answer explicitly identify current reading/practice and unavailable videos/enrollment.
- [x] Decide whether the hidden page scrollbar is a deliberate brand choice.  Owner approved visible native scrollbars; implemented.
- [x] Decide whether a local-only "best score per topic" in `localStorage` is acceptable for public practice.  RETAINED: public attempts remain unsaved under the existing preview boundary. No local best-score persistence or account-progress claim was added.
- [x] Decide whether the legacy quiz URLs auto-forward.  RETAINED: native transition links keep recovery and no-JS navigation; no automatic forwarding.
- [x] Decide whether the hero entrance plays on every visit or once per session.  Short entrance now runs once per browser session when storage works; blocked storage uses the same short motion.
- [x] Decide whether each gallery photo gets distinct alt text (with student consent) or the set is described as one group.  One group description with decorative empty alts is implemented. This does not supply missing student-image consent.
- [x] Decide whether print support for lessons and quizzes matters, and whether dark mode is in scope.  Owner approved print support; implemented. RETAINED: the release remains light mode; no dark-mode redesign.

## Quick wins

No owner decision needed.

- [x] P1: Fix the collapsed tracking on the instructor subtitle "מורה לנהיגה ומנחה הקורס". It inherits `-0.025em` computed at 144px (about -3.6px at 40px). Set `letter-spacing` on `.instructor-title-line` to `-0.01em` or `normal` in `css/welcome.css`.
- [x] P1: In quiz review, mark the correct answer and the chosen wrong answer by state instead of keeping the blue selected style (`course/css/quiz.css`, `course/js/quiz.js`).
- [x] P1: Add `@media (forced-colors: active)` rules: mask icons use `CanvasText`, buttons get a transparent border, the FAQ focus ring uses `outline` instead of an inset shadow.
- [x] P1: Stop `account/reader.js` from scrolling past the lesson title when the saved position is 0.
- [x] P2: Fix the library search status grammar: "נמצא נושא אחד", "לא נמצאו נושאים", "נמצאו 3 נושאים" (`course/js/course-library.js`).
- [x] P2: Fix copy: "אין מעכבים בלימת חירום" to "לא מעכבים בלימת חירום" (`course/driving-test/index.html`); "היתה" to "הייתה" (`course/learning-foundations/index.html`); clarify "מעבר מצדו הנכון של תמרור" in `course/licensing-and-points/index.html` and `course/index.html` so the offence is unambiguous.
- [x] P2: Remove production notes from lesson endings, for example "תרגול מלא של עקיפה ידרוש חומר נוסף ואישור מדריך.", "סרטוני ההתנהגות במעגלים עדיין אינם זמינים." and "מקרי הווידאו על אי-ציות ומהירות מופרזת עדיין אינם זמינים."
- [x] P2: Extend the account pointer-mode focus rule to programmatically focused `[tabindex="-1"]` targets, so the error box shows no ring after an Enter submit from a clicked field (`account/account.css`).
- [x] P3: Make the `.course-footer a` tap target effective (`display: inline-flex` or `inline-block`; `min-height` does nothing on inline elements).
- [x] P3: Add `theme-color` to course and account pages.
- [x] P3: Load `css/base.css` with the same version query on every page.
- [x] P3: Use `--text-soft` for the account footer brand line (4.48:1 today).

## Cross-site system

### Wayfinding

- [x] P0 [decision]: Resolved on 2026-10-08 through public-library links and an explicit closing availability notice. Original finding: the welcome page shows only disabled "start" buttons and never links to the ten live lessons and quizzes, while `404.html` links to the library.
- [x] P2: Add a "נושאי הלימוד" link to the course header. Library, lesson and quiz pages currently offer only the logo and a disabled profile button.
- [x] P2: Use one footer pattern on public pages, with "לדף הבית" and "לנושאי הלימוד". Today the home, library/lesson, quiz, account and 404 footers all differ.  Shared home/library footer navigation is implemented. The focused 404 remains an intentional chrome-free exception.
- [x] P2: Align the home topic preview (7 topics) with the library's 10 topics, in the same order and grouping.

### Typography

- [x] P1 [decision]: Replace synthesized bold. Varela Round ships only weight 400; Chromium and WebKit draw 600 and 700 identically, WebKit smears small bold labels, and Firefox bold is barely distinguishable. Either adopt a Hebrew family with real weights, or use 400 everywhere and build hierarchy with size, color and spacing. Remove 600 from the spec if the font stays.
- [x] P2: Define h1, h2 and h3 once (size, leading, text color). Today h1 is text-colored on home, library, account and 404 but blue on lessons and quizzes, and h2 sizes range from 22px to 48px.  Shared semantic defaults are implemented; documented display/reading roles retain contextual sizes.
- [x] P2: Use the amber underline for one purpose only. It is currently word emphasis on home, the section-heading style on lessons and the h1 style on account pages.
- [x] P2: Convert fixed `px` font sizes to `rem` so browser font-size settings work.
- [x] P2: Apply `text-wrap: pretty` to body paragraphs to reduce widows.
- [x] P3: Raise the 12px floor for meaningful text (mobile library result count, brand subtitle) to 13px.

### Tokens and components

- [x] P1: Add type, leading, spacing, shadow and duration tokens. Today the CSS has 29 font-size declarations, 16 line heights, 32 spacing values (24 off scale), 17 shadows and 17 durations, but only colors and three radii are tokens.
- [x] P1: Replace hard-coded color literals with tokens. 33 of 56 distinct color values bypass custom properties, including repeated alpha variants such as `rgb(197 207 226 / .72)` and `#9e3f41` in `course/css/quiz.css`.
- [x] P1: Consolidate buttons. The primary button exists in five versions (`.button-primary`, `.nav-action`, `.course-button`, `.account-action`, `.recovery-primary`) with different heights, weights and hover behavior; the secondary button has four. Create shared `.btn` variants used everywhere.
- [x] P1: Give every disabled or unavailable control one style. The course profile button and footer social items currently look active.
- [x] P2: Merge the duplicated `.site-header` and `.course-header` rules into one shared header.
- [x] P2: Unify focus styles. Five variants exist: global 4px offset, 3px on account and quiz, inset shadow on FAQ, -3px on topic options, and a 1px border change on search.
- [x] P2: Tokenize the reading-card shadow once; four near-copies exist across course, lesson and quiz CSS.
- [x] P2: Rewrite the `DESIGN.md` front matter from `css/base.css`. The prose cites hex values the code does not use (`#f5f7fb`, `#141D1E`, `#806C14`, `#8C9799`, `#D96C6C`), and the amber is named "secondary" while `--secondary` is dark olive.
- [x] P3: Remove unused tokens `--surface-highest` and `--secondary-hover`, and the duplicate `--primary-bright`.
- [x] P3: Name z-index values and the reused durations.
- [x] P3: Align reduced-motion approaches. The course uses a global `!important` blanket; home uses per-component rules.

### Color roles

- [x] P2: Write and enforce a color role table: blue for action, text color for headings, one success green token, one error coral set (`#9e3f41` text, `#fdf3f3` fill, `#d96c6c` border), amber for highlight. Blue currently means action, heading, selected and correct; coral appears in four values; green exists only in the password meter.
- [x] P1: Raise control borders to at least 3:1. Input, search and select borders `#c5cfe2` are 1.57:1 on white; quiz answer tiles are 1.14:1 (fill) and 1.26:1 (border).
- [x] P2: Give the library search field a visible keyboard focus indicator stronger than a 1px border color change.

### Scrollbar and print

- [x] P1 [decision]: Restore the native scrollbar removed in `css/base.css` and `course/css/course.css` (`scrollbar-width: none` and `::-webkit-scrollbar { display: none }`). Style it with `scrollbar-color` instead if needed. Also restore it in the home topic dropdown (`css/responsive.css`).
- [x] P2 [decision]: Add a shared print style. The home page prints the sticky header, gallery and colored bands; a printed quiz shows only the current question with its navigation buttons.

### Voice and naming

- [x] P2: Use one name for the library and one wording per back-link type. Today the library has five names and back links have five wordings.
- [x] P2: Use one skip-link wording everywhere: "דילוג לתוכן הראשי".
- [x] P2: Use "ניסיון חדש" for quiz retry in both public and protected quizzes; keep "ניסיון נוסף" for network retry only.
- [x] P2: Set an address-form rule: plural imperative for instructions, nouns for buttons, impersonal present for descriptions, no first person.  Authored UI follows the documented rule. Twelve original Ministry questions retain supplied singular address and source fidelity.
- [x] P2: Reduce repetition on the welcome page. "להבין" appears 10 times, "סרטונים" 6, "אמיתי" 5, "בקצב שלכם" 4; "complements, does not replace the instructor" appears three times. Keep it in the learning note and FAQ 2 only.

### Sharing metadata

- [x] P2: Create a 1200x630 sharing image with the brand, headline and "אורן בכור - מורה נהיגה מוסמך", and switch to `summary_large_image`. The current image is the bridge photo with Oren filling about 15% of the frame.
- [x] P2: Use one title pattern, "<עמוד> - נהיגה נכונה עם אורן בכור". Brand names and separators currently vary, and the legacy quiz pages have no brand in the title.
- [x] P3: Serve `/favicon.ico` or confirm the 404 is acceptable.
- [x] P3 [decision]: Revisit dark mode after type and spacing tokens exist.  RETAINED: light mode remains the documented release direction.

## Welcome page

### Conversion and trust

- [x] P1 [decision]: Replaced with public-preview links on 2026-10-08. Original finding: Remove the button-shaped "הלמידה עדיין אינה זמינה" from the header and mobile menu. Give each CTA slot a real action, or show a status badge such as "הקורס המלא בהכנה". Disabled buttons also drop out of the tab order.
- [x] P1: Rewrote the closing `#start` copy so it does not command an unavailable action. For example: "הקורס המלא בהכנה. בינתיים אפשר להכיר את הנושאים ולחזור אליהם לפני השיעור הבא."
- [x] P1: Make the hero establish the offer and the person. Make "צפו בנושאי הקורס" primary and "הכירו את אורן" secondary, and name Oren and his credential in the subhead.
- [x] P1 [decision]: Replace the blue stop sign. Israel's stop sign is red; a wrong-colored regulatory sign undermines a driving instructor's credibility. If it stays decorative, consider `alt=""`.
- [ ] P1 [decision]: Strengthen the trust assets. Use a teaching-context portrait or a much tighter crop of Oren, and add one large static student pass photo or strip with a factual caption such as "תלמידים של אורן אחרי הטסט". Current portrait and readable gallery were retained. A teaching-context portrait and stronger supplied student assets remain outstanding.
- [x] P2: Add an honest status chip near the hero buttons.
- [x] P2: Keep "עם אורן בכור" visible in the mobile header brand at a smaller size.
- [x] P2: Add FAQ questions visitors actually ask, with owner-approved answers, for example "מתי הקורס יהיה זמין?". Replace the "כל מה שחשוב לדעת" kicker with "שאלות נפוצות" or drop it.
- [x] P2: Simplify the footer and distinguish unavailable social destinations. Under the owner's later request, the homepage restores the original four labeled social icons and placeholder notice alongside the brand and public navigation. The icons remain noninteractive until real destinations are supplied.
- [x] P3: Give the closing heading its own line instead of a third version of the hero headline.

### Motion

- [x] P0 [decision]: Add a pause/play control to the student gallery (Hebrew label, `aria-pressed`), pause on hover and focus, and optionally stop after one loop and remember the choice. `.hero-road` has `pointer-events: none` today.  RETAINED by explicit owner decision: continuous gallery motion without a pause control. Reduced motion now exposes every photo through scrolling.
- [x] P0: Stop the hero red car from looping forever (`iterations: Infinity` in `js/hero-road-car.js`). Run it once or a few times and then park it, or tie it to the gallery pause control.
- [x] P1: Shorten the hero entrance. The heading travels from `100vw`, the copy from `100vh`, and the sign sweeps half the screen; text settles at about 1.3s. Use a 16-40px move with a fade, one direction, and skip it on repeat visits in a session.
- [x] P1: With reduced motion, make all student photos reachable (scroll-snap row or previous/next buttons). Only about 4 of 15 are visible at 1440px.
- [x] P2: Keep the red car away from the centered copy on phones and tablets, or hide it below 768px. It passes behind the headline.
- [x] P2: Fix the RTL heading entrance. Sliding in from the right shows the first word last.
- [x] P2: Remove the blur-and-wheel loading overlay over the already readable static gallery row (up to 8s timeout in `js/road-carousel.js`).
- [x] P3: With reduced motion, hide the parked car on phones or park it at a road edge.
- [x] P3: Use fade-only reveals in the instructor section, where three kinds of motion overlap.

### Layout and typography

- [x] P1: Simplify the course section on phones. Cut the three intro paragraphs to one (paragraph 2 repeats the topic list) and show all seven topics as a visible list instead of a dropdown.
- [x] P2: Keep each headline sentence on its own line ("להבין את הכביש." / "לקבל החלטה נכונה בזמן.") instead of breaking after "לקבל".
- [x] P2: Reduce empty hero space on tablet and phone (about 60% empty at 768x1024), and cap the hero paragraph at about 36ch.
- [x] P2: Quiet the desktop topic panel. It is the heaviest element on the page and repeats the selected title at 42px. Consider a two-column list with no click needed. Drop or correct the "ההסבר המלא מלווה בדוגמאות ובסרטונים" footnote.
- [x] P2: Fix the instructor section layout: about 150px of empty amber between subtitle and description at 1440x900, a 144px name more than twice the hero heading, mixed alignment at 768px.
- [x] P2: Carry amber or the road motif into one later section, separate `#about` and `#faq` with a surface change, and use one section padding rhythm.
- [x] P2: Add a short-height layout (`max-height: 500px`): landscape phones at 844x390 and 200% zoom push the hero buttons below the fold under a 72px header.
- [x] P3: Remove one of the two stacked prompts, "בחרו נושא וראו מה תלמדו" and "בחרו נושא לימוד".
- [x] P3: Prevent the FAQ question 2 orphan "נהיגה?" at 390px.
- [x] P3: Consider a familiar menu icon with a visually hidden label instead of the bordered "תפריט" button.
- [x] P3: Make the learning steps more than a decorative strip, for example with a link from each step to a topic.

### Interaction and accessibility

- [x] P1: Rebuild the desktop topic explorer as tabs, like the course library: `tablist`, `tab` with `aria-selected` and `aria-controls`, `tabpanel`, one tab stop with arrow selection, and no `aria-live`. Buttons currently announce `aria-expanded` but control nothing (`js/topic-explorer.js`).
- [x] P2: Point "צפו בנושאי הקורס" at the topic block instead of three long paragraphs, or rename it "על הקורס".
- [x] P2: Close the mobile menu on outside tap, on focus leaving the panel and on scroll (`js/script.js`).
- [x] P2: Fit the mobile topic dropdown on screen at 320x568 (open upward or cap the height), and show its scrollbar.  SUPERSEDED: phones show all ten linked descriptions as a visible list; the dropdown is removed.
- [x] P2: Make the gallery quieter for screen readers: `alt=""` on car sprites, a meaningful region name, and either distinct photo alt text or one group description.
- [x] P3: Add `tabindex="-1"` to the skip-link target `main`.
- [x] P3: Reduce named landmark noise (hero and `#start`).
- [x] P3: Allow selecting the instructor name; `.instructor-intro` has `pointer-events: none`.
- [x] P3: Add a visible marker when a nav link focuses a full-width section whose outline is off-screen.

## Course library

- [x] P1: Help first-time learners choose. Add "לא בטוחים מאיפה להתחיל? התחילו ב'יסודות הנהיגה והלמידה'" with a link, a meta line per topic (sections, quiz length, reading time), and the description in closed mobile rows.
- [x] P1: Move the "ללמידה" button directly under the topic description. On mobile it sits about 800px below the opened summary.
- [x] P1: Fix search. Normalize spelling variants (doubled yud and vav), add singular/plural stems, rank title matches first, and relabel to "חיפוש נושא" unless lesson text is indexed. Today "פניה", "הולך רגל" and "מבחן תיאוריה" fail, and "מעגל" selects signs instead of roundabouts.
- [x] P1 [decision]: Hide the disabled profile button when accounts are not configured. Otherwise make it look unavailable, use `aria-disabled` so it stays focusable, and show a visible hint on tap.
- [x] P2: Hide the native search cancel button, which duplicates "ניקוי החיפוש".
- [x] P2: Put the CTA and meta line at the top of the desktop reading panel and reduce its 640px minimum height.
- [x] P2: Remove the `32ch` cap on the mobile intro and shorten the search placeholder to "למשל: מעגל תנועה".
- [x] P2: Use one availability template, for example "אפשר לקרוא ולתרגל. סרטונים ותרשימים יתווספו בהמשך." Today only two topic notes mention their quiz.
- [x] P2: Rename "טעויות נפוצות בטסט" to "טעויות נפוצות בטסט המעשי".
- [x] P3: Cap no-JS library rows at about 760px wide.
- [x] P3: State "any order" once in the library instead of on every page.

## Lessons

- [ ] P1 [decision]: Close content gaps. Map every quiz question to a lesson paragraph and add missing teaching. Overtaking has 198 words for 17 questions; roads-and-lanes and priority-hierarchy are similarly thin; signs-and-speed and licensing defer figures to official sites. PARTIAL: every question has a validated section link, including 11 corrected destinations for propositions taught elsewhere. The editorial audit still finds 56 gaps and 25 partial explanations. Source-backed drafts are prepared in [coverage draft](docs/reference/design-teaching-coverage.md); no missing rule is presented as approved teaching.
- [ ] P1 [decision]: State the roundabout rules plainly once approved ("התנועה במעגל מגיעה משמאל - לשם מסתכלים לפני הכניסה." and the exit-signal rule). Source-backed draft review is prepared. Universal exit-signal/two-lane claims are not established by the existing bank diagrams; instructor/source approval remains outstanding.
- [x] P1: Shrink media placeholders to one compact line, never nest them inside list items, and show at most one per section. Right-of-way has 12 boxes, six inside bullets (`course/css/lesson.css`).
- [x] P1: Redesign the lesson ending. Make the quiz block a full-width featured card with the button beside the text, add "הנושא הבא: ..." and a "לכל הנושאים" text link. Today the label and button sit about 800px apart.
- [x] P1: Show position and effort: reading time in the intro, a "חזרה לתוכן העניינים" link after each mobile section, and optionally a `:target` highlight in the contents list.
- [ ] P2 [decision]: Add official sign images inline to the signs lesson. Still outstanding: suitable approved sign assets and placement. Preserve the eight supplied Ministry diagrams and their provenance.
- [x] P2: Add one "מצב מהכביש" scenario and one or two native `details` self-checks per section.
- [x] P2: Present the foundations definitions as a `dl` with a plain one-line meaning before the formal wording.
- [x] P2: Number the priority-hierarchy levels 1-4, and drop the contents list on single-section lessons (priority-hierarchy, overtaking).
- [x] P2: Make contents labels match section headings (roundabouts, licensing, trip-planning, driving-test, roads-and-lanes).
- [x] P2: Use 16px page margins and card padding below 480px, and shorten "נהג חדש, נהג חדש צעיר ורישוי" to "נהג חדש ורישוי".
- [x] P2: Use a single-column contents list below 480px; two columns misalign when a label wraps.
- [x] P2: Group the official links in the licensing lesson, color them as links, and label PDF and external destinations.
- [x] P2: Remove redundant `aria-label` on articles that already have `aria-labelledby`, and present placeholders as text or `role="note"` instead of `role="img"`.
- [x] P2: Get emphasis from size and color instead of synthesized bold below 18px.
- [x] P3: Raise the back link from 14px to 15-16px.
- [x] P3: Add a few second-person sentences in examples to warm the tone.

## Practice quizzes

- [x] P1: Help learners find their mistakes. List wrong questions on the results screen, start review at the first mistake (the review button currently returns to the last visited question), offer "לעבור על הטעויות (N)", and mark selector options correct or wrong.
- [x] P1 [decision]: Offer per-question feedback. With JavaScript on, every self-check disclosure is hidden; without JavaScript, every question has one.  RETAINED by explicit owner decision: feedback after submission only, with native no-JS self-check disclosures.
- [x] P1: Fix the phone layout. Collapse the intro after the quiz starts, use a slim sticky progress bar, put Previous/Next in a sticky bottom bar under 640px, and scroll to the card top instead of the page top. At 320x568 no answer choice is visible on arrival.
- [x] P1: Show the missing-answer message above the card, with the count and question numbers: "נשארו 3 שאלות בלי תשובה: 2, 7, 11. אפשר לענות עליהן ואז לסיים."
- [x] P1: Redesign the results screen: large score and percentage, a pass or fail heading, one threshold line, the mistakes list, and the disclaimer as small text. Drop "(85% בעיגול כלפי מעלה)".
- [ ] P1 [decision]: Add image-based sign questions to signs-and-speed (currently zero images), or retitle the topic. Still outstanding: reviewed source questions and suitable sign images. No new question IDs, keys or diagrams were fabricated.
- [x] P2: Replace the question combobox with a grid of numbered chips showing answered state (and correct/wrong in review), or add state to its options and restore a visible scrollbar.
- [x] P2: Fix the type hierarchy. The question text is 16px regular while the "שאלה 1" legend is 22px bold blue.
- [x] P2: Keep the progress indicator visible below the sticky header after navigation, and add a progress bar.
- [x] P2: State the learner's chosen answer in the review feedback. Submitted radios remain disabled under the current grading design.
- [x] P2 [partial]: Chosen-answer feedback "התשובה שלכם: ..." is implemented. Remaining: rewrite dense legal explanations, fix the overtaking explanation that contradicts its answer, and link to the matching lesson section.  Explanation wording is concise and all 140 questions link to a lesson section. The claimed overtaking contradiction was not reproduced; source wording for 0257 was clarified. Linking does not imply complete teaching coverage.
- [x] P2: Avoid doubled announcements on navigation, and include the score in the focused results heading.
- [x] P2 [decision]: Shuffle choice order per attempt; correct answers cluster by position (choice 3 in 7 of 14 signs-and-speed questions). Add "לתרגל רק את הטעויות".  RETAINED by explicit owner decision: answer order and end-only feedback stay unchanged. Mistakes-only review is implemented.
- [x] P2: Add a pre-submit summary step with a distinct "בדיקת השאלון" action.
- [x] P2: Replace the intro text after submission; it still says answers can be changed.
- [x] P2: Keep Previous and Next on one row at 320px, and hide Previous on question 1.
- [x] P2: Add a time estimate and one sentence on how to use the set.
- [x] P3: Add tap-to-enlarge for diagrams only if higher-resolution sources exist.  RETAINED: original diagrams remain at natural resolution with responsive sizing; no higher-resolution replacement sources were supplied.
- [x] P3: Shorten the per-question source line to "מקור: שאלה 0332" or "מקור: שאלה 0332 (נוסח מעודכן)".
- [x] P3: Reword the attribution: "העיצוב והפיסוק הותאמו לאתר. שאלות שנוסחן עודכן מסומנות כך."
- [x] P3: Add spacing above the button on legacy transition pages, and consider auto-forwarding while keeping the link.  Spacing is implemented. RETAINED: native transition links, without automatic forwarding.
- [x] P3: Word the no-JS intro neutrally so it does not contradict the fallback note.
- [x] P3: Normalize the space before colons preserved from Ministry text.
- [x] P3: Drop the 1px hover lift on answer rows if simplifying.

## Account and learner area

### Account forms

- [x] P1 [decision]: Let the document scroll on small or short screens instead of hiding controls inside the card. After a login error at 360x640, Google sign-in and the register link are out of view (`account/account.css`).
- [x] P1: Replace native validation popups, which can appear in English, with persistent Hebrew errors under each field using `aria-describedby` and `aria-invalid`. Examples: "חסר החלק שאחרי ה-@, למשל name@gmail.com." and "הסיסמה קצרה מדי: צריך לפחות 12 תווים, הזנתם 10."
- [x] P1 [decision]: Use one password rule for registration, reset and the gateway (`account/password-policy.js`, `account/reset.html`, `server/gateway.mjs`), and show the same checklist on reset.
- [x] P2: Show progress text on busy buttons ("מתחברים...", "יוצרים חשבון...", "שולחים..."), a loading line while the session initializes, and stop the card from jumping when messages appear.
- [x] P2 [decision]: Hide the Google button, divider and "או ממשיכים עם Google." until Google is enabled.
- [x] P2: Relabel the password meter as rule completion ("חסרות עוד 2 דרישות", "הסיסמה עומדת בכל הדרישות"), darken its fills to at least 3:1, and fix the reversed `bdi` symbol list.
- [x] P2: After a recovery request, replace the form with a confirmation panel and resend action. On reset without a recovery session, hide the form and make "בקשת קישור חדש לאיפוס" primary. Add links to the link-expired message.
- [x] P2: Make the same-browser requirement the main point of the verify page, with a tip for links opened inside email apps, plus the masked address and a resend action. Guidance leads the page; active pending registrations show a session-bound masked address and real resend with a persistent 60-second cooldown. Expiry clears the context. Static guidance and recovery remain usable without JavaScript. Local gateway, durable-session and browser checks passed; actual email delivery remains unverified.
- [x] P2: Make "ללמידה ולתרגול" the primary action on the account page, the library secondary and sign-out a quiet text button. Add a library link to the unavailable state, and fix the "ההתחברות אינה זמינה" wording on register and recovery.
- [x] P3: Add the logo lockup above the card, linking home.
- [x] P3: Consider right-aligning empty LTR fields so the caret sits near the label.  RETAINED: email/password keep native LTR caret/editing behavior; RTL labels and keyboard/pointer focus remain correct.

### Learner area

- [x] P1 [decision]: Remove the subscription dead end for free accounts. Show honest copy with a library link, and show the 10-day retention note only to learners who have or had paid access.
- [ ] P1: Restructure `account/learning.html` per topic: reading link, practice action, completion badge and last score. Move the 85% rule into the quiz, show reload only on error, open the quiz near its card or in its own view, hide the sign-in link when signed in, and replace the "- הגדרה" / "- שיעור" suffixes. PARTIAL: completion, last score, inline quiz actions, error-only reload and signed-in navigation are implemented. Grouping readings and practice needs the actual reviewed section-to-topic relationship, absent from the current catalog.
- [x] P2: Put the score summary before the locked questions in protected quiz results, add the percentage and threshold, and mark each option correct or chosen.
- [ ] P2: In the reader, drop or relocate the manual save button, show reload only on error, end with "לתרגול הנושא" and "חזרה לרשימת השיעורים", and add a progress cue. PARTIAL: scroll autosave, error-only retry/reload, 65ch text, progress cue and end navigation are implemented. A topic-specific practice link needs the reviewed section-to-topic relationship; the current end link returns to the learning list.
- [x] P2: Cap the reader text column at about 65ch; it is 862px today.
- [x] P2: Use the coral alert style for learning-area failures, and on a 401 show a primary "כניסה לחשבון" or redirect with a return URL.
- [x] P3: Without JavaScript, show only the noscript line and a library link; hide the dead reload button and empty headings.

## 404 page

- [x] P3: Keep the 404 digits inside the yellow ring. The text touches the ring at 1440px and overflows it at 320px.
- [x] P3 [decision]: Keep the 404 library link under the owner-approved public-preview navigation decision.
