---
name: Solar Serenity
colors:
  surface: '#f2f5fc'
  surface-low: '#ecf0fa'
  surface-container: '#e5ebf7'
  surface-high: '#dee5f3'
  white: '#ffffff'
  text: '#131d1f'
  text-soft: '#3e494a'
  text-muted: '#596568'
  primary: '#264796'
  on-primary: '#ffffff'
  primary-hover: '#1e3978'
  primary-wash: '#edf1fa'
  secondary: '#705d00'
  secondary-bright: '#f6db78'
  secondary-wash: '#fffdf5'
  tertiary: '#9e3f41'
  tertiary-bright: '#d96c6c'
  tertiary-wash: '#fdf3f3'
  border: '#dfe5f0'
  border-strong: '#c5cfe2'
  border-card: 'rgb(197 207 226 / 0.72)'
  control-border: '#75839c'
  success: '#246a45'
  success-wash: '#edf6f0'
  amber-text: '#554600'
  header-surface: 'rgb(242 245 252 / 0.94)'
  header-border: 'rgb(190 201 223 / 0.65)'
  inverse-text: '#eaf0ff'
typography:
  display-lg:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 3.5rem
    fontWeight: '600'
    lineHeight: 4rem
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.005em
  body-lg:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
    letterSpacing: 0em
  body-md:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.625rem
    letterSpacing: 0em
  body-sm:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: 0em
  label-lg:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 0.9375rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 0.8125rem
    fontWeight: '600'
    lineHeight: 1.125rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: '"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif'
    fontSize: 0.8125rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-tablet: 2rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system blends **Clean Minimalism** with **Warm Sunny Modernism**. It pairs pristine white foundations and soft tinted surfaces with an energized, sunlit palette: vibrant royal blue, radiant golden amber, and lively poppy coral. Replacing cooler secondary tones with luminous sunny colors shifts the emotional tone from quiet, introspective calm to an optimistic, warm, and inviting clarity.

### Brand Personality & Tone
- **Optimistic & Radiant:** Warm amber-yellow secondary tones infuse warmth and vitality, turning clinical cleanliness into an inviting, daylight-inspired ambiance.
- **Crisp & Modern:** Elevated saturation on key chromatic accents ensures actionable elements feel intentional, lively, and immediately responsive.
- **Effortless & Balanced:** Generous white breathing room, muted base surfaces, and balanced visual hierarchies prevent the enriched saturation from overwhelming the senses.

### Design Style
The aesthetic marries Scandinavian white-space restraint with optimistic, tactile contemporary UI: pure `#FFFFFF` primary cards floating over soft, light-tinted backgrounds, complemented by warm golden amber accents and punchy royal blue interactive primaries.

## Colors

The primary blue `#264796` is sampled from the user-supplied learner-sign reference. Primary actions and the course icon use this blue; the decorative stop sign uses the approved red artwork; hover states use `#1e3978`, and filled primary controls use white text. All primary tints and blue-tinted surfaces derive from this hue. Amber and coral retain their secondary and semantic roles.

The palette transitions former deeper notes into luminous sunny tones, while elevating the chroma of the blue, yellow/amber, and coral accents for heightened presence against luminous white and soft off-white canvas surfaces.

### Primary Color (`#264796` - Reference Blue)
The primary driver for high-priority actions, focus rings, and primary interactive components. Luminous and modern, it provides crisp contrast and clear visual weight against clean white canvases. Its tint surface wash is `#edf1fa`.

### Amber Highlight (`--secondary-bright`, `#f6db78`)
Use amber for welcome-page emphasis, the instructor band and lesson takeaways. Its companion surface is `--secondary-wash` (`#fffdf5`); dark amber text uses `--secondary` (`#705d00`). Secondary action buttons use the blue outlined variant. Passing results use success green.

### Error Coral (`--tertiary`, `#9e3f41`)
Use `--tertiary` for error text and incorrect-answer borders, `--tertiary-wash` (`#fdf3f3`) for error fills, and `--tertiary-bright` (`#d96c6c`) for supporting decorative borders. Text identifies errors independently of color.

### Neutral & Surfaces
- **Canvas Base (`#FFFFFF`):** High-luminescence ground layer for cards, inputs, and modal dialogs.
- **Backdrop Surface (`#f2f5fc`):** Soft, clean, ultra-light blue-gray for canvas grounds, sidebars, and grouped lists.
- **Borders:** Card separators use `--border` (`#dfe5f0`) and `--border-strong` (`#c5cfe2`). Interactive boundaries use `--control-border` (`#75839c`) for at least 3:1 contrast on white and pale controls, including hover.
- **Text:** Deep charcoal `#131D1F` for headers and body copy; slate `#596568` for labels; and `#596568` for tertiary metadata.

## Typography

Use `"Fredoka", Arial, "Helvetica Neue", Helvetica, sans-serif` for all Hebrew and Latin text. Fredoka uses locally hosted WOFF2 subsets from Google Fonts, declared in `css/base.css` with `font-display: swap`. The HTML preloads the Hebrew and Latin subsets. Preserve the supplied Varela Round bytes and original license; active font provenance is documented in `assets/fonts/README.md`.

