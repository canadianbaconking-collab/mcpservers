import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fixture, TIME } from '../packages/test-fixtures/index.mjs';
test(
  'Independent stdio processes share durable artifact references across a server restart',
  { timeout: 20000 },
  async (t) => {
    const f = fixture(),
      config = join(f.root, 'config.json');
    writeFileSync(config, JSON.stringify(f.config));
    const clients = [];
    t.after(async () => {
      for (const client of clients) await client.close();
      f.close();
    });
    async function connect(server) {
      const client = new Client({ name: 'composition-test', version: '0.1.0' });
      clients.push(client);
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [resolve('bin/serve.mjs'), server, '--config', config],
          stderr: 'pipe',
        }),
      );
      return client;
    }
    const ledger = await connect('evidence-ledger'),
      memory = await connect('decision-memory');
    const evidence = await ledger.callTool({
      name: 'evidence_ledger_record_observation',
      arguments: {
        claimKey: 'runtime',
        statement: 'Synthetic observed check',
        sourceUri: 'https://example.invalid/e',
        observedAt: TIME,
        stance: 'supports',
      },
    });
    assert.equal(evidence.isError, false);
    const id = evidence.structuredContent.data.id;
    const decision = await memory.callTool({
      name: 'decision_memory_record_decision',
      arguments: {
        question: 'Runtime?',
        choice: 'Node',
        alternatives: ['Node'],
        rationale: 'Synthetic evidence',
        evidenceIds: [id],
        revisitWhen: 'Constraints change',
        decidedAt: TIME,
      },
    });
    assert.equal(decision.isError, false);
    await ledger.close();
    const reopened = await connect('evidence-ledger');
    const artifact = await reopened.callTool({
      name: 'evidence_ledger_get_artifact',
      arguments: { id: decision.structuredContent.data.id },
    });
    assert.equal(artifact.isError, false);
    assert.deepEqual(artifact.structuredContent.data.data.evidenceIds, [id]);
  },
);
