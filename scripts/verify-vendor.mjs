import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../packages/provenance/index.mjs';
const manifest = JSON.parse(readFileSync('vendor/SOURCES.json', 'utf8'));
const listed = new Set(Object.keys(manifest.files));
for (const [path, expected] of Object.entries(manifest.files))
  if (sha256(readFileSync(path)) !== expected) throw Error('Vendor integrity mismatch: ' + path);
function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const p = join(path, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) walk(p);
    else if (p !== 'vendor/SOURCES.json' && !listed.has(p))
      throw Error('Unexpected vendor file: ' + p);
  }
}
walk('vendor');
console.log(`Verified ${listed.size} pinned vendor files.`);