### Hierarchy & Typesetting
- **Display & Headlines:** Use Fredoka at the documented sizes and weights, checking Hebrew line wrapping at desktop and mobile widths. Fredoka provides real variable weights `400` through `700`; use `400` for sustained reading and `500` or `600` for headings and controls.
- **Body & Continuous Text:** Retains an airy 1.55 to 1.65 line-height ratio, preventing reader fatigue and harmonizing with spacious layouts.
- **Labels & Micro-copy:** Micro-typography shifts to semi-bold weights (`600`) with subtle positive tracking (`+0.01em` to `+0.03em`), guaranteeing crisp legibility in badges, buttons, and navigation tags.

## Layout & Spacing

A fluid responsive grid paired with rhythmic spatial steps prioritizes spaciousness, allowing pure white surfaces to breathe.

### Grid & Breakpoints
- **Desktop (1024px+):** 12-column grid constrained to a 1280px container, with `3rem` outer margins and `1.5rem` gutters.
- **Tablet (640px - 1023px):** 8-column flexible layout, `2rem` outer margins, and `1.5rem` gutters.
- **Mobile (<640px):** 4-column flow with `1.25rem` outer margins and compact `1rem` gutters.

### Layout Principles
- **Generous Voids:** Spacing tokens (`space-lg`, `space-xl`) define modular sections to maintain an uncluttered aesthetic.
- **Density Separation:** High-density data tables and toolbars employ `space-xs` and `space-sm` for compact internal padding while preserving outer canvas breathability.

## Elevation & Depth

Visual hierarchy uses tonal surface layering combined with soft, warm-tinted ambient drop shadows rather than heavy borders.

### Elevation Levels
- **Level 0 (Inset Ground):** Surface `#f2f5fc` with an inner 1px border `#dfe5f0`. Ideal for input wells, search panels, and code callouts.
- **Level 1 (Default Containers):** Solid `#FFFFFF` card surface, 1px border `#dfe5f0`, and diffused shadow: `0 2px 8px -2px rgba(20, 29, 30, 0.04), 0 1px 3px 0 rgba(20, 29, 30, 0.02)`.
- **Level 2 (Hovered Cards & Dropdowns):** Solid `#FFFFFF`, 1px border `#c5cfe2`, and elevated ambient shadow: `0 12px 28px -6px rgba(20, 29, 30, 0.07), 0 4px 10px -2px rgba(20, 29, 30, 0.03)`.
- **Level 3 (Modals & Float Overlays):** Solid `#FFFFFF`, 1px border `#c5cfe2`, and broad light spread: `0 24px 48px -12px rgba(20, 29, 30, 0.09), 0 8px 20px -4px rgba(38, 71, 150, 0.06)`.

## Shapes

The design system maintains a balanced, rounded shape profile (`roundedness: 2`) that softens modern architectural grid layouts while maintaining structured utility.

### Geometry Tiers
- **Interactive Controls (Inputs, Buttons, Segmented Blocks):** Standard 0.5rem (8px) radius for clean, ergonomic tactile forms.
- **Containers & Cards:** 1rem (16px) radius for structured frame boundaries.
- **Overlays, Dialogs & Flyouts:** 1.5rem (24px) radius for prominent, floating canvases.
- **Pills & Tags:** Full rounded border (`9999px`) for contextual badges, status filters, and user avatars.

## Components

### Buttons
- **Primary:** Shared `.btn.btn-primary`, blue fill, white text, 8px radius, 10px 20px padding and a 44px minimum target. Hover uses `--primary-hover`. Keyboard focus uses a solid 3px blue outline with 4px offset; pointer input keeps it hidden.
- **Secondary:** Shared `.btn.btn-secondary`, white fill, blue text and `--control-border` boundary. Match primary geometry and weight 600. Amber remains an emphasis color.
- **Tertiary / Ghost:** Borderless `#FFFFFF` surface, `#131D1F` text with subtle border `#dfe5f0`. Hover: `#f2f5fc` background.

### Cards
- **Base Style:** Pure `#FFFFFF` surface with Level 1 elevation and 1px `#dfe5f0` border.
- **Featured Card (Sunny Accent):** Pure `#FFFFFF` background, 2px top accent line or 1px border in `#F6DB78`, accompanied by a subtle `#FFFDF5` header banner.
- **Interactive Cards:** Transition smoothly to Level 2 elevation on hover with a 200ms ease curve.

### Direction icons

Use the selected Font Awesome Classic Solid family for interface arrows and chevrons: `arrow-right-long`, `arrow-left-long`, `arrow-down-long`, `arrow-up-long`, `chevron-up`, `chevron-down`, `chevron-left`, and `chevron-right`. The locally hosted SVGs and upstream license live in `assets/icons/directions/`. Shared CSS masks inherit each control's color and use 16px boxes. Keep directions explicit for Hebrew RTL navigation, use the actual up/down shapes for disclosure states, and hide decorative icons from assistive technology. This applies to navigation links, topic controls, and the closed quiz question selector. Supplied road-sign artwork is separate from interface iconography.

Course-only utility icons use the same local Font Awesome Classic Solid source. `assets/icons/interface/user.svg` is available for configured account navigation, and `magnifying-glass.svg` marks the library search field. Render both as CSS masks in the current interface color and keep glyphs decorative. Hide profile navigation in static pages until account support is configured.

