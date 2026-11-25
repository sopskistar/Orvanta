# Cal.com demonstration bookings

**Acceptance pending.** Cal.com OAuth booking tools are configured in Mia's **unpublished V7 draft**, cloned from published V5. The number ending **6003 remains on V5**. The exact audibly verified AI-first greeting, extraction schema and signed enquiry webhook are preserved. No additional greeting test is required. Booking must not be called operational until real browser-call bookings, actual calendar events and matching Orvanta enquiry emails pass acceptance.

## Actual architecture

Cal.com is the sole booking authority through Retell's existing **Cal.com - OAuth** connection. The Google calendar **Orvanta Demo** is connected through Cal.com. No new calendar, Google service account, Cal.com API key, paid upgrade, outbound-calling automation or DNS change is required.

The four current `integration_app` tools are:

| Agent tool | Retell catalog template | Cal.com link | Resolved event type |
| --- | --- | --- | --- |
| `callback_availability` | `check_calcom_availability` | `1cGor7T7gRA6iJPHp7oqbp` | `8061237` |
| `callback_booking` | `book_calcom_appointment` | Same callback link | `8061237` |
| `cleaning_availability` | `check_calcom_availability` | `1cGor7T7gxwuc12axZjqG4` | `8061236` |
| `cleaning_booking` | `book_calcom_appointment` | Same cleaning link | `8061236` |

Retell's supported multi-step `get-app-tool-schema` API resolves the current booking form. Saving the tools resolves each supplied link ID into its numeric event-type ID; the IDs above were read back from the saved draft. Deprecated `book_appointment_cal` and `check_availability_cal` presets are not used. Event type, `America/Chicago`, test email `julianahonour@gmail.com` and an empty guest list are fixed server-side tool inputs. Native OAuth credentials stay encrypted inside Retell; the Worker neither obtains nor impersonates those tokens.

The existing signed `call_analyzed` webhook and all nine original extraction fields remain. For the reviewed booking version, the Worker reads **Get Call** and the pinned **Get Retell LLM** version through its existing private Retell key. It verifies call identity/version and all four tool bindings, then pairs `integration_app` invocations with actual `tool_call_result` records by tool-call ID. Only a successful Cal.com response with `status=success`, accepted booking status, the correct event type and duration, an actual UID, UTC start/end and the restricted attendee/timezone becomes confirmed booking evidence. Agent speech, extracted IDs, caller metadata and dynamic variables are never booking proof.

The real OAuth response was inspected: accepted bookings return `data.uid`, `data.status`, `data.eventTypeId`, `data.start`, `data.end` and attendee details. The host account's timezone can differ; appointment times use the confirmed attendee timezone `America/Chicago`, with UTC instants preserved separately.

Migration **003_calcom_booking_evidence.sql** adds a minimal evidence snapshot to enquiries and a normalized evidence table. Enquiry, evidence and notification outbox insert in the **same atomic SQL statement**; duplicate/concurrent `call_analyzed` events still produce one enquiry and one notification. No transcript, full provider response, attendee address or recording is added to storage. Plain-text and escaped HTML summaries include each booking type, status, date/time, IANA timezone and provider UID, separately from cleaning and callback preferences.

The Worker only observes bookings; it **never creates, retries, cancels or reschedules calendar events**. Its original minute cron, durable email claiming, bounded retry/backoff, Resend idempotency and fixed recipient are preserved. A lookup failure or ambiguous provider result remains unconfirmed/review while retaining the enquiry. Accepted email payloads remain frozen; later reconciliation requires human follow-up rather than an automatic replacement email.

## Saved Cal.com configuration

The owner confirmed both links use the **replacement** `Orvanta Demo Hours` schedule after duplicating it and deleting the original, with Monday–Friday **09:00–17:00, America/Chicago**, weekends unavailable. Both use **Orvanta Demo** for destination and conflict checking.

Callback is **15 minutes**, with attendee phone number. Standard-cleaning demonstration is **120 minutes**, with attendee address, **no buffer before**, **30 minutes after**, and **120 minutes minimum notice**. These complete saved settings are owner-confirmed: Retell's OAuth tool API exposes required form fields and live results but does not expose the full Cal.com settings editor or schedule IDs. Live checks independently verify the behaviour listed below; do not describe the complete settings as independently API-read.

