import { requireThat } from '../errors/index.mjs';
export const effects = ['READ', 'WRITE_STATE', 'WRITE_FILE', 'EXECUTE_LOCAL'];
export function annotations(effect) {
  return {
    readOnlyHint: effect === 'READ',
    destructiveHint: effect === 'WRITE_FILE',
    idempotentHint: effect === 'READ',
    openWorldHint: false,
  };
}
export function enforce(config, effect) {
  if (effect === 'WRITE_FILE')
    requireThat(
      config.allowFileWrites && config.actionRoot,
      'DENIED',
      'File commits are disabled in the operator configuration.',
    );
}
export function metadata(effect) {
  return {
    effect,
    status: 'DECLARED',
    principal: 'local-process-owner',
    authentication: 'stdio process ownership',
    enforcement: 'suite configuration and bounded adapters',
    hostApproval: 'UNKNOWN',
  };
}
