# Faultline v0.1

Faultline is a local evidence collector and review protocol for a fresh Work reviewer.
Python standard library and Git are the only requirements. The collector does
not call a model, execute project code, install dependencies, or contact GitHub.

## Use in a target repository

Copy `tools/review.py`, `REVIEW.md`, `.review/config.json`,
`.review/finding.schema.json`, `REVIEWER_PROMPT.md`, and the `.gitignore` entry
into the target repository. Commit the policy and config on the trusted base
branch before relying on them: a policy introduced in the change under review
does not take effect until a later base includes it.

PowerShell commands from `c:/dev/playground/<repo>`:

```powershell
py tools/review.py gather --base origin/main --head HEAD --intent "Implement the current tranche"
py tools/review.py gather --base HEAD --include-working-tree
```

Run these after the copied script is on disk. Pass `--output <dir>` to use
another output directory. Read `.review/out/latest/metadata.json` and
`packet.md` in a fresh Work context, following `REVIEWER_PROMPT.md`.
`origin/main` must exist for the default invocation; pass another trusted ref
with `--base` when appropriate.

The output records resolved base/head/merge-base SHAs, dirty state, untracked
paths, trusted policy/config provenance, changed paths, omissions, and a
SHA-256 digest over selected changed bytes. The packet bounds per-file and
aggregate patch bytes. Excluded files remain listed and influence the digest.
Untracked content is included only with `--include-working-tree`. A dirty
working tree without that flag is explicitly outside the reviewed patch.
No project checks are run in v0.1.

## Trust boundary and limitations

`REVIEW.md` and `.review/config.json` are loaded from the trusted base commit.
If absent, the packet says so and the built-in limits apply. Changed files can
contain instructions, but do not gain review-policy authority. This script is
for trusted local repositories; Git itself may invoke external diff drivers in
unusual configurations, so it uses `--no-ext-diff` and `--no-textconv` for
patch capture. Never use the collector as a sandbox for untrusted Git hooks or
project commands.

The digest binds changed paths and patch bytes captured during collection. It
is a review snapshot identifier, not a cryptographic attestation of the whole
repository or a guarantee against concurrent edits. Omitted files require
direct reviewer inspection before making claims about them. This release does
not yet implement active reproducer execution, incremental watermarks, or
review-quality benchmarking.

## Faultline tests

```powershell
cd c:/dev/playground/faultline
py -m unittest discover -s tests -v
```
