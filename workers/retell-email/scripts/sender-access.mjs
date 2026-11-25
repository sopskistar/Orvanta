export async function verifySender(env, request = fetch) {
  const from = env.EMAIL_FROM || '';
  if (!/^[A-Za-z0-9._+-]+@(?:[a-z0-9-]+\.)*getorvanta\.xyz$/.test(from)) throw new Error('sender_format_invalid');
  const key = env.RESEND_SETUP_API_KEY || env.RESEND_API_KEY;
  if (!key || /replace-with/.test(key)) throw new Error('sender_key_missing');
  const domainName = from.split('@')[1];
  let cursor;
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://api.resend.com/domains');
    if (cursor) url.searchParams.set('after', cursor);
    const response = await request(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (error?.name === 'restricted_api_key' || error?.name === 'invalid_permission') throw new Error('sender_read_access_required');
      throw new Error(`sender_verification_http_${response.status}`);
    }
    const domains = await response.json();
    if (!Array.isArray(domains.data)) throw new Error('sender_domain_response_invalid');
    const domain = domains.data.find(item => item.name === domainName);
    if (domain) {
      if (domain.status !== 'verified') throw new Error('sender_domain_not_verified');
      if (domain.capabilities?.sending !== 'enabled') throw new Error('sender_domain_sending_not_enabled');
      return { senderDomainVerified: true, sendingEnabled: true };
    }
    if (!domains.has_more || !domains.data.length) break;
    const next = domains.data.at(-1)?.id;
    if (typeof next !== 'string' || !next || next === cursor) throw new Error('sender_pagination_invalid');
    cursor = next;
  }
  throw new Error('sender_domain_not_found');
}
