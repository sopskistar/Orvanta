# Sample Home Cleaning demo bookings

**Implemented for private setup and testing; not operational yet.** The final website video is separately deployed. The existing enquiry-to-email Worker remains the working service until this extension is configured, deployed and tested against actual calendar events and the test inbox.

## Inspection and architecture

Retell's live integration inventory was inspected first: no calendar connections existed, and published Mia version 5 had only `end_call`. The current official calendar catalog supports Google Calendar, Cal.com and Calendly. The implementation uses signed Retell custom functions calling the existing Cloudflare Worker and a separate Google calendar. A server-side calendar adapter adds durable slot claims, exact offer confirmation and deterministic Google event IDs; Retell holds no Google credential. No Make scenario, paid upgrade or new runtime SDK is needed. The existing AI-first greeting and nine extraction fields remain protected.

Callbacks and cleaning visits are separate booking types. Defaults are 15 minutes for a callback and 120 minutes for a cleaning visit, Monday–Friday 09:00–17:00 in `America/Chicago`, with 30 minutes' notice and a 90-day booking horizon. Durations are configurable in 15-minute increments up to four hours. Both types share the dedicated demo calendar's capacity and cannot overlap. These are fictional demonstration appointments, not a guarantee of real cleaning services or prices.

## Private Google setup

1. In Google Calendar on the web, create a separate calendar named **Sample Home Cleaning Demo** and set its time zone to **America/Chicago**. Use its secondary calendar ID from Settings → Integrate calendar; `primary` is rejected. Save that ID privately as `GOOGLE_CALENDAR_ID` in this package's `.env.local`.
2. In Google Cloud Console, create or select a project, keep the **Standard Tier**, and enable **Google Calendar API**. Create a service account under IAM & Admin → Service Accounts. No project role, domain-wide delegation, billing account, Scaled Tier or paid upgrade is required for this shared demo-calendar setup. Do not enable paid quota increases.
3. Create a JSON key for that service account and save it locally as `workers/retell-email/.private/google-service-account.json`. This directory is Git-ignored. Never paste the key into chat, a shell argument, a Retell prompt or a public environment variable.
4. From that private JSON file, use the `client_email` locally to share **only the demo calendar** with the service account, granting **Make changes to events**. Do not share your personal calendar. The downloaded key's `private_key` stays private.
5. From this package directory run:

```bash
npm run config:bookings
npm run config:calendar-key -- .private/google-service-account.json
```

Initialization appends missing entries only and preserves existing values, including the working delivery flag and processing token. Key import refuses to overwrite an already configured credential. Local files use mode 600 and the private directory mode 700.

Exact variables added to `.env.example`:

| Variable | Private value or setting |
| --- | --- |
| `BOOKING_ENABLED` | Keep `false` until configuration, migrations and checks are ready. |
| `GOOGLE_CALENDAR_ID` | Secondary demo calendar ID ending in `@group.calendar.google.com`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Set privately by the import command; never print or commit it. |
| `BOOKING_TIMEZONE` | `America/Chicago`. |
| `CALLBACK_DURATION_MINUTES` | `15` by default. |
| `CLEANING_VISIT_DURATION_MINUTES` | `120` by default. |

The existing recipient remains `julianahonour@gmail.com`. Calendar events have no attendee list, no automatic reminders and `sendUpdates=none`; the existing Resend summary is the test-inbox notification. The adapter ignores any credential-supplied token URL and uses Google's fixed OAuth/API origins. Web Crypto signs short-lived service-account JWTs; no private key appears in tool configuration, application logs or Git. `RESEND_SETUP_API_KEY` remains local-only and excluded from deployment.

## Migrate, check and deploy

```bash
npm run migrate
npm run check:calendar
npm run typecheck
npm test
npm run build
```

Migration `002_demo_bookings.sql` adds offer, booking and slot-claim tables only. It does not replace enquiry/outbox tables or alter accepted notifications. Its unique minute claims prevent overlapping concurrent bookings across both types without requiring an extension. A partial unique index permits at most one active booking per call and type. `check:calendar` checks the real calendar ID, exact name, time zone and schema; it does not create events or prove inbox receipt.

On 25 November 2026 this additive migration was applied to Neon and read back: all three booking tables, the active-call/type unique index and the migration record were present. The existing email outbox had zero unresolved jobs. Calendar credentials remain unconfigured and booking remains disabled; no real calendar event has yet been created by this extension.

After checks pass, set `BOOKING_ENABLED=true` privately, retain `DELIVERY_ENABLED=true`, and deploy the existing Worker with:

```bash
npm run deploy -- --preserve-delivery
```

This update mode uploads the verified runtime secrets and publishes the final enabled configuration without a preliminary disabled deployment. Use it for this already-working Worker. The initial bootstrap/disabled deployment path remains available for a new installation. The deployment allowlist includes the calendar runtime settings only when booking is enabled; all local setup/read keys are stripped from the Wrangler subprocess environment. Pages routes and DNS are untouched.

## Prepare and publish Mia

```bash
npm run booking:agent
```

