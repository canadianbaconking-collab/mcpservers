import { mkdirSync, writeFileSync } from 'node:fs';
import { serverIds, manifest } from '../packages/runtime/index.mjs';
import { z, envelope } from '../packages/schemas/index.mjs';
const purposes = {
  'repo-state': [
    'Repository snapshots and explicit project state.',
    'Read-only Git inspection; no semantic milestone inference.',
  ],
  'environment-doctor': [
    'Local capability checks before selecting a workflow.',
    'Credential presence is not authentication. Network and connected-app availability remain unprobed.',
  ],
  verification: [
    'Deterministic checks and retained evidence.',
    'Faultline requires configured Python. Registered checks run with the process owner permissions, and Windows descendant termination is not guaranteed.',
  ],
  authority: [
    'Coldgate static authority analysis and Driftglass policy evaluation.',
    'Evaluation is advisory; caller policy cannot change suite or host permissions.',
  ],
  'evidence-ledger': [
    'Immutable observations and exact artifact retrieval.',
    'Stance, source family and time are declarations. No automatic semantic grouping, corroboration, or SignalForge schema conversion.',
  ],
  'agent-run-telemetry': [
    'Explicit run lifecycle and chained event history.',
    'Local chains need an independently retained head to detect whole-history replacement. No automatic agent instrumentation.',
  ],
  'decision-memory': [
    'Evidence-linked decisions and append-only supersession.',
    'No semantic search or recommendation. Callers retain exact IDs.',
  ],
  'release-engineer': [
    'Release planning and evidence gates bound to Git HEAD.',
    'No tagging, pushing, publishing or CI claims. Readiness covers only the selected registered checks.',
  ],
  'security-surface': [
    'Saved configuration analysis and dependency-origin inspection.',
    'Static Coldgate findings are not runtime enforcement or vulnerability scanning.',
  ],
  'pilot-lab': [
    'Explicit binary pilot registration and descriptive scoring; BlackBird bundle verification.',
    'One Brier score does not validate a theory. BlackBird verification requires configured Python and never executes stored commands.',
  ],
  'scenario-fixture': [
    'Content-addressed synthetic test inputs and expected JSON.',
    'Exact comparison only; no arbitrary code execution or inferred fixture generation.',
  ],
  'action-transaction': [
    'Prepare, inspect, commit or abort one bounded UTF-8 file change.',
    'Commit requires operator-configured allowFileWrites and actionRoot. No multi-file atomicity or hostile-writer isolation; crash reconciliation proves matching bytes, not authorship.',
  ],
};
const catalog = [];
for (const id of serverIds) {
  const m = await manifest(id);
  catalog.push(m);
  const [purpose, limit] = purposes[id];
  writeFileSync(
    `servers/${id}/package.json`,
    JSON.stringify(
      {
        name: `@frostedlogic/${id}-mcp`,
        version: '0.1.0',
        private: true,
        type: 'module',
        exports: './tools.mjs',
        scripts: { start: `node ../../bin/serve.mjs ${id}` },
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    `servers/${id}/README.md`,
    `# ${id} MCP\n\n${purpose}\n\nFrom the monorepo root:\n\n\`\`\`sh\nnode bin/serve.mjs ${id} --config examples/config.json\n\`\`\`\n\nConnect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.\n\n| Tool | Effect | Purpose |\n| --- | --- | --- |\n${m.tools.map((t) => `| \`${t.name}\` | ${t.authority.effect} | ${t.description} |`).join('\n')}\n\nResource: \`suite://${id}/manifest\` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).\n\n${limit}\n\nVerification: \`node --test tests/servers.test.mjs tests/stdio.test.mjs\` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in \`pnpm test\`. See [configuration and startup](../../README.md).\n`,
  );
}
mkdirSync('docs', { recursive: true });
writeFileSync(
  'docs/tool-catalog.json',
  JSON.stringify({ schemaVersion: 1, servers: catalog }, null, 2) + '\n',
);
mkdirSync('schemas', { recursive: true });
writeFileSync(
  'schemas/result.schema.json',
  JSON.stringify(z.toJSONSchema(envelope), null, 2) + '\n',
);
for (const name of [
  'schemas',
  'provenance',
  'errors',
  'authority',
  'store',
  'runtime',
  'adapters',
  'test-fixtures',
])
  writeFileSync(
    `packages/${name}/package.json`,
    JSON.stringify(
      {
        name: `@frostedlogic/${name}`,
        version: '0.1.0',
        private: true,
        type: 'module',
        exports: name === 'adapters' ? './python.mjs' : './index.mjs',
      },
      null,
      2,
    ) + '\n',
  );
console.log(
  `Documented ${catalog.length} servers and ${catalog.reduce((n, s) => n + s.tools.length, 0)} tools.`,
);
