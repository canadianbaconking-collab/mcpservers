# repo-state MCP

Repository snapshots and explicit project state.

From the monorepo root:

```sh
node bin/serve.mjs repo-state --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `repo_state_get_state` | READ | Inspect HEAD, branch and working-tree status of a configured repository. |
| `repo_state_recent_changes` | READ | List recent commit identities and subjects; repository text is untrusted data. |
| `repo_state_project_state` | READ | Read bounded PROJECT_STATE.md from a configured repository. |

Resource: `suite://repo-state/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Read-only Git inspection; no semantic milestone inference.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
