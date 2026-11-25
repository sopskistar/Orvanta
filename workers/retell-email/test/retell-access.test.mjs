import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAgentAccess } from '../scripts/retell-access.mjs';
const env = {
  RETELL_API_KEY: 'synthetic-signing-key-only', RETELL_WORKSPACE_ID: 'org_synthetic',
  AGENT_ROUTES_JSON: JSON.stringify({ agent_mia_synthetic: { clientId: 'orvanta', workspaceId: 'org_synthetic', recipient: 'julianahonour@gmail.com' } }),
  EMAIL_FROM: 'enquiries@notify.getorvanta.xyz',
};
test('Retell verification uses the documented POST voice-agent list and follows pagination', async () => {
  const requests = [];
  const result = await verifyAgentAccess(env, async (url, options) => {
    requests.push({ url: String(url), options });
    return Response.json(requests.length === 1
      ? { items: [{ agent_id: 'agent_other_synthetic' }], has_more: true, pagination_key: 'synthetic_cursor' }
      : { items: [{ agent_id: 'agent_mia_synthetic', is_suspended: false }], has_more: false });
  });
  assert.equal(result.configuredAgentsVerified, 1);
  assert.equal(result.webhookBadgeRequiresDashboardConfirmation, true);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(new URL(requests[0].url).pathname, '/v2/list-agents');
  assert.deepEqual(JSON.parse(requests[0].options.body), { filter_criteria: { channel: { type: 'string', op: 'eq', value: 'voice' } } });
  assert.equal(new URL(requests[1].url).searchParams.get('pagination_key'), 'synthetic_cursor');
});
test('missing or suspended agents, unauthorized keys and malformed pagination cannot pass', async () => {
  for (const items of [[], [{ agent_id: 'agent_mia_synthetic', is_suspended: true }]]) {
    await assert.rejects(verifyAgentAccess(env, async () => Response.json({ items, has_more: false })), /not_accessible/);
  }
  await assert.rejects(verifyAgentAccess(env, async () => new Response('{}', { status: 401 })), /http_401/);
  await assert.rejects(verifyAgentAccess(env, async () => Response.json({ items: [], has_more: true })), /pagination_invalid/);
  await assert.rejects(verifyAgentAccess(env, async () => Response.json([])), /response_invalid/);
});