The prompt separates preferences from bookings, proactively asks callback preference, collects and confirms name/email and phone/address, reads back booking type, full date/year, start/end and timezone, and waits for an explicit yes for each appointment. Only standard cleaning can be booked; deep cleaning and other services remain enquiries. It explicitly states that demonstration bookings provide **no actual cleaning or crew dispatch**, and a callback only reserves time for the business to call, without starting an automatic outbound call.

Each creation tool is limited by prompt to one attempt per type per conversation. On failure/decline the enquiry continues. After a missing result or ambiguous timeout, no new creation is allowed until the provider outcome is reconciled. Retell does not expose a provider-idempotency parameter for these native tools; the former Worker's deterministic Google ID/slot-claim guarantees must not be attributed to this architecture. Cal.com enforces occupied slots; native repeated/concurrent behaviour requires actual provider tests. Keep all writes through Cal.com.

## Retired direct-Google path

`BOOKING_ENABLED=false` is permanent. The former `/tools/booking-availability`, `/tools/booking-confirm` and `/tools/booking-decline` routes verify signatures/agent access and return disabled, **even if the old flag is accidentally true**. Production no longer imports the Google provider or old booking writer. Legacy modules remain only as local regression fixtures, and migration 002's tables/data remain intact. No table was dropped or erased. Google key import and old reconciliation CLI commands stop with retirement guidance; the old live-verification command delegates to the Cal.com verifier.

Deployment excludes all old Google variables and local setup/read keys from the Wrangler subprocess environment. `RESEND_SETUP_API_KEY` remains local-only and is never uploaded. There are no two active booking writers.

## Private configuration and deployment

Use the existing Git-ignored, untracked, mode-600 `.env.local`; never paste keys in chat. The existing seven email/runtime secrets remain. New exact variable names:

| Variable | Value |
| --- | --- |
| `BOOKING_ENABLED` | `false`, retired direct-Google writer |
| `CALCOM_BOOKING_ENABLED` | Enables Worker receipt verification, not a booking writer |
| `CALCOM_CONFIG_JSON` | Generated reviewed configuration: app/agent/LLM IDs, allowed version(s), timezone, link IDs, numeric event IDs and durations |

From `workers/retell-email`:

```bash
npm run booking:agent          # Create a fresh V5-based draft; preserves an existing review file
npm run config:bookings        # Append only missing Cal.com configuration entries
npm run migrate               # Additive migrations, including 003
npm run check:calendar        # OAuth access, saved tool pins and evidence schema
npm run config:enable-bookings
npm run deploy -- --preserve-delivery
```

The current draft and configuration are already prepared; do not rerun draft creation to overwrite them. The private `.private/calcom-agent-review.json` identifies V7 and preserves the original baseline. `config:bookings` does not overwrite existing settings. Only `CALCOM_CONFIG_JSON` is added to the runtime secret allowlist; no OAuth access/refresh token or Cal.com key is needed. Deployment retains `DELIVERY_ENABLED=true`, disables the Google writer and leaves Pages, phone assignment and DNS alone.

Worker **b3ad856f-228a-4b90-91c2-800cf837550d** was deployed on 25 November 2026 at `https://orvanta-retell-email.sopskistar.workers.dev`. The protected `/admin/booking-check`, health endpoint, invalid-signature rejection and retired booking route were verified against that deployment. Its minute Cron Trigger remains configured. This deployment is receipt/email readiness, not booking acceptance.

## Verification completed and remaining

On 25 November 2026:

