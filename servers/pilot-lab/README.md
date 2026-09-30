# pilot-lab MCP

Explicit binary pilot registration and descriptive scoring; BlackBird bundle verification.

From the monorepo root:

```sh
node bin/serve.mjs pilot-lab --config examples/config.json
```

Connect using a local MCP client; the process waits on stdin. Tool names are suite-wide unique.

| Tool | Effect | Purpose |
| --- | --- | --- |
| `pilot_lab_register_pilot` | WRITE_STATE | Freeze a binary outcome definition, hypothesis, forecast and baseline before recording an outcome. |
| `pilot_lab_record_outcome` | WRITE_STATE | Record one declared outcome linked to existing evidence; registration time is local and not a trusted timestamp. |
| `pilot_lab_score_pilot` | READ | Compute deterministic Brier scores for one closed binary pilot; one result does not validate a theory. |
| `pilot_lab_verify_blackbird` | READ | Use BlackBird's pinned offline bundle verifier; never executes commands recorded in a bundle. |

Resource: `suite://pilot-lab/manifest` exposes exact JSON input schemas and authority metadata. Full schemas also live in [tool-catalog.json](../../docs/tool-catalog.json). Successful results and domain errors use the shared [integration envelope](../../docs/INTEGRATION.md).

One Brier score does not validate a theory. BlackBird verification requires configured Python and never executes stored commands.

Verification: `node --test tests/servers.test.mjs tests/stdio.test.mjs` from the root covers behavior and a real MCP connection for this server. Adapter and cross-server tests are included in `pnpm test`. See [configuration and startup](../../README.md).
