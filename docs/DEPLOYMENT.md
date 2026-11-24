# Launch Orvanta on Cloudflare Pages Free

Cloudflare Pages is the initial host. Keep the free plan and use the included `pages.dev` address; no purchase or custom domain is needed. Neon remains a later database for private enquiry storage and automation. It is not a launch dependency.

This is the existing Next.js website, not a replacement site. The configuration already uses `output: "export"`, trailing-slash routes and unoptimized local images. `npm run build` runs `next build` and generates static files in `out/`. No adapter, Worker, Pages Function, server process or database is needed.

Official references: [Cloudflare's static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/), [build runtime selection](https://developers.cloudflare.com/pages/configuration/build-image/).

## Exact build settings

| Dashboard setting | Value |
| --- | --- |
| Product | **Pages**, with Git integration |
| Plan | Free |
| Git repository | `sopskistar/Orvanta` |
| Production branch | `main` |
| Framework preset | **Next.js (Static HTML Export)** |
| Build command | **`npm run build`** |
| Build output directory | **`out`** |
| Root directory | Leave blank — repository root |
| Node version | **24**, selected by committed `.node-version` |
| Dependency installation | Leave automatic npm installation enabled; the repository includes `package-lock.json` |
| Deploy command / Worker entry point | None — use the Pages workflow |

Do not select the server-rendered Next.js preset, `@cloudflare/next-on-pages`, OpenNext or a Workers deployment. Do not run `next export` (the export is produced by `next build`). Do not use `.next`, `public` or `dist` as the output. `npm start` is only the local export-preview server.

If the dashboard requests a Wrangler deploy command, you are in the Workers flow: return and choose Pages. There is no Wrangler configuration to install for this launch.

## Environment variables

**Required user-entered environment variables for the first deployment: none. No secrets are needed.**

| Variable | Source / purpose |
| --- | --- |
| `CF_PAGES=1` | Automatically supplied by Pages; the app uses it to name Cloudflare Pages in Privacy. Do not add this manually. |
| `CF_PAGES_URL` | Automatically supplied by Pages; the app uses this actual deployment URL for initial canonical, sitemap and social-image URLs. Do not invent it. |
| `NODE_VERSION=24` | Optional dashboard override if you prefer; `.node-version` already selects 24. |
| `NEXT_PUBLIC_SITE_URL` | Recommended **after first deploy**: the exact stable `https://<actual-project>.pages.dev` origin Pages gives you. Then redeploy. |
| `NEXT_PUBLIC_HOSTING_PROVIDER=cloudflare` | Optional explicit override; automatic Pages detection already provides this disclosure. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional; leave unset to keep `julianahonour@gmail.com`. |

`CF_PAGES_URL` is specific to each deployment. Once you know the permanent project `pages.dev` URL, set `NEXT_PUBLIC_SITE_URL` to that origin in **Production** build variables, so canonical and sharing URLs stay stable across later deployments. If you use preview builds, give them the same production origin when you want their canonical URLs to point to production. Remove any copied Vercel hostname or old `NEXT_PUBLIC_SITE_URL` value from Pages settings.

Public build-variable changes take effect only after another build/deployment. The `.env.example` file documents these values; real `.env` files must remain private. Do not add `DATABASE_URL`, Neon credentials, Retell keys, Resend keys, Calendly settings or a Cloudflare API token to publish this marketing site.

## Exact dashboard steps

1. Sign in to your free Cloudflare account. Open **Workers & Pages → Create application → Pages → Import an existing Git repository** (some dashboard versions say **Connect to Git**).
2. Connect GitHub and allow access to **sopskistar/Orvanta**. Select that repository and **Begin setup**. Use an existing Pages project for this repository if you already created one.
3. Choose a project name available to you. This determines the included stable `pages.dev` address. Do not assume the name “orvanta” is available until Cloudflare confirms it.
4. Set production branch `main`, framework **Next.js (Static HTML Export)**, build command `npm run build`, output `out`, and leave root directory blank. Use the current build image and Node 24 from `.node-version`. Keep automatic dependency installation enabled.
5. Leave integration/storage bindings empty. No custom domain or secret is needed. Choose **Save and Deploy**.
6. Wait for the deployment to succeed. Open the actual URL returned by Pages. Copy the stable project URL from the project's domain/overview, not just the unique hash-prefixed deployment URL.
7. In the project's **Settings → Variables and Secrets** (or **Environment variables**, depending on the dashboard), add the stable HTTPS origin as `NEXT_PUBLIC_SITE_URL` for **Production** builds. Redeploy/retry the latest production deployment to bake that value into metadata. No trailing page path is needed.
8. Open the stable public URL in an incognito/private browser while signed out. It must be accessible without Cloudflare Access or an account login. Verify the checklist below, then send the home-page URL to Retell support.

Future pushes to `main` trigger production deployments after the Git integration is connected. This repository being pushed does not itself prove the Cloudflare project is connected or the site is published. A completed deployment and a verified public URL establish publication. No Cloudflare account connection or purchase was performed by this repository preparation.

## Verify the public launch

- Open `/`, `/services/`, `/demo/`, `/contact/` and `/privacy/` on desktop and phone. Follow the menu and footer links.
- Confirm the approved navy/mint identity and **Mia — cleaning enquiry demo** heading. No testimonial heading or empty section should appear with the current empty list.
- Press Play yourself; check picture and sound, pause, seek near the end and fullscreen. The supplied unchanged video is approximately 1:57 and does not autoplay. If needed, open `/demo/Orvanta_Receptionist_Demo.mp4` directly.
- On Contact, click **Email Orvanta** and confirm `julianahonour@gmail.com`. If no default mail application is configured, copy the address into your email service. Checking the link is not proof of external email delivery.
- Check Privacy names Cloudflare Pages. The website still does not submit visitor enquiry data to Retell, Neon, Resend or Calendly.
- Open `/sitemap.xml` and `/robots.txt`. After setting the stable origin and redeploying, they should reference that real project URL. Check the social image at `/brand/social-preview.png` and favicon at `/favicon.svg`.
- Refresh a nested page such as `/services/`. Open a nonexistent path and confirm the custom 404, rather than a duplicate home page. Pages supports the exported nested `index.html` routes and root `404.html` directly; no catch-all SPA rewrite is needed. [Pages routing documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/).

The supplied video is 4,372,102 bytes (about 4.2 MiB), below Pages' 25 MiB per-asset limit. Keep within the free plan's limits; no R2 storage purchase is needed for this file. [Pages free-plan limits](https://developers.cloudflare.com/pages/platform/limits/).

## Keep later integrations separate

Use `docs/TESTIMONIALS.md` for a genuine approved review and `docs/AUTOMATION.md` for future Retell → Neon → transactional email work. A static export cannot accept POST webhooks or provide a private admin backend. Those require a separate, reviewed server integration later. They must not block this marketing launch or be described as operational now.
