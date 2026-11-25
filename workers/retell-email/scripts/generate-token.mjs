import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const file = new URL('../.env.local', import.meta.url);
try {
  const source = await fs.readFile(file, 'utf8');
  const placeholder = /^PROCESSING_TOKEN=replace-with-a-random-private-64-character-token\r?$/m;
  if (!placeholder.test(source)) {
    console.log('Processing token is not the template placeholder; no value was printed or changed.');
  } else {
    await fs.writeFile(file, source.replace(placeholder, 'PROCESSING_TOKEN=' + randomBytes(32).toString('hex')), { mode: 0o600 });
    await fs.chmod(file, 0o600);
    console.log('Generated and saved PROCESSING_TOKEN privately; its value was not printed.');
  }
} catch { console.error('Could not update the token. Check the private local file; no values were printed.'); process.exitCode = 1; }
