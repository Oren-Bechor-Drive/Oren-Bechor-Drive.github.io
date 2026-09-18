# Varela Round

Unmodified Hebrew and Latin Google Fonts v21 WOFF2 subsets, downloaded on 2026-09-13.
Licensed under the [SIL Open Font License 1.1](OFL.txt).

The source [Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=Varela+Round&display=swap) supplies the Unicode ranges preserved in [css/base.css](../../css/base.css).

| Local file | Source |
| --- | --- |
| `varela-round-v21-hebrew.woff2` | [Hebrew](https://fonts.gstatic.com/s/varelaround/v21/w8gdH283Tvk__Lua32TysjIfpcuPP9g.woff2) |
| `varela-round-v21-latin.woff2` | [Latin](https://fonts.gstatic.com/s/varelaround/v21/w8gdH283Tvk__Lua32TysjIfp8uP.woff2) |

The [license source](https://github.com/google/fonts/blob/main/ofl/varelaround/OFL.txt) includes the font's copyright notices.

## Delivery and maintenance

Both subsets use `font-display: swap` and are preloaded with `crossorigin` in the welcome page, course library, learning page, and practice-quiz pages. Hebrew letters use the Hebrew subset; ASCII punctuation and digits use the Latin subset. Keep both font files and their preloads even though the visible copy is Hebrew. The bundled font has weight 400; the browser synthesizes the heavier weights used by the pages.

If the files change, update the CSS URLs, Unicode ranges, HTML preload URLs, and source table together. Preserve the supplied font bytes and license text during punctuation or documentation edits. Run `npm test` from the repository root to check font loading and avoid duplicate downloads. See [font delivery](../../README.md#font-delivery) for the complete workflow.

The site-wide media audit checks image declarations, not font files. Keep browser font-delivery checks alongside the content and image checks when adding another authored page.
