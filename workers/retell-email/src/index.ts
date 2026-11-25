import { loadConfig } from "./config.ts";
import { processBatch } from "./delivery.ts";
import { renderEmail } from "./email.ts";
import { callIdentity, extractFields, parseEvent, readBody, RequestError } from "./payload.ts";
import { authorized, verifyRetell } from "./signature.ts";
import { neonSql, PostgresStore } from "./store.ts";
import type { Env, Store } from "./types.ts";
import { bookingTool } from "./booking.ts";
import { BookingStore } from "./booking-store.ts";
import type { BookingSummary } from "./booking-types.ts";
import { bookingConfig } from './booking-config.ts';
import { GoogleCalendar } from './booking-google.ts';

const reply = (status: number, code: string, retry = false) => Response.json({ code }, {
  status, headers: { "Cache-Control": "no-store", ...(retry ? { "Retry-After": "30" } : {}) },
});
const storage = (env: Env) => new PostgresStore(neonSql(env.DATABASE_URL));

export async function handleRequest(request: Request, env: Env, createStore: (env: Env) => Store = storage,
  createBookingStore: (env: Env) => BookingStore = env=>BookingStore.connect(env.DATABASE_URL)): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET") return reply(200, "worker_running_not_delivery_evidence");
  const toolPath = ['/tools/booking-availability','/tools/booking-confirm','/tools/booking-decline'].includes(path);
  if (path !== "/webhooks/retell" && path !== "/admin/process" && path !== '/admin/booking-check' && !toolPath) return reply(404, "not_found");
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  try {
    if(path==='/admin/booking-check') {
      if(!(await authorized(request.headers.get('authorization'),env.PROCESSING_TOKEN)))return reply(401,'unauthorized');
      if(env.BOOKING_ENABLED!=='true')return reply(409,'booking_disabled');
      loadConfig(env);
      await new GoogleCalendar(bookingConfig(env)).verifyCalendar();
      const [schema]=await neonSql(env.DATABASE_URL)("SELECT to_regclass('orvanta_workflow.booking_slot_claims') IS NOT NULL AS ready");
      if(!schema.ready)return reply(503,'booking_schema_unavailable');
      return Response.json({bookingEnabled:true,dedicatedDemoCalendarVerified:true,schemaVerified:true,operational:false},{headers:{'Cache-Control':'no-store'}});
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
    if (toolPath) return Response.json(await bookingTool(raw,path,env,env.BOOKING_ENABLED==='true'?createBookingStore(env):undefined),{headers:{'Cache-Control':'no-store'}});
    const { event, call } = parseEvent(raw);
    if (event !== "call_analyzed") return new Response(null, { status: 204 });
    const { callId, agentId } = callIdentity(call);
    const config = loadConfig(env);
    const route = config.routes.get(agentId);
    if (!route) return reply(403, "agent_not_allowed");
    const fields = extractFields(call);
    let bookings: BookingSummary[] | undefined;
    if (env.BOOKING_ENABLED === 'true') {
      try { bookings = await createBookingStore(env).summaries(callId,config.workspaceId); }
      catch {
        // A booking lookup must not discard the enquiry or invent confirmation.
        console.error('orvanta_booking_status_unavailable');
        bookings = (['callback','cleaning_visit'] as const).map(type=>({type,status:'review',timeZone:null,start:null,end:null,providerBookingId:null}));
      }
    }
    await createStore(env).accept({ id: crypto.randomUUID(), eventType: "call_analyzed", callId, agentId,
      workspaceId: config.workspaceId, clientId: route.clientId, fields }, renderEmail(fields, callId, config.from, route.recipient, bookings));
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
  if(env.BOOKING_ENABLED==='true') {
    // Preserve email processing even if separate booking housekeeping is unavailable.
    try { await BookingStore.connect(env.DATABASE_URL).markInterrupted(); }
    catch { console.error('orvanta_booking_housekeeping_failed'); }
  }
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
