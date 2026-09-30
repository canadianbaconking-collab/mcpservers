# agent-run-telemetry MCP

Explicit run lifecycle and chained event history.

From the monorepo root:

```sh
node bin/serve.mjs agent-run-telemetry --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `agent_run_telemetry_start_run` | WRITE_STATE | Register an explicitly labelled run; registration is idempotent for identical inputs. |
| `agent_run_telemetry_record_event` | WRITE_STATE | Append an event using expected sequence to detect concurrent or repeated writes. |
| `agent_run_telemetry_end_run` | WRITE_STATE | Close a run using optimistic concurrency; no events can follow closure. |
| `agent_run_telemetry_get_run` | READ | Read a registered run and verify its full event hash chain. |

Resource: `suite://agent-run-telemetry/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Local chains need an independently retained head to detect whole-history replacement. No automatic agent instrumentation.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
