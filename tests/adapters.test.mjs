import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
import { fixture } from '../packages/test-fixtures/index.mjs';
const python = process.env.SUITE_TEST_PYTHON;
test(
  'Faultline adapter: trusted base policy, exact diff hash and no project execution',
  { skip: !python },
  async (t) => {
    const f = fixture({ python });
    t.after(() => f.close());
    writeFileSync(join(f.repo, 'value.txt'), 'new');
    const args = {
      repo: 'fixture',
      base: f.git('rev-parse', 'HEAD'),
      includeWorkingTree: true,
      intent: 'Synthetic review',
    };
    const r = await f.call('verification', 'gather_review', args);
    assert.equal(r.ok, true, JSON.stringify(r));
    const data = r.data.data;
    assert.equal(data.metadata.checks.executed, false);
    assert.equal(data.metadata.scope.dirty, true);
    assert.match(data.metadata.scope.diffHash, /^[a-f0-9]{64}$/);
    const again = await f.call('verification', 'gather_review', args);
    assert.equal(again.data.id, r.data.id);
  },
);
test(
  'BlackBird adapter: upstream verifier reproduces a synthetic bundle and rejects tampering',
  { skip: !python },
  async (t) => {
    const f = fixture({ python });
    t.after(() => f.close());
    execFileSync(python, [resolve('tests/make_blackbird_fixture.py'), f.repo], {
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      timeout: 20000,
      windowsHide: true,
    });
    const args = { repo: 'fixture', path: 'bundle' };
    const r = await f.call('pilot-lab', 'verify_blackbird', args);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.report_reproduced, true);
    assert.equal(r.data.external_anchor_checked, false);
    const path = join(f.repo, 'bundle', 'report.json');
    writeFileSync(path, JSON.stringify({ tampered: true }));
    assert.equal((await f.call('pilot-lab', 'verify_blackbird', args)).ok, false);
  },
);
