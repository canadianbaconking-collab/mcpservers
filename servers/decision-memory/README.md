# decision-memory MCP

Evidence-linked decisions and append-only supersession.

From the monorepo root:

```sh
node bin/serve.mjs decision-memory --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `decision_memory_record_decision` | WRITE_STATE | Persist a decision with alternatives, rationale, evidence IDs, and a revisit condition. |
| `decision_memory_get_decision` | READ | Return an exact immutable decision plus supersession history. |
| `decision_memory_supersede` | WRITE_STATE | Link an existing decision to its replacement without rewriting history; cycles and repeated replacement are rejected. |

Resource: `suite://decision-memory/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

No semantic search or recommendation. Callers retain exact IDs.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
