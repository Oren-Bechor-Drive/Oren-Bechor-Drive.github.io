# Learning journey welcome page

> **Archived — current-state note, September 12, 2026:** This document preserves the original proposal and implementation history. Its commands, checkboxes, branch/worktree instructions, paths, and asset counts are not an active work plan. Use [README.md](../../../README.md) for setup and maintenance, [PRODUCT.md](../../../PRODUCT.md) for current scope, and [DESIGN.md](../../../DESIGN.md) for the approved appearance.
>
> The current page uses four stylesheets under `css/` and browser modules under `js/`, with Varela Round typography. The instructor now follows the hero and includes a full-width amber section and a road carousel of supplied student photos. Numbered photos are discovered without a fixed maximum; six current car colors are templates. The separate learning-method section and its supporting road photographs were removed. The current media audit also checks numbered student photos and the scrolling group’s direct child templates. Gallery timing follows rendered geometry, and `npm test` includes a focused Playwright Chromium check; see README for browser installation. Historical examples below intentionally retain the earlier structure.

## Goal

Create a single Hebrew welcome page for new visitors who do not yet know the course. The page should explain what the course teaches, connect the material to real driving situations, and lead visitors into a preview of the learning topics.

The page is an introduction, not an enrolled-student dashboard and not a checkout flow.

## Audience

The primary visitor is learning to drive or wants to improve their understanding of correct driving. They may already take driving lessons but still find right-of-way, intersections, lane choice, and road signs difficult to understand in practice.

## Content and page flow

The document and interface use Hebrew with `dir="rtl"`. The page follows this sequence:

1. A compact navigation bar with the course name and links to the course explanation, topic preview, and instructor.
2. A first viewport built around the line `ללמוד לקרוא את הכביש`, supported by a short explanation that the course connects road law with situations drivers meet in real life. The primary button, `לנושאי הלימוד`, scrolls to the topic preview.
3. A short explanation of the gap between theory and practice. It should make clear that the course supports driving lessons and does not replace a driving instructor.
4. A visual learning-topic preview based on the PDF. The initial selection will cover right-of-way and turns, road and lane recognition, traffic circles and intersections, road signs and speed limits, overtaking, trip planning, and common driving-test mistakes.
5. A practical-learning section explaining that lessons combine clear explanations with videos based on real driving situations.
6. A concise introduction to Oren Bachor, a certified driving instructor with more than eight years of experience. It will use only facts present in the PDF.
7. A closing invitation that returns visitors to the topic preview. Enrollment, payment, accounts, and course playback remain outside this release.

## Visual direction

The page follows `DESIGN.md` as the source of truth:

- Soft cyan background surfaces, white content areas, dark charcoal text, cyan primary actions, amber highlights, and restrained coral accents.
- System fonts: Arial, "Helvetica Neue", Helvetica, sans-serif. This supersedes the original bundled-font direction.
- A spacious 12-column desktop layout that collapses into a single-column mobile reading flow.
- Eight-pixel controls, sixteen-pixel content containers, subtle borders, and soft tinted shadows.
- A road-learning visual world rather than generic education graphics. The hero will use an original generated road image without showing an invented instructor.
- Motion is limited to a gentle entrance sequence, smooth anchor scrolling, and small hover or focus feedback. Reduced-motion preferences disable nonessential movement.

## Interaction and behavior

- The main hero button scrolls to the topic preview and moves keyboard focus to its heading.
- Navigation links scroll to corresponding sections.
- Topic cards support pointer and keyboard interaction. Selecting one reveals a brief explanation of what the visitor will learn without leaving the page.
- A mobile navigation button exposes the same links and reports its expanded state to assistive technology.
- JavaScript adds progressive enhancement only. The page content and anchors remain useful if JavaScript is unavailable.

## Files

- `index.html` contains the semantic Hebrew page structure and content.
- `styles.css` contains design tokens derived from `DESIGN.md`, responsive layout, focus styles, and restrained motion.
- `script.js` contains navigation, topic-preview, and focus-management behavior.
- `assets/` contains the generated hero image and any small supporting image assets.
- `README.md` documents how to open the page and records two later concepts: an instructor-led welcome page and a course-dashboard preview.

No framework or build step is needed.

## Accessibility and responsive behavior

- Use semantic landmarks, a skip link, visible keyboard focus, descriptive image text, and sufficient contrast.
- Preserve logical right-to-left reading order without reversing icons or numbers that should retain their natural direction.
- Avoid text embedded inside images.
- At widths below 768 pixels, navigation collapses, multi-column sections become one column, and touch targets remain at least 44 pixels tall.

## Verification

- Open the page through a local web server and test the complete visitor path.
- Verify the main button reaches the topic preview, topic cards work with keyboard and pointer input, and mobile navigation opens and closes correctly.
- Inspect desktop and mobile screenshots for overflow, clipped Hebrew text, weak contrast, and layout drift from `DESIGN.md`.
- Confirm the page remains readable and navigable with JavaScript disabled and with reduced motion enabled.
