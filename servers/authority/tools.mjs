import { object, json, empty } from '../../packages/schemas/index.mjs';
import { scanConfig } from '../../vendor/coldgate/authority/src/scan.ts';
import { evaluate, loadPolicy } from '../../vendor/driftglass/kernel/index.js';
import { requireThat } from '../../packages/errors/index.mjs';
export const tools = {
  inspect_config: {
    description:
      'Analyze saved MCP configuration using pinned Coldgate; declarations do not prove enforcement.',
    input: object({ config: json }),
    effect: 'READ',
    run: (_ctx, a) => {
      const report = scanConfig(a.config);
      requireThat(
        !report.errors.length,
        'VALIDATION',
        'Coldgate rejected the saved configuration.',
      );
      return report;
    },
  },
  evaluate_policy: {
    description:
      'Evaluate a hypothetical event using pinned Driftglass. Caller-supplied policy cannot grant suite permissions.',
    input: object({ policy: json, event: json }),
    effect: 'READ',
    run: (_ctx, a) => ({
      evaluation: evaluate(loadPolicy(a.policy), a.event),
      mode: 'advisory',
      grantsExecution: false,
    }),
  },
  effective_controls: {
    description: 'Describe actual suite controls and unknown host approval behavior.',
    input: empty,
    effect: 'READ',
    run: (ctx) => ({
      principal: 'local-process-owner',
      transport: 'stdio',
      configuredRepos: Object.keys(ctx.config.repos).sort(),
      fileWritesEnabled: ctx.config.allowFileWrites,
      registeredChecks: Object.keys(ctx.config.checks).sort(),
      hostApproval: 'UNKNOWN',
      networkTools: false,
      staticAnalysis: 'Coldgate',
      policyEvaluator: 'Driftglass',
      limits: ['not an OS sandbox', 'cannot govern other MCP servers'],
    }),
  },
};
