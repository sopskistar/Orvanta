import { loadConfig } from "./config.ts";
import { processBatch } from "./delivery.ts";
import { renderEmail } from "./email.ts";
import { callIdentity, extractFields, parseEvent, readBody, RequestError } from "./payload.ts";
import { authorized, verifyRetell } from "./signature.ts";
import { neonSql, PostgresStore } from "./store.ts";
import type { Env, Store } from "./types.ts";
import type { BookingSummary } from "./booking-types.ts";
import {verifiedCalcomEvidence} from './calcom-evidence.ts';
import {calcomConfig} from './calcom-config.ts';

const reply = (status: number, code: string, retry = false) => Response.json({ code }, {
  status, headers: { "Cache-Control": "no-store", ...(retry ? { "Retry-After": "30" } : {}) },
});
const storage = (env: Env) => new PostgresStore(neonSql(env.DATABASE_URL));

export async function handleRequest(request: Request, env: Env, createStore: (env: Env) => Store = storage): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET") return reply(200, "worker_running_not_delivery_evidence");
  const toolPath = ['/tools/booking-availability','/tools/booking-confirm','/tools/booking-decline'].includes(path);
  if (path !== "/webhooks/retell" && path !== "/admin/process" && path !== '/admin/booking-check' && !toolPath) return reply(404, "not_found");
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  try {
    if(path==='/admin/booking-check') {
      if(!(await authorized(request.headers.get('authorization'),env.PROCESSING_TOKEN)))return reply(401,'unauthorized');
      if(env.CALCOM_BOOKING_ENABLED!=='true')return reply(409,'booking_disabled');
      loadConfig(env);
      calcomConfig(env);
      const [schema]=await neonSql(env.DATABASE_URL)("SELECT to_regclass('orvanta_workflow.calcom_booking_evidence') IS NOT NULL AS ready");
      if(!schema.ready)return reply(503,'booking_schema_unavailable');
      return Response.json({calcomEvidenceEnabled:true,directGoogleWriterRetired:true,schemaVerified:true,operational:false},{headers:{'Cache-Control':'no-store'}});
    }
    if (path === "/admin/process") {
      if (!(await authorized(request.headers.get("authorization"), env.PROCESSING_TOKEN))) return reply(401, "unauthorized");
      if (env.DELIVERY_ENABLED !== "true") return reply(409, "delivery_disabled");
      loadConfig(env);
      const summary = await processBatch(createStore(env), env.RESEND_API_KEY);
      return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "") || request.headers.has("content-encoding")) return reply(415, "unsupported_content_type_or_encoding");
    if (!env.RETELL_API_KEY) return reply(503, "webhook_not_configured", true);
    const raw = await readBody(request);
    if (!(await verifyRetell(raw, request.headers.get("x-retell-signature"), env.RETELL_API_KEY))) return reply(401, "invalid_signature");
    if (toolPath) {
      let parsed:Record<string,unknown>;
      try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(raw));}catch{throw new RequestError(400,'invalid_json');}
      const {call}=parseEvent(new TextEncoder().encode(JSON.stringify({event:'call_analyzed',call:parsed?.call})));
      const {agentId}=callIdentity(call);
      if(!loadConfig(env).routes.has(agentId))return reply(403,'agent_not_allowed');
      // Retired permanently. No environment flag can re-enable a second writer.
      return Response.json({status:'disabled',booked:false,enquiryCaptureContinues:true,code:'direct_google_booking_retired'},{headers:{'Cache-Control':'no-store'}});
    }
    const { event, call } = parseEvent(raw);
    if (event !== "call_analyzed") return new Response(null, { status: 204 });
    const { callId, agentId } = callIdentity(call);
    const config = loadConfig(env);
    const route = config.routes.get(agentId);
    if (!route) return reply(403, "agent_not_allowed");
    const fields = extractFields(call);
    const bookingEvidence=await verifiedCalcomEvidence(call,env);
    const bookings:BookingSummary[]|undefined=bookingEvidence;
    await createStore(env).accept({ id: crypto.randomUUID(), eventType: "call_analyzed", callId, agentId,
      workspaceId: config.workspaceId, clientId: route.clientId, fields,bookingEvidence }, renderEmail(fields, callId, config.from, route.recipient, bookings));
    // No delivery promise is launched by webhook acceptance.
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof RequestError) return reply(error.status, error.message);
    // Never log request bodies, extracted PII, connection strings or exceptions.
    console.error("orvanta_workflow_request_failed");
    return reply(503, "durable_processing_unavailable", true);
  }
}

export async function scheduledProcessing(env: Env, createStore: (env: Env) => Store = storage) {
  if (env.DELIVERY_ENABLED !== "true") return;
  loadConfig(env);
  const summary = await processBatch(createStore(env), env.RESEND_API_KEY);
  console.log(JSON.stringify({ event: "outbox_batch", ...summary }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> { return handleRequest(request, env); },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    // The scheduled handler's returned promise tracks the COMPLETE batch.
    try { await scheduledProcessing(env); }
    catch { console.error("orvanta_outbox_batch_failed"); throw new Error("outbox_batch_failed"); }
  },
};
