import { object, text, z, timestamp, byId, id } from '../../packages/schemas/index.mjs';
export const tools = {
  record_observation: {
    description:
      'Store an immutable, explicitly attributed observation; a declared stance is not independently verified truth.',
    input: object({
      claimKey: text,
      statement: text,
      sourceUri: z.string().url().max(2000),
      observedAt: timestamp,
      stance: z.enum(['supports', 'refutes', 'neutral', 'unassessed']),
      sourceFamily: text.optional(),
    }),
    effect: 'WRITE_STATE',
    run: (ctx, a) => ctx.store.put('observation', { ...a, provenanceStatus: 'DECLARED' }),
  },
  get_artifact: {
    description: 'Retrieve and hash-verify any exact suite artifact by ID.',
    input: byId,
    effect: 'READ',
    run: (ctx, a) => ctx.store.get(a.id),
  },
  inspect_claim: {
    description:
      'Inspect explicit observations for a claim; no semantic grouping or inferred independence.',
    input: object({ claimKey: text }),
    effect: 'READ',
    run: (ctx, a) => {
      const rows = ctx.store.list('observation', 10001);
      if (rows.length > 10000) throw new Error('Observation limit');
      const observations = rows.filter((x) => x.data.claimKey === a.claimKey),
        support = observations.filter((x) => x.data.stance === 'supports'),
        counter = observations.filter((x) => x.data.stance === 'refutes');
      return {
        claimKey: a.claimKey,
        observations,
        status:
          support.length && counter.length
            ? 'contested'
            : support.length
              ? 'supported-as-declared'
              : 'unassessed',
        declaredSupportFamilies: [
          ...new Set(support.map((x) => x.data.sourceFamily).filter(Boolean)),
        ].sort(),
        independence: 'not-verified',
        compatibility: 'suite schema 1; not a SignalForge evidence artifact',
      };
    },
  },
};
