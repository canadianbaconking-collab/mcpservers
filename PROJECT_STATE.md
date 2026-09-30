# Frosted Logic MCP Suite — v0.1 complete

The initial architecture and useful vertical slices for all twelve servers are implemented, tested and published to [canadianbaconking-collab/mcpservers](https://github.com/canadianbaconking-collab/mcpservers). Initial local delivery: **2026-09-29**. GitHub records the publication on **2026-09-30 UTC**. The servers run locally; no remote MCP host installation or npm publication is included.

## Completed delivery

| Server | Tools | Completed slice |
| --- | ---: | --- |
| Repo State | 3 | HEAD/branch/dirty state, recent commits, project state |
| Environment Doctor | 3 | Runtime availability, credential presence only, repository health |
| Verification | 4 | SHA-256 checks, byte comparison, Faultline review collection, configured checks |
| Authority | 3 | Coldgate inspection, Driftglass policy evaluation, effective suite controls |
| Evidence Ledger | 3 | Immutable observations, exact artifact retrieval, explicit contradictions |
| Agent Run Telemetry | 4 | Registration, sequenced events, closure, verified history |
| Decision Memory | 3 | Evidence-linked decisions, retrieval, immutable supersession |
| Release Engineer | 3 | Frozen version plan, current-HEAD readiness, release-note text |
| Security Surface | 3 | Saved-config scan, declaration comparison, dependency origins |
| Pilot Lab | 4 | Binary forecast registration, one outcome, Brier scoring, BlackBird verification |
| Scenario/Fixture | 3 | Synthetic fixture storage/retrieval, exact JSON comparison |
| Action Transaction | 4 | Prepare/inspect/commit/abort for one bounded local UTF-8 file |

**Total: 12 runnable stdio servers, 40 tools, 12 manifest resources, 8 shared workspace packages.** Each server has a concise README, strict input schemas and tests. Shared packages cover runtime, schemas, provenance, errors, authority, persistence, adapters and synthetic fixtures. Generated schemas, integration contracts, architecture, source provenance, configuration generator, runnable all-server example and a CI matrix are included.

## Verification evidence

- Implementation checkpoint: local commit `68e5027` (`Implement twelve-server local MCP suite and shared integration contracts`). Final documentation/package metadata follow in a separate commit.
- `node scripts/check.mjs`: **34 passed, 0 failed, 0 skipped**, with `SUITE_TEST_PYTHON` configured.
- All 40 tools exercised across domain, adapter and protocol cases; every server tested through a real official-SDK stdio client.
- Independent server processes share persisted evidence IDs; state survives a server restart.
- All-twelve synthetic workflow passes through inspection, check, evidence, decision, pilot, release readiness and a local file receipt.
- Formatter, syntax, generated catalog consistency and all **43 pinned vendor files** pass verification.
- pnpm frozen-lockfile install succeeds offline from the local cache with install scripts disabled.
- Local Windows execution verified. Hosted **Ubuntu and Windows CI both passed**, including Python adapters, on published implementation commit `8e2d2bcdf8d72dd8c5487a9db53655831a93cdbf`: [run 36667954217](https://github.com/canadianbaconking-collab/mcpservers/actions/runs/36667954217).

See [VALIDATION.md](docs/VALIDATION.md) and the retained [final check log](docs/validation.log). Reviews and failure-oriented checkpoints were performed within this task; no independent reviewer or empirical production pilot is claimed.

## Reuse and integration dependencies

- **Coldgate `87844dd`:** unchanged static authority scanner reused directly.
- **Driftglass `12a4b44`:** unchanged pure policy kernel reused directly.
- **Faultline `a64175b`:** unchanged review collector through a fixed Python bridge. Requires an explicit Python executable; no project checks execute inside the collector.
- **BlackBird `89a32ae`:** unchanged offline bundle verifier through a bounded Python bridge. Stored gate commands never execute during verification.
- **SignalForge `1ac9c0e`:** implementation and schema-3 contracts inspected. No collector/ranking fork or false compatibility claim. Suite operational observations remain a separate schema.
- All servers compose through the same configured local SQLite store; no server process dependency or network service is required.

Exact archive and source-file hashes are in [vendor/SOURCES.json](vendor/SOURCES.json); details and retained upstream documentation are in [REUSE_AUDIT.md](docs/REUSE_AUDIT.md).

## Environment and repository status

The task began in an empty projectless workspace. Existing Frosted Logic projects were inspected without modifying them. Git and Node were available; gh, npm on PATH, Bash and the Git HTTPS clone helper were unavailable. The connected GitHub integration and read-only source archive downloads supplied upstream context. Existing credentials were preserved. No remote repository, issue, pull request or deployment was created.

The suite uses normal local Git on `main`; `origin` points to the owner-created `canadianbaconking-collab/mcpservers` repository. The initial commits use an explicit Codex local author identity because no Git author was configured; global Git identity/authentication settings were left unchanged. Publication uses the connected GitHub Git-data API because the bundled Git lacks HTTPS transport. All tracked source, schemas, tests, docs and vendored code are included; dependencies, local databases and machine-specific configuration are ignored. The original local build history is preserved on `local-build-v0.1`; `main` tracks the published `origin/main`. Initial publication verified all 136 file hashes and the complete Git tree. See [publication evidence](docs/PUBLICATION.md).

## Known limits and unresolved questions

- Choose real repository aliases, meaningful registered acceptance checks, an operator-controlled config location and any permitted output directory before regular use. Example config defaults to disabled file commits and no executable checks.
- Authority is enforced only for this suite's bounded adapters. Coldgate/Driftglass cannot grant host approval or govern unrelated MCP servers.
- File transactions handle one regular file, exact preconditions and retry/reconciliation. No multi-file atomicity, automatic rollback, hostile concurrent-writer protection or distributed transaction guarantee.
- Checks execute trusted configured commands with normal process permissions. Windows timeout handling does not guarantee descendant termination.
- Local hashes prove consistency, not truth, trusted chronology or whole-repository reproducibility. Evidence families, origin labels and observation times remain declarations.
- No remote HTTP transport/OAuth deployment, telemetry auto-instrumentation, source collection, vector search, vulnerability database or automatic publishing.
- Source publication to the owner-created GitHub repository is authorized. Workspace packages remain private to prevent accidental npm publication; no new upstream license grant is inferred.

## Next milestones

1. Build a lossless, versioned SignalForge evidence importer preserving original IDs, provenance, rejected records and source-family semantics; add real upstream compatibility fixtures.
2. Add SQLite backup/export/migration tooling, artifact discovery/pagination and stronger externally retained integrity anchors.
3. Pilot against one real Frosted Logic repository with a preregistered acceptance gate; retain failures and separate real/synthetic evidence.
4. Package/install into the desired local MCP client; maintain the passing hosted Windows/Linux matrix.
5. Extend transactions and remote transports only with explicit authority, recovery and authentication contracts.