This requires the deployed, authenticated `/admin/booking-check` to verify enabled booking and the dedicated calendar. It creates a fresh draft from the current published agent and a local `.private/booking-agent-review.json`; it preserves an existing review file. Three custom functions check availability, confirm a chosen offer, or record a decline. Only the directly conflicting enquiry-only appointment statements are revised, and the booking policy is appended. The AI-first greeting, other business rules, webhook and extraction schema are retained. Inspect that concrete draft before publishing:

```bash
npm run booking:agent -- --publish
```

Publishing rereads the reviewed draft, rejects intervening edits, publishes it, then pins the existing demo number to the returned version and verifies the mapping and other number settings. Use the exact version printed by this command; do not assume the next version number or edit an older published version. No ringing/typing sound is added.

Mia must identify the booking type, check live availability, read back the full date/year, start/end time and Austin/Central time zone, and wait for an explicit yes. Creation accepts only the unguessable, call-bound offer token and exact returned local time/zone. Only a successful provider creation plus event read-back and durable receipt can return `booked=true`. Failed, declined, unavailable, disabled, creating or review states keep the enquiry and never authorize a confirmation announcement.

## Reliability and reconciliation

- Google is queried live for busy windows, then queried again after an atomic database capacity claim. Concurrent calls through this Worker cannot reserve the same minutes, including callback/visit overlap.
- A committed booking UUID determines the provider event ID. Duplicate requests use the same durable record and ID; a confirmed receipt is returned without creating another event. A conflicting provider ID must match the stored call/type/time marker before it is adopted.
- Known permanent failures release capacity. Timeouts, uncertain creation or a crash keep capacity reserved for review; an old `creating` record becomes `review` during scheduled housekeeping. There is no blind automatic creation retry or new event ID after an uncertain outcome.
- `npm run reconcile:booking -- call_ID` reads the existing deterministic provider event and adopts a matching receipt. It creates no event, releases no uncertain claim and resends no email. A review record with no event remains for human reconciliation.
- Live Google free/busy plus event insertion is not an atomic Google operation. The database prevents races among this Worker's requests; an unrelated manual/external calendar writer could still insert an overlapping event between the final read and creation. Keep this dedicated demo calendar's booking writes behind the Worker.
- Booking summaries come from trusted database records, never caller-supplied extraction fields. The original nine enquiry values and their string/null rules remain unchanged. Plain text and escaped HTML include each type, status, time zone, local date/time and confirmed provider ID. Callback preference and preferred cleaning date remain separate.
- The notification captures booking status when the enquiry is accepted. A later manual reconciliation does not rewrite an accepted email or silently send another message. Human follow-up is required if an uncertain booking is resolved after notification. No transcripts, recordings, keys or caller-selected recipients are added.

## Validation and operational gate

Local tests exercise the real migration and SQL in PGlite: successful creation, separate types, explicit consent, unavailable slots, concurrent callers, duplicate retries, provider errors/timeouts, declined/expired/wrong-call offers, fixed routing, escaped summaries and preserved transactional enquiry/email capture. Separate provider tests verify JWT signatures, fixed origins, event identity/read-back and partial availability failures. These tests use synthetic details and provider doubles and send no real email. PGlite serializes queries; it does not replace the live Neon concurrency test.

Ten additional HTTP/crypto checks passed in actual local Cloudflare workerd, including native RSA JWT signing/verification, signature rejection, unknown-agent rejection and disabled booking behavior. Google, Neon and Resend were not contacted by that smoke fixture. Production `wrangler.jsonc` never exposes the test-only crypto route.

After private setup and enabled deployment, choose a future free weekday on the demo calendar and explicitly run:

```bash
RUN_BOOKING_LIVE_TESTS=true npm run verify:bookings -- YYYY-MM-DD
```

This is excluded from CI/default tests. It creates at most three synthetic demo events, exercises duplicate and simultaneous requests, checks unavailable and declined outcomes, and sends **four** synthetic enquiry summaries only to `julianahonour@gmail.com`. It waits for scheduled processing without invoking `/admin/process`, verifies actual Google event read-back, and records a private report under `artifacts/booking-live/`. It does not mark inbox receipt or booking operational. Use a fresh test date for each run; retain events until their IDs/times and emails have been inspected. Test events must not be mistaken for real customer appointments.

Then complete a real Mia browser or telephone call using synthetic details: ask for both appointment types at distinct times, wait for her explicit date/time/zone confirmations, and end the call. Verify the exact published version, transcript/tool receipts, actual demo-calendar events, one stored enquiry/outbox record, and the actual Gmail message with both provider IDs. Also verify the declined/unavailable notifications. Provider `accepted` or `delivered` alone is not actual inbox proof. Only after that chain passes may booking be called operational.

## Official documentation consulted

[Retell calendar catalog/Google connection](https://docs.retellai.com/integrations/google-calendar), [custom functions, payloads, signatures and retries](https://docs.retellai.com/build/single-multi-prompt/custom-function), [Google free/busy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query), [event creation and client-supplied IDs](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account), [Standard Tier quotas](https://developers.google.com/workspace/calendar/api/guides/quotas), and [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).
