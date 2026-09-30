import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { lstatSync, readdirSync } from 'node:fs';
import { processResult } from '../runtime/io.mjs';
import { requireThat } from '../errors/index.mjs';
const runner = fileURLToPath(new URL('./runner.py', import.meta.url));
export function python(ctx, operation, args, cwd) {
  requireThat(
    ctx.config.python,
    'UNAVAILABLE',
    'Set an operator-owned Python executable in the configuration to use this adapter.',
  );
  if (operation === 'blackbird') {
    let count = 0,
      bytes = 0;
    const walk = (path, depth = 0) => {
      requireThat(++count <= 2000 && depth <= 12, 'LIMIT', 'Bundle contains too many entries.');
      const stat = lstatSync(path);
      requireThat(!stat.isSymbolicLink(), 'PATH', 'Bundle links are not supported.');
      if (stat.isDirectory())
        for (const entry of readdirSync(path)) walk(join(path, entry), depth + 1);
      else {
        requireThat(stat.isFile(), 'PATH', 'Bundle entries must be regular files.');
        bytes += stat.size;
        requireThat(
          stat.size <= 16_000_000 && bytes <= 32_000_000,
          'LIMIT',
          'Bundle exceeds adapter limits.',
        );
      }
    };
    walk(args.path);
  }
  const result = processResult(ctx.config.python, [runner, operation, JSON.stringify(args)], {
    cwd,
    timeoutMs: 30000,
  });
  requireThat(result.exitCode === 0, 'ADAPTER', 'Upstream adapter failed or exceeded its bound.');
  return JSON.parse(result.stdout);
}
