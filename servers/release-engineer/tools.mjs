import { object, repo, z, id, text, byId } from '../../packages/schemas/index.mjs';
import { snapshot, repoRoot, git } from '../../packages/runtime/io.mjs';
import { requireThat } from '../../packages/errors/index.mjs';
const gates = z
  .array(id)
  .min(1)
  .max(50)
  .refine((v) => new Set(v).size === v.length);
export const tools = {
  plan_release: {
    description:
      'Freeze the repository HEAD, proposed version and exact verification artifacts; never tags or publishes.',
    input: object({
      ...repo,
      version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/),
      verificationIds: gates,
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) => {
      for (const id of a.verificationIds) ctx.store.get(id, 'verification');
      return ctx.store.put('release-plan', { ...a, snapshot: snapshot(ctx, a.repo) });
    },
  },
  readiness: {
    description:
      'Check a stored release plan against current HEAD, dirtiness, and exact registered-check evidence; file hashes alone do not pass a release.',
    input: byId,
    effect: 'READ',
    run: (ctx, a) => {
      const plan = ctx.store.get(a.id, 'release-plan').data,
        current = snapshot(ctx, plan.repo),
        reasons = [];
      if (current.head !== plan.snapshot.head) reasons.push('HEAD_CHANGED');
      if (current.dirty || plan.snapshot.dirty) reasons.push('DIRTY_TREE');
      for (const id of plan.verificationIds) {
        const v = ctx.store.get(id, 'verification').data;
        if (v.repo !== plan.repo || v.head !== current.head)
          reasons.push('STALE_OR_FOREIGN_VERIFICATION');
        if (v.method !== 'registered-check' || !v.pass) reasons.push('CHECK_NOT_PASSING');
      }
      return {
        planId: a.id,
        ready: reasons.length === 0,
        reasons: [...new Set(reasons)],
        head: current.head,
        scope: 'configured-checks-only',
        published: false,
      };
    },
  },
  release_notes: {
    description:
      'Create deterministic Markdown from a bounded commit range; commit text remains untrusted.',
    input: object({ ...repo, base: z.string().regex(/^[a-f0-9]{40,64}$/) }),
    effect: 'READ',
    run: (ctx, a) => ({
      markdown: git(repoRoot(ctx, a.repo), [
        'log',
        '--max-count=100',
        '--format=- %s (%h)',
        `${a.base}..HEAD`,
      ]),
      limit: 100,
      published: false,
    }),
  },
};
