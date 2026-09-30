import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverIds, loadConfig } from '../packages/runtime/index.mjs';
if (process.argv.length !== 3) {
  console.error('Usage: node scripts/client-config.mjs path/to/config.json');
  process.exit(2);
}
const config = resolve(process.argv[2]);
loadConfig(config);
const server = fileURLToPath(new URL('../bin/serve.mjs', import.meta.url));
console.log(
  JSON.stringify(
    {
      mcpServers: Object.fromEntries(
        serverIds.map((id) => [
          `frosted-${id}`,
          { command: process.execPath, args: [server, id, '--config', config] },
        ]),
      ),
    },
    null,
    2,
  ),
);
