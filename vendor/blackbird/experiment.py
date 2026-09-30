"""Public SDK: run registration, annotation, gate capture and prospective forecasts."""
import copy
import hashlib
import os
from pathlib import Path
import signal
import subprocess
import threading
import time

from .model import DEFAULT_MODEL, canonical, forecast, number, state, validate_model


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def gate_manifest(repo, paths):
    result = {}
    for name in paths:
        p = (Path(repo) / name).resolve()
        if not p.is_relative_to(Path(repo).resolve()):
            raise ValueError("gate files must be inside the repository")
        result[name] = file_hash(p) if p.is_file() else None
    return result


def snapshot(repo):
    """Capture Git identity/status; this is context, not a complete source archive."""
    result = {}
    for key, args in (("head", ["rev-parse", "HEAD"]), ("status", ["status", "--porcelain=v1"]),
                      ("diff_stat", ["diff", "--stat", "HEAD"])):
        try:
            p = subprocess.run(["git", "-C", repo, *args], capture_output=True, timeout=10)
            result[key] = p.stdout[:131072].decode(errors="replace") if p.returncode == 0 else None
        except (OSError, subprocess.TimeoutExpired):
            result[key] = None
    return result


def start(store, *, name, repo, command, gate_files, capacity=8, model=None,
          origin="real", cohort="pilot", agent="unspecified", task="unspecified", timeout=120):
    repo = str(Path(repo).resolve())
    if not Path(repo).is_dir():
        raise ValueError("repository directory does not exist")
    if not command or any(not isinstance(c, str) or not c for c in command):
        raise ValueError("gate must be a nonempty argument array")
    if origin not in ("real", "synthetic", "retrospective"):
        raise ValueError("origin must be real, synthetic or retrospective")
    if not name.strip() or not cohort.strip():
        raise ValueError("name and cohort are required")
    number(capacity, "capacity", 0.01, 10000)
    number(timeout, "timeout", 0.1, 86400)
    model = copy.deepcopy(model or DEFAULT_MODEL)
    validate_model(model)
    if not gate_files:
        raise ValueError("register at least one acceptance gate file")
    paths = sorted(set(str(Path(p)) for p in gate_files))
    manifest = gate_manifest(repo, paths)
    if any(v is None for v in manifest.values()):
        raise ValueError("all registered gate files must exist")
    config = {"schema": 1, "name": name, "repo": repo, "command": command, "gate_files": manifest,
              "capacity": capacity, "model": model, "origin": origin, "cohort": cohort,
              "agent": agent, "task": task, "timeout": timeout,
              "outcome": "streak of gate failures/passes within the next fixed number of gate attempts",
              "evidence": [store.evidence_file(Path(repo)/p) for p in paths]}
    return store.create(config)


def writable(store, run, allow_busy=False, allow_ended=False):
    store.verify(run)
    events = store.events(run)
    if not allow_ended and any(e["kind"] == "run_end" for e in events):
        raise ValueError("run is ended; its observations are frozen")
    starts = sum(e["kind"] == "check_start" for e in events)
    finishes = sum(e["kind"] == "check" for e in events)
    if starts != finishes and not allow_busy:
        raise ValueError("a gate capture is pending; finish it or explicitly abandon the interrupted capture")
    return events


def annotate(store, run, action, *, identifier=None, kind=None, units=1, text="", evidence=None):
    if action not in ("open", "close", "externalize", "simplify", "note", "postmortem"):
        raise ValueError("unknown annotation action")
    if not text.strip():
        raise ValueError("annotation requires a rationale")
    with store.transaction():
        events = writable(store, run, allow_ended=action == "postmortem")
        items, _ = state(events)
        if action == "open":
            if not identifier or identifier in items:
                raise ValueError("obligation id must be new and nonempty")
            if kind not in events[0]["payload"]["model"]["weights"]:
                raise ValueError("unknown obligation kind")
            number(units, "units", 0.01, 100)
        elif action in ("close", "externalize", "simplify"):
            if identifier not in items or items[identifier]["closed"]:
                raise ValueError("obligation is missing or already closed")
            if not evidence:
                raise ValueError("closing or reducing burden requires a captured evidence file")
            if action == "externalize" and items[identifier]["externalized"]:
                raise ValueError("obligation is already externalized")
            if action == "simplify":
                number(units, "units", 0.01, items[identifier]["units"])
                if units >= items[identifier]["units"]:
                    raise ValueError("simplification must reduce units")
        payload = {"id": identifier, "kind": kind, "units": units, "text": text,
                   "evidence": [store.evidence_file(evidence)] if evidence else [], "source": "operator"}
        return store.append(run, "obligation_"+action if action not in ("note", "postmortem") else action, payload)


def predict(store, run):
    with store.transaction():
        events = writable(store, run)
        index = len(state(events)[1])
        existing = [e for e in events if e["kind"] == "prediction" and e["payload"]["check_index"] == index]
        if existing:
            return existing[0]  # First prediction wins: annotations cannot overwrite it.
        p = forecast(events, events[0]["payload"])
        p["cutoff_hash"] = events[-1]["hash"]
        p["cutoff_seq"] = events[-1]["seq"]
        return store.append(run, "prediction", p)


