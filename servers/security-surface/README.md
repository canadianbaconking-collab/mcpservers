# security-surface MCP

Saved configuration analysis and dependency-origin inspection.

From the monorepo root:

```sh
node bin/serve.mjs security-surface --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `security_surface_scan_config` | READ | Run pinned Coldgate static analysis; no server is contacted and no configuration command executes. |
| `security_surface_compare_surface` | READ | Compare effect and approval declarations from two saved configurations; no runtime revocation is inferred. |
| `security_surface_inspect_manifest` | READ | Inspect package dependency origins and lifecycle script presence without executing scripts or returning script bodies. |

Resource: `suite://security-surface/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

Static Coldgate findings are not runtime enforcement or vulnerability scanning.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
