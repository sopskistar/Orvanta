# Customer reviews and service scenarios

The home-page component in `src/components/testimonials.tsx` always displays a useful section. When no approved reviews exist, it displays four service examples from `src/content/testimonials.ts` under “Enquiry capture in practice.” The heading is accompanied by “Illustrative service scenarios, not customer testimonials or measured results.” The examples explain after-hours capture, unanswered calls, appointment requests and quote follow-up, without invented names, star ratings or measured outcomes.

No customer feedback or results were supplied for the current update. The `testimonials` array remains empty. Add genuine, complete, approved reviews to that array and the component automatically switches to “In our clients’ words.” Verify the quotation, attribution, outcome and rating with the client and obtain publication permission before setting `approved: true`. Keep consent correspondence and private draft reviews outside this public repository.

| Field | Content |
| --- | --- |
| `id` | Unique stable identifier, not an email address |
| `quote` | Exact approved quotation |
| `author` | Approved public name |
| `role` | Optional verified role/business type |
| `company` | Optional approved company attribution |
| `rating` | Optional customer-supplied integer from 1 to 5; omit if none was supplied |
| `result` | Optional verified, approved outcome statement |
| `approved` | `true` only after verification and publication permission |

Incomplete, unapproved or invalidly rated entries cannot render as reviews. React escapes names and review text. No aggregate rating or review schema is fabricated. The existing palette, Albert Sans and two-column desktop / single-column mobile grid are preserved. Ratings have accessible labels and authored SVG stars.

Run `npm run test:testimonials`, `npm run lint`, `npm run typecheck`, and `npm run build`, then check desktop/mobile. Adding or withdrawing a review requires rebuilding and deploying. To withdraw one, remove it or set `approved: false` and redeploy.

The development-only synthetic review fixture is never imported by website routes or included in production data. Browser QA checks that it is absent from the export.
