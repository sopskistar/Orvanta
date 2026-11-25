# Coded Retell enquiry notifications

The workflow is implemented in [workers/retell-email](../workers/retell-email/README.md), separate from the unchanged static Cloudflare Pages website. It uses an authenticated Retell webhook, transactional Neon enquiry/outbox storage, a scheduled Cloudflare Worker and Resend summaries to the initially configured test inbox.

**A genuine browser-call → completed extraction → durable enquiry → received-email acceptance test passed on 25 November 2026.** Neon/Retell/Resend setup, sender verification, the enabled deployed Worker and actual receipt in the restricted Gmail inbox were verified. The published version 2 follow-up test also verified Mia proactively asking for callback timing, a separate cleaning date, one matching enquiry/email and Cloudflare cron execution without manual processing. See the Worker README for call IDs and cloud execution evidence. No telephone number, Make scenario, booking or Calendly integration is needed for this change.

Follow the package README for migrations, exact environment names, secret upload, retry/reconciliation behavior and the real acceptance test. Existing Zoho email DNS records must be preserved. Never add workflow secrets to the Next.js environment or browser bundle, and never send full transcripts/recordings by default.

Mia's existing demo number is pinned to published version `5`, with the AI speaking first and the existing Sample Home Cleaning demo greeting configured explicitly. The user confirmed the telephone-to-inbox test and audible version 5 greeting. No simulated ringing audio was added.

The separate callback/cleaning-visit [demo booking extension](../workers/retell-email/BOOKING.md) is implemented with durable slot claims and trusted booking summaries, but remains disabled pending the private Google demo-calendar connection and real calendar/inbox verification. The working enquiry/email service stays enabled during setup.
