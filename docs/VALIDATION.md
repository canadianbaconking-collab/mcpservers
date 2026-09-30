# Validation and review — 2026-09-29

## Executed environment

Windows, Node **24.19.0**, Git **2.53.0.windows.3**, pnpm **11.19.0** and the bundled Python **3.12** runtime. MCP server/client **2.2.0** and Zod **4.3.6** are pinned. Prettier **3.9.9** is a development-only formatting check. This environment required the bundled pnpm entrypoint because npm/pnpm were not on PATH.

The initial dependency fetch required network permission. After installing the SDK, the dependency refresh completed from the local cache without running install scripts. A Windows ownership mismatch required using the same operator context for the dependency refresh. No credentials or global Git configuration changed.

## Checkpoints

1. Initial domain tests passed for all twelve modules. Real stdio tests exposed test cleanup ordering: the fixture tried to delete SQLite files while a server still held them. Closing the client before removing its fixture fixed the harness.
2. The first broader checkpoint passed 31/32. Faultline's adapter omitted the upstream `output` Namespace field; adding `output=None` fixed collection while preserving its read-only in-memory API. The pinned source itself did not change.
3. The second checkpoint passed **34/34 tests, zero skipped**, with Python adapters enabled. Every server passed actual SDK client initialization, tool listing, a useful tool invocation, manifest reading and malformed-input rejection. Independent server processes shared evidence references and preserved them across a server restart. The synthetic integration workflow exercised all 12 domains.
4. Final check on implementation commit `68e5027` passed the same **34/34** with zero skipped after formatting and generated-catalog checks were added. A frozen-lockfile installation succeeded offline with all 21 workspaces present. The complete successful check output is retained in [validation.log](validation.log).

## Review findings addressed

- UTC timestamps must compare parsed instants, not lexical strings with optional fractional seconds. A regression proves earlier fractional-time inputs are rejected.
- A BlackBird directory boundary alone does not protect nested files. The adapter now preflights every entry with depth, count, byte and link checks before invoking the original verifier.
- Git line-ending conversion would invalidate vendored byte hashes on Windows. `.gitattributes` fixes suite text to LF and preserves vendor bytes exactly.
- SQLite event reads and writes now enforce the stream-size boundary. Writes serialize across processes, roll back failed transactions, and check exact content IDs on retrieval.
- Release readiness rejects single-file digest evidence, stale/foreign HEADs, failed checks and dirty trees. It does not claim broader certification.
- File transaction tests cover disabled writes, changed preconditions, retry idempotence, abort and crash reconciliation after a filesystem write but before a journal commit.
- Documentation is generated from live validators; `check` rejects a stale catalog and unexpected or modified vendor files.

Reviews were performed in this task with explicit failure-oriented tests. No independent reviewer or hosted CI result is claimed.

## Coverage and practical limits

Tests cover all 40 tool implementations across domain, adapter, fixture and protocol cases. Integrity tests deliberately alter local SQLite bytes after dropping triggers and verify detection. Path tests cover traversal, Windows device names/alternate streams, junction escape and oversized files. Exact observation IDs deduplicate, contradictory stances stay contested, decision cycles fail, and pilot outcomes cannot be rewritten.

The Linux/Windows GitHub Actions matrix subsequently **passed on both Ubuntu and Windows** for published implementation commit `8e2d2bcdf8d72dd8c5487a9db53655831a93cdbf`: [run 36667954217](https://github.com/canadianbaconking-collab/mcpservers/actions/runs/36667954217). Both jobs completed their frozen dependency install and all checks with Python adapters enabled. The default test command still skips Python adapter tests when `SUITE_TEST_PYTHON` is unset. Source publication is complete; remote MCP/ChatGPT installation, production pilots, npm publication, deployment, load benchmarks, hostile-writer proof and real SignalForge import remain outside this checkpoint.

Reproduce with `SUITE_TEST_PYTHON` set to an installed Python executable and `node scripts/check.mjs` from the repository root. The suite is source-runnable; no compilation step is required.
