import { createHash } from 'node:crypto';
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
        .join(',') +
      '}'
    );
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value)))
    throw new TypeError('Non-JSON value');
  return JSON.stringify(value);
}
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const digest = (value) => sha256(canonical(value));
export const artifactId = (kind, data) => digest({ schemaVersion: 1, kind, data });