### Chips & Badges
- **Sunny Amber (Highlighting):** Background `#FFFDF5`, text `#705D00`, border `1px solid rgba(246, 219, 120, 0.30)`.
- **Reference Blue (Informational):** Background `#edf1fa`, text `#264796`, border `1px solid rgba(38, 71, 150, 0.25)`.
- **Poppy Coral (Alerts / Critical):** Background `#FDF3F3`, text `#9e3f41`, border `1px solid rgba(217, 108, 108, 0.25)`.
- **Neutral:** Background `#f2f5fc`, text `#596568`, border `1px solid #dfe5f0`.
- Formatted as full pills (`9999px`), `label-sm` font, padding 4px 10px.

### Input Fields & Selects
- **Text Inputs:** `#FFFFFF` fill, 1px border `--control-border`, `0.5rem` radius, padding 12px 16px, text `#131D1F`, placeholder `#596568`. Reserve the outer focus indicator for keyboard navigation, following Focus behavior below.

### Focus behavior

- Mouse clicks and touch taps must not display focus rings, outlines, or focus halos on fields, buttons, or links. Clicking a label and typing in a pointer-focused field must also keep the ring hidden.
- Preserve native focus, caret placement, selection, editing and activation. Never blur a clicked control or prevent its default pointer action just to hide an outline. Do not autofocus fields on page load.
- Tab and Shift+Tab navigation must show a clear focus indicator. Arrow/Home/End navigation within radio, select, tab or combobox controls must also show keyboard focus. Do not globally remove outlines. Keep the baseline `:focus-visible` styling when JavaScript is disabled or fails.
- `:focus-visible` alone is insufficient for text and number inputs because browsers can match it after a click. `js/input-mode.js` owns shared input-mode listeners; home, library, public quiz and account entry modules import it directly. All consumers use the single `data-input-mode` state and base input-mode rules. Import the helper instead of duplicating listeners. A pointer event hides rings; keyboard navigation restores them. Ordinary typing, caret arrows and Enter submission from a pointer-focused text field do not change the input mode.
- Programmatically focused feedback targets follow the same pointer/keyboard input mode as controls.
- In forced-colors mode, mask icons use `CanvasText` and retain their fill, action boundaries use system-visible borders, and the FAQ uses an inset `Highlight` outline for keyboard focus. Pointer focus remains unoutlined.
- Verify clicks, touch taps, label activation, typing after a click, and keyboard navigation when adding or changing controls. Include switching from keyboard navigation back to pointer input.

### Checkboxes, Radios & Switches
- **Checkboxes & Radios:** Unchecked state features an empty `#FFFFFF` fill and `--control-border` boundary. Checked state transitions to a royal blue `#264796` fill with a crisp check/bullet.
- **Toggle Switches:** Unchecked track in `#dfe5f0` with white thumb; checked track transitions to `#F6DB78` (warm sunny accent) to signal active status.

### Lists & Navigation Rails
- Row dividers utilize 1px `#dfe5f0`. Active navigation list items feature a `#FFFDF5` surface background with `#F6DB78` left accent edge (3px) and bold `#131D1F` label copy.

## Current Welcome Page

The approved composition is the hero, the instructor introduction with its student gallery, one combined learning section containing the three learning steps and topic preview, the homepage FAQ, and a closing public-preview action before the footer. This section records page-specific choices within the broader system above; unused palette colors remain available for future designs.

### Hero, Learning Steps, and Instructor Gallery

