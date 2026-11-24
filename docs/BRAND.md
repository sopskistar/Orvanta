# Orvanta launch identity

Orvanta is the business. Sample Home Cleaning is a fictional demo client and never a testimonial or trading identity.

## Assets

`public/brand/` contains original SVG icons, outlined SVG wordmarks and PNG exports. `dark` means intended for a dark background (mint symbol, light lettering); `light` means navy on a light background. Transparent PNG wordmarks are 1032 × 288; icons are 512 × 512. Social preview is 1200 × 630; GitHub preview is 1280 × 640. The favicon SVG/ICO, Apple touch icon and 192/512 app icons are in `public/`.

The mark is an open O with a continuation stroke: an enquiry has somewhere to go. It is original vector geometry, not an AI/robot, shield or hexagon. It has not been represented as trademark-cleared. Keep proportions intact; leave at least one stroke-width of clear space and use the provided icon below wordmark size. Do not add effects, shadows or a glow.

## Colour source of truth

`src/app/tokens.css` has primitive colours, semantic aliases, component tokens, typography and spacing. Approved video colours are unchanged: navy `#08111F`, elevated navy `#142B42`, mint `#79DAC3`, light text `#F3F6FB`, secondary `#B7C9D5`, divider `#324451`. Warm white `#F7F7F2` is an additional website reading surface. Website secondary text on warm white is `#465664`. Dividers are decorative, never text.

Mint is for actions, links, navigation feedback and the small logo. Use navy text on mint buttons. Do not use mint text on warm white. Hover/pressed mint shades and both focus colours are verified in the QA report. Avoid gradients, arbitrary glass effects and decorative status indicators.

## Typography and licensing

The website uses **Albert Sans**, a free SIL Open Font License family designed by **Mathieu Triay**, sourced from the official Google Fonts repository: https://github.com/google/fonts/tree/main/ofl/albertsans . The licence is bundled at `public/fonts/OFL-Albert-Sans.txt`. It is self-hosted, so visitors do not request Google Fonts. Its open counters, measured geometric forms and clear sans-serif voice complement the video's DejaVu Sans while providing a purposeful web display family. The variable font supplies true weights; no fake bold or italic is used. Wordmark exports use outlined glyphs for portability.

The supplied video still uses its original DejaVu Sans/DejaVu Sans Bold and original colours. Only a still title frame was extracted for the poster. No template illustrations, stock photographs, third-party brand logos or purchased assets were used.

## Raster provenance

The poster is a still at 1.5 seconds of the supplied approved edited MP4. All brand PNGs are deterministic exports of the adjacent original SVG, using `scripts/export-brand.mjs`; they are not AI-generated pictures or evidence of product capability. The original MP4 remains byte-identical to the supplied file. See `docs/QA.md` for verification.
