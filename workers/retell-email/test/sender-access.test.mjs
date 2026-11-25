import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifySender } from '../scripts/sender-access.mjs';
const env = { EMAIL_FROM: 'enquiries@notify.getorvanta.xyz', RESEND_API_KEY: 're_synthetic_send_only' };
test('sender must match the exact domain, verified status and enabled sending capability', async () => {
  assert.deepEqual(await verifySender(env, async () => Response.json({ data: [{ name: 'notify.getorvanta.xyz', status: 'verified', capabilities: { sending: 'enabled' } }], has_more: false })), { senderDomainVerified: true, sendingEnabled: true });
  for (const domain of [{ name: 'getorvanta.xyz', status: 'verified', capabilities: { sending: 'enabled' } }, { name: 'notify.getorvanta.xyz', status: 'pending', capabilities: { sending: 'enabled' } }, { name: 'notify.getorvanta.xyz', status: 'verified', capabilities: { sending: 'disabled' } }]) {
    await assert.rejects(verifySender(env, async () => Response.json({ data: [domain], has_more: false })));
  }
});
test('restricted read access is reported safely and the local setup key is used only for verification', async () => {
  await assert.rejects(verifySender(env, async () => Response.json({ name: 'restricted_api_key', message: 'PRIVATE_DETAIL' }, { status: 401 })), /^Error: sender_read_access_required$/);
  let authorization;
  await verifySender({ ...env, RESEND_SETUP_API_KEY: 're_synthetic_local_setup' }, async (_url, options) => {
    authorization = options.headers.Authorization;
    return Response.json({ data: [{ name: 'notify.getorvanta.xyz', status: 'verified', capabilities: { sending: 'enabled' } }], has_more: false });
  });
  assert.equal(authorization, 'Bearer re_synthetic_local_setup');
});
