import argparse
import json
from pathlib import Path
import sqlite3
import sys

from . import __version__
from .bundle import verify_bundle
from .experiment import abandon, annotate, check, end, export, predict, start
from .evaluation import evaluate_run, summarize
from .model import canonical, state
from .store import Store


def parser():
    p = argparse.ArgumentParser(prog="blackbird", description="Measure unresolved state; freeze forecasts; test failure and recovery.")
    p.add_argument("--version", action="version", version=__version__)
    p.add_argument("--db", default=".blackbird/blackbird.sqlite", help="local event/evidence database")
    sub = p.add_subparsers(dest="action", required=True)
    s = sub.add_parser("start", help="register a real run and freeze the acceptance gate")
    s.add_argument("name")
    s.add_argument("--repo", default=".")
    s.add_argument("--gate-file", action="append", required=True, dest="gate_files")
    s.add_argument("--capacity", type=float, default=8)
    s.add_argument("--model", help="JSON model file; frozen by content hash")
    s.add_argument("--origin", choices=["real", "synthetic", "retrospective"], default="real")
    s.add_argument("--cohort", default="pilot")
    s.add_argument("--agent", default="unspecified")
    s.add_argument("--task", default="unspecified")
    s.add_argument("--timeout", type=float, default=120)
    s.add_argument("--gate", nargs=argparse.REMAINDER, required=True, help="LAST option: command argument array, without a shell")
    sub.add_parser("runs")
    s = sub.add_parser("verify-bundle", help="verify a portable export without its original database")
    s.add_argument("directory")
    s.add_argument("--head", help="optional externally retained journal anchor")
    for name in ("status", "predict", "check", "report", "verify", "end", "abandon", "export"):
        s = sub.add_parser(name)
        s.add_argument("run")
        if name in ("end", "abandon"):
            s.add_argument("--reason", required=True)
        if name == "verify":
            s.add_argument("--head")
        if name == "export":
            s.add_argument("directory")
    for action in ("open", "close", "externalize", "simplify", "note", "postmortem"):
        s = sub.add_parser(action)
        s.add_argument("run")
        if action not in ("note", "postmortem"):
            s.add_argument("identifier")
        s.add_argument("--text", required=True)
        s.add_argument("--evidence", required=action in ("close", "externalize", "simplify"))
        if action == "open":
            s.add_argument("--kind", required=True, choices=["assumption", "decision", "dependency", "verification"])
        if action in ("open", "simplify"):
            s.add_argument("--units", type=float, default=1)
    s = sub.add_parser("summary")
    s.add_argument("--cohort")
    s.add_argument("--origin", choices=["real", "synthetic", "retrospective"], default="real")
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    store = None
    try:
        if args.action == "verify-bundle":
            print(json.dumps(verify_bundle(args.directory, args.head), indent=2))
            return 0
        store = Store(args.db)
        action = args.action
        if action == "start":
            config = vars(args).copy()
            for key in ("action", "db"):
                config.pop(key)
            config["command"] = config.pop("gate")
            config["model"] = json.loads(Path(config["model"]).read_text()) if config["model"] else None
            result = {"run": start(store, **config)}
        elif action in ("open", "close", "externalize", "simplify", "note", "postmortem"):
            kw = vars(args).copy()
            for key in ("action", "db", "run"):
                kw.pop(key)
            result = annotate(store, args.run, action, **kw)
        elif action == "runs":
            result = [{"run": r, "name": store.events(r)[0]["payload"]["name"]} for r in store.runs()]
        elif action == "status":
            store.verify(args.run)
            events = store.events(args.run)
            obligations, checks = state(events)
            result = {"run": args.run, "open": [o for o in obligations.values() if not o["closed"]],
                      "checks": len(checks), "ended": any(e["kind"] == "run_end" for e in events)}
        elif action == "predict":
            result = predict(store, args.run)
        elif action == "check":
            result = check(store, args.run)
        elif action == "verify":
            result = store.verify(args.run, args.head)
        elif action == "end":
            result = end(store, args.run, args.reason)
        elif action == "abandon":
            result = abandon(store, args.run, args.reason)
        elif action == "report":
            result = evaluate_run(store, args.run)
        elif action == "export":
            result = export(store, args.run, args.directory)
        else:
            result = summarize(store, args.cohort, args.origin)
        print(json.dumps(result, indent=2, allow_nan=False))
        if action == "check":
            return 0 if result["payload"]["valid"] and result["payload"]["passed"] else 1
        return 0
    except (ValueError, OSError, sqlite3.Error, KeyError, TypeError) as exc:
        print(canonical({"error": str(exc)}), file=sys.stderr)
        return 2
    finally:
        if store is not None:
            store.close()


if __name__ == "__main__":
    raise SystemExit(main())
