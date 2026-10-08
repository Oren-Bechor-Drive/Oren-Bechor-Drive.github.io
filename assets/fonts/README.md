# Font sources

## Active typeface: Fredoka

The owner requested a rounded replacement closer to Varela Round on 2026-10-08 after reviewing Rubik. The site now uses the unmodified Hebrew and Latin Fredoka v17 variable WOFF2 subsets, with real weights 400-700. Both use `font-display: swap` and are preloaded once per page. The supplied Varela Round files and their original license remain preserved.

| Local file | Source |
| --- | --- |
| `fredoka-v17-hebrew.woff2` | [Hebrew](https://fonts.gstatic.com/s/fredoka/v17/X7n64b87HvSqjb_WIi2yDCRwoQ_k7367_DWs89XyHw.woff2) |
| `fredoka-v17-latin.woff2` | [Latin](https://fonts.gstatic.com/s/fredoka/v17/X7n64b87HvSqjb_WIi2yDCRwoQ_k7367_DWu89U.woff2) |

The [Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=Fredoka:wght@400..700&display=swap) supplies the Unicode ranges preserved in [css/base.css](../../css/base.css). The copyright and SIL Open Font License are retained verbatim in [Fredoka-OFL.txt](Fredoka-OFL.txt).

## Supplied typeface: Varela Round

Unmodified Hebrew and Latin Google Fonts v21 WOFF2 subsets, downloaded on 2026-09-13.
Licensed under the [SIL Open Font License 1.1](OFL.txt).

The source [Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=Varela+Round&display=swap) supplies the original Unicode ranges. These files are preserved source assets and are no longer requested by the pages.

| Local file | Source |
| --- | --- |
| `varela-round-v21-hebrew.woff2` | [Hebrew](https://fonts.gstatic.com/s/varelaround/v21/w8gdH283Tvk__Lua32TysjIfpcuPP9g.woff2) |
| `varela-round-v21-latin.woff2` | [Latin](https://fonts.gstatic.com/s/varelaround/v21/w8gdH283Tvk__Lua32TysjIfp8uP.woff2) |

The [license source](https://github.com/google/fonts/blob/main/ofl/varelaround/OFL.txt) includes the font's copyright notices.

## Delivery and maintenance

Both active Fredoka subsets use `font-display: swap` and are preloaded with `crossorigin` in every authored page. Hebrew letters use the Hebrew subset; ASCII punctuation and digits use the Latin subset. Keep both active font files and their preloads even though the visible copy is Hebrew. Sustained reading uses weight 400; headings and controls use real variable weights.

If the files change, update the CSS URLs, Unicode ranges, HTML preload URLs, and source table together. Preserve the supplied font bytes and license text during punctuation or documentation edits. Run `npm test` from the repository root to check font loading and avoid duplicate downloads. See [font delivery](../../README.md#font-delivery) for the complete workflow.

The site-wide media audit checks image declarations, not font files. Keep browser font-delivery checks alongside the content and image checks when adding another authored page.
