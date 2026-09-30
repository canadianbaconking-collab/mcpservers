"""Fixed-window scoring. Synthetic data is excluded from real-run summaries."""
import html
import json
import random
from statistics import mean

from .model import digest, forecast, label, state


def evaluate_run(store, run):
    integrity = store.verify(run)
    events = store.events(run)
    config = events[0]["payload"]
    checks = state(events)[1]
    predictions = []
    for event in events:
        if event["kind"] != "prediction":
            continue
        p = event["payload"]
        prefix = events[:event["seq"]-1]
        expected = forecast(prefix, config)
        if any(p[k] != value for k, value in expected.items()) or p["cutoff_hash"] != prefix[-1]["hash"] or p["cutoff_seq"] != prefix[-1]["seq"]:
            raise ValueError("prediction cannot be reproduced from its recorded prefix")
        start = p["check_index"]
        outcome, censored = label(checks[start:start+p["horizon"]], p["target"], p["horizon"], p["streak"])
        predictions.append(dict(p, seq=event["seq"], at=event["at"], outcome=outcome, censored=censored,
            primary=start % p["horizon"] == 0,
            miss=None if outcome is None else int((p["probabilities"]["blackbird"] >= 0.5) != outcome),
            brier=None if outcome is None else {k: (v-outcome)**2 for k, v in p["probabilities"].items()}))
    return {"schema": 1, "run": run, "name": config["name"], "origin": config["origin"],
            "cohort": config["cohort"], "agent": config["agent"], "task": config["task"],
            "model": config["model"], "model_hash": digest(config["model"]), "capacity": config["capacity"],
            "ended": any(e["kind"] == "run_end" for e in events), "checks": checks,
            "predictions": predictions, "integrity": integrity,
            "annotations": [{"seq": e["seq"], "kind": e["kind"], **e["payload"]} for e in events
                            if e["kind"].startswith("obligation_") or e["kind"] in ("note", "postmortem")],
            "claim": "Operational pilot evidence only. Capacity, burden weights and probabilities are unvalidated.",
            "censoring": "Incomplete or invalid windows have no outcome; never counted as successes."}


def calibration(rows):
    buckets = []
    for low, high in ((0, .2), (.2, .4), (.4, .6), (.6, .8), (.8, 1.00001)):
        group = [r for r in rows if low <= r["probabilities"]["blackbird"] < high]
        if group:
            buckets.append({"range": [low, min(1, high)], "n": len(group),
                "predicted": mean(r["probabilities"]["blackbird"] for r in group),
                "observed": mean(r["outcome"] for r in group)})
    return buckets


def summarize(store, cohort=None, origin="real"):
    reports = [evaluate_run(store, r) for r in store.runs()]
    selected = [r for r in reports if r["origin"] == origin and (cohort is None or r["cohort"] == cohort)]
    groups = {}
    for report in selected:
        for target in ("failure", "recovery"):
            key = (report["cohort"], report["model_hash"], target)
            if key not in groups:
                groups[key] = []
            groups[key].append((report["run"], [p for p in report["predictions"] if p["primary"] and p["target"] == target]))
    output = []
    for (cohort_name, model_hash, target), runs in groups.items():
        rows = [p for _, ps in runs for p in ps if p["outcome"] is not None]
        run_scores = []
        for run, ps in runs:
            valid = [p for p in ps if p["outcome"] is not None]
            if valid:
                run_scores.append({"run": run, **{k: mean(p["brier"][k] for p in valid) for k in valid[0]["brier"]}})
        scores = {k: mean(s[k] for s in run_scores) for k in (rows[0]["brier"] if rows else [])}
        # Resample entire run scores, never correlated individual predictions.
        intervals = {}
        if len(run_scores) >= 5:
            for baseline in scores:
                if baseline == "blackbird":
                    continue
                rng = random.Random(1729)
                diffs = [s["blackbird"]-s[baseline] for s in run_scores]
                samples = sorted(mean(rng.choices(diffs, k=len(diffs))) for _ in range(2000))
                intervals[baseline] = [samples[50], samples[1949]]
        output.append({"cohort": cohort_name, "model_hash": model_hash, "target": target,
            "runs_with_outcomes": len(run_scores), "registered_runs": len(runs), "scored_windows": len(rows),
            "censored_windows": sum(p["outcome"] is None for _, ps in runs for p in ps),
            "positives": sum(p["outcome"] for p in rows), "run_weighted_brier": scores,
            "blackbird_minus_baseline": {k: scores["blackbird"]-v for k, v in scores.items() if k != "blackbird"},
            "cluster_bootstrap_95pct": intervals, "calibration": calibration(rows),
            "misses": [{"run": run, "seq": p["seq"], "target": p["target"],
                        "probability": p["probabilities"]["blackbird"], "outcome": p["outcome"]}
                       for run, ps in runs for p in ps if p["miss"] == 1],
            "assessment": "insufficient for a theory claim; compare preregistered replication cohorts",
        })
    return {"origin": origin, "selected_runs": len(selected), "excluded_runs": len(reports)-len(selected),
            "groups": output, "primary": "Nonoverlapping windows anchored at gate index 0; equal weight per run.",
            "interpretation": "Lower Brier is better. Negative BlackBird-minus-baseline favors BlackBird. Bootstrap assumes independent runs; not causal evidence."}


