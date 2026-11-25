import type { EnquiryFields } from "../../../src/lib/enquiries.ts";
export type { EnquiryFields };

export interface Env {
  DATABASE_URL: string;
  RETELL_API_KEY: string;
  RETELL_WORKSPACE_ID: string;
  AGENT_ROUTES_JSON: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  PROCESSING_TOKEN: string;
  DELIVERY_ENABLED: string;
}

export interface AgentRoute { clientId: string; workspaceId: string; recipient: string }
export interface Config { workspaceId: string; routes: Map<string, AgentRoute>; from: string }
export interface Enquiry {
  id: string;
  eventType: "call_analyzed";
  callId: string;
  agentId: string;
  workspaceId: string;
  clientId: string;
  fields: EnquiryFields;
}
export interface Email { from: string; to: string[]; subject: string; text: string; html: string }
export interface Job {
  id: string;
  claim_token: string;
  attempts: number;
  payload: Email;
  first_attempt_at: string;
}
export interface Store {
  accept(enquiry: Enquiry, email: Email): Promise<boolean>;
  claim(): Promise<Job[]>;
  finish(job: Job, result: SendResult): Promise<void>;
}
export type SendResult =
  | { kind: "accepted"; providerId: string }
  | { kind: "retry" | "failed" | "review"; code: string; retryAfterSeconds?: number };
export type Sql = <T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
