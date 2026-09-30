# evidence-ledger MCP

Immutable observations and exact artifact retrieval.

From the monorepo root:

```sh
node bin/serve.mjs evidence-ledger --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `evidence_ledger_record_observation` | WRITE_STATE | Store an immutable, explicitly attributed observation; a declared stance is not independently verified truth. |
| `evidence_ledger_get_artifact` | READ | Retrieve and hash-verify any exact suite artifact by ID. |
| `evidence_ledger_inspect_claim` | READ | Inspect explicit observations for a claim; no semantic grouping or inferred independence. |

Resource: `suite://evidence-ledger/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Stance, source family and time are declarations. No automatic semantic grouping, corroboration, or SignalForge schema conversion.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
