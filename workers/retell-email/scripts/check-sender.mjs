import { verifySender } from './sender-access.mjs';
try { console.log(JSON.stringify(await verifySender(process.env))); }
catch (error) {
  const code = /^sender_[a-z0-9_]+$/.test(error.message || '') ? error.message : 'sender_connection_failed';
  console.error(`Sender verification incomplete: ${code}. A read-capable RESEND_SETUP_API_KEY may be needed for a restricted sending key. No secret values were printed.`);
  process.exitCode = 1;
}
