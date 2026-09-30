"""SQLite transactions, append-only event chains, and content-addressed evidence."""
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import uuid

from .model import canonical, digest


class Store:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(self.path), timeout=10, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS artifacts(sha TEXT PRIMARY KEY, data BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS events(
            run TEXT NOT NULL REFERENCES runs(id), seq INTEGER NOT NULL, at TEXT NOT NULL,
            kind TEXT NOT NULL, payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL,
            PRIMARY KEY(run,seq));
        CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events
            BEGIN SELECT RAISE(ABORT,'events are append-only'); END;
        CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events
            BEGIN SELECT RAISE(ABORT,'events are append-only'); END;
        CREATE TRIGGER IF NOT EXISTS artifacts_no_update BEFORE UPDATE ON artifacts
            BEGIN SELECT RAISE(ABORT,'artifacts are immutable'); END;
        CREATE TRIGGER IF NOT EXISTS artifacts_no_delete BEFORE DELETE ON artifacts
            BEGIN SELECT RAISE(ABORT,'artifacts are immutable'); END;
        """)

    def close(self):
        self.db.close()

    @contextmanager
    def transaction(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def artifact(self, data):
        if isinstance(data, str):
            data = data.encode()
        sha = hashlib.sha256(data).hexdigest()
        self.db.execute("INSERT OR IGNORE INTO artifacts VALUES(?,?)", (sha, data))
        return sha

    def evidence_file(self, path):
        p = Path(path)
        if p.stat().st_size > 16 * 1024 * 1024:
            raise ValueError("evidence file exceeds 16 MiB; supply a smaller evidence extract")
        return self.artifact(p.read_bytes())

    def append(self, run, kind, payload):
        previous = self.db.execute("SELECT seq,hash FROM events WHERE run=? ORDER BY seq DESC LIMIT 1", (run,)).fetchone()
        seq, prev = (previous["seq"]+1, previous["hash"]) if previous else (1, "0"*64)
        event = {"run": run, "seq": seq, "at": datetime.now(timezone.utc).isoformat(),
                 "kind": kind, "payload": payload, "prev": prev}
        event["hash"] = digest(event)
        self.db.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?)", (run, seq, event["at"], kind, canonical(payload), prev, event["hash"]))
        return event

    def create(self, config):
        run = uuid.uuid4().hex[:12]
        with self.transaction():
            self.db.execute("INSERT INTO runs VALUES(?,?)", (run, datetime.now(timezone.utc).isoformat()))
            self.append(run, "run_start", config)
        return run

    def events(self, run):
        rows = self.db.execute("SELECT * FROM events WHERE run=? ORDER BY seq", (run,)).fetchall()
        if not rows:
            raise ValueError(f"unknown run: {run}")
        return [dict(r, payload=json.loads(r["payload"])) for r in rows]

    def runs(self):
        return [r[0] for r in self.db.execute("SELECT id FROM runs ORDER BY created,id")]

    def verify(self, run, expected_head=None):
        events = self.events(run)
        previous = "0"*64
        for seq, event in enumerate(events, 1):
            if event["seq"] != seq or event["prev"] != previous:
                raise ValueError("broken event sequence")
            if digest({k: v for k, v in event.items() if k != "hash"}) != event["hash"]:
                raise ValueError("event hash mismatch")
            previous = event["hash"]
            for sha in event["payload"].get("evidence", []):
                row = self.db.execute("SELECT data FROM artifacts WHERE sha=?", (sha,)).fetchone()
                if row is None or hashlib.sha256(row[0]).hexdigest() != sha:
                    raise ValueError(f"missing or corrupt evidence: {sha}")
        if expected_head and previous != expected_head:
            raise ValueError("journal does not match externally retained head")
        return {"run": run, "events": len(events), "head": previous, "verified": True}
