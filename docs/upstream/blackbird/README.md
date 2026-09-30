# BlackBird

**A working experimental instrument for failure and recovery in AI-assisted development.**

BlackBird asks whether unresolved development obligations predict subsequent failure
better than simpler explanations. It records real acceptance checks, makes forecasts
before those checks execute, preserves evidence, and scores the forecasts afterward.

**Status: instrument v0.1; theory unvalidated.** One actual self-development pilot is
included. The first scored window favored the simple persistence baseline over
BlackBird. That result is retained, not explained away. See [the living model](docs/MODEL.md).

## What works

- Python SDK and CLI; Python 3.10+; no runtime packages, accounts or network required.
- SQLite event journal with immutable rows, chained hashes and captured evidence bytes.
- Frozen model, capacity, acceptance command, protected test files and forecast horizon.
- Explicit obligation lifecycle: open, externalize, simplify, close, with evidence for reductions.
- Automatic pre-command predictions and gate execution, exit status, timeout, bounded output,
  complete-output hash, duration, Git HEAD/status/diff summary and test-file drift detection.
- Separate failure/recovery targets; incomplete and invalid windows remain censored.
- Five comparison baselines; nonoverlapping primary windows; equal run weighting;
  calibration bins and run-cluster bootstrap intervals when at least five runs are available.
- Portable HTML/JSON reports, journals and evidence; offline verification without the original repository.
- Retrospective postmortems can be appended after a run ends without changing its predictions.

No automatic claim to read an agent's mind. Obligations are operator annotations;
gate observations are automatic. Git snapshots are context, not a complete source backup.

## Get started

Clone the repository in PowerShell (or use the extracted release archive):

```powershell
Set-Location c:/dev/playground
git clone https://github.com/canadianbaconking-collab/blackbird.git
Set-Location c:/dev/playground/blackbird
python -m unittest discover -s tests -v
python -m blackbird verify-bundle examples/pilot-001
```

Open `examples/pilot-001/report.html` for the real pilot. Or generate explicitly
synthetic counterexamples to inspect the instrument:

```powershell
python examples/synthetic_demo.py --output .blackbird/demo
```

## Observe a real task

Choose a fixed acceptance gate **before** work starts. Here is a complete PowerShell
example using BlackBird's own tests; substitute the repository and gate for your task:

```powershell
Set-Location c:/dev/playground/blackbird
$bbRun = (python -m blackbird start "My development task" --repo . --gate-file tests/test_instrument.py --capacity 8 --cohort pilot-002 --agent "Codex" --task "Describe the actual change" --gate python -m unittest discover -s tests -p test_instrument.py -v | ConvertFrom-Json).run
python -m blackbird open $bbRun uncertain-contract --kind assumption --text "The new behavior may violate the existing contract"
python -m blackbird check $bbRun
```

Now do development normally. At each material implementation milestone, annotate
new unresolved obligations and run `check` again. It freezes a forecast, runs the
registered command, and records the actual result. It exits 1 on a failed/invalid
gate; that is an observation, not an instrument crash. Instrument errors exit 2.

```powershell
python -m blackbird externalize $bbRun uncertain-contract --text "Wrote a durable, retrievable decision" --evidence docs/decision.md
python -m blackbird check $bbRun
python -m blackbird close $bbRun uncertain-contract --text "Verified the contract against this evidence" --evidence verification.txt
python -m blackbird check $bbRun
python -m blackbird end $bbRun --reason "Task accepted"
python -m blackbird postmortem $bbRun --text "What happened, which predictions missed, and what to change next"
python -m blackbird export $bbRun .blackbird/my-task-report
python -m blackbird summary --cohort pilot-002
```

The two evidence paths above must be real files you created during the task. BlackBird
copies their bytes; a filename alone is insufficient. Never fabricate annotations
or run extra gates just to obtain a desired label. See [operator protocol](docs/PROTOCOL.md).

On Bash, run the same `python -m blackbird` commands from the extracted project;
copy the `run` value returned by `start` into a shell variable:

```bash
cd /path/to/blackbird
bb_run=THE_RETURNED_RUN_ID
python -m blackbird status "$bb_run"
```

The global `--db PATH` option must precede the subcommand. The default database is
relative to the current working directory. Keep that directory fixed, or specify
an absolute database path. `--gate` is the final `start` option and consumes all
remaining arguments. Commands are argument arrays; shell syntax is not interpreted.
Optional install: `python -m pip install -e .` exposes the `blackbird` entry point.

## Read the result correctly

BlackBird's first model computes weighted unresolved burden divided by a
preregistered capacity. It maps that ratio to an **uncalibrated candidate probability**.
It does not measure a biological or model-context capacity, and 8 is an arbitrary
starting parameter, not an established threshold.

The outcome is defined independently: by default, two consecutive failed acceptance
attempts within the next three attempts. If the previous attempt failed, the next
forecast instead targets two consecutive passes. Neither definition uses burden.
This is an operational proxy, **not a verified definition of cognitive failure**.

Reports show all forecasts. Cohort scoring uses only nonoverlapping windows, groups
different model configurations separately, and defaults to `origin=real`. Synthetic
and retrospective runs require explicit selection. Origins are operator declarations,
not independently authenticated facts. There is no hidden success threshold or
automatic validation badge.

## Files and limits

- [MODEL.md](docs/MODEL.md): definitions, equations, predictions, outcomes, objections and revision ledger.
- [PROTOCOL.md](docs/PROTOCOL.md): observation and replication protocol, falsifiers and confounders.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): code map, storage, evidence and trust boundaries.
- [PROJECT_STATE.md](PROJECT_STATE.md): verified delivery state and concrete next experiment.
- `examples/pilot-001/`: real, prospective self-development evidence, including its unsuccessful gate.
- `tests/`: instrument and adversarial tests; generated fixtures are not empirical evidence.

Local hash chains are tamper-evident against an independently retained anchor, not
trusted timestamping. Save an exported head outside the workspace before outcomes
if stronger chronological assurance matters. The runner is not a sandbox: it executes
the command you register, with your permissions. Captured output/evidence may include
private project information; exports remain local unless you share them.

Linux/Python 3.12 is verified here. A Windows/Linux CI matrix is included but has not
run on a hosted service. On Windows, timed-out descendant processes are not guaranteed
to terminate with their parent; avoid gates that leave child processes running.
