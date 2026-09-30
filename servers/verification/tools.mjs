import { object, repo, relativePath, id, z, name, text } from '../../packages/schemas/index.mjs';
import {
  readBounded,
  safePath,
  repoRoot,
  snapshot,
  processResult,
} from '../../packages/runtime/io.mjs';
import { sha256 } from '../../packages/provenance/index.mjs';
import { requireThat } from '../../packages/errors/index.mjs';
import { python } from '../../packages/adapters/python.mjs';
export const tools = {
  check_file: {
    description:
      'Check exact file bytes against an expected SHA-256 and retain an evidence artifact.',
    input: object({ ...repo, path: relativePath, expectedHash: id }),
    effect: 'WRITE_STATE',
    run: (ctx, a) => {
      const before = snapshot(ctx, a.repo),
        actualHash = sha256(readBounded(safePath(repoRoot(ctx, a.repo), a.path)));
      return ctx.store.put('verification', {
        method: 'file-sha256',
        repo: a.repo,
        head: before.head,
        dirty: before.dirty,
        path: a.path,
        expectedHash: a.expectedHash,
        actualHash,
        pass: actualHash === a.expectedHash,
        scope: 'one-file',
      });
    },
  },
  compare_files: {
    description: 'Compare bounded file bytes without executing repository code.',
    input: object({ ...repo, left: relativePath, right: relativePath }),
    effect: 'READ',
    run: (ctx, a) => {
      const root = repoRoot(ctx, a.repo),
        left = sha256(readBounded(safePath(root, a.left))),
        right = sha256(readBounded(safePath(root, a.right)));
      return { equal: left === right, leftHash: left, rightHash: right };
    },
  },
  gather_review: {
    description:
      'Use the pinned Faultline collector with policy from a trusted base commit. No project checks execute.',
    input: object({
      ...repo,
      base: z.string().regex(/^[a-f0-9]{40,64}$/),
      includeWorkingTree: z.boolean().default(false),
      intent: text,
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) =>
      ctx.store.put('review-packet', python(ctx, 'faultline', a, repoRoot(ctx, a.repo))),
  },
  run_check: {
    description:
      'Execute only a named command preconfigured by the operator. This is not a sandbox; stores hashes, not raw output.',
    input: object({ check: name }),
    effect: 'EXECUTE_LOCAL',
    run: (ctx, a) => {
      const check = ctx.config.checks[a.check];
      requireThat(check, 'DENIED', 'Check is not registered by the operator.');
      const before = snapshot(ctx, check.repo),
        r = processResult(check.command, check.args, {
          cwd: repoRoot(ctx, check.repo),
          timeoutMs: check.timeoutMs,
        }),
        after = snapshot(ctx, check.repo);
      return ctx.store.put('verification', {
        method: 'registered-check',
        check: a.check,
        repo: check.repo,
        head: before.head,
        dirty: before.dirty,
        afterHead: after.head,
        afterDirty: after.dirty,
        commandHash: sha256(JSON.stringify([check.command, check.args])),
        exitCode: r.exitCode,
        error: r.error,
        stdoutHash: sha256(r.stdout),
        stderrHash: sha256(r.stderr),
        pass:
          r.exitCode === 0 &&
          !r.error &&
          before.head === after.head &&
          !before.dirty &&
          !after.dirty,
        scope: 'operator-registered-command',
        captureComplete: !r.error,
      });
    },
  },
};
