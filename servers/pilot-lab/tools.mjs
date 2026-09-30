import {
  object,
  name,
  text,
  z,
  origin,
  timestamp,
  byId,
  id,
  repo,
  relativePath,
} from '../../packages/schemas/index.mjs';
import { requireThat } from '../../packages/errors/index.mjs';
import { safePath, repoRoot } from '../../packages/runtime/io.mjs';
import { python } from '../../packages/adapters/python.mjs';
export const tools = {
  register_pilot: {
    description:
      'Freeze a binary outcome definition, hypothesis, forecast and baseline before recording an outcome.',
    input: object({
      key: name,
      hypothesis: text,
      outcomeDefinition: text,
      probability: z.number().min(0).max(1),
      baselineProbability: z.number().min(0).max(1),
      origin,
      registeredAt: timestamp,
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) => ctx.store.put('pilot', a),
  },
  record_outcome: {
    description:
      'Record one declared outcome linked to existing evidence; registration time is local and not a trusted timestamp.',
    input: object({ id, outcome: z.boolean(), observedAt: timestamp, evidenceId: id }),
    effect: 'WRITE_STATE',
    run: (ctx, a) =>
      ctx.store.transaction(() => {
        const pilot = ctx.store.get(a.id, 'pilot');
        ctx.store.get(a.evidenceId);
        requireThat(
          Date.parse(a.observedAt) > Date.parse(pilot.data.registeredAt),
          'VALIDATION',
          'Outcome must follow registration.',
        );
        requireThat(
          !ctx.store.events('pilot:' + a.id).length,
          'CONFLICT',
          'Pilot already has an outcome.',
        );
        return ctx.store.append('pilot:' + a.id, {
          outcome: a.outcome,
          observedAt: a.observedAt,
          evidenceId: a.evidenceId,
        });
      }),
  },
  score_pilot: {
    description:
      'Compute deterministic Brier scores for one closed binary pilot; one result does not validate a theory.',
    input: byId,
    effect: 'READ',
    run: (ctx, a) => {
      const p = ctx.store.get(a.id, 'pilot').data,
        outcome = ctx.store.events('pilot:' + a.id)[0]?.data;
      if (!outcome) return { status: 'pending', origin: p.origin };
      const y = Number(outcome.outcome);
      return {
        status: 'scored',
        origin: p.origin,
        brier: (p.probability - y) ** 2,
        baselineBrier: (p.baselineProbability - y) ** 2,
        sampleSize: 1,
        conclusion: 'descriptive-only',
        outcome,
      };
    },
  },
  verify_blackbird: {
    description:
      "Use BlackBird's pinned offline bundle verifier; never executes commands recorded in a bundle.",
    input: object({ ...repo, path: relativePath, expectedHead: id.optional() }),
    effect: 'READ',
    run: (ctx, a) =>
      python(
        ctx,
        'blackbird',
        { path: safePath(repoRoot(ctx, a.repo), a.path), expectedHead: a.expectedHead },
        repoRoot(ctx, a.repo),
      ),
  },
};
