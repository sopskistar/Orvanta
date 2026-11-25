import { neon } from "@neondatabase/serverless";
import { BATCH_SIZE, IDEMPOTENCY_WINDOW_SECONDS, MAX_ATTEMPTS } from "./config.ts";
import type { Email, Enquiry, Job, SendResult, Sql, Store } from "./types.ts";

export function neonSql(url: string): Sql {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname.endsWith(".neon.tech")) throw new Error("neon_connection_invalid");
  const client = neon(url);
  return async <T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> =>
    await client.query(text, params, { fetchOptions: { signal: AbortSignal.timeout(5000) } }) as T[];
}

export class PostgresStore implements Store {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }

  async accept(enquiry: Enquiry, email: Email): Promise<boolean> {
    // A data-modifying CTE is one atomic Postgres statement/transaction. An
    // outbox failure rolls back the enquiry too; duplicate keys create neither.
    const rows = await this.sql(`
      WITH enquiry AS (
        INSERT INTO orvanta_workflow.enquiries
          (id, event_type, call_id, agent_id, workspace_id, client_id, fields)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (event_type, call_id) DO NOTHING RETURNING id
      )
      INSERT INTO orvanta_workflow.notification_outbox (id, enquiry_id, payload)
      SELECT $8::uuid, id, $9::jsonb FROM enquiry RETURNING id
    `, [enquiry.id, enquiry.eventType, enquiry.callId, enquiry.agentId, enquiry.workspaceId, enquiry.clientId,
      JSON.stringify(enquiry.fields), crypto.randomUUID(), JSON.stringify(email)]);
    return rows.length === 1;
  }

  async claim(): Promise<Job[]> {
    // Never retry an uncertain send outside the provider's 24h idempotency
    // lifetime. Exhausted/expired jobs are retained for human reconciliation.
    await this.sql(`
      UPDATE orvanta_workflow.notification_outbox SET state = 'review',
        last_error = 'retry_safety_limit', claim_token = NULL, lease_until = NULL, updated_at = now()
      WHERE (state = 'pending' OR (state = 'processing' AND lease_until <= now()))
        AND (attempts >= $1 OR first_attempt_at <= now() - make_interval(secs => $2))
    `, [MAX_ATTEMPTS, IDEMPOTENCY_WINDOW_SECONDS]);
    return this.sql<Job & Record<string, unknown>>(`
      WITH candidates AS (
        SELECT id FROM orvanta_workflow.notification_outbox
        WHERE ((state = 'pending' AND next_attempt_at <= now()) OR (state = 'processing' AND lease_until <= now()))
          AND attempts < $1 AND (first_attempt_at IS NULL OR first_attempt_at > now() - make_interval(secs => $2))
        ORDER BY next_attempt_at, created_at FOR UPDATE SKIP LOCKED LIMIT $3
      ), claimed AS (
        UPDATE orvanta_workflow.notification_outbox AS jobs SET
          state = 'processing', attempts = jobs.attempts + 1, claim_token = $4::uuid,
          lease_until = now() + interval '120 seconds', first_attempt_at = coalesce(jobs.first_attempt_at, now()), updated_at = now()
        FROM candidates WHERE jobs.id = candidates.id RETURNING jobs.*
      ), audit AS (
        INSERT INTO orvanta_workflow.notification_attempts (outbox_id, attempt, claim_token)
        SELECT id, attempts, claim_token FROM claimed RETURNING outbox_id
      )
      SELECT claimed.id, claimed.claim_token, claimed.attempts, claimed.payload, claimed.first_attempt_at
      FROM claimed JOIN audit ON audit.outbox_id = claimed.id
    `, [MAX_ATTEMPTS, IDEMPOTENCY_WINDOW_SECONDS, BATCH_SIZE, crypto.randomUUID()]);
  }

  async finish(job: Job, result: SendResult): Promise<void> {
    let state: string = result.kind === "retry" ? "pending" : result.kind;
    let code: string | null = result.kind === "accepted" ? null : result.code;
    if (result.kind === "retry" && job.attempts >= MAX_ATTEMPTS) { state = "review"; code = "retry_limit_uncertain"; }
    const backoff = Math.max(Math.min(30 * 2 ** (job.attempts - 1), 3600), result.kind === "retry" ? Math.min(result.retryAfterSeconds || 0, 3600) : 0);
    const rows = await this.sql(`
      WITH updated AS (
        UPDATE orvanta_workflow.notification_outbox SET state = $3, last_error = $4,
          provider_message_id = $5, provider_accepted_at = CASE WHEN $3 = 'accepted' THEN now() ELSE NULL END,
          next_attempt_at = now() + make_interval(secs => $6), claim_token = NULL, lease_until = NULL, updated_at = now()
        WHERE id = $1::uuid AND claim_token = $2::uuid AND state = 'processing' RETURNING id
      )
      UPDATE orvanta_workflow.notification_attempts SET outcome = $7, error_code = $4,
        provider_message_id = $5, finished_at = now()
      FROM updated WHERE outbox_id = updated.id AND claim_token = $2::uuid RETURNING outbox_id
    `, [job.id, job.claim_token, state, code, result.kind === "accepted" ? result.providerId : null,
      backoff, state === "pending" ? "retry" : state]);
    if (rows.length !== 1) throw new Error("claim_lost");
  }
}
