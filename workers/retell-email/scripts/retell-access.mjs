import { loadConfig } from '../src/config.ts';

// Current official list API is POST /v2/list-agents with paginated items.
// Never log the request headers or the workspace's full agent list.
export async function verifyAgentAccess(env, request = fetch) {
  const config = loadConfig(env);
  if (/replace-with/.test(env.RETELL_API_KEY)) throw new Error('retell_key_not_configured');
  const remaining = new Set(config.routes.keys());
  let cursor;
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://api.retellai.com/v2/list-agents');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('pagination_key', cursor);
    const response = await request(url, {
      method: 'POST', headers: { Authorization: `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter_criteria: { channel: { type: 'string', op: 'eq', value: 'voice' } } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`retell_agents_http_${response.status}`);
    const agents = await response.json();
    if (!Array.isArray(agents.items) || typeof agents.has_more !== 'boolean') throw new Error('retell_agents_response_invalid');
    for (const agent of agents.items) {
      if (agent && typeof agent.agent_id === 'string' && agent.is_suspended !== true) remaining.delete(agent.agent_id);
    }
    if (!remaining.size) return { configuredAgentsVerified: config.routes.size, apiAccess: true, webhookBadgeRequiresDashboardConfirmation: true };
    if (!agents.has_more) break;
    if (typeof agents.pagination_key !== 'string' || !agents.pagination_key || agents.pagination_key === cursor) throw new Error('retell_agents_pagination_invalid');
    cursor = agents.pagination_key;
  }
  throw new Error('retell_allowed_agents_not_accessible');
}