- The instructor uses the supplied `oren.jpg` photo, with responsive WebP copies, rounded corners, and a cover crop positioned at 50% 75% to keep Oren visible in shallow frames. The two-line title identifies Oren Bachor as the driving instructor and course presenter. One Hebrew paragraph introduces his certification, more than eight years of experience, and explanations of real road situations. On desktop the photo and text sit at opposite outer edges, with each column capped at 540px. At 768px and below, use one column in both reading and visual order: centered title, photo, description. The introduction is constrained to 1280px and shares one small viewport below the sticky header with the road gallery beneath it. Allow natural growth on short screens or for enlarged text.
- Use a full-width warm amber (`#F6DB78`) instructor section to distinguish it from the pale blue hero. The top of the amber aligns with the bottom of the sticky header when navigating to `#instructor`.
- The hero identifies Oren, his certification and more than eight years of experience. Its primary "צפו בנושאי הקורס" link targets `#topics`; the secondary "הכירו את אורן" link targets `#instructor`. An adjacent status line identifies open reading/practice and the full course in preparation. The heading has two sentence lines. Tablet and phone layouts fill the dynamic viewport below the header and use a 36ch reading measure; short viewports use a compact side-by-side layout and grow naturally when the content needs more room. The red stop-sign variant is a separate approved edit; preserve the blue original. Header and closing actions link to `course/`, without promising enrollment, videos or saved progress.
- Place the supplied road background below the compact instructor introduction. The introduction and road together fit below the sticky header on typical laptop and phone screens. Preserve gallery geometry and cadence; `hero-road` remains the gallery's existing technical identifier.
- Present the course as one white `#about` section, with one concise introductory paragraph, three learning steps presented as plain text, the ten topics in library order and the learning note. Above 640px, topic buttons form a tablist with one tab stop, `aria-selected`, `aria-controls` and a labeled tabpanel. Arrow keys select the next topic; Home/End select first/last. The panel reads the authored baseline description and links to its lesson. Phones show all ten baseline descriptions and links as a visible list. No dropdown or duplicate description source is maintained. The panel uses a quiet pale blue surface and a modest heading.
- The topbar links to the instructor, `#about`, and `#faq`. Use only the sticky header height as the global scroll offset, with no extra section scroll margins, so section backgrounds align immediately below the header. The mobile fallback header is in normal document flow and uses a zero scroll offset.
- Place the homepage FAQ immediately before `#start`. End with a centered pale blue section headed "הנושא הבא שלכם מתחיל כאן." and one prominent blue "לנושאי הלימוד ולתרגול" link to `course/`. Omit the supporting paragraph. Use a larger 64px minimum button target and a decorative left arrow, with a responsive 360px maximum action width.
- The road spans the viewport, repeats horizontally, fills its height, and has square corners. Its height responds to the small viewport height, with a 180-264px desktop range and a 140-188px phone range.
- Center the visible car silhouettes despite differing transparent margins in their source files. Size cars relative to the road height and retain a separate car-scale setting; phone layouts show neighboring cars partially clipped.
- Place student photos on the car roofs with 8px rounded corners and a subtle 3px transparent edge fade. Keep the middle of each photo opaque, crop with `object-fit: cover`, and preserve the original image files.
- Move cars continuously to the left with linear timing. Keep photo order numeric and randomize car colors independently. Preserve the approved cadence of about 11.11 seconds per car on desktop and 9.46 seconds on phones, configured by `--road-seconds-per-car`. The gallery derives loop duration from rendered row width and car spacing and updates it on viewport resize; short rows include any extra viewport space in their travel distance. The road is noninteractive and has no pause control.
- Start motion once the initial consecutive photos have decoded and cover the viewport with one car of spare space, with a minimum of six photos or the complete list for a smaller gallery. Append later photos in numeric order while preserving the visible cars' position and travel speed. Keep a static row until startup succeeds or when JavaScript is unavailable; a later loading failure freezes photo additions but preserves the working row. That row continues adapting its duration on viewport resize while retaining its position within the animation cycle. With reduced motion, stop the animation and hide the duplicate row. Make the complete photo row horizontally scrollable with keyboard focus and scroll snapping; normal motion keeps its approved cadence and no pause control.
- During loading, startup failure and without JavaScript, keep the static photo row readable. Do not cover it with a blur, wheel or loading overlay. Group the photos under one meaningful region description; decorative car sprites and grouped photos use empty alt text and `aria-hidden="true"`.

### Applied Layout and Styling

A small supplied red car follows the hero road from top to bottom once in 15 seconds at a steady speed and turns with the bends. Keep it behind the sign and copy and noninteractive. Sample the road in rendered coordinates so the car retains its proportions on phones and follows the route after resizing. Reduced motion parks it near the start of the road; without JavaScript, omit the decorative car.

The hero heading, paragraph, and buttons share a right edge on desktop and remain centered at 768px and below. Underline only "להבין" and "לקבל" in warm yellow (`#F6DB78`). A static, faint blue road curve follows the supplied drawn route: enter at the top center, sweep into a broad low loop to the left of the stop sign, climb diagonally behind the sign and copy into a high right-hand bend, then return to the bottom center. The curve fills the hero and stays behind all content. Keep it decorative, noninteractive, and lighter on mobile so it does not compete with the centered copy.

The hero copy enters from 36px to the right and the sign from 36px to the left, both fading in over 500ms with the shared `--ease-out` curve. At 768px and below, both use a 14px upward arrival instead. After the entrance, the amber underlines beneath "להבין" and "לקבל" sweep from right to left over 320ms, with the second starting 80ms after the first. The complete sequence settles in 900ms and replays on every page load, including reloads. It does not depend on browser storage or earlier visits. Content and native amber underlines stay visible without JavaScript. Reduced motion, forced colors and print use static content and native underlines. The decorative hero car makes one finite trip on desktop and phones and disappears after exiting.

The hero's `:focus-within` rule immediately settles the copy, sign and underlines before native focus scrolling. The JavaScript focus handler clears the entrance state so leaving the hero does not restart the sequence. Keep both protections: clipping prevents internal scrolling, while the focus rule prevents the page from scrolling toward an off-screen animated button.

Mobile navigation uses the existing short opacity/4px entrance for pointer input and immediate keyboard activation. Close on outside pointer interaction, focus leaving its shell, scroll, link activation or Escape. The menu button uses a familiar three-line icon and an accessible Hebrew label.

Instructor content uses an opacity-only reveal over 280ms. The combined learning section keeps its short reveal; keyboard focus settles content immediately. Reduced motion uses a short opacity fade without spatial movement; print exposes everything.

Topic preview changes animate only the title and description container; the unchanged explanatory note stays still. A new pointer or touch selection fades and moves the outgoing content by 6px, replaces it after 110ms, and returns it over 180ms with `--ease-out`. Selecting the active topic does not restart feedback. Keyboard and assistive activation update immediately. Enabling reduced motion settles any pending update and removes movement and delay from later selections.

