"""Fixed adapters only. Never evaluate caller code or run a stored BlackBird gate."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
operation, raw = sys.argv[1:]
args = json.loads(raw)
if operation == "faultline":
    spec = importlib.util.spec_from_file_location("faultline_review", ROOT / "vendor/faultline/review.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    metadata, packet = module.gather(argparse.Namespace(base=args["base"], head="HEAD", include_working_tree=args["includeWorkingTree"], intent=args["intent"], output=None))
    print(json.dumps({"metadata": metadata, "packet": packet}))
elif operation == "blackbird":
    sys.path.insert(0, str(ROOT / "vendor"))
    from blackbird.bundle import verify_bundle
    print(json.dumps(verify_bundle(args["path"], args.get("expectedHead"))))
else:
    raise ValueError("Unknown fixed adapter")
