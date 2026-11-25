# Orvanta on Cloudflare Pages

The production website address is **https://getorvanta.xyz**. The existing Cloudflare Pages project is `orvanta`, with included hostname `orvanta-246.pages.dev`. This remains a Next.js static export; no Worker, server adapter, Pages Function or database is required.

## Production URL configuration

`src/lib/business.ts` defaults the central public origin to `https://getorvanta.xyz`. All five page canonical URLs, Open Graph page/image URLs, Twitter images, sitemap entries and robots host/sitemap references use it. Local Wrangler exports and Cloudflare builds share that default. Deployment-specific `CF_PAGES_URL` and legacy Vercel hostnames no longer select the origin.

`NEXT_PUBLIC_SITE_URL` remains an optional explicit build-time override. Remove obsolete values from local `.env*` files and Cloudflare build variables, or set it to `https://getorvanta.xyz`. Source defaults do not override an explicit environment value. Read-only Cloudflare inspection on 24 November 2026 found no `NEXT_PUBLIC_SITE_URL` override in production or preview settings. `.env.example` documents the configuration; do not commit secrets or actual `.env` files.

Cloudflare Pages is the default host named in Privacy, including locally built exports. The contact address stays `julianahonour@gmail.com`.

## Build and export

Use Node 24 from `.node-version`, with dependencies from `package-lock.json`:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:config
npm run test:testimonials
npm run build
```

`npm run build` produces `out/` through `output: "export"`. Keep trailing-slash routes, unoptimized local images and root `404.html`. Do not run `next export`, upload `.next`, or add a catch-all SPA rewrite. `npm start` previews the export locally.

The approved final edited video is `public/demo/Orvanta_Receptionist_Demo_62049c7b.mp4`, copied into `out/demo/`, with the matching `poster-62049c7b.jpg`. It is about 3.24 MiB, below Pages’ 25 MiB per-file limit. The source edit and raw/private verification files remain under Git-ignored `artifacts/`.

## GitHub automatic deployment status

Read-only inspection of the existing Cloudflare project on 24 November 2026 verified:

- Source: GitHub repository `sopskistar/Orvanta`, production branch `main`.
- `deployments_enabled: true` and `production_deployments_enabled: true`.
- Dashboard build command: `npx next build`; output directory: `out`; root: repository root. The dashboard command runs the same Next.js build as `npm run build`.
- Recent Cloudflare deployments cloned the repository, built and deployed successfully. Their trigger type is `ad_hoc`, so they do not establish that a new Git push triggered deployment.
- Latest prior deployment `a6bdf437-d7c0-40fd-b27f-61611857ba76` succeeded on 24 November 2026 at 13:45 UTC for commit `b8ca2b6193b55a320ee0ce0e1f322e9e516c7931`, consistent with the supplied Wrangler history.
- GitHub’s latest “Website checks” run for that commit passed: [run evidence](https://github.com/sopskistar/Orvanta/actions/runs/45396918262). `.github/workflows/checks.yml` validates/builds and contains no deployment step.

**Automatic Cloudflare deployments are configured and enabled.** A future push to `main` should trigger a production build. A fresh push-triggered deployment of this update has not been tested: this update is prepared locally, not pushed or deployed. After pushing, inspect Cloudflare’s deployment for the new commit and wait for success. If it does not trigger, inspect the Cloudflare GitHub app’s repository access and project branch/build controls. Green GitHub checks alone are not proof of publication.

Wrangler remains a valid manual fallback for this Git-integrated project:

```bash
npx wrangler pages deploy out --project-name=orvanta --branch=main
```

Rebuild immediately before uploading. A manual upload does not commit or push source. Record the returned deployment URL/ID and verify the public pages before calling it published. No Cloudflare settings were changed by this update.

Official references: [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Direct Upload and Wrangler](https://developers.cloudflare.com/pages/get-started/direct-upload/), [static Next.js deployment](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).

## Domain status and verification

Cloudflare’s project domain list includes `getorvanta.xyz`. That attachment is not evidence of active DNS or a working certificate. During this update, HTTPS could not resolve the hostname, and a public Cloudflare DNS-over-HTTPS A-record query returned no answer. Domain activation is **not verified**.

In the existing Pages project’s Custom domains view, inspect the exact DNS record Cloudflare requests for `getorvanta.xyz` and its validation state. For this apex domain, use Cloudflare’s instructed record/flattening workflow rather than guessing an IP address. See [Cloudflare custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/). No DNS, domain or certificate setting was changed here.

After activation and deployment, verify:

- HTTPS opens `/`, `/services/`, `/demo/`, `/contact/` and `/privacy/` at `https://getorvanta.xyz` without signing in.
- The new copy is present; view-source canonical/Open Graph/Twitter URLs use that origin.
- `/sitemap.xml` lists all five routes; `/robots.txt` references the production host and sitemap.
- Demo heading/copy, playback/seeking and `julianahonour@gmail.com` remain correct.
- Four service scenarios are visible and labelled illustrative; genuine testimonials appear only after approval.
- Refreshing nested routes works; an unknown URL returns the custom 404.

Public access, external email receipt, live telephone service and appointment integrations are separate from export verification. This update does not establish those capabilities.
