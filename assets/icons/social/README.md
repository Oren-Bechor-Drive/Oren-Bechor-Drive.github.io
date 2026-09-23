# Social icons

Google, Instagram, TikTok, YouTube, and WhatsApp icons are from [Font Awesome Free 7.3.1](https://github.com/FortAwesome/Font-Awesome/tree/7.3.1/svgs/brands), by Fonticons, Inc.

The SVG icons use the [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/). The upstream [LICENSE.txt](LICENSE.txt) and each SVG's attribution comment are preserved. The four footer icons replace `currentColor` with the site's primary color, `#264796`, so external image elements retain the footer's existing blue icons. The account Google icon preserves the upstream SVG bytes and uses a CSS mask to inherit its button color.

These five files are served locally. No Font Awesome kit, script, stylesheet, or icon font is required. The Google artwork is the Brands icon shown on the [official Google icon page](https://fontawesome.com/icons/brands/solid/google).

`npm run check:media` includes these ordinary SVG image declarations on the welcome page. It checks that each local SVG is valid XML with an SVG root and namespace; it does not impose raster dimensions on scalable icons. Run `npm test` as well to verify the rendered footer and accessible labels. Preserve the attribution comments and license when updating references. See [media verification](../../../README.md#automated-checks) for the site-wide checks.
