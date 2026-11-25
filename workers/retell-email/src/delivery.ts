import { IDEMPOTENCY_WINDOW_SECONDS, INITIAL_RECIPIENT } from "./config.ts";
import type { Job, SendResult, Store } from "./types.ts";

export async function sendEmail(job: Job, apiKey: string, request: typeof fetch = fetch, now = Date.now()): Promise<SendResult> {
  const firstAttempt = new Date(job.first_attempt_at).getTime();
  if (!Number.isFinite(firstAttempt) || now - firstAttempt >= IDEMPOTENCY_WINDOW_SECONDS * 1000) return { kind: "review", code: "idempotency_window_expired" };
  const email = job.payload;
  if (email.to.length !== 1 || email.to[0] !== INITIAL_RECIPIENT || !/^Orvanta <[A-Za-z0-9._+-]+@(?:[a-z0-9-]+\.)*getorvanta\.xyz>$/.test(email.from)) return { kind: "failed", code: "stored_route_invalid" };
  try {
    const response = await request("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `orvanta-enquiry/${job.id}` },
      // Only these trusted, frozen keys are sent. No caller/DB-supplied cc/bcc.
      body: JSON.stringify({ from: email.from, to: [INITIAL_RECIPIENT], subject: email.subject, text: email.text, html: email.html }),
    });
    const body: unknown = await response.json().catch(() => null);
    const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
    if (response.ok) {
      return typeof record.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(record.id)
        ? { kind: "accepted", providerId: record.id } : { kind: "retry", code: "provider_response_uncertain" };
    }
    const retryHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryHeader ? /^\d+$/.test(retryHeader) ? Number(retryHeader) : Math.max(0, (Date.parse(retryHeader) - now) / 1000) : 0;
    if (response.status === 409) return record.name === "concurrent_idempotent_requests"
      ? { kind: "retry", code: "provider_concurrent_request" }
      : { kind: "review", code: "provider_idempotency_conflict" };
    if ([408, 425, 429].includes(response.status) || response.status >= 500) return { kind: "retry", code: `provider_http_${response.status}`, retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 0 };
    return { kind: "failed", code: `provider_http_${response.status}` };
  } catch { return { kind: "retry", code: "provider_request_uncertain" }; }
}

export async function processBatch(store: Store, apiKey: string, request: typeof fetch = fetch) {
  if (!apiKey) throw new Error("resend_configuration_missing");
  const jobs = await store.claim();
  const settled = await Promise.allSettled(jobs.map(async job => {
    const result = await sendEmail(job, apiKey, request);
    // A failure here leaves the lease for recovery with the SAME provider key.
    await store.finish(job, result);
    return result.kind;
  }));
  if (settled.some(result => result.status === "rejected")) throw new Error("outbox_result_persistence_failed");
  const results = settled.map(result => (result as PromiseFulfilledResult<SendResult["kind"]>).value);
  return { claimed: jobs.length, accepted: results.filter(kind => kind === "accepted").length,
    retry: results.filter(kind => kind === "retry").length, failed: results.filter(kind => kind === "failed").length,
    review: results.filter(kind => kind === "review").length };
}
