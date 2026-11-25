import { loadConfig } from "./config.ts";
import { processBatch } from "./delivery.ts";
import { renderEmail } from "./email.ts";
import { callIdentity, extractFields, parseEvent, readBody, RequestError } from "./payload.ts";
import { authorized, verifyRetell } from "./signature.ts";
import { neonSql, PostgresStore } from "./store.ts";
import type { Env, Store } from "./types.ts";

const reply = (status: number, code: string, retry = false) => Response.json({ code }, {
  status, headers: { "Cache-Control": "no-store", ...(retry ? { "Retry-After": "30" } : {}) },
});
const storage = (env: Env) => new PostgresStore(neonSql(env.DATABASE_URL));

export async function handleRequest(request: Request, env: Env, createStore: (env: Env) => Store = storage): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET") return reply(200, "worker_running_not_delivery_evidence");
  if (path !== "/webhooks/retell" && path !== "/admin/process") return reply(404, "not_found");
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  try {
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
    const { event, call } = parseEvent(raw);
    if (event !== "call_analyzed") return new Response(null, { status: 204 });
    const { callId, agentId } = callIdentity(call);
    const config = loadConfig(env);
    const route = config.routes.get(agentId);
    if (!route) return reply(403, "agent_not_allowed");
    const fields = extractFields(call);
    await createStore(env).accept({ id: crypto.randomUUID(), eventType: "call_analyzed", callId, agentId,
      workspaceId: config.workspaceId, clientId: route.clientId, fields }, renderEmail(fields, callId, config.from, route.recipient));
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
