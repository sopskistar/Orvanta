CREATE TABLE IF NOT EXISTS orvanta_workflow.booking_offers (
  id uuid PRIMARY KEY, call_id text NOT NULL, agent_id text NOT NULL, workspace_id text NOT NULL,
  booking_type text NOT NULL CHECK (booking_type IN ('callback','cleaning_visit')),
  calendar_id text NOT NULL, time_zone text NOT NULL,
  starts_at timestamptz, ends_at timestamptz, expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','declined','unavailable','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((starts_at IS NULL AND ends_at IS NULL AND status IN ('declined','unavailable','failed')) OR (starts_at IS NOT NULL AND ends_at > starts_at))
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS orvanta_workflow.bookings (
  id uuid PRIMARY KEY, offer_id uuid NOT NULL UNIQUE REFERENCES orvanta_workflow.booking_offers(id),
  call_id text NOT NULL, agent_id text NOT NULL, workspace_id text NOT NULL,
  booking_type text NOT NULL CHECK(booking_type IN ('callback','cleaning_visit')),
  calendar_id text NOT NULL, time_zone text NOT NULL,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
  customer_name text NOT NULL, callback_number text NOT NULL,
  status text NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','confirmed','unavailable','failed','review')),
  provider_event_id text, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='confirmed') = (provider_event_id IS NOT NULL))
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_call_type ON orvanta_workflow.bookings(workspace_id,call_id,booking_type)
 WHERE status IN ('creating','confirmed','review');
-- statement-breakpoint
-- Unique minute claims make competing transactions conflict atomically, including
-- callback/visit overlap on the same demo calendar; no extension is required.
CREATE TABLE IF NOT EXISTS orvanta_workflow.booking_slot_claims (
 calendar_id text NOT NULL, starts_at timestamptz NOT NULL,
 booking_id uuid NOT NULL REFERENCES orvanta_workflow.bookings(id) ON DELETE CASCADE,
 PRIMARY KEY(calendar_id,starts_at)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS booking_offers_by_call ON orvanta_workflow.booking_offers(workspace_id,call_id,created_at DESC);
