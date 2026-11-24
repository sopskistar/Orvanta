# Orvanta

Professional launch website for custom AI receptionist setup for cleaning companies, business websites and connected enquiry workflows.

Built with Next.js App Router, TypeScript and React. The launch is a static export: no database, API keys or paid service is required to run it.

## Current truth

- **Included:** Home, Services, Demo, Contact, Privacy, custom 404, original vector branding, social graphics, icons, metadata, sitemap and robots.
- **Demo:** the supplied edited MP4 is copied unchanged to `public/demo/Orvanta_Receptionist_Demo.mp4`. One native player with controls, metadata preload, inline playback and no autoplay. The public heading is “Mia — cleaning enquiry demo”.
- **Contact:** email links to `julianahonour@gmail.com`. There is no website submission form or automatic email service.
- **Pending:** Retell telephone account verification, automatic enquiry emails and real booking. No connected webhook, database, CRM, calendar or admin view is exposed.
- **Deployment:** Vercel is the intended host; Neon is intended for later enquiry storage only. Prepared and tested locally; this repository is not evidence of a public deployment. Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Run on Ubuntu / WSL

Use Node.js 22 or 24 LTS and npm. In Ubuntu Terminal:

```bash
cd ~/projects/Orvanta
npm ci
npm run dev
```

Open `http://localhost:3000` in your Windows browser. Keep the terminal open. Stop the server with Ctrl+C.

For the production export:

```bash
npm run lint
npm run typecheck
npm run test:testimonials
npm run build
npm start
```

The production output is `out/`. Keep Vercel’s Next.js Output Directory override off; its framework integration handles the export. `npm start` serves it locally, including video byte-range requests and the custom 404. It is a local preview server, not a hosting service. If port 3000 is occupied, stop the other server or use `PORT=3001 npm start`.

## Settings

Edit `src/lib/business.ts` for the default business email, description and demo paths. Optional public build settings are documented in `.env.example`. For local overrides, copy that file to `.env.local` and enter actual values. Never commit `.env.local` or credentials.

Set `NEXT_PUBLIC_SITE_URL` to the actual public HTTPS origin after first deployment, then redeploy. This enables correct absolute social-image URLs, canonical URLs and sitemap entries. Vercel's production system hostname is also detected automatically. Without a known public URL the local build deliberately omits those URLs rather than inventing a domain.

## Documentation

- [Exact deployment steps and launch checklist](docs/DEPLOYMENT.md)
- [Brand assets, fonts and usage](docs/BRAND.md)
- [References actually inspected](docs/DESIGN-REFERENCES.md)
- [Verification evidence and limits](docs/QA.md)
- [Add a genuine testimonial](docs/TESTIMONIALS.md)
- [Later automation implementation checklist](docs/AUTOMATION.md)
- [Product truth](PRODUCT.md) and [design system](DESIGN.md)

## Browser QA and asset tooling

The project reuses existing Playwright and font tooling on this workstation rather than installing duplicate browser packages. They are development tools, not website dependencies. Point `PLAYWRIGHT_MODULE_PATH` at an existing Playwright package directory, start `npm start` in a second terminal, and run:

```bash
PLAYWRIGHT_MODULE_PATH=/home/sopski/modelswitch-lab/node_modules/playwright npm run qa
```

If you do not have an existing Playwright installation on another machine, install it there as a development dependency (`npm install -D playwright`), install Chromium with `npx playwright install chromium`, then `npm run qa`. This is optional for deployment. QA writes local screenshots and `artifacts/qa/report.json`; it sends no email and never starts a live Retell call.

Brand exports are already committed as static assets. To reproduce them with the existing font tool on this workstation:

```bash
FONTKIT_MODULE_PATH=/home/sopski/projects/returntail/node_modules/fontkit/dist/node/index.js npm run brand:export
```

On a machine without that tool, install `fontkit` as a dev dependency before exporting. Do not regenerate or re-edit the approved video to update the website. The root Windows download and its Zone.Identifier are ignored; only the intended public copy is deployed.
