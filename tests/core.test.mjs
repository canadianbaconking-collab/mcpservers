import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, symlinkSync, readFileSync } from 'node:fs';
import { Store } from '../packages/store/index.mjs';
import { fixture, TIME, LATER } from '../packages/test-fixtures/index.mjs';
import { canonical, digest } from '../packages/provenance/index.mjs';
import { safePath, readBounded } from '../packages/runtime/io.mjs';
import { relativePath } from '../packages/schemas/index.mjs';
test('Canonical evidence: object order stable; arrays ordered and nonfinite values rejected', () => {
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
  assert.notEqual(digest([1, 2]), digest([2, 1]));
  assert.throws(() => canonical({ bad: NaN }));
});
test('SQLite: durable reopen, atomic rollback, immutable rows and independent connections', (t) => {
  const f = fixture();
  t.after(() => f.close());
  const s = f.ctx.store,
    a = s.put('test', { x: 1 });
  assert.throws(() =>
    s.transaction(() => {
      s.put('rolled-back', { x: 2 });
      throw Error('rollback');
    }),
  );
  assert.equal(s.list('rolled-back').length, 0);
  assert.throws(() => s.db.prepare('UPDATE artifacts SET body=? WHERE id=?').run('{}', a.id));
  const other = new Store(join(f.config.dataDir, 'suite.sqlite'));
  try {
    assert.deepEqual(other.get(a.id), a);
    other.transaction(() => other.append('stream', { x: 1 }));
    s.transaction(() => s.append('stream', { x: 2 }));
    assert.equal(other.events('stream').length, 2);
  } finally {
    other.close();
  }
});
test('Integrity: content and chain corruption are detected even after local triggers are removed', (t) => {
  const f = fixture();
  t.after(() => f.close());
  const s = f.ctx.store,
    a = s.put('test', { x: 1 });
  s.append('stream', { x: 1 });
  s.db.exec('DROP TRIGGER immutable_artifacts_update; DROP TRIGGER immutable_events_update;');
  s.db.prepare('UPDATE artifacts SET body=? WHERE id=?').run('{"x":2}', a.id);
  assert.throws(() => s.get(a.id), /hash mismatch/);
  s.db.prepare('UPDATE events SET body=? WHERE stream=?').run('{"x":2}', 'stream');
  assert.throws(() => s.events('stream'), /chain mismatch/);
});
test('Path boundary: traversal, Windows alternate streams, device names, symlink directory and file bounds', (t) => {
  const f = fixture();
  t.after(() => f.close());
  for (const p of [
    '../x',
    '/x',
    'C:/x',
    'a\\b',
    'a//b',
    'a/./b',
    'NUL.txt',
    'x:secret',
    'name.',
    'name ',
  ])
    assert.equal(relativePath.safeParse(p).success, false, p);
  const outside = join(f.root, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'secret'), 'outside');
  const link = join(f.actions, 'link');
  symlinkSync(outside, link, 'junction');
  assert.throws(() => safePath(f.actions, 'link/secret'), /links/);
  writeFileSync(join(f.actions, 'large'), '123456');
  assert.throws(() => readBounded(join(f.actions, 'large'), 5), /limit/);
});
test('Transaction crash recovery: exact target bytes reconcile after a file replacement before journal commit', async (t) => {
  const f = fixture({ allowFileWrites: true });
  t.after(() => f.close());
  const p = await f.call('action-transaction', 'prepare', {
    path: 'recover.txt',
    content: 'intended',
    expectedHash: null,
    reason: 'Synthetic interrupted commit',
  });
  assert.equal(p.ok, true);
  writeFileSync(join(f.actions, 'recover.txt'), 'intended');
  const r = await f.call('action-transaction', 'commit', { id: p.data.id });
  assert.equal(r.ok, true);
  assert.equal(r.data.reconciled, true);
  assert.equal(r.data.attribution, 'exact-bytes-only');
});
test('Chronology uses instants rather than lexical fractional timestamps', async (t) => {
  const f = fixture();
  t.after(() => f.close());
  const run = await f.call('agent-run-telemetry', 'start_run', {
    key: 'time',
    task: 'Synthetic',
    origin: 'synthetic',
    startedAt: '2026-09-29T12:00:00.001Z',
  });
  const r = await f.call('agent-run-telemetry', 'record_event', {
    id: run.data.id,
    expectedSeq: 1,
    at: '2026-09-29T12:00:00Z',
    kind: 'checkpoint',
    summary: 'Earlier',
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'VALIDATION');
});