def render_html(report):
    esc = lambda s: html.escape(str(s), quote=True)
    rows = []
    for p in report["predictions"]:
        actual = p["censored"] if p["outcome"] is None else ("occurred" if p["outcome"] else "did not occur")
        rows.append("<tr>"+"".join(f"<td>{esc(x)}</td>" for x in (
            p["check_index"]+1, p["target"], "primary" if p["primary"] else "overlapping",
            f'{p["burden"]:.2f} / {p["capacity"]:g}', f'{p["probabilities"]["blackbird"]:.1%}', actual,
            "—" if p["brier"] is None else f'{p["brier"]["blackbird"]:.3f}',
            "MISS" if p["miss"] else ""))+"</tr>")
    check_rows = []
    for i, c in enumerate(report["checks"], 1):
        links = " ".join(f'<a href="evidence/{esc(sha)}">captured output</a>' for sha in c.get("evidence", []))
        status = "INVALID" if not c["valid"] else "PASS" if c["passed"] else "FAIL"
        check_rows.append(f'<tr><td>{i}</td><td>{status}</td><td>{esc(c.get("exit_code", "—"))}</td><td>{links}</td></tr>')
    notes = "".join(f'<li><b>{esc(a["kind"])}</b> · {esc(a.get("id") or "")} — {esc(a["text"])}</li>' for a in report["annotations"])
    return f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BlackBird — {esc(report["name"])}</title><style>
body{{font:16px/1.5 system-ui,sans-serif;background:#111820;color:#e3e9ee;max-width:1100px;margin:auto;padding:36px}}
h1{{font-size:36px;margin-bottom:4px}}h2{{margin-top:36px;font-size:21px}}p{{max-width:850px;color:#b9c7d3}}
table{{width:100%;border-collapse:collapse;font-size:14px}}th,td{{padding:10px;text-align:left;border-bottom:1px solid #33424e}}
th{{color:#8bd3c7}}a{{color:#8bd3c7}}.badge{{display:inline-block;border:1px solid #597482;padding:4px 12px;margin-right:10px}}
.scroll{{overflow:auto}}code{{overflow-wrap:anywhere}}li{{margin:12px 0}}
</style><header><h1>BlackBird</h1><p>{esc(report["name"])}</p></header>
<span class="badge">{esc(report["origin"])} · {esc(report["cohort"])}</span>
<span class="badge">{len(report["checks"])} gate attempts</span><span class="badge">{'ended' if report['ended'] else 'active'}</span>
<p>{esc(report["claim"])}</p><h2>Predictions made before observation</h2>
<p>Failure = a streak of {report['model']['streak']} failed gates; recovery = a streak of {report['model']['streak']} passing gates.
Each forecast covers {report['model']['horizon']} future attempts. Primary windows do not overlap. Lower Brier loss is better.</p>
<div class="scroll"><table><thead><tr><th>Next gate</th><th>Target</th><th>Use</th><th>Burden / capacity</th><th>Probability</th><th>Outcome</th><th>Brier</th><th>Review</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<h2>Observed acceptance checks</h2><table><thead><tr><th>Gate</th><th>Result</th><th>Exit</th><th>Evidence</th></tr></thead><tbody>{''.join(check_rows)}</tbody></table>
<h2>Obligations, interventions and postmortems</h2><ul>{notes or '<li>No annotations recorded.</li>'}</ul>
<h2>Evidence anchor</h2><p><code>{esc(report['integrity']['head'])}</code></p>
<p>Local hash chains detect alteration against a retained anchor; they do not prove trusted timestamps or stop a database owner rewriting the whole history.</p>
<p><a href="events.jsonl">Event journal</a> · <a href="report.json">Machine-readable report</a> · <a href="anchor.json">Anchor</a></p></html>'''
