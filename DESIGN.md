---
name: Orvanta
description: "AI receptionist setup, websites and connected enquiry workflows."
colors:
  navy: "#08111f"
  navy-raised: "#142b42"
  mint: "#79dac3"
  mint-hover: "#a4e8d7"
  mint-pressed: "#65c7af"
  light: "#f3f6fb"
  secondary: "#b7c9d5"
  divider: "#324451"
  warm-white: "#f7f7f2"
  light-muted: "#465664"
  light-divider: "#cbd1ce"
typography:
  display:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: "clamp(2.75rem, 6.7vw, 6rem)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: "clamp(2.1rem, 3.7vw, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-.03em"
  title:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: "clamp(1.5rem, 2.1vw, 2rem)"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-.02em"
  body:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  lead:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: "clamp(1.125rem, 1.5vw, 1.375rem)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: ".875rem"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  navigation:
    fontFamily: "Albert Sans, DejaVu Sans, sans-serif"
    fontSize: ".9375rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  button: "6px"
  card: "14px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
  3xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.navy}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.mint-hover}"
  button-primary-active:
    backgroundColor: "{colors.mint-pressed}"
  text-link:
    textColor: "{colors.light}"
    padding: "0"
  navigation:
    textColor: "{colors.light}"
    typography: "{typography.navigation}"
  service-card:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.light}"
    rounded: "{rounded.card}"
    padding: "40px"
  brand:
    textColor: "{colors.light}"
---

# Design System: Orvanta

## Overview

**Creative North Star: "Carry the enquiry forward"**

Orvanta is an assured, conversation-led studio. Deep navy gives the identity its presence; mint makes actions and the open O mark easy to find. Warm-white regions give longer explanations room to be read. The visual system supports a professional service business whose claims stay close to its actual demonstration.

Broad, left-aligned Albert Sans headings sit above quieter explanatory text. Open spacing, asymmetric service emphasis and visible text links carry the page. The current build uses original vector identity and genuine demo imagery; its visual confidence does not depend on invented statistics or customer proof.

**Key Characteristics:**
- Deep navy identity with mint actions and warm-white reading regions.
- One self-hosted sans family, broad headings and readable paragraph measures.
- Restrained rectangular controls, softly rounded media and cards.
- Flat tonal depth, visible focus and reduced-motion support.

This document records the implemented system in `src/app/tokens.css`, `base.css`, `globals.css` and representative components. It is a visual reference, not a claim of full accessibility compliance.

## Colors

The palette pairs cool navy and fresh mint with warm-white explanatory surfaces. Frontmatter preserves the canonical source colors; semantic CSS aliases assign them by surface.

### Primary
- **Enquiry Mint** (`mint`): primary actions, brand stroke, small process numbers, hover emphasis and focus on navy.
- **Mint Hover** (`mint-hover`) and **Mint Pressed** (`mint-pressed`): primary action interaction states.

### Neutral
- **Identity Navy** (`navy`): site background, action text and main text on warm-white regions.
- **Raised Navy** (`navy-raised`): service cards, contact band and media containers.
- **Cool Light** (`light`): main text on navy surfaces.
- **Quiet Blue Grey** (`secondary`): supporting text on dark regions.
- **Navy Divider** (`divider`): dark-surface borders and rules.
- **Warm White** (`warm-white`): explanatory and reading regions.
- **Reading Slate** (`light-muted`): supporting text on warm-white.
- **Reading Divider** (`light-divider`): light-region borders and rules.

**The Reading Surface Rule.** Warm-white reading regions switch text, dividers and focus to their light-surface assignments together.

## Typography

**Display Font:** Albert Sans, with DejaVu Sans and sans-serif fallbacks.
**Body Font:** the same family, self-hosted from the variable TrueType asset with a normal weight range (100–900) and `font-display: swap`. The font is distributed under SIL OFL; the project includes its license.

**Character:** direct, open and composed. Medium headings use tight tracking; body copy stays regular and spacious. There is no separate mono or decorative display family.

### Hierarchy
- **Display:** the frontmatter `display` role is the home heading. Interior page heroes use the observed related scale (`clamp(2.6rem, 6vw, 5.5rem)`), retaining the display weight, leading and tracking.
- **Headline:** the `headline` role leads sections; a few explanatory third-level headings intentionally take this size.
- **Title:** the `title` role leads ordinary cards and content subsections. Pilot-list titles use a fixed smaller size (1.5rem); the featured service uses a larger scale (`clamp(2.5rem, 4.2vw, 4rem)`, then 3rem below 760px).
- **Body:** the `body` role uses regular weight and relaxed leading. Default paragraphs cap at 65ch; privacy prose uses 70ch. Local explanatory measures often narrow to 30–48ch.
- **Lead:** the `lead` role distinguishes introductory and section-support copy.
- **Label:** the `label` role supports captions, footer detail and small component links. Labels remain sentence case.
- **Button / Navigation:** the frontmatter records their actual interface roles separately from body copy.

