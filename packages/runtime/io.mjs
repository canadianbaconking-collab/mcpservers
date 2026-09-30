import { execFileSync, spawnSync } from 'node:child_process';
import {
  lstatSync,
  realpathSync,
  readFileSync,
  openSync,
  fstatSync,
  readSync,
  closeSync,
  constants,
} from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { relativePath } from '../schemas/index.mjs';
import { requireThat, SuiteError } from '../errors/index.mjs';
export function safePath(root, path, missing = false) {
  relativePath.parse(path);
  const base = realpathSync(root);
  let target = base;
  for (const [i, part] of path.split('/').entries()) {
    target = join(target, part);
    try {
      requireThat(!lstatSync(target).isSymbolicLink(), 'PATH', 'Symbolic links are not supported.');
    } catch (e) {
      if (e.code === 'ENOENT' && missing && i === path.split('/').length - 1) break;
      throw e;
    }
  }
  const rel = relative(base, target);
  requireThat(
    rel && !rel.startsWith('..') && !isAbsolute(rel),
    'PATH',
    'Path must remain within its configured root.',
  );
  return target;
}
export function readBounded(path, max = 2_000_000) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    requireThat(
      stat.isFile() && stat.size <= max,
      'LIMIT',
      'Expected a regular file within the size limit.',
    );
    const buffer = Buffer.alloc(max + 1);
    let used = 0;
    while (used < buffer.length) {
      const n = readSync(fd, buffer, used, buffer.length - used, null);
      if (!n) break;
      used += n;
    }
    requireThat(used <= max, 'LIMIT', 'File exceeds size limit.');
    return buffer.subarray(0, used);
  } finally {
    closeSync(fd);
  }
}
export function repoRoot(ctx, name) {
  requireThat(Object.hasOwn(ctx.config.repos, name), 'NOT_FOUND', 'Repository is not configured.');
  return realpathSync(ctx.config.repos[name]);
}
export function git(root, args) {
  try {
    return execFileSync(
      'git',
      ['-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', '-C', root, ...args],
      {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 2_000_000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch {
    throw new SuiteError(
      'GIT',
      'Git inspection failed; check repository ownership, refs, and availability.',
    );
  }
}
export function snapshot(ctx, name) {
  const root = repoRoot(ctx, name);
  const head = git(root, ['rev-parse', '--verify', 'HEAD']).trim();
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=normal']);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  return {
    repo: name,
    head,
    branch,
    dirty: status.length > 0,
    statusEntries: status.split('\0').filter(Boolean),
  };
}
export function processResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 10000,
    maxBuffer: 2_000_000,
    windowsHide: true,
    shell: false,
    cwd: options.cwd,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  return {
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.code ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
