import { verifyAgentAccess } from './retell-access.mjs';
try { console.log(JSON.stringify(await verifyAgentAccess(process.env))); }
catch (error) {
  const code = /^retell_[a-z0-9_]+$/.test(error.message) ? error.message : 'retell_configuration_or_connection_failed';
  console.error(`Retell verification incomplete: ${code}. Check the private key, workspace and Mia's agent mapping; no key values were printed.`);
  process.exitCode = 1;
}
