# action-transaction MCP

Prepare, inspect, commit or abort one bounded UTF-8 file change.

From the monorepo root:

```sh
node bin/serve.mjs action-transaction --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `action_transaction_prepare` | WRITE_STATE | Prepare one bounded UTF-8 file replacement with an exact precondition. Does not change the target file. |
| `action_transaction_inspect` | READ | Inspect a prepared file plan and its immutable transition history. |
| `action_transaction_commit` | WRITE_FILE | Apply a prepared single-file change only when operator configuration permits it and precondition still holds. Retry is idempotent. |
| `action_transaction_abort` | WRITE_STATE | Abort a pending proposal without touching target bytes. |

Resource: `suite://action-transaction/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Commit requires operator-configured allowFileWrites and actionRoot. No multi-file atomicity or hostile-writer isolation; crash reconciliation proves matching bytes, not authorship.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