- Actual Cal.com OAuth callback creation and 120-minute standard-cleaning creation returned accepted provider UIDs. Each matching event was independently read from **Orvanta Demo**, including matching UID in its event description and exact America/Chicago times.
- Actual Cal.com invitations containing those UIDs were read in the restricted Gmail inbox. These provider invitations are **not** the Orvanta enquiry summary and do not prove its complete call-to-email chain.
- Live availability returned no weekend slots, no occupied cleaning slots, no callback during the cleaning appointment's 30-minute buffer, and openings immediately after that buffer.
- A repeated check of the booked callback slot returned no opening. A cleaning check wholly within the next two hours returned no slots, consistent with the configured minimum notice.
- Live 09:00 America/Chicago slots returned UTC−06 before the March 2027 daylight-saving transition and UTC−05 afterward.
- Two simultaneous callback requests saw the same opening: one provider creation succeeded, one was rejected, and an independent calendar query found exactly one corresponding event. The rejected response is conservatively review/unconfirmed rather than proof of a nonexistent booking. No ambiguous creation was retried.
- Additive migration 003 was applied in Neon. Automated SQL/provider-double tests cover authenticated evidence, wrong IDs/status/timezones/recipients, failures and missing results, duplicate/concurrent webhook acceptance, atomic rollback, and enquiry preservation. No automated fixture sends real email.
- Fully mocked native-tool simulations covered provider failure and ambiguous timeout: Mia stated the appointment was unconfirmed and made no second creation attempt. Declined and deep-cleaning scenarios made zero booking attempts and continued as enquiries. All tools, including a catch-all, were mocked in these scenarios, so they created no appointments.
- All 59 automated test cases, root lint/type check, Worker type check/bundle and 10 actual local workerd HTTP/evidence checks passed. The local runtime fixture contacts no provider and is absent from the production entrypoint.

Private provider responses, synthetic conversations, event IDs, Gmail message IDs, screenshots and call verification remain under ignored `artifacts/` or `.private/`; they are not committed.

Read-only live availability verification:

```bash
npm run verify:bookings -- YYYY-MM-DD
```

Optional explicitly authorized synthetic cleaning creation:

```bash
RUN_CALCOM_LIVE_TESTS=true CALCOM_TEST_NAME=unique_test_name npm run verify:bookings -- YYYY-MM-DD --cleaning
```

This creates a real 11:00–13:00 demo event and can send Cal.com invitations **only** to the test inbox. The report is written before the request and refuses an existing test name, so a command rerun cannot blindly repeat a possibly successful creation. Read-only results and playground conversations are not real voice-call acceptance evidence.

**Next browser acceptance:** Select Mia's **V7 draft**, Test Audio, and use synthetic details plus the test Gmail address. Request standard cleaning December 10, 2026, 10:00–12:00 America/Chicago and a separate callback December 11, 10:00–10:15. Confirm each only after Mia reads it back. End the call and record its call ID:

```bash
npm run verify:booking-call -- call_REAL_ID
```

Verify the real transcript has explicit consent and accurate announcements, both accepted provider receipts, both actual calendar events, one stored enquiry/notification, preserved preferences and one matching Orvanta summary **received in Gmail**. Check Cloudflare execution records for scheduled processing rather than `/admin/process`, and zero unresolved notification jobs. Also exercise declined/failed booking paths; provider failures/ambiguous timeouts should be simulated safely rather than sabotaging the live calendar connection. Cal.com may send separate booking invitations; distinguish them from the single Orvanta summary.

Only after acceptance passes, record private version-bound calendar/Gmail/cron evidence in `.private/calcom-acceptance.json`. `npm run booking:publish` requires that evidence, both confirmed types and accepted notifications; rejects changed draft/baseline; then publishes and assigns the verified version to number 6003. It reads back publication, phone mapping and protected settings. Until then, do not publish or reassign the number.

## Official documentation

[Retell Cal.com OAuth](https://docs.retellai.com/integrations/cal-com), [current functions and link-ID resolution](https://docs.retellai.com/integrations/cal-com-functions), [integration inputs/outputs](https://docs.retellai.com/integrations/overview), [Retell OpenAPI schema loop and tool execution records](https://docs.retellai.com/openapi.yaml), [Cal.com event settings](https://cal.com/docs/api-reference/v2/event-types/get-an-event-type), [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/), [Neon HTTPS driver](https://neon.com/docs/serverless/serverless-driver), [Resend sending](https://resend.com/docs/api-reference/emails/send-email).