Course footers use the brand and two navigation links: "דף הבית" and "נושאי הלימוד", each with a 44px target. The homepage footer contains only the original four social icons as noninteractive placeholders with accessible Hebrew labels. Omit its brand, site navigation, visible channel labels and contact notice. Add working social destinations only when supplied. The focused 404 recovery page remains an intentional exception without chrome.

Separate consecutive homepage topic descriptions with a 1px `--border-strong` divider and reading space on both sides. Keep the first topic free of a leading divider, including the baseline experience without JavaScript. Phones use compact 1rem section padding without adding a trailing border after the final topic.

Use the shared solid 3px primary blue outline for keyboard focus across the site so it remains visible on white, blue and amber surfaces.

The header brand image uses the requested Hebrew alternative `alt="לוגו"`. Keep the enclosing home link's descriptive accessible name and the visible course and instructor names.

Without JavaScript or when the entry module is unavailable, the mobile header stays in document flow with visible navigation links, and section links align to the viewport top. A small synchronous `js/menu-bootstrap.js` head script reserves the compact header while the deferred entry module loads, preventing the expanded fallback navigation from flashing. An entry error, page load without enhancement or a three-second loading deadline restores the fallback and preserves that presentation for the page lifetime, including focused links. Successful initialization enables the sticky header, its scroll offset, and the collapsible menu. Show all ten topic descriptions as static content before enhancement; the interactive preview uses those descriptions and replaces the static presentation after initialization.

The current page uses a maximum 1280px content width, with 48px side margins above 1024px, 32px at 1024px and below, 20px at 768px and below, and 16px at 440px and below. The main layout and menu switch at 768px; the complete topic list replaces tabs below 640px. These are the implemented page breakpoints rather than a mandatory column grid.

The page uses `#f2f5fc` for its base surface and `#131D1F` for primary text. `css/base.css` holds runtime tokens, `css/components.css` holds navigation styles, `css/welcome.css` holds the main section layouts, `css/faq.css` holds the FAQ layout and disclosure styles, and `css/responsive.css` holds motion, interaction states, responsive overrides, and accessibility preferences. Keep this stylesheet load order.

### Accessibility and unavailable destinations

The header subtitle uses `--text-soft` to maintain at least 4.5:1 contrast over the translucent header. The home link accessible name includes the complete visible brand text. Show the homepage's social artwork as noninteractive icons with accessible unavailable labels until profile URLs are supplied. Preserve their supplied local SVG source assets.

## Homepage FAQ

The public questions and answers live in `index.html` at `#faq`, immediately before `#start`. The section uses six native `details` and `summary` rows: the former help page's first five questions and a current-availability question. Keep the native controls and baseline answers usable without JavaScript. Desktop and mobile navigation link directly to the section.

At widths above 768px, place the heading in a narrow column in normal flow and the disclosures in a wider column. At 768px and below, use one column. Each answer uses a 16px card radius, the pale base surface when closed, a white surface and subtle shadow when open, and the local chevron rotated to show its state. Use the single heading "שאלות נפוצות" without a repeated kicker, and the established Fredoka hierarchy.

Pointer and touch activation animates the complete FAQ card height and chevron rotation in both directions over 220ms with `--ease-out`. A rapid second activation reverses from the currently rendered height. Keyboard activation and reduced-motion interaction settle immediately, including when they interrupt active motion.

The FAQ heading and question list enter together once when the section first scrolls into view, fading in and moving upward by 8px over 280ms with `--ease-out`. Reuse the existing scroll-reveal behavior. Keyboard focus reveals the content immediately; reduced motion keeps only an 80ms opacity fade. Without JavaScript or IntersectionObserver, and in print, the content stays visible.

The FAQ's video and practice-quiz answers use the requested completed-course marketing copy. They do not document current runtime availability. The `noindex` course area retains placeholder lesson media and disabled enrollment. Public theory quizzes now show scores and answer review without saved account progress. Account links become available through the configured local gateway.

## Not-found page

`404.html` is the static recovery page for missing URLs. It contains only the skip link and one centered error-message section with recovery actions. The page has no header, footer, brand chrome, or topic preview. A large circular yellow border contains the centered blue 404 text. The actions stack below 601px. At short viewport heights, the message aligns to the top with safe padding and scrolls naturally.

The page links to the welcome page and course library. It has no account, checkout, enrollment, progress, contact, or service-status controls. Keep it `noindex` and omit canonical metadata because one response body serves many missing URLs. All page, asset, and recovery references must remain root-absolute while the site is published at the domain root, so nested missing paths recover correctly. A host or path-prefix migration must update these references as part of the move. Reduced motion removes inherited smooth scrolling and the skip-link transition.

The complete error message enters together once on page load: the yellow circle and 404 number, kicker, heading, explanation, and recovery links fade in and scale from 0.96 to 1 over 280ms with `--ease-out`. Focusing a recovery link settles the entrance immediately. Reduced motion uses an 80ms opacity-only entrance. Pointer and touch presses on recovery links move them down 1px and scale them to 0.99 over 140ms with `--ease-out`; keyboard and reduced-motion activation have no spatial feedback. These effects use CSS and work without JavaScript. The skip link stays outside the entrance animation.

## Local account pages

The Hebrew pages under `account/` reuse the base palette, Fredoka, blue primary actions, white rounded cards, and pale blue background. They are standalone account screens with no top bar or account kicker. Keep a return link to the homepage and the existing Hebrew page headings. The forgot-password link appears between the password field and the sign-in button.

