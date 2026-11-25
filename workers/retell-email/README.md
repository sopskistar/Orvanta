# Retell → Neon → email

Implemented as a separate Cloudflare Worker. **Delivery is enabled; a genuine published-agent browser-call-to-inbox acceptance test passed on 25 November 2026.** The marketing application keeps `output: "export"`; no Pages routes, public API keys or DNS changes are part of this package.

The optional [demo booking extension](BOOKING.md) adds separate callback and cleaning-visit calendar appointments. It is implemented behind `BOOKING_ENABLED=false` and requires a private dedicated-calendar connection plus live calendar/inbox tests before activation. The original enquiry/email workflow remains the deployed service during setup. The user has now audibly verified Mia's published version 5 AI-first greeting; that earlier pending greeting check is complete.

## What the code does

`POST /webhooks/retell` accepts JSON, streams at most 512 KiB with a 3-second read deadline, and verifies `x-retell-signature` against the untouched bytes before parsing. It implements Retell's documented HMAC-SHA256 of raw body plus millisecond timestamp, with a five-minute freshness check and Web Crypto verification. Compressed bodies, malformed input, invalid field types and unconfigured agents are rejected. Other authentic events return 204 without storage or email processing.

For `call_analyzed`, the configured webhook key identifies the workspace context; `call.agent_id` must be in `AGENT_ROUTES_JSON`. Caller metadata and extracted values never select workspace, sender or recipient. Preflight checks allowed agent IDs against the workspace key's Retell agent list. `RETELL_WORKSPACE_ID` must be confirmed from that workspace's dashboard because the webhook does not provide an independently verifiable workspace identifier.

A single data-modifying PostgreSQL CTE inserts both the minimal enquiry and its outbox entry atomically. A unique `(event_type, call_id)` constraint deduplicates concurrent events. Success returns an empty 204 only after the database operation completes; unavailable storage returns 503 with `Retry-After`. Nothing sends email in the webhook handler.

The minute Cron Trigger, or authenticated `POST /admin/process`, claims at most three jobs using `FOR UPDATE SKIP LOCKED`, a two-minute lease and a fencing token. Claims and attempt records are committed together. At most three sends run concurrently, and the invocation awaits every send and outcome write. A crash leaves a recoverable database lease. Six attempts, exponential backoff (30 seconds to one hour), provider `Retry-After`, and safe error codes bound retries. Missing provider configuration consumes no attempts.

The email payload is rendered and frozen at acceptance so retries keep the same bytes and Resend idempotency key, `orvanta-enquiry/<outbox UUID>`. API acceptance is stored as `accepted` with a provider ID/time; `delivery_status` stays `unconfirmed`. An uncertain request can retry only within 23 hours of its first claim, safely inside Resend's 24-hour window. Exhausted or older uncertain jobs become `review` and never silently resend with a fresh key. Reconcile them with Resend before taking any manual action.

Stored fields are exactly `customer_name`, `callback_number`, `service_requested`, `zip_code`, `property_details`, `preferred_date`, `cleaning_notes`, `callback_preference`, and `follow_up_needed`. Strings, leading zeros, nulls, empty strings and boolean false are preserved. Cleaning dates are not parsed or combined with callback preferences. No value is inferred from transcripts or caller-number metadata. Transcripts, recording URLs and the full webhook payload are not stored or emailed.

Plain text and escaped HTML include call ID and all nine fields. The initial recipient is restricted to `julianahonour@gmail.com` both in configuration validation and at send time. Additional caller/DB-supplied `cc`/`bcc` fields are not forwarded. No live test goes to an unconfigured inbox.

## Runtime and dependencies

- Cloudflare compatibility date `2026-11-24`; current Workers enables Node compatibility automatically for this date. Web Crypto, Fetch, streams, timers and `AbortSignal.timeout` are available. No Retell or Resend Node SDK is needed.
- `@neondatabase/serverless` uses HTTPS through `neon().query`; there is no long-lived TCP/WebSocket pool or process-global database session. The five-second database request timeout keeps acceptance below Retell's ten-second webhook budget in normal operation. A timeout is treated as uncertain acceptance; replay is safe through database uniqueness.
- Wrangler is pinned for reproducible bundles. PGlite is a development-only PostgreSQL engine for exercising the actual migration and SQL locally, with no external email or API requests.
- Database and provider errors are not logged verbatim. Worker application logs contain static error codes and batch counts only. Worker observability is disabled in configuration; assess access/retention before enabling request logging.

## 1. Neon and private local configuration

From the repository root, install this package with `npm ci --prefix workers/retell-email`. Use Node 24.

