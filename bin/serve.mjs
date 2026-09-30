#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createContext, createServer, loadConfig, serverIds } from '../packages/runtime/index.mjs';
const [serverId, ...flags] = process.argv.slice(2);
if (
  !serverIds.includes(serverId) ||
  (flags.length && (flags.length !== 2 || flags[0] !== '--config'))
) {
  console.error('Usage: node bin/serve.mjs <server-id> [--config config.json]');
  process.exit(2);
}
try {
  const ctx = createContext(loadConfig(flags[1]));
  process.on('exit', () => ctx.store.close());
  await serveStdio(() => createServer(serverId, ctx));
} catch {
  console.error('Server startup failed. Check configuration, directories, and runtime.');
  process.exitCode = 1;
}