Account headings use charcoal text and real weight without an amber underline. Reserve the underline for the welcome hero's emphasized words.

Center the compact account card when it fits. Use ordinary document scrolling when short screens, zoom, a keyboard or long messages need more space; keep every control reachable. Do not clip form controls to suppress scrolling. Labels and reading order stay RTL; email and password inputs use LTR text.

Use locally hosted Font Awesome Google Brands artwork for Google sign-in and Classic Solid eye/eye-slash artwork for password visibility. Render decorative glyphs as CSS masks; buttons retain Hebrew accessible labels and the password toggle exposes its pressed state. Pointer input keeps normal editing and caret behavior without the blue outer focus outline. Keyboard Tab navigation displays the outline. Without JavaScript, retain the baseline focus-visible treatment.

The course's profile control stays hidden in its static fallback. When the local gateway confirms account support, reveal the link to login or the account page. This conditional link does not change public topic navigation. Account fields are editable while the service loads or is unavailable, including without JavaScript. Only submission stays disabled until session initialization succeeds. Disable the fieldset only while an account request is being submitted. Hide the Google control and divider until the configured service enables Google.

Registration and reset share one password rule: at least 12 Unicode characters and at most 72 UTF-8 bytes without composition requirements. Both show a compact length-rule completion indicator, using text independently of color. Persistent Hebrew field errors identify the issue and recovery with `aria-invalid` and `aria-describedby`; do not rely on native browser validation bubbles. Busy buttons name the current action. Account submission remains disabled until session initialization succeeds. Provider settings and policy changes are local configuration evidence; hosted verification remains separate.

Confirmation guidance leads with opening the email link in the same browser used for registration, including a tip for links opened inside email apps. With an active pending registration, show only the masked address and a resend action with a server-enforced 60-second cooldown. Expired or absent context falls back to requesting a new link through registration. Preserve the static same-browser guidance without JavaScript. A resend acknowledgement is conditional and does not claim email delivery or reveal whether an account exists.

Account screens are a local development capability. They do not imply a paid subscription, available checkout, protected static lessons, or persistent progress in the browser. The homepage links to the public reading and practice preview; full-course enrollment and videos remain unavailable.

The protected learning page lists the signed-in learner's available, titled sections. Its links open `account/reader.html` with a section ID and access level. The reader uses the existing account palette and card, with an authorized 65ch reading area, autosave status and end navigation. Reload and manual save retry appear only for their corresponding failures. Static HTML contains no private body. The reader keeps baseline navigation and a JavaScript requirement message; existing account typography, spacing, short-viewport overflow, focus and reduced-motion behavior apply. This area has no paid enrollment action.

Omit the supplementary account-note paragraphs. Password bar updates use a right-anchored horizontal scale transition over 220ms with the shared `--ease-out` curve and a 180ms color transition. Retarget transitions from the current rendered state when typing reverses progress. Reduced motion changes the fill length immediately and retains only a 100ms color fade. Requirement labels, counts, and validation update immediately.

## Course library preview

The user selected option A, an open library organized by named learning topics. `course/index.html` implements that layout as a preview, with no fixed learning order, locked topics, or fabricated completion progress. Preserve the existing Fredoka font, blue actions, shared pale blue canvas, and white 16px-radius topic cards. Reading surfaces remain opaque white for sustained legibility. The course header matches the home page: a sticky 72px bar (66px at 768px and below), translucent tinted background, subtle bottom border, and 14px backdrop blur. Match its 1280px shell, responsive gutters, 42px logo and brand typography; retain the instructor subtitle on mobile at 13px or larger. Keep anchor targets and sticky sidebars below the header. Its clickable brand leads to `index.html`. A 44px profile link is enhanced when account support is configured; hide the unavailable static profile control, using the local Font Awesome user icon and the configured link's accurate accessible label. Static pages have no unavailable profile control; the local gateway reveals account navigation as described above. This header is shared visually by the library, learning and quiz pages.

The reading order is a short introduction, search and the topic browser, within a maximum width of 1080px. At 900px and above, successful initialization presents a compact translucent-white vertical topic list on the right and a separate white reading panel on the left. Selecting a topic highlights its row without rearranging the list. The list stays sticky while reading long outlines and scrolls internally if the viewport is too short. The panel shows the title, description, outline, availability note and any learning link. Its compact minimum height limits layout shifts without an empty 640px reading area. Content comes from the baseline HTML; no second authored copy is maintained.

Below 900px, or when JavaScript is unavailable, use a single column of compact native details/summary rows. Closed rows show the title, description and chevron; opening one reveals the learning action, effort metadata and outline. Topics share the native exclusive group `course-topics`; older browsers retain readable disclosures even without group support. All ten topics shared with the welcome page retain its descriptions and order. Selection carries across viewport changes, with focus transferred to the corresponding control when needed. No illustration, fake video player, or sample lesson count is needed for this layout.