Run `npm run config:init --prefix workers/retell-email` from the repository root to create `.env.local` only if it does not exist, using exclusive creation and mode 600. The assistant has already created this file for the current setup. Edit it in your local editor. Git ignores `.env.local` through the root `.env.*` rule. Confirm with:

```bash
git check-ignore -v workers/retell-email/.env.local
```

In Neon's console, create/use a dedicated Free project and copy its Postgres connection string into **`DATABASE_URL`**. Keep SSL enabled. Do not use the Neon account API key as this value. Then:

```bash
cd workers/retell-email
npm run check:database
npm run migrate
npm run check:database -- --schema
```

The initial migration is idempotent and transactional, with an advisory lock. It creates only the `orvanta_workflow` schema and its enquiry, outbox, attempts and migration tables. No existing website database is needed. Use a dedicated database role/project, keep migration permissions separate from later restricted runtime access where practical, and never grant anonymous access to these tables.

## 2. Retell workspace, Mia and extraction

Set these privately in `.env.local`:

- `RETELL_API_KEY`: the API key bearing the **webhook** badge in the intended Retell workspace. A different key may authenticate ordinary API calls but fail webhook verification.
- `RETELL_WORKSPACE_ID`: the exact workspace ID from the dashboard. For this setup, the user has supplied it privately in the local file.
- `AGENT_ROUTES_JSON`: replace `agent_REPLACE` with Mia's exact agent ID. Keep the matching workspace, `clientId: "orvanta"`, and `recipient: "julianahonour@gmail.com"`.

Run `npm run check:retell` to verify that the configured agent is accessible using this key. This uses Retell's current paginated `POST /v2/list-agents` API and prints only verification flags/counts. Ordinary API access cannot prove the key has the webhook badge; confirm that badge in the dashboard, then verify an actual signed call event after deployment.

Configure Mia's post-call extraction with the eight text fields listed above and one boolean `follow_up_needed`. Tell extraction to leave unknown values absent/null, preserve phone/ZIP formatting, and keep `preferred_date` about cleaning while `callback_preference` concerns contacting the customer. Do not add booking tools or claim a confirmed appointment.

Use a **browser/web call** from Retell's dashboard; a telephone number is not required. Do not add a browser test widget or API key to the public website.

## 3. Resend sender and key

Use a free Resend account. Add a dedicated sending subdomain such as **`notify.getorvanta.xyz`**. Add only the exact verification records Resend supplies for that subdomain and its sending return-path. Keep all existing Zoho MX, SPF, DKIM and DMARC records at their existing names. Do not replace root MX records, add a second SPF TXT at the same name, enable inbound mail at Resend, or remove Zoho records. If a requested record conflicts with an existing name, stop and inspect the records together before editing DNS.

Wait until the exact sender domain is verified in Resend. Set:

- `EMAIL_FROM=enquiries@notify.getorvanta.xyz` (or an address at the exact verified root/subdomain).
- `RESEND_API_KEY`: a key allowed to send from that domain. Keep it server-side.
- Optional `RESEND_SETUP_API_KEY`: a separate private read/setup-capable key for preflight domain checks and provider status retrieval if the sending key is restricted. This optional key is **not uploaded to the Worker**. A read-capable main key also works; no extra key is required in that case.

Preflight confirms verified domain status, not inbox placement. No DNS automation or service purchase is performed by this package.

## 4. Processing token and deploy

Run `npm run config:token` from this package to generate 32 random bytes and save them as `PROCESSING_TOKEN` in `.env.local`. It replaces only the template placeholder, keeps mode 600, and never prints the token. It leaves an existing configured token unchanged. Do not paste the token into chat, shell arguments or Git, or rotate one without coordinating deployed secrets.

Keep `DELIVERY_ENABLED=false` while configuring the database, allowed agents and sender and while running the disabled capture checks. Deploy initially with:

```bash
npm run preflight
npm run deploy:disabled
```

`deploy:disabled` runs preflight, publishes the separate Worker with delivery disabled, uploads only the seven runtime secret bindings through Wrangler's **stdin** bulk operation, and keeps delivery disabled in its final deployment. The local setup/read key is removed from Wrangler's subprocess environment as well as excluded from the upload list. The separate `deploy` command enables delivery only when `DELIVERY_ENABLED=true` was explicitly configured; do not run that enabled path during the disabled capture test. The main Pages project and domain routes are untouched. The optional setup key, test database URL and local Worker URL are never uploaded. If a step fails, inspect the returned state; a partially bootstrapped Worker may remain disabled. Never infer success from the dry-run build.

