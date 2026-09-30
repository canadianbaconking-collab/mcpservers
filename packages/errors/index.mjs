export class SuiteError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
export function requireThat(condition, code, message) {
  if (!condition) throw new SuiteError(code, message);
}
export function publicError(error) {
  if (error instanceof SuiteError) return { code: error.code, message: error.message };
  if (error?.name === 'ZodError' || error?.name === 'ValidationError')
    return { code: 'VALIDATION', message: 'Input does not match the contract.' };
  return { code: 'INTERNAL', message: 'Operation failed; no successful result is implied.' };
}