def execute(command, cwd, timeout):
    """Drain all output; retain at most 1 MiB plus digest of the full stream."""
    output = bytearray()
    full_hash = hashlib.sha256()
    total = 0
    started = time.monotonic()
    try:
        process = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   stdin=subprocess.DEVNULL, start_new_session=(os.name != "nt"))
    except OSError as exc:
        return {"passed": False, "valid": False, "exit_code": None, "error": str(exc),
                "duration": time.monotonic()-started}, str(exc).encode()

    def drain():
        nonlocal total
        while True:
            chunk = process.stdout.read(65536)
            if not chunk:
                break
            full_hash.update(chunk)
            total += len(chunk)
            output.extend(chunk[:max(0, 1048576-len(output))])

    reader = threading.Thread(target=drain, daemon=True)
    reader.start()
    timed_out = False
    interrupted = False
    try:
        process.wait(timeout=timeout)
        reader.join(max(0, timeout-(time.monotonic()-started)))
        if reader.is_alive():
            raise subprocess.TimeoutExpired(command, timeout)
    except (subprocess.TimeoutExpired, KeyboardInterrupt) as exc:
        timed_out = isinstance(exc, subprocess.TimeoutExpired)
        interrupted = not timed_out
        if os.name != "nt":
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        else:
            process.kill()
        process.wait()
        reader.join(2)
    # A descendant holding the pipe on Windows makes capture invalid, not a success.
    valid = not interrupted and not reader.is_alive()
    if not reader.is_alive():
        process.stdout.close()
    return {"passed": process.returncode == 0 and not timed_out and valid, "valid": valid,
            "exit_code": process.returncode, "timed_out": timed_out, "interrupted": interrupted,
            "duration": time.monotonic()-started, "output_bytes": total,
            "output_sha256": full_hash.hexdigest(), "output_truncated": total > len(output)}, bytes(output)


def check(store, run):
    # Forecast is committed before launching any command.
    predict(store, run)
    with store.transaction():
        events = writable(store, run)
        config = events[0]["payload"]
        before = gate_manifest(config["repo"], config["gate_files"])
        token = store.append(run, "check_start", {"index": len(state(events)[1]),
            "manifest_before": before, "snapshot": snapshot(config["repo"]), "evidence": []})
    result, output = execute(config["command"], config["repo"], config["timeout"])
    try:
        after = gate_manifest(config["repo"], config["gate_files"])
    except (OSError, ValueError):
        after = {}
    result["gate_unchanged"] = before == after == config["gate_files"]
    result["valid"] = result["valid"] and result["gate_unchanged"]
    result["start_seq"] = token["seq"]
    result["manifest_after"] = after
    with store.transaction():
        events = writable(store, run, allow_busy=True)
        if any(e["kind"] == "check" and e["payload"]["start_seq"] == token["seq"] for e in events):
            raise ValueError("capture was already abandoned; command result cannot replace it")
        result["evidence"] = [store.artifact(output)]
        return store.append(run, "check", result)


def abandon(store, run, reason):
    if not reason.strip():
        raise ValueError("abandon requires a reason")
    with store.transaction():
        events = writable(store, run, allow_busy=True)
        done = {e["payload"]["start_seq"] for e in events if e["kind"] == "check"}
        pending = [e for e in events if e["kind"] == "check_start" and e["seq"] not in done]
        if not pending:
            raise ValueError("no pending capture")
        return store.append(run, "check", {"start_seq": pending[0]["seq"], "passed": False,
            "valid": False, "interrupted": True, "reason": reason, "evidence": []})


def end(store, run, reason):
    if not reason.strip():
        raise ValueError("ending requires a reason")
    with store.transaction():
        writable(store, run)
        return store.append(run, "run_end", {"reason": reason, "evidence": []})


def export(store, run, directory):
    """Portable journal, evidence, and externally retainable chain anchor."""
    from .evaluation import evaluate_run, render_html
    verified = store.verify(run)
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=False)
    events = store.events(run)
    (directory/"events.jsonl").write_text("".join(canonical(e)+"\n" for e in events), encoding="utf-8")
    (directory/"anchor.json").write_text(canonical(verified)+"\n", encoding="utf-8")
    evidence = directory/"evidence"
    evidence.mkdir()
    for sha in {s for e in events for s in e["payload"].get("evidence", [])}:
        (evidence/sha).write_bytes(store.db.execute("SELECT data FROM artifacts WHERE sha=?", (sha,)).fetchone()[0])
    report = evaluate_run(store, run)
    (directory/"report.json").write_text(canonical(report)+"\n", encoding="utf-8")
    (directory/"report.html").write_text(render_html(report), encoding="utf-8")
    return {"directory": str(directory.resolve()), **verified}
