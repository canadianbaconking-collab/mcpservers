# environment-doctor MCP

Local capability checks before selecting a workflow.

From the monorepo root:

```sh
node bin/serve.mjs environment-doctor --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `environment_doctor_diagnose` | READ | Check fixed local runtimes without contacting services or reading credential values. |
| `environment_doctor_credential_presence` | READ | Report presence only for explicitly named credential variables; values are never returned. |
| `environment_doctor_workspace_health` | READ | Check configured Git repositories and collect explicit failures. |

Resource: `suite://environment-doctor/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Credential presence is not authentication. Network and connected-app availability remain unprobed.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
