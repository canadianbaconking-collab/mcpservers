import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fixture,
  TIME,
  LATER,
  policySample,
  configSample,
} from '../packages/test-fixtures/index.mjs';
export async function workflow() {
  const f = fixture({ allowFileWrites: true }),
    used = new Set();
  const call = async (server, name, args = {}) => {
    const r = await f.call(server, name, args);
    if (!r.ok) throw Error(JSON.stringify(r.error));
    used.add(server);
    return r.data;
  };
  try {
    const health = await call('environment-doctor', 'diagnose');
    const state = await call('repo-state', 'get_state', { repo: 'fixture' });
    const authority = await call('authority', 'evaluate_policy', {
      policy: policySample,
      event: { schema_version: 1, tool: 'repo.read', effect: 'READ' },
    });
    const security = await call('security-surface', 'scan_config', { config: configSample });
    const run = await call('agent-run-telemetry', 'start_run', {
      key: 'demo',
      task: 'Synthetic end-to-end acceptance',
      origin: 'synthetic',
      startedAt: TIME,
    });
    const pilot = await call('pilot-lab', 'register_pilot', {
      key: 'demo',
      hypothesis: 'Registered check passes',
      outcomeDefinition: 'Check exits zero on unchanged clean HEAD',
      probability: 0.75,
      baselineProbability: 0.5,
      origin: 'synthetic',
      registeredAt: TIME,
    });
    const scenario = await call('scenario-fixture', 'save_fixture', {
      name: 'pass-shape',
      input: { check: 'pass' },
      expected: { pass: true },
      purpose: 'Synthetic expectation',
    });
    const verification = await call('verification', 'run_check', { check: 'pass' });
    const match = await call('scenario-fixture', 'check_fixture', {
      id: scenario.id,
      actual: { pass: verification.data.pass },
    });
    const evidence = await call('evidence-ledger', 'get_artifact', { id: verification.id });
    const decision = await call('decision-memory', 'record_decision', {
      question: 'Is the synthetic check accepted?',
      choice: 'accept',
      alternatives: ['accept', 'reject'],
      rationale: 'Recorded clean-HEAD command passed',
      evidenceIds: [evidence.id],
      revisitWhen: 'HEAD or check changes',
      decidedAt: LATER,
    });
    await call('agent-run-telemetry', 'record_event', {
      id: run.id,
      expectedSeq: 1,
      at: LATER,
      kind: 'decision',
      summary: 'Accepted synthetic evidence',
      evidenceIds: [verification.id, decision.id],
    });
    await call('pilot-lab', 'record_outcome', {
      id: pilot.id,
      outcome: verification.data.pass,
      observedAt: LATER,
      evidenceId: verification.id,
    });
    const score = await call('pilot-lab', 'score_pilot', { id: pilot.id });
    const plan = await call('release-engineer', 'plan_release', {
      repo: 'fixture',
      version: '0.1.0',
      verificationIds: [verification.id],
    });
    const readiness = await call('release-engineer', 'readiness', { id: plan.id });
    const proposal = await call('action-transaction', 'prepare', {
      path: 'acceptance.json',
      content: JSON.stringify({ ready: readiness.ready, decisionId: decision.id }),
      expectedHash: null,
      reason: 'Write synthetic local acceptance receipt',
    });
    await call('action-transaction', 'commit', { id: proposal.id });
    await call('agent-run-telemetry', 'end_run', {
      id: run.id,
      expectedSeq: 2,
      at: LATER,
      outcome: 'completed',
    });
    return {
      origin: 'synthetic',
      serversUsed: [...used].sort(),
      nodeAvailable: health.versions.node.available,
      cleanStart: !state.dirty,
      authorityDecision: authority.evaluation.decision,
      staticRecords: security.records.length,
      fixturePassed: match.pass,
      releaseReady: readiness.ready,
      pilotBrier: score.brier,
      receiptMatches:
        JSON.parse(readFileSync(join(f.actions, 'acceptance.json'), 'utf8')).decisionId ===
        decision.id,
      externalActions: 0,
    };
  } finally {
    f.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await workflow(), null, 2));
