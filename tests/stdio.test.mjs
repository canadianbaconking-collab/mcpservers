import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { serverIds } from '../packages/runtime/index.mjs';
import { fixture, configSample, TIME } from '../packages/test-fixtures/index.mjs';
const calls = {
  'repo-state': ['get_state', { repo: 'fixture' }],
  'environment-doctor': ['workspace_health', {}],
  verification: ['compare_files', { repo: 'fixture', left: 'value.txt', right: 'same.txt' }],
  authority: ['inspect_config', { config: configSample }],
  'evidence-ledger': [
    'record_observation',
    {
      claimKey: 'test',
      statement: 'Synthetic',
      sourceUri: 'https://example.invalid/',
      observedAt: TIME,
      stance: 'unassessed',
    },
  ],
  'agent-run-telemetry': [
    'start_run',
    { key: 'stdio', task: 'Synthetic', origin: 'synthetic', startedAt: TIME },
  ],
  'decision-memory': [
    'record_decision',
    {
      question: 'Q',
      choice: 'A',
      alternatives: ['A'],
      rationale: 'R',
      revisitWhen: 'Later',
      decidedAt: TIME,
    },
  ],
  'release-engineer': ['release_notes', null],
  'security-surface': ['scan_config', { config: configSample }],
  'pilot-lab': [
    'register_pilot',
    {
      key: 'stdio',
      hypothesis: 'H',
      outcomeDefinition: 'O',
      probability: 0.5,
      baselineProbability: 0.5,
      origin: 'synthetic',
      registeredAt: TIME,
    },
  ],
  'scenario-fixture': [
    'save_fixture',
    { name: 'stdio', input: {}, expected: {}, purpose: 'Synthetic' },
  ],
  'action-transaction': [
    'prepare',
    { path: 'stdio.txt', content: 'Synthetic', expectedHash: null, reason: 'Protocol test' },
  ],
};
for (const id of serverIds)
  test(
    `${id}: SDK stdio initialize, list, call, resource and validation`,
    { timeout: 15000 },
    async (t) => {
      const f = fixture();
      const config = join(f.root, 'config.json');
      writeFileSync(config, JSON.stringify(f.config));
      const transport = new StdioClientTransport({
          command: process.execPath,
          args: [resolve('bin/serve.mjs'), id, '--config', config],
          stderr: 'pipe',
        }),
        client = new Client({ name: 'suite-test', version: '0.1.0' });
      t.after(async () => {
        await client.close();
        f.close();
      });
      await client.connect(transport);
      const list = await client.listTools();
      assert.ok(list.tools.length >= 2 && list.tools.length <= 5);
      const [verb, args] = calls[id],
        name = `${id.replaceAll('-', '_')}_${verb}`;
      const r = await client.callTool({
        name,
        arguments: args ?? { repo: 'fixture', base: f.git('rev-parse', 'HEAD') },
      });
      assert.equal(r.isError, false, JSON.stringify(r));
      assert.equal(r.structuredContent.ok, true);
      const resources = await client.listResources();
      assert.equal(resources.resources.length, 1);
      const m = await client.readResource({ uri: `suite://${id}/manifest` });
      assert.equal(JSON.parse(m.contents[0].text).name, id);
      const bad = await client.callTool({ name, arguments: { ...args, unknownField: true } });
      assert.equal(bad.isError, true);
    },
  );
