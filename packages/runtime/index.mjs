import { mkdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { configSchema, envelope, z } from '../schemas/index.mjs';
import { Store } from '../store/index.mjs';
import { digest } from '../provenance/index.mjs';
import { annotations, enforce, metadata } from '../authority/index.mjs';
import { publicError, requireThat } from '../errors/index.mjs';
import { readBounded } from './io.mjs';
export const serverIds = [
  'repo-state',
  'environment-doctor',
  'verification',
  'authority',
  'evidence-ledger',
  'agent-run-telemetry',
  'decision-memory',
  'release-engineer',
  'security-surface',
  'pilot-lab',
  'scenario-fixture',
  'action-transaction',
];
export function loadConfig(path) {
  const base = path ? dirname(resolve(path)) : process.cwd();
  const config = configSchema.parse(
    path
      ? JSON.parse(readBounded(resolve(path), 100000).toString())
      : { schemaVersion: 1, dataDir: '.suite', repos: { workspace: base } },
  );
  config.dataDir = resolve(base, config.dataDir);
  for (const key of Object.keys(config.repos))
    config.repos[key] = realpathSync(resolve(base, config.repos[key]));
  if (config.actionRoot) config.actionRoot = realpathSync(resolve(base, config.actionRoot));
  return config;
}
export function createContext(config) {
  config = configSchema.parse(config);
  mkdirSync(config.dataDir, { recursive: true });
  return { config, store: new Store(join(config.dataDir, 'suite.sqlite')) };
}
export async function definitions(serverId) {
  requireThat(serverIds.includes(serverId), 'NOT_FOUND', 'Unknown suite server.');
  return (await import(`../../servers/${serverId}/tools.mjs`)).tools;
}
export const toolName = (serverId, name) => `${serverId.replaceAll('-', '_')}_${name}`;
export async function invoke(ctx, serverId, name, raw = {}) {
  try {
    requireThat(
      Buffer.byteLength(JSON.stringify(raw)) <= 2_000_000,
      'LIMIT',
      'Input exceeds 2 MB.',
    );
    const def = (await definitions(serverId))[name];
    requireThat(def, 'NOT_FOUND', 'Unknown tool.');
    const args = def.input.parse(raw);
    enforce(ctx.config, def.effect);
    const data = await def.run(ctx, args);
    return envelope.parse({
      schemaVersion: 1,
      server: serverId,
      tool: name,
      ok: true,
      data,
      provenance: { inputHash: digest(args), outputHash: digest(data) },
    });
  } catch (error) {
    return { schemaVersion: 1, server: serverId, tool: name, ok: false, error: publicError(error) };
  }
}
export async function manifest(serverId) {
  const defs = await definitions(serverId);
  return {
    schemaVersion: 1,
    name: serverId,
    version: '0.1.0',
    transport: 'stdio',
    tools: Object.entries(defs).map(([name, d]) => ({
      name: toolName(serverId, name),
      description: d.description,
      inputSchema: z.toJSONSchema(d.input),
      authority: metadata(d.effect),
    })),
  };
}
export async function createServer(serverId, ctx) {
  const server = new McpServer({ name: `frostedlogic-${serverId}`, version: '0.1.0' }),
    defs = await definitions(serverId);
  for (const [name, def] of Object.entries(defs))
    server.registerTool(
      toolName(serverId, name),
      {
        description: def.description,
        inputSchema: def.input,
        outputSchema: envelope,
        annotations: annotations(def.effect),
      },
      async (args) => {
        const result = await invoke(ctx, serverId, name, args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
          isError: !result.ok,
        };
      },
    );
  const uri = `suite://${serverId}/manifest`;
  server.registerResource(
    'manifest',
    uri,
    {
      mimeType: 'application/json',
      description: 'Versioned tool contracts and declared authority metadata.',
    },
    async () => ({
      contents: [
        { uri, mimeType: 'application/json', text: JSON.stringify(await manifest(serverId)) },
      ],
    }),
  );
  return server;
}
