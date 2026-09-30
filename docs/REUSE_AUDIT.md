# Existing-project inspection and reuse

Inspected 2026-09-29 via the connected GitHub integration and read-only source archives. No upstream repository, authentication setting, remote, branch, issue or PR was changed. The suite is a new local repo, not a recreated GitHub repo.

| Project / inspected revision prefix | Existing capability | v0.1 decision |
| --- | --- | --- |
| [Coldgate](https://github.com/canadianbaconking-collab/coldgate) / `87844dd` | TypeScript authority records, conservative static MCP analysis, trace and diff tools | Directly reuse `scanConfig` and its validation/evidence rules in Authority and Security Surface. Preserve claim status; no new static policy inference engine. |
| [Driftglass](https://github.com/canadianbaconking-collab/driftglass) / `12a4b44` | Pure policy evaluator, replay and policy comparison | Reuse `loadPolicy` and `evaluate` directly. Evaluation remains advisory; live gateway enforcement is out of scope. |
| [Faultline](https://github.com/canadianbaconking-collab/faultline) / `a64175b` | Python Git review packet with trusted-base policy and bounded patches | Reuse `gather` via a fixed Python bridge; store its unchanged metadata and packet under a suite artifact ID. No duplicate patch collector. |
| [SignalForge](https://github.com/canadianbaconking-collab/signalforge) / `1ac9c0e` | TypeScript/SQLite evidence schema 3, source-family dependence, adjudication, review and decision artifacts | Inspect schema and implementation; keep suite operational evidence distinct. Do not fork its collectors/ranking/adjudicator. Lossless artifact import is deferred with explicit namespace/version validation. |
| [BlackBird](https://github.com/canadianbaconking-collab/blackbird) / `89a32ae` | Python immutable journals, preregistered forecasts, acceptance gates, bundle verification and cohort scoring | Reuse offline `verify_bundle`; Pilot Lab's small binary Brier experiment has a separate schema and does not replace BlackBird's model or cohort semantics. |

Source archive digests and every vendored file hash are in [vendor/SOURCES.json](../vendor/SOURCES.json). `node scripts/verify-vendor.mjs` detects edits and unexpected files. Upstream source bytes remain unchanged; integration code lives under `packages/adapters`. Readme snapshots are preserved in `docs/upstream`. No upstream license file was found in the inspected roots, so all suite packages stay private and no publication/license grant is inferred.

The local `Documents/ChatGPT/signalforge` folder contained untracked Driftglass validation and inspection artifacts rather than the upstream SignalForge implementation. It had no remote. It was inspected with a per-command Git ownership exception, without changing global Git configuration. Cascadia was listed as an available project, but has a different scope. Other accessible Frosted Logic repository names were inventoried; EnvCheck's root README returned 404, so no capability claims or code reuse are based on it.

The starting workspace had no repository or pre-existing code. `git --version` reported 2.53.0.windows.3; `git remote -v` and `git status` correctly reported that absence. `gh` was not on PATH. The requested Bash `which gh || command -v gh || true` probe could not run because Bash was absent from the bundled Git distribution; PowerShell `Get-Command gh` confirmed absence. A clone attempt exposed a missing Git HTTPS helper, so source inspection used the working connected GitHub API and read-only HTTPS archives. No repeated authentication attempts or credential replacement occurred.

## Adapter upgrade policy

Inspect upstream changes, select an explicit revision, update only the required source subset and source manifest, then rerun adapter and protocol tests. Do not regenerate pins merely to bless unexplained byte changes. Future SignalForge import must retain its original artifact ID, version, evidence hash, provenance and rejected records; it must not manufacture verified source independence from host counts.
