"""Create an explicitly synthetic upstream BlackBird bundle for adapter tests."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vendor"))
from blackbird.experiment import start, check, end, export
from blackbird.store import Store
root = Path(sys.argv[1])
(root / "gate.txt").write_text("Synthetic fixed acceptance gate", encoding="utf-8")
store = Store(":memory:")
try:
    run = start(store, name="suite-adapter-test", repo=root,
                command=[sys.executable, "-c", "raise SystemExit(0)"],
                gate_files=["gate.txt"], origin="synthetic", cohort="suite-test")
    for _ in range(3):
        check(store, run)
    end(store, run, "Synthetic fixture complete")
    export(store, run, root / "bundle")
finally:
    store.close()
