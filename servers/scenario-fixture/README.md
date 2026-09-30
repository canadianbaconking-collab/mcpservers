# scenario-fixture MCP

Content-addressed synthetic test inputs and expected JSON.

From the monorepo root:

```sh
node bin/serve.mjs scenario-fixture --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `scenario_fixture_save_fixture` | WRITE_STATE | Save an immutable JSON input and expected output as an explicitly synthetic fixture. |
| `scenario_fixture_get_fixture` | READ | Retrieve and hash-verify an exact fixture. |
| `scenario_fixture_check_fixture` | READ | Compare supplied actual JSON to a frozen expected value with canonical key ordering; no code executes. |

Resource: `suite://scenario-fixture/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Exact comparison only; no arbitrary code execution or inferred fixture generation.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
