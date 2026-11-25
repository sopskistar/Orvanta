import type { Config, Env, AgentRoute } from "./types.ts";

export const INITIAL_RECIPIENT = "julianahonour@gmail.com";
export const ID = /^[A-Za-z0-9_-]{1,128}$/;
export const MAX_ATTEMPTS = 6;
export const BATCH_SIZE = 3;
export const IDEMPOTENCY_WINDOW_SECONDS = 23 * 60 * 60;

export function loadConfig(env: Env): Config {
  if (!env.RETELL_API_KEY || !ID.test(env.RETELL_WORKSPACE_ID || "")) throw new Error("retell_configuration_missing");
  const from = env.EMAIL_FROM || "";
  if (!/^[A-Za-z0-9._+-]+@(?:[a-z0-9-]+\.)*getorvanta\.xyz$/.test(from)) throw new Error("sender_configuration_invalid");
  const parsed: unknown = JSON.parse(env.AGENT_ROUTES_JSON || "null");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("agent_routes_invalid");
  const routes = new Map<string, AgentRoute>();
  for (const [agentId, raw] of Object.entries(parsed)) {
    if (!ID.test(agentId) || !raw || typeof raw !== "object") throw new Error("agent_route_invalid");
    const route = raw as AgentRoute;
    if (!ID.test(route.clientId || "") || route.workspaceId !== env.RETELL_WORKSPACE_ID || route.recipient !== INITIAL_RECIPIENT) {
      throw new Error("agent_route_invalid");
    }
    routes.set(agentId, { clientId: route.clientId, workspaceId: route.workspaceId, recipient: INITIAL_RECIPIENT });
  }
  if (!routes.size) throw new Error("agent_routes_empty");
  return { workspaceId: env.RETELL_WORKSPACE_ID, routes, from };
}
