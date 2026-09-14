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

Visitors first see the course introduction and a road carousel of supplied photos of Oren Bachor with students after passing their driving tests. The instructor introduction follows, then a course explanation and a preview of topics such as right-of-way, turns, intersections, road signs, speed limits, overtaking, trip planning, and common driving-test mistakes. The site footer follows the topic preview directly.

## Capabilities and constraints

- The first release is one welcome page for new visitors.
- The main action scrolls to a preview of learning topics on the same page.
- The hero gallery presents student photos in numeric order on cars moving left across a road. Car colors vary independently of photo order. The gallery uses a generated photo list with no maximum-count setting. After changing photos, run `npm run optimize:media` and publish its output with the originals; see [README.md](README.md#add-or-update-student-photos) for the full maintenance steps.
- The gallery is noninteractive. A static row remains during initial loading, after startup failure, and without JavaScript. A later loading failure preserves the already moving row and its responsive timing. Reduced motion disables scrolling; horizontal overflow remains clipped.
- Enrollment, payment, user accounts, and course playback are outside this release.
- Visitor-facing website copy is Hebrew and uses a right-to-left reading direction.
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

## Product principles

- Explain the course before asking the visitor to act.
- Connect every learning topic to real road decisions.
- Support driving lessons rather than suggesting the course replaces them.
- Use only supplied facts for the instructor and course.
- Keep the first experience focused on learning.

## Accessibility and inclusion

The page must support keyboard navigation, visible focus, reduced-motion preferences, readable contrast, semantic landmarks, and correct Hebrew right-to-left flow.
