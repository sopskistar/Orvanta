/** Shared with workers/retell-email; runtime setup and live verification are separate. */
export interface EnquiryFields {
  customer_name: string | null;
  callback_number: string | null;
  service_requested: string | null;
  zip_code: string | null;
  property_details: string | null;
  preferred_date: string | null;
  cleaning_notes: string | null;
  callback_preference: string | null;
  follow_up_needed: boolean | null;
}

/** Trusted server configuration; recipients must never come from caller data. */
export interface ClientMapping {
  clientId: string;
  workspaceId: string;
  agentId: string;
  notificationRecipient: string;
  timeZone: string;
}

export type NotificationState = "pending" | "processing" | "accepted" | "failed" | "review";

export interface PersistedEnquiry {
  clientId: string;
  callId: string;
  eventKey: string;
  fields: EnquiryFields;
  state: NotificationState;
  attemptCount: number;
  nextAttemptAt: string | null;
  providerMessageId: string | null;
}
