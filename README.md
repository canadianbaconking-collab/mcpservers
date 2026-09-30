# Frosted Logic MCP Suite — v0.1.0

Twelve local MCP servers with **40 tools**, a manifest resource per server, shared evidence IDs, and an offline integration workflow. All servers run from one monorepo and share a configured SQLite store. No cloud account is required.

Source: [canadianbaconking-collab/mcpservers](https://github.com/canadianbaconking-collab/mcpservers). Hosted checks: [Suite checks](https://github.com/canadianbaconking-collab/mcpservers/actions/workflows/ci.yml).

## Start

Requires **Node 24.x**, Git, and pnpm 11.19.0 to install dependencies. Python 3.10+ is optional for the Faultline and BlackBird adapters. Node's native SQLite and TypeScript stripping avoid native dependency builds and a compilation step. Packages are private workspace packages, not published npm products.

```sh
git clone https://github.com/canadianbaconking-collab/mcpservers.git
cd mcpservers
pnpm install --frozen-lockfile --ignore-scripts
node bin/serve.mjs repo-state --config examples/config.json
```

The server waits for an MCP client on stdin. Stdout contains protocol messages only. For a runnable synthetic workflow using every server:

```sh
node examples/workflow.mjs
node scripts/check.mjs
```

The workflow creates and removes an isolated temporary Git repository, composes all twelve implementations, and verifies a local receipt. It makes no external changes. `check` validates pinned vendor bytes, syntax, manifests and tests. Adapter tests are explicitly skipped unless `SUITE_TEST_PYTHON` names a Python executable. To include them:

```powershell
$env:SUITE_TEST_PYTHON = (Get-Command python).Source
node scripts/check.mjs
```

```sh
SUITE_TEST_PYTHON="$(command -v python3)" node scripts/check.mjs
```

On this prepared machine, dependencies are installed already; direct `node` commands work. The environment inspection and test runtime details are in [VALIDATION.md](docs/VALIDATION.md).

## Configure

Copy [examples/config.json](examples/config.json) to an operator-controlled file. Relative paths resolve from that file, not the client's working directory. Each server receives the same config to share evidence and history. Repositories and the action directory must already exist; the suite creates the data directory.

```json
{
  "schemaVersion": 1,
  "dataDir": "./local-state",
  "repos": {"project": "../my-project"},
  "python": "C:/Python312/python.exe",
  "actionRoot": "../my-project/generated",
  "allowFileWrites": false,
  "checks": {
    "unit": {
      "repo": "project",
      "command": "node",
      "args": ["--test", "tests/*.test.mjs"],
      "timeoutMs": 30000
    }
  }
}
```

Omit `python`, `actionRoot` and `checks` when unused. A registered check is authorization to execute that exact command with local process permissions; tool callers cannot supply replacement arguments. `allowFileWrites` must be explicitly enabled for prepared file commits. The default allows only local state writes. No tool can alter this configuration or request host approval on the user's behalf. Keep the config outside an action root that callers may edit.

Use absolute Node and server paths in your MCP client's stdio configuration. Generic example (adapt the paths and container key to your client):

```json
{
  "mcpServers": {
    "frosted-repo-state": {
      "command": "node",
      "args": ["/absolute/frosted-mcp-suite/bin/serve.mjs", "repo-state", "--config", "/absolute/config.json"]
    }
  }
}
```

Repeat the entry with another server ID to enable it. [scripts/client-config.mjs](scripts/client-config.mjs) emits entries for all 12 from an absolute config path, using the current Node executable. It prints JSON and does not edit client settings. This release supplies local stdio servers; installing a remote ChatGPT connector or publishing HTTP endpoints is not included.

## Servers

| Server | Useful v0.1 slice | Tools |
| --- | --- | ---: |
| [Repo State](servers/repo-state/README.md) | Git state, recent commits, project state | 3 |
| [Environment Doctor](servers/environment-doctor/README.md) | Runtime diagnostics, credential presence, repository availability | 3 |
| [Verification](servers/verification/README.md) | File digests, file comparison, Faultline packets, registered checks | 4 |
| [Authority](servers/authority/README.md) | Coldgate analysis, Driftglass evaluation, effective suite controls | 3 |
| [Evidence Ledger](servers/evidence-ledger/README.md) | Observations, exact artifacts, explicit contradictions | 3 |
| [Agent Run Telemetry](servers/agent-run-telemetry/README.md) | Start, append, close, verify event history | 4 |
| [Decision Memory](servers/decision-memory/README.md) | Record, retrieve, supersede evidence-linked decisions | 3 |
| [Release Engineer](servers/release-engineer/README.md) | Version plan, current-HEAD gates, release notes | 3 |
| [Security Surface](servers/security-surface/README.md) | Coldgate reports, declaration changes, manifest origins | 3 |
| [Pilot Lab](servers/pilot-lab/README.md) | Freeze forecast, record outcome, score, verify BlackBird bundle | 4 |
| [Scenario/Fixture](servers/scenario-fixture/README.md) | Store, retrieve, compare synthetic JSON fixtures | 3 |
| [Action Transaction](servers/action-transaction/README.md) | Prepare, inspect, commit, abort one bounded file change | 4 |

## Contracts and limits

- [Architecture](docs/ARCHITECTURE.md): runtime, packages, persistence and boundaries.
- [Integration contract](docs/INTEGRATION.md): IDs, errors, evidence and server composition.
- [Reuse audit](docs/REUSE_AUDIT.md): inspected projects, source pins and adapter decisions.
- [Validation](docs/VALIDATION.md): executed checks and self-review findings.
- [Project state](PROJECT_STATE.md): delivery status, dependencies and next milestones.
- [Tool schemas](docs/tool-catalog.json) and [result schema](schemas/result.schema.json): generated from runtime validators.

This is a local v0.1 suite, not an OS sandbox, general MCP gateway, vulnerability scanner, trusted timestamp service or automatic release publisher. Inputs and repository content remain untrusted data. Git repositories and registered commands must be trusted by the operator. Capture hashes establish byte identity, not truth or whole-repository reproducibility. SQLite protects ordinary concurrent writes; its owner can rewrite the database. File transactions support one regular UTF-8 file with a compare-and-swap precondition, not distributed or multi-file atomicity. See the integration contract for crash recovery and concurrency limits.

Keep local databases, configuration, raw review packets and exported evidence private unless deliberately shared. Source is available in the GitHub repository; workspace packages remain private to prevent accidental npm publication. No additional license grant for the upstream Frosted Logic code is inferred.
