import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createContext, invoke } from '../runtime/index.mjs';
import { sha256 } from '../provenance/index.mjs';
export const TIME = '2026-09-29T12:00:00Z',
  LATER = '2026-09-29T12:01:00Z';
export const configSample = {
  tools: [
    { name: 'get_record', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
  ],
};
export const policySample = {
  schema_version: 1,
  default: 'deny',
  rules: [{ id: 'read', allow: { tool: 'repo.read', effect: 'READ' } }],
};
export function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'frosted-suite-')),
    repo = join(root, 'repo'),
    actions = join(root, 'actions');
  mkdirSync(repo);
  mkdirSync(actions);
  const git = (...args) =>
    execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  writeFileSync(join(repo, 'PROJECT_STATE.md'), '# Synthetic fixture\nReady for a test.\n');
  writeFileSync(join(repo, 'value.txt'), 'alpha');
  writeFileSync(join(repo, 'same.txt'), 'alpha');
  writeFileSync(
    join(repo, 'package.json'),
    JSON.stringify({
      name: 'synthetic',
      scripts: { postinstall: 'never execute' },
      dependencies: { example: 'https://example.invalid/repo' },
    }),
  );
  git('add', '.');
  git(
    '-c',
    'user.name=Suite Test',
    '-c',
    'user.email=suite-test@example.invalid',
    'commit',
    '-m',
    'Synthetic fixture',
  );
  const config = {
    schemaVersion: 1,
    dataDir: join(root, 'data'),
    repos: { fixture: repo },
    actionRoot: actions,
    allowFileWrites: false,
    checks: {
      pass: { repo: 'fixture', command: process.execPath, args: ['-e', 'process.exit(0)'] },
      fail: { repo: 'fixture', command: process.execPath, args: ['-e', 'process.exit(2)'] },
      timeout: {
        repo: 'fixture',
        command: process.execPath,
        args: ['-e', 'setInterval(()=>{},1000)'],
        timeoutMs: 100,
      },
    },
    ...options,
  };
  const ctx = createContext(config);
  return {
    root,
    repo,
    actions,
    ctx,
    config,
    git,
    hash: sha256('alpha'),
    call: (server, name, args) => invoke(ctx, server, name, args),
    close() {
      ctx.store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
