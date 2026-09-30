import { object, repo, relativePath, json } from '../../packages/schemas/index.mjs';
import { safePath, readBounded, repoRoot } from '../../packages/runtime/io.mjs';
import { scanConfig } from '../../vendor/coldgate/authority/src/scan.ts';
import { requireThat } from '../../packages/errors/index.mjs';
function scan(config) {
  const report = scanConfig(config);
  requireThat(!report.errors.length, 'VALIDATION', 'Coldgate rejected the configuration.');
  return report;
}
export const tools = {
  scan_config: {
    description:
      'Run pinned Coldgate static analysis; no server is contacted and no configuration command executes.',
    input: object({ config: json }),
    effect: 'READ',
    run: (_ctx, a) => scan(a.config),
  },
  compare_surface: {
    description:
      'Compare effect and approval declarations from two saved configurations; no runtime revocation is inferred.',
    input: object({ before: json, after: json }),
    effect: 'READ',
    run: (_ctx, a) => {
      const before = scan(a.before),
        after = scan(a.after),
        old = new Map(before.records.map((r) => [r.id, r])),
        current = new Map(after.records.map((r) => [r.id, r]));
      return {
        added: after.records.filter((r) => !old.has(r.id)).map((r) => r.id),
        removed: before.records.filter((r) => !current.has(r.id)).map((r) => r.id),
        changed: after.records
          .filter(
            (r) =>
              old.has(r.id) &&
              JSON.stringify(old.get(r.id).capability) !== JSON.stringify(r.capability),
          )
          .map((r) => ({ id: r.id, before: old.get(r.id).capability, after: r.capability })),
        evidence: 'static-declarations',
        runtimeRevocation: 'UNKNOWN',
      };
    },
  },
  inspect_manifest: {
    description:
      'Inspect package dependency origins and lifecycle script presence without executing scripts or returning script bodies.',
    input: object({ ...repo, path: relativePath.default('package.json') }),
    effect: 'READ',
    run: (ctx, a) => {
      const m = JSON.parse(readBounded(safePath(repoRoot(ctx, a.repo), a.path), 100000).toString());
      requireThat(
        m && typeof m === 'object' && !Array.isArray(m),
        'VALIDATION',
        'Expected a package manifest object.',
      );
      const dependencies = Object.entries({ ...m.dependencies, ...m.devDependencies }).map(
        ([name, version]) => ({
          name,
          source:
            typeof version !== 'string'
              ? 'invalid'
              : /^(git|https?:|github:)/.test(version)
                ? 'remote-source'
                : /^(file:|link:|workspace:)/.test(version)
                  ? 'local'
                  : 'registry',
        }),
      );
      return {
        dependencies,
        lifecycleScripts: ['preinstall', 'install', 'postinstall', 'prepare'].filter((k) =>
          Object.hasOwn(m.scripts ?? {}, k),
        ),
        vulnerabilityStatus: 'not-scanned',
        secrets: 'values-not-inspected',
      };
    },
  },
};
