import {
  object,
  text,
  timestamp,
  evidenceRefs,
  byId,
  id,
  z,
} from '../../packages/schemas/index.mjs';
import { requireThat } from '../../packages/errors/index.mjs';
export const tools = {
  record_decision: {
    description:
      'Persist a decision with alternatives, rationale, evidence IDs, and a revisit condition.',
    input: object({
      question: text,
      choice: text,
      alternatives: z.array(text).min(1).max(20),
      rationale: text,
      evidenceIds: evidenceRefs,
      revisitWhen: text,
      decidedAt: timestamp,
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) => {
      ctx.store.references(a.evidenceIds);
      requireThat(
        a.alternatives.includes(a.choice),
        'VALIDATION',
        'Choice must appear among alternatives.',
      );
      return ctx.store.put('decision', a);
    },
  },
  get_decision: {
    description: 'Return an exact immutable decision plus supersession history.',
    input: byId,
    effect: 'READ',
    run: (ctx, a) => ({
      decision: ctx.store.get(a.id, 'decision'),
      history: ctx.store.events('decision:' + a.id),
    }),
  },
  supersede: {
    description:
      'Link an existing decision to its replacement without rewriting history; cycles and repeated replacement are rejected.',
    input: object({ id, replacementId: id, reason: text }),
    effect: 'WRITE_STATE',
    run: (ctx, a) =>
      ctx.store.transaction(() => {
        ctx.store.get(a.id, 'decision');
        ctx.store.get(a.replacementId, 'decision');
        requireThat(a.id !== a.replacementId, 'VALIDATION', 'A decision cannot supersede itself.');
        requireThat(
          !ctx.store.events('decision:' + a.id).length,
          'CONFLICT',
          'Decision already superseded.',
        );
        let cursor = a.replacementId;
        const seen = new Set([a.id]);
        while (cursor) {
          requireThat(!seen.has(cursor), 'CONFLICT', 'Supersession would create a cycle.');
          seen.add(cursor);
          cursor = ctx.store.events('decision:' + cursor)[0]?.data.replacementId;
        }
        return ctx.store.append('decision:' + a.id, {
          replacementId: a.replacementId,
          reason: a.reason,
        });
      }),
  },
};
