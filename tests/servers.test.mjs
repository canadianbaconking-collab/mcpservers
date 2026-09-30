import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  fixture,
  TIME,
  LATER,
  configSample,
  policySample,
} from '../packages/test-fixtures/index.mjs';
import { digest } from '../packages/provenance/index.mjs';
function setup(t, options) {
  const f = fixture(options);
  t.after(() => f.close());
  return f;
}
async function ok(f, server, tool, args = {}) {
  const r = await f.call(server, tool, args);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.data;
}
async function error(f, server, tool, args, code) {
  const r = await f.call(server, tool, args);
  assert.equal(r.ok, false);
  if (code) assert.equal(r.error.code, code);
  return r;
}
async function observation(f, extra = {}) {
  return ok(f, 'evidence-ledger', 'record_observation', {
    claimKey: 'tests',
    statement: 'A declared check',
    sourceUri: 'https://example.invalid/evidence',
    observedAt: TIME,
    stance: 'supports',
    ...extra,
  });
}

test('Repo State: observes real commits, dirtiness and bounded project state', async (t) => {
  const f = setup(t);
  const state = await ok(f, 'repo-state', 'get_state', { repo: 'fixture' });
  assert.equal(state.dirty, false);
  assert.equal(state.head, f.git('rev-parse', 'HEAD'));
  assert.equal(
    (await ok(f, 'repo-state', 'recent_changes', { repo: 'fixture' })).commits.length,
    1,
  );
  assert.match(
    (await ok(f, 'repo-state', 'project_state', { repo: 'fixture' })).content,
    /Synthetic/,
  );
  writeFileSync(join(f.repo, 'new.txt'), 'x');
  assert.equal((await ok(f, 'repo-state', 'get_state', { repo: 'fixture' })).dirty, true);
  await error(f, 'repo-state', 'get_state', { repo: 'unknown' }, 'NOT_FOUND');
  await error(f, 'repo-state', 'get_state', { repo: 'fixture', extra: true }, 'VALIDATION');
});
test('Environment Doctor: reports availability and presence without credential values', async (t) => {
  const f = setup(t);
  const result = await ok(f, 'environment-doctor', 'diagnose');
  assert.equal(result.versions.node.available, true);
  assert.equal(result.authentication, 'not-probed');
  process.env.SUITE_TEST_SECRET = 'do-not-return-me';
  try {
    const p = await ok(f, 'environment-doctor', 'credential_presence', {
      names: ['SUITE_TEST_SECRET', 'SUITE_MISSING_VARIABLE'],
    });
    assert.equal(p.credentials[0].present, true);
    assert.equal(p.credentials[1].present, false);
    assert.ok(!JSON.stringify(p).includes('do-not-return-me'));
  } finally {
    delete process.env.SUITE_TEST_SECRET;
  }
  assert.equal((await ok(f, 'environment-doctor', 'workspace_health')).repos[0].available, true);
});
test('Verification: file evidence, equality, configured checks, failures and timeout', async (t) => {
  const f = setup(t);
  const v = await ok(f, 'verification', 'check_file', {
    repo: 'fixture',
    path: 'value.txt',
    expectedHash: f.hash,
  });
  assert.equal(v.data.pass, true);
  assert.equal(
    (
      await ok(f, 'verification', 'check_file', {
        repo: 'fixture',
        path: 'value.txt',
        expectedHash: '0'.repeat(64),
      })
    ).data.pass,
    false,
  );
  assert.equal(
    (
      await ok(f, 'verification', 'compare_files', {
        repo: 'fixture',
        left: 'value.txt',
        right: 'same.txt',
      })
    ).equal,
    true,
  );
  assert.equal((await ok(f, 'verification', 'run_check', { check: 'pass' })).data.pass, true);
  assert.equal((await ok(f, 'verification', 'run_check', { check: 'fail' })).data.pass, false);
  const timeout = await ok(f, 'verification', 'run_check', { check: 'timeout' });
  assert.equal(timeout.data.pass, false);
  assert.equal(timeout.data.error, 'ETIMEDOUT');
  await error(f, 'verification', 'run_check', { check: 'unregistered' }, 'DENIED');
  await error(
    f,
    'verification',
    'check_file',
    { repo: 'fixture', path: '../outside', expectedHash: f.hash },
    'VALIDATION',
  );
});
test('Authority: Coldgate preserves unknown approvals; Driftglass denies by default and never grants execution', async (t) => {
  const f = setup(t);
  const report = await ok(f, 'authority', 'inspect_config', { config: configSample });
  assert.equal(report.records[0].capability.approval.status, 'UNKNOWN');
  const allow = await ok(f, 'authority', 'evaluate_policy', {
    policy: policySample,
    event: { schema_version: 1, tool: 'repo.read', effect: 'READ' },
  });
  assert.equal(allow.evaluation.decision, 'ALLOW');
  assert.equal(allow.grantsExecution, false);
  const deny = await ok(f, 'authority', 'evaluate_policy', {
    policy: policySample,
    event: { schema_version: 1, tool: 'repo.write', effect: 'WRITE' },
  });
  assert.equal(deny.evaluation.decision, 'DENY');
  await error(
    f,
    'authority',
    'inspect_config',
    { config: { tools: [{ name: 'bad', annotations: { readOnlyHint: 'yes' } }] } },
    'VALIDATION',
  );
  assert.equal((await ok(f, 'authority', 'effective_controls')).fileWritesEnabled, false);
});
test('Evidence Ledger: idempotent artifacts, explicit contradictions and missing IDs', async (t) => {
  const f = setup(t),
    a = await observation(f),
    b = await observation(f);
  assert.equal(a.id, b.id);
  await observation(f, { stance: 'refutes', statement: 'Counter evidence' });
  const claim = await ok(f, 'evidence-ledger', 'inspect_claim', { claimKey: 'tests' });
  assert.equal(claim.status, 'contested');
  assert.equal(claim.independence, 'not-verified');
  assert.deepEqual(await ok(f, 'evidence-ledger', 'get_artifact', { id: a.id }), a);
  await error(f, 'evidence-ledger', 'get_artifact', { id: '0'.repeat(64) }, 'NOT_FOUND');
});
test('Agent Run Telemetry: optimistic concurrency, chain integrity and closed-run rejection', async (t) => {
  const f = setup(t),
    run = await ok(f, 'agent-run-telemetry', 'start_run', {
      key: 'test',
      task: 'Synthetic task',
      origin: 'synthetic',
      startedAt: TIME,
    });
  const event = { id: run.id, expectedSeq: 1, at: LATER, kind: 'checkpoint', summary: 'Checked' };
  await ok(f, 'agent-run-telemetry', 'record_event', event);
  await error(f, 'agent-run-telemetry', 'record_event', event, 'CONFLICT');
  await ok(f, 'agent-run-telemetry', 'end_run', {
    id: run.id,
    expectedSeq: 2,
    at: LATER,
    outcome: 'completed',
  });
  await error(f, 'agent-run-telemetry', 'record_event', { ...event, expectedSeq: 3 }, 'STATE');
  const r = await ok(f, 'agent-run-telemetry', 'get_run', { id: run.id });
  assert.equal(r.events.length, 3);
  assert.equal(r.events[2].prev, r.events[1].hash);
});
test('Decision Memory: references, immutable supersession and cycle prevention', async (t) => {
  const f = setup(t),
    e = await observation(f),
    base = {
      question: 'Runtime?',
      choice: 'Node',
      alternatives: ['Node', 'Python'],
      rationale: 'Local-first',
      evidenceIds: [e.id],
      revisitWhen: 'New constraints',
      decidedAt: TIME,
    };
  const a = await ok(f, 'decision-memory', 'record_decision', base),
    b = await ok(f, 'decision-memory', 'record_decision', { ...base, choice: 'Python' });
  await ok(f, 'decision-memory', 'supersede', {
    id: a.id,
    replacementId: b.id,
    reason: 'Changed constraints',
  });
  await error(
    f,
    'decision-memory',
    'supersede',
    { id: b.id, replacementId: a.id, reason: 'Cycle' },
    'CONFLICT',
  );
  assert.equal((await ok(f, 'decision-memory', 'get_decision', { id: a.id })).history.length, 1);
  await error(
    f,
    'decision-memory',
    'record_decision',
    { ...base, evidenceIds: ['0'.repeat(64)] },
    'NOT_FOUND',
  );
});
test('Release Engineer: clean HEAD plus registered check; rejects dirty, stale and insufficient evidence', async (t) => {
  const f = setup(t),
    v = await ok(f, 'verification', 'run_check', { check: 'pass' }),
    p = await ok(f, 'release-engineer', 'plan_release', {
      repo: 'fixture',
      version: '0.1.0',
      verificationIds: [v.id],
    });
  assert.equal((await ok(f, 'release-engineer', 'readiness', { id: p.id })).ready, true);
  assert.equal(
    (
      await ok(f, 'release-engineer', 'release_notes', {
        repo: 'fixture',
        base: f.git('rev-parse', 'HEAD'),
      })
    ).markdown,
    '',
  );
  const hash = await ok(f, 'verification', 'check_file', {
      repo: 'fixture',
      path: 'value.txt',
      expectedHash: f.hash,
    }),
    weak = await ok(f, 'release-engineer', 'plan_release', {
      repo: 'fixture',
      version: '0.1.0',
      verificationIds: [hash.id],
    });
  assert.equal((await ok(f, 'release-engineer', 'readiness', { id: weak.id })).ready, false);
  writeFileSync(join(f.repo, 'value.txt'), 'changed');
  assert.equal((await ok(f, 'release-engineer', 'readiness', { id: p.id })).ready, false);
  f.git('add', '.');
  f.git(
    '-c',
    'user.name=Suite Test',
    '-c',
    'user.email=suite-test@example.invalid',
    'commit',
    '-m',
    'change',
  );
  assert.ok(
    (await ok(f, 'release-engineer', 'readiness', { id: p.id })).reasons.includes('HEAD_CHANGED'),
  );
});
test('Security Surface: Coldgate report, changes and manifest metadata do not run scripts', async (t) => {
  const f = setup(t);
  assert.equal(
    (await ok(f, 'security-surface', 'scan_config', { config: configSample })).records.length,
    1,
  );
  const after = {
    tools: [...configSample.tools, { name: 'delete_record', inputSchema: { type: 'object' } }],
  };
  assert.equal(
    (await ok(f, 'security-surface', 'compare_surface', { before: configSample, after })).added
      .length,
    1,
  );
  const m = await ok(f, 'security-surface', 'inspect_manifest', { repo: 'fixture' });
  assert.deepEqual(m.lifecycleScripts, ['postinstall']);
  assert.equal(m.vulnerabilityStatus, 'not-scanned');
  assert.ok(!JSON.stringify(m).includes('never execute'));
});
test('Pilot Lab: pending before outcome, exact Brier scores, no second outcome', async (t) => {
  const f = setup(t),
    e = await observation(f),
    p = await ok(f, 'pilot-lab', 'register_pilot', {
      key: 'trial',
      hypothesis: 'Synthetic test passes',
      outcomeDefinition: 'Exit zero',
      probability: 0.75,
      baselineProbability: 0.5,
      origin: 'synthetic',
      registeredAt: TIME,
    });
  assert.equal((await ok(f, 'pilot-lab', 'score_pilot', { id: p.id })).status, 'pending');
  const args = { id: p.id, outcome: true, observedAt: LATER, evidenceId: e.id };
  await ok(f, 'pilot-lab', 'record_outcome', args);
  await error(f, 'pilot-lab', 'record_outcome', args, 'CONFLICT');
  const score = await ok(f, 'pilot-lab', 'score_pilot', { id: p.id });
  assert.equal(score.brier, 0.0625);
  assert.equal(score.baselineBrier, 0.25);
  assert.equal(score.conclusion, 'descriptive-only');
});
test('Scenario/Fixture: stable synthetic fixtures and order-independent JSON comparison', async (t) => {
  const f = setup(t),
    a = {
      name: 'simple',
      input: { x: 1 },
      expected: { a: 1, b: 2 },
      purpose: 'Synthetic contract check',
    },
    r = await ok(f, 'scenario-fixture', 'save_fixture', a);
  assert.equal((await ok(f, 'scenario-fixture', 'save_fixture', a)).id, r.id);
  assert.equal(
    (await ok(f, 'scenario-fixture', 'get_fixture', { id: r.id })).data.origin,
    'synthetic',
  );
  assert.equal(
    (await ok(f, 'scenario-fixture', 'check_fixture', { id: r.id, actual: { b: 2, a: 1 } })).pass,
    true,
  );
  assert.equal(
    (await ok(f, 'scenario-fixture', 'check_fixture', { id: r.id, actual: { a: 2, b: 2 } })).pass,
    false,
  );
});
test('Action Transaction: explicit enablement, preconditions, idempotence and abort', async (t) => {
  const f = setup(t),
    p = await ok(f, 'action-transaction', 'prepare', {
      path: 'note.txt',
      content: 'safe',
      expectedHash: null,
      reason: 'Synthetic test',
    });
  assert.equal(existsSync(join(f.actions, 'note.txt')), false);
  await error(f, 'action-transaction', 'commit', { id: p.id }, 'DENIED');
  f.ctx.config.allowFileWrites = true;
  await ok(f, 'action-transaction', 'commit', { id: p.id });
  assert.equal(readFileSync(join(f.actions, 'note.txt'), 'utf8'), 'safe');
  assert.equal((await ok(f, 'action-transaction', 'commit', { id: p.id })).replayed, true);
  assert.equal((await ok(f, 'action-transaction', 'inspect', { id: p.id })).status, 'committed');
  const pending = await ok(f, 'action-transaction', 'prepare', {
    path: 'other.txt',
    content: 'new',
    expectedHash: null,
    reason: 'Abort test',
  });
  await ok(f, 'action-transaction', 'abort', { id: pending.id });
  await error(f, 'action-transaction', 'commit', { id: pending.id }, 'STATE');
  const conflict = await ok(f, 'action-transaction', 'prepare', {
    path: 'conflict.txt',
    content: 'new',
    expectedHash: null,
    reason: 'Conflict test',
  });
  writeFileSync(join(f.actions, 'conflict.txt'), 'concurrent');
  await error(f, 'action-transaction', 'commit', { id: conflict.id }, 'CONFLICT');
  assert.equal(readFileSync(join(f.actions, 'conflict.txt'), 'utf8'), 'concurrent');
});
