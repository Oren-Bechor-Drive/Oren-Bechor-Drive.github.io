# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS, and browser JavaScript, as requested by the user.

## Users

The primary users are new visitors who are learning to drive or want to understand correct driving more clearly. They do not yet know what the course offers and need a simple introduction before choosing where to begin.

## Product purpose

The website introduces a digital interactive course about correct driving. It helps visitors understand road rules and the reasoning behind safe actions through explanations and videos based on real driving situations.

## Positioning

The course connects driving theory to situations that occur on the road. It supports practical driving lessons and does not replace a driving instructor.

## Operating context

Visitors first see a concrete course promise and links to the instructor and topic preview. The compact instructor introduction and student gallery follow, sharing a viewport. The course introduction explains the audience, specific topics and examples, and how to review material between practical lessons. Its three paragraphs lead into three learning steps and the full topic preview in one continuous section below the instructor. On phones, the instructor title, photo, and single description stack vertically. A closing first-lesson action precedes the footer.

## Capabilities and constraints

- The first release is one welcome page for new visitors.
- The hero actions scroll to the instructor and unified course section. Section links align immediately below the sticky header, or at the viewport top when the mobile fallback header scrolls with the page. Course-start controls in the header and closing section are disabled and clearly labeled unavailable until a real destination is supplied.
- Navigation and all seven topic descriptions remain usable without JavaScript or when the entry module fails to load. Successful initialization enables the mobile menu and interactive topic preview.
- The instructor gallery presents student photos in numeric order on cars moving left across a road. Car colors vary independently of photo order. The gallery uses a generated photo list with no maximum-count setting. After changing photos, run `npm run optimize:media` and publish its output with the originals; see [README.md](README.md#add-or-update-student-photos) for the full maintenance steps.
- The gallery is noninteractive. A static row remains during initial loading, after startup failure, and without JavaScript. A later loading failure preserves the already moving row and its responsive timing. Reduced motion disables scrolling; horizontal overflow remains clipped.
- Enrollment, payment, user accounts, and course playback are outside this release.
- Visitor-facing website copy is Hebrew and uses a right-to-left reading direction.
- Search and sharing descriptions, structured data, and the public `llms.txt` overview describe the same course and instructor facts as the welcome page. They do not imply that enrollment or lesson playback is available on this site.
- The page must work on desktop and mobile without a framework or a build step to serve the checked-in files. Updating gallery photos requires the maintenance step above.

## Brand commitments

- The course is presented by Oren Bachor, a certified driving instructor with more than eight years of experience.
- The supplied `DESIGN.md` is the visual authority.
- The tone is practical, clear, optimistic, and welcoming.

## Evidence on hand

- `docs/reference/the-idea.pdf` contains the course introduction, instructor facts, lesson topics, explanations, and examples.
- `DESIGN.md` contains the complete Solar Serenity palette, typography, spacing, shapes, and component treatments.
- The supplied road background, car artwork, and photos of Oren with students are in `assets/images/`. Student photos are gallery content, not written testimonials or evidence for a pass-rate claim.
- No written testimonials, prices, enrollment URL, or numerical performance claims were supplied. Future work must not invent them.
- Public business contact details and real social-profile URLs are not available yet. The footer identifies the social channels as unavailable text until the owner supplies destinations.

## Product principles

- Explain the course before asking the visitor to act.
- Connect every learning topic to real road decisions.
- Support driving lessons rather than suggesting the course replaces them.
- Use only supplied facts for the instructor and course.
- Keep the first experience focused on learning.

## Accessibility and inclusion

The page must support keyboard navigation, visible focus, reduced-motion preferences, readable contrast, semantic landmarks, and correct Hebrew right-to-left flow.
