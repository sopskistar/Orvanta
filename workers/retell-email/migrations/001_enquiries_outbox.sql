CREATE SCHEMA IF NOT EXISTS orvanta_workflow;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS orvanta_workflow.schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS orvanta_workflow.enquiries (
  id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type = 'call_analyzed'),
  call_id text NOT NULL CHECK (length(call_id) BETWEEN 1 AND 128),
  agent_id text NOT NULL,
  workspace_id text NOT NULL,
  client_id text NOT NULL,
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'object'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, call_id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS orvanta_workflow.notification_outbox (
  id uuid PRIMARY KEY,
  enquiry_id uuid NOT NULL UNIQUE REFERENCES orvanta_workflow.enquiries(id) ON DELETE CASCADE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'accepted', 'failed', 'review')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  last_error text,
  provider_message_id text,
  provider_accepted_at timestamptz,
  -- API acceptance is deliberately distinct from any delivery observation.
  delivery_status text NOT NULL DEFAULT 'unconfirmed',
  delivery_observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'processing') = (claim_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK ((state = 'accepted') = (provider_message_id IS NOT NULL AND provider_accepted_at IS NOT NULL))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS notification_outbox_due ON orvanta_workflow.notification_outbox(next_attempt_at, created_at)
  WHERE state IN ('pending', 'processing');
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS orvanta_workflow.notification_attempts (
  outbox_id uuid NOT NULL REFERENCES orvanta_workflow.notification_outbox(id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  claim_token uuid NOT NULL,
  outcome text NOT NULL DEFAULT 'started' CHECK (outcome IN ('started', 'accepted', 'retry', 'failed', 'review')),
  error_code text,
  provider_message_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (outbox_id, attempt)
);
