-- Additive observation of Cal.com OAuth tool results. This Worker creates no
-- calendar events. All legacy direct-Google tables and existing data remain.
ALTER TABLE orvanta_workflow.enquiries ADD COLUMN IF NOT EXISTS booking_evidence jsonb;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS orvanta_workflow.calcom_booking_evidence (
 enquiry_id uuid NOT NULL REFERENCES orvanta_workflow.enquiries(id),
 workspace_id text NOT NULL, call_id text NOT NULL, agent_id text NOT NULL,
 tool_call_id text NOT NULL, booking_type text NOT NULL CHECK(booking_type IN ('callback','cleaning_visit')),
 event_type_id text NOT NULL, status text NOT NULL,
 time_zone text, starts_at timestamptz, ends_at timestamptz,
 provider_booking_id text, evidence_source text NOT NULL, reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(enquiry_id,tool_call_id),
 CHECK ((status='confirmed') = (provider_booking_id IS NOT NULL)),
 CHECK (status<>'confirmed' OR (starts_at IS NOT NULL AND ends_at>starts_at AND time_zone='America/Chicago'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS calcom_evidence_by_call ON orvanta_workflow.calcom_booking_evidence(workspace_id,call_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS calcom_evidence_by_provider ON orvanta_workflow.calcom_booking_evidence(workspace_id,provider_booking_id) WHERE provider_booking_id IS NOT NULL;
