import type { EnquiryFields } from "./types.ts";
import { ID } from "./config.ts";

export class RequestError extends Error {
  status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}
export const MAX_BODY_BYTES = 512 * 1024;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export async function readBody(request: Request): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new RequestError(413, "body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "body_missing");
  const parts: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 3000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RequestError(413, "body_too_large"); }
      parts.push(value);
    }
    if (timedOut) throw new RequestError(408, "body_timeout");
  } finally { clearTimeout(timer); reader.releaseLock(); }
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { raw.set(part, offset); offset += part.length; }
  return raw;
}

export function parseEvent(raw: Uint8Array): { event: string; call: Record<string, unknown> } {
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(raw)); }
  catch { throw new RequestError(400, "invalid_json"); }
  if (!isObject(parsed) || typeof parsed.event !== "string" || !/^[a-z_]{1,100}$/.test(parsed.event)) throw new RequestError(400, "invalid_event");
  if (parsed.event === "call_analyzed" && !isObject(parsed.call)) throw new RequestError(400, "invalid_call");
  return { event: parsed.event, call: isObject(parsed.call) ? parsed.call : {} };
}

export function callIdentity(call: Record<string, unknown>) {
  if (typeof call.call_id !== "string" || !ID.test(call.call_id) || typeof call.agent_id !== "string" || !ID.test(call.agent_id)) throw new RequestError(400, "invalid_call_identity");
  return { callId: call.call_id, agentId: call.agent_id };
}

export function extractFields(call: Record<string, unknown>): EnquiryFields {
  const analysis = call.call_analysis;
  if (analysis != null && !isObject(analysis)) throw new RequestError(400, "invalid_analysis");
  const data = isObject(analysis) ? analysis.custom_analysis_data : undefined;
  if (data != null && !isObject(data)) throw new RequestError(400, "invalid_extraction");
  const source = isObject(data) ? data : {};
  const fields = {} as EnquiryFields;
  for (const name of ["customer_name", "callback_number", "service_requested", "zip_code", "property_details", "preferred_date", "cleaning_notes", "callback_preference"] as const) {
    const value = source[name];
    if (value != null && (typeof value !== "string" || value.length > 4000)) throw new RequestError(400, "invalid_field_type_or_length");
    fields[name] = value == null ? null : value as string;
  }
  const followUp = source.follow_up_needed;
  if (followUp != null && typeof followUp !== "boolean") throw new RequestError(400, "invalid_follow_up_needed");
  fields.follow_up_needed = followUp == null ? null : followUp as boolean;
  return fields;
}