After the disabled checks pass and their synthetic enquiry/outbox records have been removed, explicitly set `DELIVERY_ENABLED=true` in the private file and run `npm run deploy`. This is the enabled deployment command; `deploy:disabled` always leaves delivery off.

For manual private secret entry, use `npx wrangler secret put DATABASE_URL` (and the other runtime names) and paste each value at Wrangler's hidden prompt. Do not put secret values on command lines. `wrangler.jsonc` defaults delivery to false; direct future `wrangler deploy` calls can disable delivery unless explicitly overridden. Use the package deployment script to preserve the explicit enabled state.

The runtime secret names are `DATABASE_URL`, `RETELL_API_KEY`, `RETELL_WORKSPACE_ID`, `AGENT_ROUTES_JSON`, `RESEND_API_KEY`, `EMAIL_FROM`, `PROCESSING_TOKEN`. Set `WORKER_URL` in the local file to the actual returned HTTPS `workers.dev` origin. `GET /health` is liveness only, not operational proof.

For local Wrangler development, use a private `.dev.vars` in this package containing runtime values. Do not assume Node's `.env.local` loading and Wrangler's precedence are identical. Both files remain ignored. Synthetic runtime smoke tests use their own config and never load production credentials.

## 5. Register the actual webhook

In Mia's Retell agent settings, set the agent webhook URL to:

```text
<actual WORKER_URL>/webhooks/retell
```

Select `call_analyzed`. An agent webhook supersedes the account-level webhook for that agent; inspect any existing URL before replacing it. This endpoint is on the separate Worker, not the static Pages website. After registering, verify an invalid signature is rejected and test one browser call using fictional enquiry details.

## 6. Actual acceptance test

Use a browser call to Mia, with a synthetic caller such as Alex Example, callback `+1 202-555-0143`, ZIP `02108`, a clearly stated preferred cleaning date. Wait for Mia to ask for the callback day, time and time zone before providing a separate callback preference. Test the exact published agent version; callback-question behavior was verified on version `2`; the current inbound version is `5`, with the AI-first greeting configured as recorded below. End the call and wait for analysis to complete. To verify scheduled processing, keep local dev servers stopped and do not invoke `npm run process` or `/admin/process` during the test.

```bash
npm run status -- call_ACTUAL_ID
```

The status command checks that Retell returns a real web call, the allowed agent and completed extraction; compares the nine stored enquiry fields; checks the outbox/provider ID; and retrieves Resend's provider event when read permission is available. It never prints the full transcript, recording, connection string or enquiry values. The minute cron delivers eligible jobs; `npm run process` runs one authenticated bounded batch if needed. Do not repeatedly rerun extraction as a substitute for checking the existing row: event/call deduplication intentionally freezes the first accepted enquiry.

Finally open **julianahonour@gmail.com**, find the summary with this exact call ID, and confirm its captured details, escaped content, sender and absence of transcript/recording. Provider `accepted`, `sent`, or `delivered` is not proof of inbox receipt. Correlate the actual inbox message (including Spam if necessary) before reporting the chain operational. The acceptance test recorded below includes a verified Gmail inbox message; repeat this correlation for future acceptance tests.

## Tests and operations

```bash
npm run typecheck
npm test
npm run build
```

The tests execute the production SQL against PGlite, including transaction rollback, duplicate/concurrent inputs, leases/fencing, retry recovery and failures. PGlite serializes queries internally; it is not proof of multi-process Neon row-lock scheduling. For a dedicated disposable Neon **test branch only**, set `WORKFLOW_TEST_DATABASE_URL` and `ALLOW_WORKFLOW_TEST_RESET=true`, ensure its URL differs from production, and run `node --env-file=.env.local --test test/workflow.test.mjs`. This test explicitly truncates only that test branch's workflow schema. Never point it at production.

Actual workerd smoke test, using two local terminals:

```bash
npx wrangler dev --config test/wrangler-smoke.json --local --ip 127.0.0.1 --port 8790 --test-scheduled
node scripts/runtime-smoke.mjs
```

Inspect `notification_outbox.state`, `last_error`, `attempts`, `provider_message_id` and `notification_attempts` through authenticated database tools. `failed` means a permanent API/configuration rejection; `review` requires reconciliation. Neither means a customer was notified. Do not manually change IDs, frozen payloads, first-attempt time or reset attempt counts to bypass the provider idempotency window.

No automatic retention deletion is enabled without an agreed policy. Private outbox payloads contain enquiry details; restrict database access, agree a retention period before real customer rollout, and delete associated enquiry rows only under that policy (outbox/attempt rows cascade). No public enquiry/admin listing is exposed.

