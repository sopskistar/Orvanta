# Add a genuine testimonial later

The data file is `src/content/testimonials.ts`. It starts with an empty list. The home page's entire testimonial section returns no markup when no complete, approved reviews exist: no heading, space, placeholder, rating or logo is shown.

Before adding a review, verify that it comes from a real client, confirm the exact quotation and attribution, and get permission to publish them. Keep consent correspondence and other private records outside this public repository. No claim should exceed the work the client actually experienced.

Add an object to the `testimonials` array using these fields:

| Field | What to enter |
| --- | --- |
| `id` | A unique stable identifier for this review, not an email address. |
| `quote` | The genuine, approved wording. |
| `author` | The person's approved public attribution. |
| `role` | Optional verified public role; omit if not agreed. |
| `company` | Optional verified company attribution; omit if not agreed. |
| `approved` | `false` while drafting; `true` only when the review and publication permission are verified. |

No example quote or invented person is pre-populated. An entry must have `approved: true` and nonblank id, quote and author to render. Unapproved entries are never passed to the public client interface; this component runs at build time. **Do not commit confidential draft reviews** even with `approved: false`: this is a public repository.

Run `npm run test:testimonials`, `npm run lint`, `npm run typecheck`, and `npm run build`, then check desktop and mobile before committing and pushing. Because this is a static site, adding, approving or removing a review requires a deployment. To withdraw one, remove it or set `approved: false`, then redeploy.

The presentation inherits Orvanta's existing warm-white reading surface, Albert Sans, navy type and spacing tokens. One review spans the available width; multiple reviews use two columns on desktop and one on mobile. There is no carousel, automatic animation, stars, invented results or customer-logo field.

The test suite uses explicitly synthetic fixtures in a local test harness only. They are never added to the production data file or exposed through a website route.
