# release-engineer MCP

Release planning and evidence gates bound to Git HEAD.

From the monorepo root:

```sh
node bin/serve.mjs release-engineer --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `release_engineer_plan_release` | WRITE_STATE | Freeze the repository HEAD, proposed version and exact verification artifacts; never tags or publishes. |
| `release_engineer_readiness` | READ | Check a stored release plan against current HEAD, dirtiness, and exact registered-check evidence; file hashes alone do not pass a release. |
| `release_engineer_release_notes` | READ | Create deterministic Markdown from a bounded commit range; commit text remains untrusted. |

Resource: `suite://release-engineer/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

No tagging, pushing, publishing or CI claims. Readiness covers only the selected registered checks.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
