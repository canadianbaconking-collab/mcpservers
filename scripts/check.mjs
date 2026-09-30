import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serverIds, manifest } from '../packages/runtime/index.mjs';
import { canonical } from '../packages/provenance/index.mjs';
await import('./verify-vendor.mjs');
const currentCatalog = { schemaVersion: 1, servers: await Promise.all(serverIds.map(manifest)) };
if (
  canonical(currentCatalog) !==
  canonical(JSON.parse(readFileSync('docs/tool-catalog.json', 'utf8')))
) {
  throw Error('Tool catalog is stale; run node scripts/generate-docs.mjs');
}
for (const id of serverIds) {
  const m = await manifest(id);
  if (m.tools.length < 2 || m.tools.length > 5) throw Error('Tool count ' + id);
  readFileSync(`servers/${id}/README.md`);
}
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(path, e.name))
      : e.name.endsWith('.mjs')
        ? [join(path, e.name)]
        : [],
  );
}
const sourcePaths = ['bin', 'packages', 'servers', 'scripts', 'examples', 'tests'].flatMap(walk);
const formatting = spawnSync(
  process.execPath,
  ['node_modules/prettier/bin/prettier.cjs', '--check', ...sourcePaths],
  { stdio: 'inherit', windowsHide: true },
);
if (formatting.status !== 0) process.exit(1);
for (const path of sourcePaths) {
  const r = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) process.exit(1);
}
const r = spawnSync(process.execPath, ['--test', 'tests/*.test.mjs'], {
  stdio: 'inherit',
  windowsHide: true,
});
process.exit(r.status ?? 1);
