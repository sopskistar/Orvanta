try {
  const url = new URL('/admin/process', process.env.WORKER_URL);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error('https_required');
  if (!process.env.PROCESSING_TOKEN || process.env.PROCESSING_TOKEN.length < 32) throw new Error('token_missing');
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.PROCESSING_TOKEN}` }, signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`process_http_${response.status}`);
  console.log(JSON.stringify(await response.json()));
} catch { console.error('Processing failed or delivery is disabled. Check Worker configuration and the private processing token.'); process.exitCode = 1; }
