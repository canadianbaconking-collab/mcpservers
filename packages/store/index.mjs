import { DatabaseSync } from 'node:sqlite';
import { artifactId, canonical, digest } from '../provenance/index.mjs';
import { requireThat } from '../errors/index.mjs';
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    requireThat(version <= 1, 'VERSION', 'Store was created by a newer suite.');
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(stream TEXT NOT NULL, seq INTEGER NOT NULL, prev TEXT, hash TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(stream,seq));
      CREATE TRIGGER IF NOT EXISTS immutable_artifacts_update BEFORE UPDATE ON artifacts BEGIN SELECT RAISE(ABORT,'immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_artifacts_delete BEFORE DELETE ON artifacts BEGIN SELECT RAISE(ABORT,'immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_events_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_events_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
      PRAGMA user_version=1;`);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  put(kind, data) {
    const id = artifactId(kind, data),
      body = canonical(data);
    requireThat(Buffer.byteLength(body) <= 2_000_000, 'LIMIT', 'Artifact exceeds 2 MB.');
    this.db.prepare('INSERT OR IGNORE INTO artifacts VALUES(?,?,?)').run(id, kind, body);
    this.get(id, kind);
    return { id, kind, data };
  }
  get(id, kind) {
    const row = this.db.prepare('SELECT * FROM artifacts WHERE id=?').get(id);
    requireThat(
      row && (!kind || row.kind === kind),
      'NOT_FOUND',
      'Artifact is missing or has the wrong kind.',
    );
    const data = JSON.parse(row.body);
    requireThat(artifactId(row.kind, data) === id, 'INTEGRITY', 'Artifact hash mismatch.');
    return { id, kind: row.kind, data };
  }
  list(kind, limit = 100, offset = 0) {
    return this.db
      .prepare('SELECT id FROM artifacts WHERE kind=? ORDER BY id LIMIT ? OFFSET ?')
      .all(kind, limit, offset)
      .map((row) => this.get(row.id, kind));
  }
  append(stream, data) {
    const previous = this.db
      .prepare('SELECT seq,hash FROM events WHERE stream=? ORDER BY seq DESC LIMIT 1')
      .get(stream);
    requireThat((previous?.seq ?? 0) < 10000, 'LIMIT', 'Stream reached its v0.1 limit.');
    const event = { stream, seq: (previous?.seq ?? 0) + 1, prev: previous?.hash ?? null, data };
    const hash = digest(event);
    this.db
      .prepare('INSERT INTO events VALUES(?,?,?,?,?)')
      .run(stream, event.seq, event.prev, hash, canonical(data));
    return { ...event, hash };
  }
  events(stream) {
    let prev = null;
    const rows = this.db
      .prepare('SELECT * FROM events WHERE stream=? ORDER BY seq LIMIT 10001')
      .all(stream);
    requireThat(rows.length <= 10000, 'LIMIT', 'Stream exceeds v0.1 read limit.');
    return rows.map((row, i) => {
      const event = { stream, seq: row.seq, prev: row.prev, data: JSON.parse(row.body) };
      requireThat(
        event.seq === i + 1 && event.prev === prev && digest(event) === row.hash,
        'INTEGRITY',
        'Event chain mismatch.',
      );
      prev = row.hash;
      return { ...event, hash: row.hash };
    });
  }
  references(ids) {
    return ids.map((id) => this.get(id));
  }
  close() {
    this.db.close();
  }
}
