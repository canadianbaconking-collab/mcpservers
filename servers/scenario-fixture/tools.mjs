import { object, name, json, byId, id, text, z } from '../../packages/schemas/index.mjs';
import { canonical } from '../../packages/provenance/index.mjs';
export const tools = {
  save_fixture: {
    description:
      'Save an immutable JSON input and expected output as an explicitly synthetic fixture.',
    input: object({ name, input: json, expected: json, purpose: text }),
    effect: 'WRITE_STATE',
    run: (ctx, a) => ctx.store.put('fixture', { ...a, origin: 'synthetic' }),
  },
  get_fixture: {
    description: 'Retrieve and hash-verify an exact fixture.',
    input: byId,
    effect: 'READ',
    run: (ctx, a) => ctx.store.get(a.id, 'fixture'),
  },
  check_fixture: {
    description:
      'Compare supplied actual JSON to a frozen expected value with canonical key ordering; no code executes.',
    input: object({ id, actual: json }),
    effect: 'READ',
    run: (ctx, a) => {
      const f = ctx.store.get(a.id, 'fixture');
      return {
        fixtureId: a.id,
        pass: canonical(f.data.expected) === canonical(a.actual),
        expected: f.data.expected,
        actual: a.actual,
        origin: 'synthetic',
      };
    },
  },
};
