"""Pure, versioned model and independent outcome definition."""
import hashlib
import json
import math


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


DEFAULT_MODEL = {
    "version": "burden-v0.1",
    "weights": {"assumption": 1.0, "decision": 1.5, "dependency": 1.5, "verification": 1.0},
    "externalized_multiplier": 0.5,
    "intercept": -2.0,
    "pressure_slope": 2.0,
    "horizon": 3,
    "streak": 2,
}


def number(value, name, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"{name} must be a finite number in [{low}, {high}]")
    return value


def validate_model(model):
    if set(model) != set(DEFAULT_MODEL):
        raise ValueError("model keys must match the versioned model schema")
    if not isinstance(model["version"], str) or not model["version"].strip():
        raise ValueError("model version is required")
    if set(model["weights"]) != set(DEFAULT_MODEL["weights"]):
        raise ValueError("model must define all four obligation kinds")
    for key, value in model["weights"].items():
        number(value, key, 0.01, 100)
    number(model["externalized_multiplier"], "externalized_multiplier", 0, 1)
    number(model["intercept"], "intercept", -20, 20)
    number(model["pressure_slope"], "pressure_slope", 0, 20)
    for key in ("horizon", "streak"):
        if type(model[key]) is not int or not 1 <= model[key] <= 100:
            raise ValueError(f"{key} must be an integer between 1 and 100")
    if model["streak"] > model["horizon"]:
        raise ValueError("streak must fit within horizon")


def state(events):
    obligations = {}
    checks = []
    for event in events:
        p = event["payload"]
        if event["kind"] == "obligation_open":
            obligations[p["id"]] = dict(p, externalized=False, closed=False)
        elif event["kind"] in ("obligation_close", "obligation_externalize", "obligation_simplify"):
            item = obligations[p["id"]]
            if event["kind"] == "obligation_close":
                item["closed"] = True
            elif event["kind"] == "obligation_externalize":
                item["externalized"] = True
            else:
                item["units"] = p["units"]
        elif event["kind"] == "check":
            checks.append(p)
    return obligations, checks


def has_streak(values, desired, length):
    count = 0
    for value in values:
        count = count + 1 if value == desired else 0
        if count >= length:
            return True
    return False


def label(checks, target, horizon, streak):
    """No labels for incomplete windows, changed gates, or interrupted capture."""
    if len(checks) < horizon:
        return None, "incomplete horizon"
    window = checks[:horizon]
    if any(not c["valid"] for c in window):
        return None, "protocol deviation or interrupted check"
    return int(has_streak([c["passed"] for c in window], target == "recovery", streak)), None


def forecast(events, config):
    model = config["model"]
    obligations, checks = state(events)
    active = [o for o in obligations.values() if not o["closed"]]
    contributions = [{"id": o["id"], "kind": o["kind"], "burden":
        o["units"] * model["weights"][o["kind"]] * (model["externalized_multiplier"] if o["externalized"] else 1)
        } for o in active]
    burden = sum(o["burden"] for o in contributions)
    pressure = burden / config["capacity"]
    last = checks[-1] if checks else None
    target = "recovery" if last and last["valid"] and not last["passed"] else "failure"
    sigmoid = lambda x: 1 / (1 + math.exp(-max(-30, min(30, x))))
    failure = sigmoid(model["intercept"] + model["pressure_slope"] * pressure)
    count_failure = sigmoid(-2 + 0.5 * len(active))
    historical = []
    h = model["horizon"]
    # Only already observed, nonoverlapping windows. No future prevalence leakage.
    for start in range(0, len(checks) - h + 1, h):
        y, _ = label(checks[start:start+h], target, h, model["streak"])
        if y is not None:
            historical.append(y)
    persistence_failure = 0.8 if last and last["valid"] and not last["passed"] else 0.2
    convert = lambda p: p if target == "failure" else 1-p
    return {
        "target": target, "check_index": len(checks), "horizon": h, "streak": model["streak"],
        "model_hash": digest(model), "capacity": config["capacity"], "burden": burden,
        "pressure": pressure, "open_count": len(active), "contributions": contributions,
        "probabilities": {"blackbird": convert(failure), "constant": 0.5,
            "persistence": convert(persistence_failure), "count_only": convert(count_failure),
            "elapsed_checks": convert(min(0.8, 0.2 + 0.02 * len(checks))),
            "prior_windows": (sum(historical) + 1) / (len(historical) + 2)},
        "calibrated": False,
    }
