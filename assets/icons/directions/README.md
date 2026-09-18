# Direction icons

The eight direction icons are from [Font Awesome Free 7.3.1, Classic Solid](https://github.com/FortAwesome/Font-Awesome/tree/7.3.1/svgs/solid), by Fonticons, Inc.:

- `arrow-right-long.svg`
- `arrow-left-long.svg`
- `arrow-down-long.svg`
- `arrow-up-long.svg`
- `chevron-up.svg`
- `chevron-down.svg`
- `chevron-left.svg`
- `chevron-right.svg`

These are the user's selected icon family. Preserve the upstream SVG paths, attribution comments and [LICENSE.txt](LICENSE.txt). The SVG artwork is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

`css/base.css` uses these local SVGs as CSS masks so each icon inherits its control's text color. Decorative markup uses `aria-hidden="true"`; pseudo-elements contain no text. Direction remains explicit for the Hebrew RTL interface. Dropdowns and disclosures switch between the actual up/down chevrons, and the quiz's native select retains its keyboard behavior with a custom closed-control chevron. No external Font Awesome kit, stylesheet, script or font is loaded.

For an inline direction icon, use `direction-icon` with its `icon-<filename-without-extension>` class. The shared styles also cover the existing disclosure and selection indicators. Keep SVG paths relative to the shared stylesheet so they resolve from the homepage and nested course/quiz pages.

After changes, run `npm run check:media`, `npm test`, and browser delivery checks. The media audit does not inspect CSS mask URLs, so verify their requests and rendered shapes in the browser, including open/closed disclosures and the nested quiz pages.