## Official sources checked

Local verification on 24 November 2026: all 23 workflow tests passed against PGlite; six HTTP/signature checks passed in Cloudflare's actual local workerd runtime; Worker type checking, lint and a 218.68 KiB dry-run bundle passed. The marketing website's lint, TypeScript check and fresh static export also passed. Neon setup subsequently verified the private connection, applied `001_enquiries_outbox.sql`, and confirmed all four workflow tables, event/call deduplication, the outbox foreign key and migration record without reading private enquiry data. The separate Worker was subsequently deployed with `DELIVERY_ENABLED=false` at `https://orvanta-retell-email.sopskistar.workers.dev` (version `cd238ea5-3c46-4ca1-9236-eb12d3e083f7`). Cloudflare settings confirm all seven runtime secrets are present and `RESEND_SETUP_API_KEY` is absent. Retell agent access/mapping and the Resend sender domain were verified through their APIs. No real browser-call-to-inbox verification had run at that point; delivery was disabled. The private configuration file was created with mode 600, confirmed ignored and confirmed not overwritten by a repeat initialization.

Checked 24 November 2026: [Retell signature verification](https://docs.retellai.com/features/secure-webhook), [webhook events/retries](https://docs.retellai.com/features/webhook-overview), [analysis consumption](https://docs.retellai.com/features/post-call-analysis-consumption), [Neon HTTP driver/transactions](https://neon.com/docs/serverless/serverless-driver), [Cloudflare Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [send](https://resend.com/docs/api-reference/emails/send-email), [provider status](https://resend.com/docs/api-reference/emails/retrieve-email), [sending domains](https://resend.com/docs/dashboard/domains/introduction).

## Disabled deployment verification

After independently confirming Cloudflare's `DELIVERY_ENABLED` binding is false, run `npm run verify:disabled`. This checks the public endpoint, signature rejection, authenticated processing refusal, durable acceptance of two concurrent signed synthetic events, database deduplication, stored field types and pending notification state. It removes only its generated synthetic enquiry and cascading outbox/attempt records afterward. It never invokes the email provider. The test does not replace a genuine Retell browser call and received-email check.

All ten live disabled-Worker checks passed on 24 November 2026. Two concurrent signed synthetic posts returned 204, persisted one enquiry/outbox pair, and left the notification pending with no provider ID or acceptance timestamp. Signature rejection, authenticated disabled processing, allowed-agent enforcement, string/null preservation and recipient restriction were checked. The initial network-interrupted probe and the successful probe were removed; no test notification was sent. The local setup key was checked absent from all deployed bindings, deployment logs and Git candidates. `.env.local` remains mode 600, Git-ignored and untracked. The marketing Pages deployment and existing DNS records were not modified.

Verified registration URL: `https://orvanta-retell-email.sopskistar.workers.dev/webhooks/retell`. Mia's existing agent is displayed as `Single-Prompt Agent`; its existing prompt identifies Mia, and all nine extraction field names were present. Register this agent-level URL with `call_analyzed`, then save/publish the version used for the browser call. Delivery was kept disabled until explicitly authorized for the real inbox acceptance test.


On 25 November 2026, delivery was explicitly enabled for the browser-call acceptance test. Before enabling, the Retell API confirmed published agent version `0`, the exact registered `/webhooks/retell` URL, only `call_analyzed` selected, and all nine extraction fields with their expected types. Neon contained zero synthetic enquiries, zero synthetic notification jobs, zero outstanding jobs and zero unexpected recipients. The sender was reverified. Enabled Worker version: `77328383-89d1-4264-9d75-a89eb21ff92a`. Cloudflare settings independently confirmed `DELIVERY_ENABLED=true`, seven runtime secret bindings and no `RESEND_SETUP_API_KEY`. The live health check returned 200; authenticated processing returned 200 with zero jobs claimed. The initial recipient remains restricted to `julianahonour@gmail.com`. The marketing homepage also returned 200; this deployment did not alter Pages or DNS. At enablement, the real browser-call-to-inbox test was pending; enabling delivery alone did not establish operational readiness.


The genuine browser-call acceptance test passed on 25 November 2026 for `call_b74c6f9d46e387ddff71f12b507`, using Mia's published agent version `0`. Retell completed analysis with all nine enquiry fields present. All nine stored Neon values matched the extraction, including separate `preferred_date` and `callback_preference` values. Exactly one enquiry and one outbox record exist for the call. The scheduled Worker accepted the notification on its first attempt with no recorded error; Resend reported `delivered`. The actual message was independently located in `julianahonour@gmail.com` with the `INBOX` label and matching call ID, sender and recipient. SHA-256 comparisons of normalized plain-text and HTML bodies matched the frozen outbox email exactly; the two timing fields remained separate in the received message. SPF, DKIM and DMARC passed. No attachments, transcripts or recordings were included. Final queue inspection found zero synthetic notification jobs and zero pending, processing, failed or review jobs. The workflow passed this end-to-end acceptance test; provider acceptance alone was not used as inbox proof. Redacted verification reports are kept under the Git-ignored `artifacts/deployment/` directory. No caller contact details or secret values were added to tracked documentation.


## Published version 2 callback and scheduled-delivery acceptance

Verified on 25 November 2026 for `call_189a657758338ebf3c420368ca4`, a completed browser call using Mia's **published agent version 2**, linked to Retell LLM version 2. Before publishing, comparison with version 0 confirmed the only business-prompt change was the added callback-preference instruction: no previous prompt lines or other LLM settings were removed or changed. The webhook URL, `call_analyzed` selection, complete extraction schema and other agent settings were preserved apart from version metadata. The published prompt was read back and matched the reviewed draft.

The transcript shows Mia asking, “What day and time would you prefer the team to call you back, including your time zone?” before the caller mentioned a callback preference. Extraction, Neon storage and the received email kept the cleaning date (December 3, 2026) separate from the callback preference (November 27, 10 AM–12 PM, Austin time). All nine stored values matched Retell's extraction. The database contained exactly one enquiry and one notification for the call, with one successful provider attempt and no recorded error. Exactly one matching Gmail message was found in `INBOX`; both normalized plain-text and HTML bodies matched the frozen notification by SHA-256. The user independently confirmed receipt and matching details. SPF, DKIM and DMARC passed.

Cloudflare's actual execution records, correlated with the persisted attempt audit, established the processing path:

| UTC time, 25 November 2026 | Verified event |
| --- | --- |
| 06:17:02 | Successful HTTP invocation returned 204; Neon accepted the webhook at 06:17:02.304. |
| 06:17:28 | Successful production cron invocation for `* * * * *`, on Worker version `77328383-89d1-4264-9d75-a89eb21ff92a`. |
| 06:17:29.446 | Durable notification attempt started. |
| 06:17:29.617 | Provider acceptance and completed attempt were stored. |

Cloudflare's `workersInvocationsScheduled` and unsampled (`sampleInterval=1`) `workersInvocationsAdaptive` records for 06:16–06:19 UTC show the successful cron invocations and only one HTTP invocation, the 204 webhook. Successful `/admin/process` calls return 200; none appeared in that interval. No manual-processing request was made during this acceptance test. Processing therefore ran in Cloudflare independently of a local terminal or dev server. Worker liveness and cron configuration alone were not used as evidence of the send.

Final queue verification found zero pending, processing, failed or review jobs and zero leftover synthetic jobs. Delivery remains enabled and restricted to `julianahonour@gmail.com`. Cloudflare settings confirm all seven runtime secret bindings and no local-only setup key. The Pages website and DNS were not changed. Private transcripts, email bodies, provider responses and verification artifacts remain outside Git; only this summarized result is recorded here. At this verification point, the browser-call workflow was verified; telephone-number routing and a telephone call had not yet been tested. Subsequent telephone and greeting configuration is recorded below.


## AI-first greeting and inbound version 5

The user subsequently confirmed a successful telephone test and matching Gmail inbox delivery. On 25 November 2026, API inspection found the existing demo number still pinned to agent version `2`, while the latest published agent was version `3`. A new isolated draft was created from version `3` (leaving the existing version `4` draft untouched), configured and published as **agent version `5` / Retell LLM version `5`**. Read-back verification confirmed:

- `start_speaker` is `agent`.
- `begin_message` is the existing main-prompt greeting: “Hi, you’ve reached the Sample Home Cleaning demo. I’m Mia, an AI assistant. How can I help?”
- The main business prompt, callback-preference question, other LLM settings, agent settings, webhook and complete extraction schema are preserved.
- The existing number's inbound agent is the same Mia agent, pinned explicitly to version `5` at weight `1`; all other number settings are unchanged.
- No simulated ringing sound or other audio asset was added.

The separate Worker remains enabled on version `77328383-89d1-4264-9d75-a89eb21ff92a`, with the existing minute cron and recipient restriction. This Retell configuration change does not alter the database, email delivery code, static Pages deployment or DNS. The greeting and inbound mapping were verified by API read-back, and the user subsequently confirmed the AI-first greeting was audibly verified. A new enquiry can still be correlated with its single outbox entry and received email; API read-back alone is not audible-call evidence.
