// Retell's documented manual method: HMAC-SHA256(raw bytes + timestamp).
// https://docs.retellai.com/features/secure-webhook
export async function verifyRetell(raw: Uint8Array, signature: string | null, key: string, now = Date.now()): Promise<boolean> {
  const match = /^v=(\d{1,16}),d=([a-fA-F0-9]{64})$/.exec(signature || "");
  if (!match || !key) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300_000) return false;
  const suffix = new TextEncoder().encode(match[1]);
  const signed = new Uint8Array(raw.length + suffix.length);
  signed.set(raw);
  signed.set(suffix, raw.length);
  const digest = Uint8Array.from(match[2].match(/../g)!, byte => parseInt(byte, 16));
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", cryptoKey, digest, signed);
}

export async function authorized(header: string | null, secret: string): Promise<boolean> {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const encode = (value: string) => new TextEncoder().encode(value);
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encode(header.slice(7))), crypto.subtle.digest("SHA-256", encode(secret))]);
  const first = new Uint8Array(a), second = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < first.length; i++) difference |= first[i] ^ second[i];
  return difference === 0;
}
