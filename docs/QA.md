# Production-domain update verification

This is the historical 24 November 2026 launch snapshot. For the subsequently deployed final MP4, current media URLs and 220 successful production browser checks, see [the final demo update](DEMO-UPDATE.md). The enquiry/email and optional calendar extension have separate verification records in the Worker documentation.

Verified locally on 24 November 2026 against the production static export. This update has not been pushed or deployed. The existing Pages project was inspected read-only; no hosting, DNS or domain settings were changed.

## Checks completed

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:config`: passed. Covers the production default, Pages preview/legacy Vercel isolation, explicit-origin override, per-page sharing metadata, credential-free builds and invalid URL protocols.
- `npm run test:testimonials`: passed. Covers the visible labelled fallback, approval/completeness filtering, ratings/results, invalid ratings, semantic reviews, escaping and optional attribution.
- `npm run build`: passed on Next.js 16.4.6 with Node 24.22.2; 70 static files exported into `out/`.
- `npm run qa`: **205 checks passed**, 15 page captures, 15 distinct link targets, zero page-runtime errors. Local evidence: ignored `artifacts/qa/report.json` and screenshots. Playwright and Chromium were reused from the existing workstation installation; no dependencies were added.
- Export inspection verified each of the five routes has its exact `https://getorvanta.xyz` canonical/Open Graph URL and absolute Open Graph/Twitter image URL. Sitemap contains all five production routes; robots advertises the production host and sitemap.
- Every exported asset is below Pages’ 25 MiB per-file limit. Static trailing-slash routes and root `404.html` remain available.
- `git diff --check`: passed.

Native Node reports an informational module-type detection warning for the existing TypeScript test fixture import; it did not fail the browser suite. Browser/server execution required sandbox escalation; no build checks were bypassed.

## Visual and interaction inspection

Captured the prior export at desktop 1440 × 1000, tablet 768 × 1024 and phone 375 × 812 into ignored `artifacts/qa-before/`. Inspected current desktop/mobile/tablet captures against the preserved identity. The original palette, Albert Sans, branding, hero, service cards and demo treatment remain intact. The four-step “How Orvanta works” and visible service-scenario section use the existing typography, surfaces and responsive grid.

The browser suite checks all five pages, one h1 per page, loaded images, canonical/sharing metadata, menus, Escape/focus handling, skip link, reduced motion, contact mailto, all internal links, 404 behavior and no-JavaScript navigation. Additional 320/390/600/1024/1920 widths have no horizontal overflow. The existing authored contrast pairs still pass 4.5:1. This is not a complete accessibility certification; physical-device, screen-reader and other browser engines were not tested.

## Demo and contact preserved

`src/app/demo/page.tsx`, `src/components/demo-player.tsx`, the demo title/description, poster and MP4 are unchanged. Source and exported MP4 have identical SHA-256:

```text
ba96e2b875704ed07448a0cf5947c21d5cbbd277da5d3e55e860e89408ffcdc0
```

Browser checks verified native controls, metadata preload, inline playback, no autoplay, decoded playback, seeking to 85 seconds, HTTP byte ranges and recovery after deliberately aborting the source request. Contact links still target `julianahonour@gmail.com`. No email was sent and no live telephone call was initiated; external email delivery and live integrations are not established by these checks. Actual audio output was not manually reviewed again.

## Customer feedback limitation

No genuine customer quotes, names, ratings or completed results were supplied or found. The component now remains visible with four clearly labelled illustrative service scenarios, rather than publishing invented customer proof. Approved review support includes optional genuine star ratings and outcome statements. Synthetic QA reviews remain local to the development harness and are absent from production HTML. See [TESTIMONIALS.md](TESTIMONIALS.md).

## Deployment and domain evidence

The existing Cloudflare Pages project `orvanta` is connected to GitHub `sopskistar/Orvanta`; automatic production deployments for `main` are enabled. Its current build command is `npx next build` and output directory is `out`. Production and preview have no explicit `NEXT_PUBLIC_SITE_URL` setting. Recent repository clone/build/deploy stages succeeded, but their trigger type is `ad_hoc`; a new push-triggered deployment was not tested. GitHub’s latest existing Website checks run succeeded and contains no deployment step.

The project lists `getorvanta.xyz` as attached, but an HTTPS request could not resolve it. Cloudflare’s public DNS-over-HTTPS A-record query returned status 0 with no answer records. This does not verify DNS/certificate activation. No claim is made that the new copy is live at that address. [DEPLOYMENT.md](DEPLOYMENT.md) records the checked settings and the existing Wrangler fallback.

The source-default change makes local Wrangler exports and Cloudflare builds consistently point search/sharing metadata at `https://getorvanta.xyz`. That configuration does not activate DNS.

## Existing design-tool metadata

Impeccable reported an older generated design sidecar and no recorded build-path preference. Those pre-existing tool records were left outside this scoped content/metadata update; the implemented DESIGN.md and existing code remain the visual authority. Its `document` workflow can refresh the sidecar separately if requested.
