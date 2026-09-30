# verification MCP

Deterministic checks and retained evidence.

From the monorepo root:

```sh
node bin/serve.mjs verification --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `verification_check_file` | WRITE_STATE | Check exact file bytes against an expected SHA-256 and retain an evidence artifact. |
| `verification_compare_files` | READ | Compare bounded file bytes without executing repository code. |
| `verification_gather_review` | WRITE_STATE | Use the pinned Faultline collector with policy from a trusted base commit. No project checks execute. |
| `verification_run_check` | EXECUTE_LOCAL | Execute only a named command preconfigured by the operator. This is not a sandbox; stores hashes, not raw output. |

Resource: `suite://verification/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Faultline requires configured Python. Registered checks run with the process owner permissions, and Windows descendant termination is not guaranteed.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