Pointer and touch topic selection introduces the desktop reading content with a 180ms opacity transition and 6px upward arrival, using the shared `--ease-out` curve. The panel and topic list stay still. On mobile, animate the complete card height over 200ms with the same curve, including the description inside its summary. Keep closing content rendered until the compact height is reached. A rapid reversal starts from the current rendered height. When a preceding card collapses, keep the newly activated summary at its viewport position and below the sticky header; fragment navigation and filtering supersede that tracking. After enhancement, JavaScript manages exclusivity so the outgoing card can close while the new card opens; baseline HTML retains the native named group. Keyboard interaction settles active motion and selects without animation. Reduced motion removes spatial transitions. Course buttons provide a 140ms press response with a 1px downward movement and scale of 0.99, disabled for keyboard focus and reduced motion. Fine pointers receive only subtle one-to-two-pixel feedback on course buttons, tabs, lesson navigation and quiz choices. Baseline content remains visible without JavaScript.

The library presents foundations, signs and speed, roads and lanes, right-of-way and turns, priority hierarchy, roundabouts and intersections, overtaking, trip planning, test preparation, and new-driver/licensing/points information in that order. This is a browsing order, not a prerequisite sequence; all ten topics remain freely accessible.

Search and its recovery controls appear only after initialization; an announced result count and an empty state accompany filtering. Search filters both presentations, selects a matching desktop outline when necessary, and hides the reading panel for empty results. Desktop selection uses a vertical tablist with Up/Down and Home/End navigation, one tab stop for the selected topic, and a labeled, focusable reading panel. Keyboard focus uses the existing solid blue outline. The preview includes a preparation notice and noindex metadata. Every outline includes a blue "ללמידה" link to its authored lesson page. The preparation notice distinguishes available reading material and practice quizzes from outstanding videos and illustrations.

### First learning page

`course/right-of-way/index.html` adapts PDF pages 12-17 into separate white reading sections for left turns, right turns and U-turns. A fourth section covers narrow/steep-road priority using official teaching sources. The foundations page includes separate definitions, theory/practice and recap sections. `course/priority-hierarchy/index.html` adapts page 18 as its own learning topic and section. A back-to-library link and introduction precede a right-hand contents list; each section keeps its own border, rounded corners, and 28px separation. Section headings use charcoal text, real weight and size without an amber underline. The contents list is sticky on desktop, moves above the reading content below 901px and becomes one column below 480px. Omit it on single-section lessons. Use native anchor links and baseline HTML throughout; these pages need no JavaScript. Short amber takeaways distinguish the key point in each section. PDF provenance labels and links are omitted from the learning interface; official resource destinations supplied as course content remain available in the licensing lesson.

