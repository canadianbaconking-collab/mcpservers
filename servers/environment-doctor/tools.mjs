import { empty, object, z, name } from '../../packages/schemas/index.mjs';
import { processResult, snapshot } from '../../packages/runtime/io.mjs';
export const tools = {
  diagnose: {
    description:
      'Check fixed local runtimes without contacting services or reading credential values.',
    input: empty,
    effect: 'READ',
    run: (ctx) => {
      const versions = { node: { available: true, version: process.version } };
      for (const [name, command, args] of [
        ['git', 'git', ['--version']],
        ['gh', 'gh', ['--version']],
        ['python', ctx.config.python ?? 'python', ['--version']],
      ]) {
        const r = processResult(command, args, { timeoutMs: 2000 });
        versions[name] = {
          available: r.exitCode === 0,
          version: r.exitCode === 0 ? r.stdout.trim().split('\n')[0] : null,
          reason: r.error,
        };
      }
      return {
        platform: process.platform,
        versions,
        githubRoute: versions.gh.available
          ? 'cli-available-auth-unverified'
          : 'use-connected-integration-if-available',
        authentication: 'not-probed',
      };
    },
  },
  credential_presence: {
    description:
      'Report presence only for explicitly named credential variables; values are never returned.',
    input: object({ names: z.array(name).max(20) }),
    effect: 'READ',
    run: (_ctx, a) => ({
      credentials: a.names.map((name) => ({
        name,
        present: typeof process.env[name] === 'string' && process.env[name].length > 0,
      })),
      authentication: 'presence-does-not-prove-validity',
    }),
  },
  workspace_health: {
    description: 'Check configured Git repositories and collect explicit failures.',
    input: empty,
    effect: 'READ',
    run: (ctx) => ({
      repos: Object.keys(ctx.config.repos)
        .sort()
        .map((repo) => {
          try {
            return { ...snapshot(ctx, repo), available: true };
          } catch {
            return { repo, available: false, reason: 'Git inspection unavailable' };
          }
        }),
    }),
  },
};
