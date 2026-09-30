import { serverIds, manifest } from '../packages/runtime/index.mjs';
console.log(
  JSON.stringify(
    { schemaVersion: 1, servers: await Promise.all(serverIds.map(manifest)) },
    null,
    2,
  ),
);
