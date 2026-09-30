import {
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  existsSync,
  unlinkSync,
  renameSync,
} from 'node:fs';
import { object, relativePath, text, id, byId, z } from '../../packages/schemas/index.mjs';
import { safePath, readBounded } from '../../packages/runtime/io.mjs';
import { sha256 } from '../../packages/provenance/index.mjs';
import { requireThat } from '../../packages/errors/index.mjs';
function target(ctx, path) {
  requireThat(ctx.config.actionRoot, 'DENIED', 'No action root is configured.');
  return safePath(ctx.config.actionRoot, path, true);
}
function currentHash(path) {
  return existsSync(path) ? sha256(readBounded(path, 100000)) : null;
}
function state(ctx, id) {
  const plan = ctx.store.get(id, 'file-plan'),
    events = ctx.store.events('transaction:' + id);
  return { plan, events, status: events.at(-1)?.data.status ?? 'prepared' };
}
export const tools = {
  prepare: {
    description:
      'Prepare one bounded UTF-8 file replacement with an exact precondition. Does not change the target file.',
    input: object({
      path: relativePath,
      content: z.string().max(100000),
      expectedHash: id.nullable(),
      reason: text,
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) => {
      requireThat(Buffer.byteLength(a.content) <= 100000, 'LIMIT', 'Content exceeds 100 KB.');
      requireThat(
        currentHash(target(ctx, a.path)) === a.expectedHash,
        'CONFLICT',
        'Target does not match expected bytes.',
      );
      return ctx.store.put('file-plan', {
        ...a,
        afterHash: sha256(a.content),
        root: ctx.config.actionRoot,
      });
    },
  },
  inspect: {
    description: 'Inspect a prepared file plan and its immutable transition history.',
    input: byId,
    effect: 'READ',
    run: (ctx, a) => state(ctx, a.id),
  },
  commit: {
    description:
      'Apply a prepared single-file change only when operator configuration permits it and precondition still holds. Retry is idempotent.',
    input: byId,
    effect: 'WRITE_FILE',
    run: (ctx, a) =>
      ctx.store.transaction(() => {
        const s = state(ctx, a.id),
          p = s.plan.data;
        requireThat(p.root === ctx.config.actionRoot, 'CONFLICT', 'Action root changed.');
        if (s.status === 'committed') return { id: a.id, status: 'committed', replayed: true };
        requireThat(s.status === 'prepared', 'STATE', 'Transaction was aborted.');
        const path = target(ctx, p.path),
          actual = currentHash(path);
        // A prior process may have replaced the file before the SQLite commit. Reconcile exact bytes.
        if (actual === p.afterHash) {
          ctx.store.append('transaction:' + a.id, { status: 'committed', reconciled: true });
          return {
            id: a.id,
            status: 'committed',
            reconciled: true,
            attribution: 'exact-bytes-only',
          };
        }
        requireThat(actual === p.expectedHash, 'CONFLICT', 'File changed since preparation.');
        const temporary = safePath(ctx.config.actionRoot, p.path + '.suite-' + a.id + '.tmp', true);
        if (existsSync(temporary)) {
          requireThat(
            sha256(readBounded(temporary, 100000)) === p.afterHash,
            'CONFLICT',
            'Conflicting staging file.',
          );
          unlinkSync(temporary);
        }
        const fd = openSync(temporary, 'wx');
        try {
          writeFileSync(fd, p.content, 'utf8');
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        // Recheck after staging. Local concurrent hostile writers are outside the v0.1 boundary.
        requireThat(
          currentHash(target(ctx, p.path)) === p.expectedHash,
          'CONFLICT',
          'File changed during preparation.',
        );
        renameSync(temporary, path);
        ctx.store.append('transaction:' + a.id, { status: 'committed', afterHash: p.afterHash });
        return { id: a.id, status: 'committed', afterHash: p.afterHash };
      }),
  },
  abort: {
    description: 'Abort a pending proposal without touching target bytes.',
    input: byId,
    effect: 'WRITE_STATE',
    run: (ctx, a) =>
      ctx.store.transaction(() => {
        const s = state(ctx, a.id);
        requireThat(s.status === 'prepared', 'STATE', 'Only prepared transactions can be aborted.');
        requireThat(
          currentHash(target(ctx, s.plan.data.path)) !== s.plan.data.afterHash,
          'STATE',
          'Target already matches proposed bytes; reconcile with commit.',
        );
        return ctx.store.append('transaction:' + a.id, { status: 'aborted' });
      }),
  },
};
