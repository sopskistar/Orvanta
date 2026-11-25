import fs from 'node:fs/promises';
const target = new URL('../.env.local', import.meta.url);
try {
  const handle = await fs.open(target, 'wx', 0o600);
  try { await handle.writeFile(await fs.readFile(new URL('../.env.example', import.meta.url))); }
  finally { await handle.close(); }
  console.log('Created private .env.local with mode 600. Fill placeholders in a local editor; never paste keys into chat.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('.env.local already exists and was not overwritten.');
  else { console.error('Could not create private configuration file.'); process.exitCode = 1; }
}
