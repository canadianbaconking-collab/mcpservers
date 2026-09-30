import test from 'node:test';
import assert from 'node:assert/strict';
import { workflow } from '../examples/workflow.mjs';
import { serverIds } from '../packages/runtime/index.mjs';
test('All 12 compose: inspect → check → evidence → decision → pilot → release → local transaction', async () => {
  const result = await workflow();
  assert.deepEqual(result.serversUsed, [...serverIds].sort());
  assert.equal(result.fixturePassed, true);
  assert.equal(result.releaseReady, true);
  assert.equal(result.receiptMatches, true);
  assert.equal(result.pilotBrier, 0.0625);
  assert.equal(result.origin, 'synthetic');
  assert.equal(result.externalActions, 0);
});
