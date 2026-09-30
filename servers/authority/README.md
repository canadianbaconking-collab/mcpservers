# authority MCP

Coldgate static authority analysis and Driftglass policy evaluation.

From the monorepo root:

```sh
node bin/serve.mjs authority --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `authority_inspect_config` | READ | Analyze saved MCP configuration using pinned Coldgate; declarations do not prove enforcement. |
| `authority_evaluate_policy` | READ | Evaluate a hypothetical event using pinned Driftglass. Caller-supplied policy cannot grant suite permissions. |
| `authority_effective_controls` | READ | Describe actual suite controls and unknown host approval behavior. |

Resource: `suite://authority/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Evaluation is advisory; caller policy cannot change suite or host permissions.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
