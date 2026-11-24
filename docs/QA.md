# Launch verification

Cloudflare Pages preparation verified locally on 24 November 2026. This is repository verification, not evidence of a published Cloudflare deployment. Cloudflare Pages Free is the intended initial host; Neon remains only for later enquiry storage.

## Completed checks

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:config`: **3 tests passed** for automatic Pages URLs/host disclosure, stable-origin precedence and credential-free local configuration.
- `npm run test:testimonials`: **4 tests passed**. Verified empty launch data produces no markup; unapproved/incomplete reviews stay hidden; approved review markup is semantic; review text is escaped and optional attribution stays optional.
- `npm run build`: passed on Next.js 16.4.6, React 19.3.1, TypeScript 5.9.3 and Node 24.22.2. Home, Services, Demo, Contact, Privacy, robots, sitemap and custom 404 export into `out/`.
- Browser QA against that production export: **154 checks passed**, zero page-runtime errors, 15 page captures and 15 distinct link targets. Evidence: local ignored `artifacts/qa/report.json` and screenshots.
- `git diff --check`: passed. A credential-pattern scan of the intended text source/docs found no matches; Git ignores actual environment files, original Windows download, zone metadata, generated builds, dependency directories and QA captures.

Next.js needs child-process access for its real TypeScript inspection, so the production checks were run outside the execution sandbox. No build/type error bypass is configured. Native Node tests emit an informational module-detection warning for the TypeScript data module; all four tests pass. No additional runtime or browser packages were installed for this update.

## Browser and visual inspection

Used the already installed Playwright/Chromium. Captured and visually inspected desktop 1440 × 1000, tablet 768 × 1024 and phone 375 × 812, including the updated Home and Demo pages. The approved layout, palette, typography, wordmark and video remain intact. Other required pages, navigation, mailto contact, images, skip link, focus and reduced motion were checked. Additional 320/390/600/1024/1920 widths have no horizontal overflow.

The public heading is **Mia — cleaning enquiry demo**. The specified explanatory disclaimers and other fictional-business prose are absent from rendered public pages. No paying-customer, live-phone, email-delivery or booking claim was added. Underlying demo facts remain in internal product/brand records so later edits do not turn the demonstration into false customer proof.

Native video checks cover controls, metadata preload, inline playback, no autoplay, decoded playback, seeking to 85 seconds, byte ranges and recovery after a deliberately aborted source request. No live Retell call or email is triggered. The contact link targets the supplied Gmail address; external email receipt is not established by checking a mailto URL.

The home-page testimonial section has no DOM/heading/spacing while launch data is empty. A separate local-only HTML harness renders explicitly synthetic data to check the component's two-column desktop/tablet layout and single-column phone layout. Those captures are marked synthetic, stored in ignored `artifacts/qa/`, and never exposed through a website route. No synthetic review text is present in production HTML. The production data array stays empty. See `docs/TESTIMONIALS.md` for adding a real review with permission.

Physical-device, other-browser-engine and screen-reader testing were not performed. Closed captions were not supplied or invented. Public-host access, actual sound on the visitor's device and email receipt remain part of the Cloudflare Pages dashboard/public verification checklist.

## Prior design checks — interface preserved

The following design-review results come from the preceding interface update. This hosting change does not edit the layout, styling, brand assets, demo copy or testimonial data. Fresh production-export screenshots were inspected as described above; no redesign or redundant design audit was introduced.

- Hallmark static and rendered audit: **0 FAIL, 0 REFLEX, 7 WARN**. Five extra captures cover 1280/1440/1920 folds plus full desktop/phone pages.
- The warnings concern existing short introductory measures, a headline max-width interpreted as another container, the approved headline/supporting-copy lengths and a 91-word screen window. Inspected renders remain readable; these are reported warnings, not a claimed warning-free result.
- Impeccable's source detector returned **8 advisory findings**, all concerning pre-existing literal font sizes versus the documented type ramp. No new testimonial component finding or non-advisory finding was reported. The approved typography was preserved rather than changed to silence those advisories.
- The original launch received an independent finishing-review `ship` verdict. The separate scoped visual reviewer returned **`disposition: ship`** with no material fixes after inspecting updated Home/Demo and local-only testimonial captures.

## Contrast and media integrity

The unchanged authored colour pairs were checked numerically. The minimum normal-text pair is website secondary text on warm white, **7.04:1**. Navy on mint is **11.38:1**, hover **13.60:1**, pressed **9.31:1**. Fine dividers are decorative, never text. The new testimonial component inherits these existing roles. This is not a claim of comprehensive WCAG certification.

The supplied MP4 and intended public copy have identical SHA-256:

```text
ba96e2b875704ed07448a0cf5947c21d5cbbd277da5d3e55e860e89408ffcdc0
```

FFprobe reports 1920 × 1080 H.264, 30 fps, AAC audio, 117.121333 seconds and 4,372,102 bytes. No video, voice, font, colour, overlay or edit was changed. The original title-frame poster is preserved. No full-length human audio/sync review was repeated for this website-copy update.

## Upload and deployment boundary

Only the reviewed implementation, public brand/video/font assets, documentation and checks are intended for GitHub. No secrets, real `.env` files, identity documents, raw recordings, account screenshots, dependency trees or local QA fixtures are in the intended commit. `.env.example` contains descriptions/public settings only.

A successful Git push is not a website publication. The remaining Cloudflare Pages steps are in `docs/DEPLOYMENT.md`: connect the repository, use Next.js (Static HTML Export), build with `npm run build`, publish `out`, then open the returned stable `pages.dev` URL in a private browser. The committed `.node-version` selects 24, and Pages supplies `CF_PAGES`/`CF_PAGES_URL`; no user-entered variables or secrets are required for the first deploy. Set `NEXT_PUBLIC_SITE_URL` to the actual stable project origin afterward and redeploy. No paid plan, database, custom domain, Calendly or email automation was created.

## Cloudflare-specific export evidence

Ran `CF_PAGES=1 CF_PAGES_URL=https://cloudflare-export-check.invalid npm run build`. The `.invalid` origin is a synthetic local-only check, not a public URL or an environment value to copy into Pages. The output contains 70 static files, including all five pages, root `404.html`, sitemap and robots. Exported canonical/social URLs used the supplied Pages build origin and Privacy named Cloudflare Pages. The stable explicit origin takes priority, as the configuration tests verify.

Every exported asset is under the Pages 25 MiB limit and the file count is under its free-plan limit. The exported MP4 is byte-identical to the intended public source. No `_worker.js`, POST endpoint, server adapter or database binding is needed. Browser QA ran against these exported files using the local static preview; Cloudflare's actual remote routing/CDN and public access still need the deployment checklist.
