import {
  object,
  name,
  text,
  timestamp,
  byId,
  id,
  z,
  evidenceRefs,
  origin,
} from '../../packages/schemas/index.mjs';
import { requireThat } from '../../packages/errors/index.mjs';
export const tools = {
  start_run: {
    description:
      'Register an explicitly labelled run; registration is idempotent for identical inputs.',
    input: object({ key: name, task: text, origin, startedAt: timestamp }),
    effect: 'WRITE_STATE',
    run: (ctx, a) =>
      ctx.store.transaction(() => {
        const run = ctx.store.put('run', a);
        if (!ctx.store.events(run.id).length)
          ctx.store.append(run.id, { kind: 'start', at: a.startedAt });
        return run;
      }),
  },
  record_event: {
    description: 'Append an event using expected sequence to detect concurrent or repeated writes.',
    input: object({
      id,
      expectedSeq: z.number().int().min(1),
      at: timestamp,
      kind: z.enum(['checkpoint', 'decision', 'reversal', 'obligation', 'failure']),
      summary: text,
      evidenceIds: evidenceRefs,
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) =>
      ctx.store.transaction(() => {
        ctx.store.get(a.id, 'run');
        ctx.store.references(a.evidenceIds);
        const events = ctx.store.events(a.id),
          last = events.at(-1);
        requireThat(last.seq === a.expectedSeq, 'CONFLICT', 'Run sequence changed.');
        requireThat(last.data.kind !== 'end', 'STATE', 'Run has ended.');
        requireThat(
          Date.parse(a.at) >= Date.parse(last.data.at),
          'VALIDATION',
          'Event time precedes the prior event.',
        );
        return ctx.store.append(a.id, {
          kind: a.kind,
          at: a.at,
          summary: a.summary,
          evidenceIds: a.evidenceIds,
        });
      }),
  },
  end_run: {
    description: 'Close a run using optimistic concurrency; no events can follow closure.',
    input: object({
      id,
      expectedSeq: z.number().int().min(1),
      at: timestamp,
      outcome: z.enum(['completed', 'failed', 'abandoned']),
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) =>
      ctx.store.transaction(() => {
        ctx.store.get(a.id, 'run');
        const last = ctx.store.events(a.id).at(-1);
        requireThat(last.seq === a.expectedSeq, 'CONFLICT', 'Run sequence changed.');
        requireThat(
          last.data.kind !== 'end' && Date.parse(a.at) >= Date.parse(last.data.at),
          'STATE',
          'Run is closed or timestamp is earlier.',
        );
        return ctx.store.append(a.id, { kind: 'end', at: a.at, outcome: a.outcome });
      }),
  },
  get_run: {
    description: 'Read a registered run and verify its full event hash chain.',
    input: byId,
    effect: 'READ',
    run: (ctx, a) => ({ run: ctx.store.get(a.id, 'run'), events: ctx.store.events(a.id) }),
  },
};
