# Suite integration contract v1

## Calls and results

Each server exposes 2–5 tools plus `suite://<server-id>/manifest`. The manifest contains schemas and fixed authority metadata. Inputs are strict: unknown properties, coercions and invalid IDs fail validation. The official SDK returns protocol/schema errors before domain dispatch; successful domain dispatch and domain failures use this envelope:

```json
{
  "schemaVersion": 1,
  "server": "evidence-ledger",
  "tool": "get_artifact",
  "ok": true,
  "data": {"id": "<64 hex>", "kind": "observation", "data": {}},
  "provenance": {"inputHash": "<64 hex>", "outputHash": "<64 hex>"}
}
```

The same envelope appears in MCP `structuredContent` and the JSON text content. A failed domain call has `ok: false`, `error: {code,message}` and MCP `isError: true`. Codes include `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `STATE`, `DENIED`, `PATH`, `LIMIT`, `INTEGRITY`, `VERSION`, `GIT`, `UNAVAILABLE`, `ADAPTER` and `INTERNAL`. Unexpected errors do not expose file contents, credentials or subprocess output. Missing Python produces `UNAVAILABLE`; it never substitutes a synthetic adapter result.

Input/output hashes cover canonical parsed values. Validation applies defaults before hashing. Object keys sort lexicographically; arrays retain order. Hashes cover UTF-8 JSON and do not normalize Unicode or numeric representations across arbitrary other languages. Upstream artifact hashes retain their own algorithm and namespace.

## Durable identity and references

Suite artifact ID = SHA-256 of canonical `{schemaVersion:1,kind,data}`. IDs are immutable content references, not user names or authorization tokens. Artifacts and events share the configured store; all servers need the same resolved `dataDir` to compose. Foreign keys are checked at domain write time before recording references. Generic evidence references may point to any hash-verified suite artifact; specialized gates require the correct kind.

| Artifact kind | Producer | Consumers |
| --- | --- | --- |
| `observation` | Evidence Ledger | claim inspection, decisions, pilots, telemetry |
| `verification` | Verification | Release Engineer, decisions, pilots, telemetry |
| `review-packet` | Verification/Faultline | exact artifact retrieval, human review, decisions |
| `decision` | Decision Memory | supersession, telemetry, downstream client |
| `run` | Agent Run Telemetry | sequenced run events |
| `release-plan` | Release Engineer | readiness checks |
| `pilot` | Pilot Lab | outcome event and descriptive score |
| `fixture` | Scenario/Fixture | expected-output checks |
| `file-plan` | Action Transaction | inspect, commit, abort |

Record observations with explicit source URI, UTC observation time, claim key and stance. `sourceFamily` remains an operator declaration, not proven independence. An exact supports/refutes conflict becomes contested; no semantic model invents stance. Suite observations are not SignalForge schema-3 snapshots. Decisions must choose an explicit alternative, cite existing artifacts and state a revisit condition. Supersession preserves original bytes and rejects cycles.

## Composition

1. Environment Doctor checks capabilities; Repo State establishes HEAD and dirtiness.
2. Authority and Security Surface inspect saved configurations without executing them.
3. Register a synthetic or real run and pilot. Freeze a fixture's expected JSON.
4. Verification executes an operator-registered check or captures exact evidence.
5. Evidence Ledger retrieves that exact artifact; Decision Memory cites its ID.
6. Telemetry appends evidence-linked events using `expectedSeq` to detect races.
7. Pilot Lab records one evidence-linked outcome and computes Brier and baseline scores.
8. Release Engineer freezes a version/HEAD plan and checks readiness against fresh state.
9. Action Transaction prepares a local receipt, then commits only within configured authority.

[examples/workflow.mjs](../examples/workflow.mjs) runs this entire sequence against an isolated synthetic fixture. Tests also launch every server over real stdio. A passing synthetic workflow is not a product pilot or evidence that BlackBird's theory is validated.

## Release evidence

Readiness requires a clean planned/current working tree, unchanged HEAD, and all selected verification artifacts from that repo and HEAD. Only successful `registered-check` artifacts qualify; a matching single-file digest is insufficient. Each check captures exit status, capture error, stdout/stderr hashes, command hash, before/after HEAD and dirtiness. Raw output is intentionally not exported. Checks are bounded and use an argv array without shell expansion.

Readiness is limited to the selected checks. It does not certify dependency provenance, ignored files, transient edits reverted during a check, CI status, remote branch state or reproducibility. It never tags or publishes. A caller can select a weak registered check, so operators must configure meaningful gates.

## Retries, concurrency and recovery

Artifact writes are content-idempotent. A run start with identical registration data reuses its record. Run event writes need the previous sequence; stale writes fail rather than duplicating an event. Pilot outcomes and decision replacements are one-time transitions. Closed runs reject new events. Event timestamps are caller-declared and monotonic by parsed UTC instant, not externally authenticated.

File plans include configured root, safe relative path, content, expected prior SHA-256 (or null for a new file), desired SHA-256 and reason. Commit holds the SQLite write lock, validates the precondition, stages and fsyncs bytes beside the target, rechecks, then renames and records completion. A committed ID retries without executing again. An aborted ID cannot commit.

The database and filesystem do not form one atomic transaction. A crash after rename but before the database commit is reconciled on retry only if target bytes exactly match the desired hash. The response marks `reconciled` and `attribution: exact-bytes-only`, because another actor could have written those bytes. A crash while staging can leave a `.suite-<id>.tmp` file; retry only reuses/removes it when its hash matches. Differing target/staging bytes produce a conflict and are preserved for inspection. An initial no-op is likewise byte reconciliation. No rollback, multi-file commit or distributed transaction is claimed. Directory metadata fsync and power-loss guarantees vary by platform.

## Upstream adapters

Coldgate static configuration reports retain DECLARED/INFERRED/UNKNOWN distinctions. Driftglass outcomes retain its exact policy precedence and source rule IDs. Caller policy evaluation is advisory only. Faultline loads review policy/config from the supplied base commit SHA, preserves excluded/omitted paths and never executes project checks. Its packet may contain private source bytes.

BlackBird's upstream offline verifier replays the journal and reproduces the report without running stored gates. The wrapper bounds and rejects linked bundle entries. Supplying `expectedHead` checks a separately retained chain anchor; omitting it establishes only internal consistency. Local bundle timestamps and origin labels remain declarations.
