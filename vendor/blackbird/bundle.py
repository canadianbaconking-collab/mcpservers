"""Verify portable exports without executing commands or trusting rendered reports."""
import json
from pathlib import Path
import re
import sqlite3

from .evaluation import evaluate_run
from .model import canonical, validate_model
from .store import Store


def verify_bundle(directory, expected_head=None):
    directory = Path(directory)
    store = Store(":memory:")
    try:
        events = [json.loads(line) for line in (directory/"events.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
        if not events or events[0]["kind"] != "run_start":
            raise ValueError("bundle must begin with run registration")
        run = events[0]["run"]
        validate_model(events[0]["payload"]["model"])
        store.db.execute("INSERT INTO runs VALUES(?,?)", (run, events[0]["at"]))
        for event in events:
            if set(event) != {"run", "seq", "at", "kind", "payload", "prev", "hash"} or event["run"] != run:
                raise ValueError("invalid event envelope or mixed runs")
            store.db.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?)", (run, event["seq"], event["at"],
                event["kind"], canonical(event["payload"]), event["prev"], event["hash"]))
            for sha in event["payload"].get("evidence", []):
                if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{64}", sha):
                    raise ValueError("invalid evidence identifier")
                path = directory/"evidence"/sha
                if not path.is_file() or path.is_symlink():
                    raise ValueError(f"missing or unsafe evidence: {sha}")
                if store.artifact(path.read_bytes()) != sha:
                    raise ValueError(f"evidence hash mismatch: {sha}")
        anchor = json.loads((directory/"anchor.json").read_text(encoding="utf-8"))
        verified = store.verify(run, expected_head or anchor["head"])
        if verified != anchor:
            raise ValueError("bundle anchor differs from journal")
        report = evaluate_run(store, run)
        stored = json.loads((directory/"report.json").read_text(encoding="utf-8"))
        if report != stored:
            raise ValueError("saved report differs from recomputed observations")
        return {**verified, "report_reproduced": True, "external_anchor_checked": expected_head is not None}
    except (OSError, KeyError, TypeError, sqlite3.Error) as exc:
        raise ValueError(f"invalid bundle: {exc}") from exc
    finally:
        store.close()
