import { z } from 'zod';
export { z };
export const text = z.string().min(1).max(4000);
export const name = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/);
export const id = z.string().regex(/^[a-f0-9]{64}$/);
export const timestamp = z.iso.datetime();
export const relativePath = z.string().min(1).max(500).refine(v => !v.includes('\\') && !v.includes(':') && !v.startsWith('/') && v.split('/').every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p) && !/[<>"|?*\x00-\x1f]/.test(p) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)), 'Use a safe relative path with forward slashes');
export const object = fields => z.strictObject(fields);
export const empty = object({});
export const byId = object({ id });
export const repo = { repo: name };
export const json = z.json();
export const evidenceRefs = z.array(id).max(100).default([]);
export const origin = z.enum(['real', 'synthetic', 'retrospective']);
export const envelope = object({ schemaVersion: z.literal(1), server: name, tool: name, ok: z.boolean(), data: json.optional(), error: object({code:name,message:text}).optional(), provenance: object({inputHash:id,outputHash:id}).optional() });
export const configSchema = object({
  schemaVersion: z.literal(1),
  dataDir: z.string().min(1),
  repos: z.record(name, z.string().min(1)).default({}),
  python: z.string().min(1).optional(),
  actionRoot: z.string().min(1).optional(),
  allowFileWrites: z.boolean().default(false),
  checks: z.record(name, object({ repo:name, command:z.string().min(1), args:z.array(z.string()).max(50), timeoutMs:z.number().int().min(100).max(60000).default(10000) })).default({})
});