**The One Family Rule.** Use Albert Sans for display, body and interface text; hierarchy comes from scale, weight and spacing.

## Layout

The centered container has a maximum outer width (1408px), including horizontal gutters. Gutters step from desktop (64px) to tablet (32px at 1000px and below), then phone (24px at 600px and below). Repeated two-column layouts use equal flexible tracks with a desktop column gap (64px), narrowing to 40px and 24px at those same breakpoints.

Large section padding steps from desktop (128px) to tablet (96px at 1000px and below), then phone (72px at 600px and below). The frontmatter spacing scale supplies component and content gaps. The home hero starts with a broad statement, followed by intro/actions and a small demonstration preview; this composition is a home-surface pattern rather than a mandatory layout for every page.

At 760px and below, content pairs, service cards and media descriptions stack, the contact band becomes a column, and the desktop navigation gives way to a Menu button. At 420px and below, hero actions and footer details stack further, and cards use the smaller established padding (24px). The footer uses three columns on desktop and two at 1000px and below, with email moving to its own row.

## Elevation & Depth

Depth comes from surface tone, clipping, spacing and one-pixel dividers. There are no box shadows in the current stylesheets. Cards sit on raised navy; warm-white regions separate explanation from the surrounding identity surface. Hover primarily changes color or underline rather than lifting geometry.

**The Tonal Depth Rule.** Use the raised navy surface and fine dividers for depth; the current system has no box shadows.

## Shapes

Buttons and small preview images use the compact `button` radius; cards and full demo/media wrappers use the softer `card` radius. These are the two recurring corner treatments. Borders are thin (1px), with no pill-shaped control system. The open O and continuation stroke remain the distinctive vector silhouette; their round caps belong to the identity mark.

## Components

### Buttons

Confident rectangular actions with restrained corners. Primary buttons use mint over navy text, an accent-colored border, the frontmatter padding and minimum height (52px). Content is centered in an inline flex row with the small spacing step between icon and text. Hover and pressed colors use the named mint variants. Background transitions use the micro duration (140ms). Visible focus uses a solid outline (3px) with an offset (5px), mint on dark regions and navy on warm-white.

### Text Links

Quiet but visibly actionable. The recurring text link is underlined, medium weight (500), and has a minimum target height (44px). Its underline begins in the surface divider color and changes to the text color on hover. It inherits the current region's text color rather than keeping a fixed dark-surface color.

### Cards / Containers

Raised navy, light headings and quieter supporting text. Service cards use the `card` radius and a vertical flex layout; the main padding is the extra-large spacing step. Secondary desktop cards use smaller vertical padding (24px) while retaining the wider horizontal padding (40px). Link labels sit toward the bottom and reveal their mint underline on hover. There is no card shadow or hover lift. All linked cards receive the shared visible focus outline.

### Navigation

Inline, sentence-case navigation with the frontmatter navigation type. Desktop links use wide spacing (40px, then 24px below 1000px), turn mint on hover and underline the current page in mint. The contact link has a thin navy divider border, compact button corners and the primary button's padding, but retains the header background. On mobile, the labeled toggle opens an absolutely positioned navy menu; Escape closes it and returns focus to the toggle. The animation of its two lines uses the short duration (240ms).

### Identity and Media

The wordmark pairs the mint open O with light text. Its desktop lettering is slightly heavier (650), compactly tracked (-.035em) and larger than navigation (1.9rem); the mark is 40px square. At the mobile navigation breakpoint, these reduce to 1.65rem and 34px respectively. Preserve the existing SVG geometry.

Demo thumbnails and full previews use genuine demo imagery. Full media wrappers clip to the card radius; the video uses native controls and a widescreen ratio (16:9). The home preview uses a wider crop (16:8) and a mint action inset at the lower left, switching to a contained image (16:11) on mobile.

The only entrance animation moves the home heading vertically (12px to 0) over the long duration (600ms) with the established ease-out curve. The reduced-motion preference removes animations and transitions and disables smooth scrolling. Source-derived component previews and motion values live in `.impeccable/design.json`; its generated tonal ramps are previews, not an expanded production palette.

## Do's and Don'ts

### Do:
- **Do** use the established navy, mint and warm-white surface roles.
- **Do** keep explanations at the observed paragraph measures and allow headings to scale fluidly.
- **Do** keep text links visibly underlined and preserve a visible keyboard focus outline.
- **Do** retain the original open O mark and genuine demo imagery.
- **Do** preserve native video controls and the reduced-motion override.

### Don't:
- **Don't** add decorative gradients or shadow effects to the current flat surface system.
- **Don't** replace the project font or recolor the approved identity.
- **Don't** treat illustrative tonal ramps in the sidecar as additional implemented color tokens.
- **Don't** introduce fabricated customer proof or results into visual components.