Use media only where it helps explain the subject. Reserve video for movement, timing and developing hazards; use images or diagrams for recognition and road layouts. Summaries and administrative explanations need no media. Planned media uses at most one compact text note per section with a solid surface-container-low background (#ecf0fa), a dashed border and descriptive Hebrew text. Do not use gradients in media placeholders. Video and image/diagram placeholders share this treatment and use note semantics, without broken images or inactive players. Complete right-turn and U-turn demonstrations absorb individual checks and completion steps. Each topic ends with one blue "לשאלון התרגול" link and a note identifying its actual question count and answer review. Place that block after the reading sections; individual sections do not own quizzes. All course preview pages remain noindex.

On the learning page, native contents links scroll smoothly to the selected sub-subject without focusing or outlining its reading section. Sections have no `tabindex`; links retain native keyboard navigation and fragment URLs. Scope smooth scrolling to `html.lesson-page` so quiz question focus and other course navigation retain their own behavior. The shared reduced-motion rule switches scrolling to immediate movement. No JavaScript is required for this interaction.

### Practice quiz preview

Clicking or tapping a quiz answer shows its selected background, border and radio state without an outer focus ring. Keyboard focus retains the solid blue outer outline around the answer. The course search field uses a visible blue keyboard outline and the shared input-mode helper; pointer-focused typing keeps its ring hidden.

Enhance the question selector into a labeled combobox with a scrollable white list, a visible native scrollbar, rounded corners, a subtle shadow and 44px options. Each option identifies whether its question is unanswered or answered; after submission it identifies correct or incorrect answers with Hebrew text and the existing blue/coral roles. Keep the trigger label compact, using the current question name. Highlight the current question in blue and show the selected Font Awesome up/down chevrons. Position the list above the trigger when there is insufficient space below. Pointer entrances use 180ms opacity and scale from 0.97; exits use 150ms along the same path, with the shared `--ease-out` curve. Keyboard interaction is immediate, supports arrows, Home/End, Enter/Space and Escape, and keeps focus on the trigger while exploring options. Outside interaction dismisses the list. Reduced motion removes the transitions. Options come from the native selector, which remains in the document; blocked JavaScript preserves the complete static question list.

Each topic links to its own static quiz page, with the topic title and lesson return links authored in HTML. All ten reuse `course/js/quiz.js`. Former section quiz URLs retain their transition links. The compact 820px-wide layout shows the subject title, actual question count, question selector, one fieldset with four native radio choices, and previous/next controls. Question counts follow coverage, without padding to 20. Original question diagrams sit above the choices at their natural width, capped at 100% of the card. Preserve their aspect ratio and use accurate Hebrew alt text.

Selections remain editable until submission. Missing answers produce Hebrew feedback above the question form, including the count and question numbers, and focus the first unanswered question. Update that message as remaining answers are supplied. The visible position text is not a live region after enhancement, because focusing the question already announces navigation. Completed attempts show the number correct, a rounded percentage and text identifying whether the learner passed; the focused result heading also includes the percentage and pass/fail outcome. Passing requires at least 85% correct, with the required answer count rounded up and shown beside the result. Keep actions to review answers or start a new attempt. Review keeps the submitted choices locked and displays a native answer disclosure with a text result, the learner's chosen answer, correct answer and explanation. The introduction changes to explain locked review after submission and returns to its original wording on retry. Results list each incorrect question as a 44px button that opens that question. General review starts at the first mistake, or the first question for an all-correct attempt. A separate "לעבור על הטעויות (N)" action offers review restricted to incorrect questions; Previous/Next follow that subset and its end returns to results. Choosing a question from the selector or results list restores full question navigation. Do not show an empty mistake list or mistakes-only action for all-correct results. Correct feedback and the correct answer tile use the primary border; an incorrect selected tile uses `--tertiary` text/border and `--tertiary-wash` fill. Each marked tile includes a Hebrew state label. On phones, place that label below the answer text so the text retains its reading width. Hover does not overwrite submitted states. Text identifies correctness independently of color. Restart clears choices, results, mistake links, chosen-answer feedback and selector states, restores the introduction and returns to the first question. With JavaScript disabled or blocked, every fieldset and its native self-check disclosure remains usable. No public score is presented as an official theory-test result or paid-course completion.

Each question shows its source number and marks adapted wording. A compact attribution below the quiz names the Ministry's source, links to the dataset and CC BY licence, and distinguishes course selection and explanations from Ministry endorsement. Keep keyboard focus visible on the answer disclosures and retry action, and pointer/touch outlines hidden.

### Content and verification constraints

The September 18 architecture changes preserve this layout, typography, motion and HTML formatting. Quiz forms marked `data-quiz-placeholder` retain the approved 20-question preview layout. The shared interaction follows authored question order and does not depend on numeric IDs or a fixed video position. The owner-authorized theory update uses `data-quiz-graded` in the real pages; placeholder fixtures continue to test ungraded behavior.

Learning-section identity comes from its stable anchor and declared heading, not a heading-level assumption in a test. Site-wide media checks allow scaled ordinary brand images while preserving exact intrinsic metadata checks on marked road media. Gallery initialization receives its student photo list while preserving normal cadence and numeric order; reduced motion exposes a scrollable row and the readable static row has no loading overlay. See [Architecture](docs/ARCHITECTURE.md) for implementation ownership and [README](README.md#add-learning-sections-and-quizzes) for authoring steps.

### Protected learner area

The protected learner area uses the existing account visual language in a wider 920px reading shell, with normal document scrolling. Use white cards, the existing pale canvas, Fredoka, 16px card corners and blue primary actions. Quiz questions use native fieldsets, legends and radio groups. Keep radio focus and arrow-key behavior during autosave. Results show a score, explanations and a separate optional completion action. Keep unavailable and conflict messages beside the affected controls.

The reader renders approved text with preserved paragraph spacing and inline responsive private media. Saved reading position is derived from the text area. New readings, zero saved positions and changed content versions start at the document top so the section title remains visible; positive positions resume within the text. Account input-mode focus rules apply to both new entry modules. These screens require authenticated API content; their static shells contain no instructional body or answer keys. Course-library baseline descriptions remain independently usable without JavaScript.

## Implemented shared roles and tokens

`css/base.css` owns runtime colors, typography, spacing, shadows, durations and stacking levels. Use blue for actions and focus, charcoal for headings, `--success` for passing results, `--tertiary` with `--tertiary-wash` for errors, and amber for welcome emphasis and takeaways. Interactive boundaries use `--control-border`; card separators retain the quiet `--border`. Buttons share `.btn`, `.btn-primary` and `.btn-secondary`, with existing page classes retained for their interaction hooks. Header structure is shared by `.site-header` and `.course-header`. Keep native scrollbars visible.

Meaningful text has a 13px minimum. Use rem for type, pretty paragraph wrapping, real font weights, and a restrained heading hierarchy. Shared print styling removes navigation and decorative motion; lesson text and all quiz questions remain printable. Keep light mode for this release; dark-mode direction remains an owner choice.

Public quiz feedback remains after submission under the owner's 2026-10-08 decision. A completed answer set opens a pre-submit summary with a distinct "בדיקת השאלון" action. Phones collapse the introduction after starting, retain a slim sticky answered-progress bar and a one-row bottom navigation area. Navigation aligns the question card below that progress bar. Results show one clear score, outcome and threshold; lesson-section links connect review to the available teaching text. No shuffled answer order or immediate-feedback mode is implemented.

## Copy and teaching review

Use plural imperative for authored instructions, short action nouns or verbs for controls, and impersonal present for descriptions. Use "נושאי הלימוד" for the public library and "ניסיון חדש" for a fresh quiz attempt; "ניסיון נוסף" names a network retry. Keep Ministry source wording and documented adaptations distinguishable. New examples restate existing rules and remain subject to instructor approval before publication, as required by [Operations](docs/OPERATIONS.md#keep-evidence-approval-and-technical-checks-separate). The [coverage draft](docs/reference/design-teaching-coverage.md) separates valid navigation links from complete teaching coverage.
