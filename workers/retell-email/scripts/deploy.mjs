import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preflight } from './preflight.mjs';

const binary = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const secrets = ['DATABASE_URL', 'RETELL_API_KEY', 'RETELL_WORKSPACE_ID', 'AGENT_ROUTES_JSON', 'RESEND_API_KEY', 'EMAIL_FROM', 'PROCESSING_TOKEN'];
function wrangler(args, input) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', WRANGLER_SEND_METRICS: 'false' };
    // Runtime secrets travel only over stdin. Setup/read credentials never
    // reach the deployment subprocess or its environment/diagnostics.
    for (const name of [...secrets, 'RESEND_SETUP_API_KEY', 'WORKFLOW_TEST_DATABASE_URL', 'WORKER_URL', 'DELIVERY_ENABLED']) delete childEnv[name];
    const child = spawn(process.execPath, [binary, ...args], {
      stdio: ['pipe', 'inherit', 'inherit'], env: childEnv,
    });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('worker_deployment_failed')));
    child.stdin.end(input);
  });
}
try {
  await preflight();
  const disabled = process.argv.includes('--disabled');
  if (!disabled && process.env.DELIVERY_ENABLED !== 'true') throw new Error('delivery_not_explicitly_enabled');
  // Separate Worker only: no Pages deployment, main-domain route or DNS writes.
  await wrangler(['deploy', '--var', 'DELIVERY_ENABLED:false']);
  await wrangler(['secret', 'bulk'], JSON.stringify(Object.fromEntries(secrets.map(name => [name, process.env[name]]))));
  await wrangler(['deploy', '--var', `DELIVERY_ENABLED:${disabled ? 'false' : 'true'}`]);
  console.log(`Worker deployment command completed with delivery ${disabled ? 'disabled' : 'enabled'}. Verify the returned HTTPS URL and complete the real call-to-inbox test before calling the workflow operational.`);
} catch {
  console.error('Deployment incomplete. Check preflight, Cloudflare login and the selected deployment mode. No secret values are printed. A partially bootstrapped Worker can remain disabled.');
  process.exitCode = 1;
}
