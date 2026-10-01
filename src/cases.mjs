import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, lstatSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { EngineError } from './engine.mjs';

const STATUSES = new Set(['open', 'in_progress', 'resolved']);
const PRIORITIES = new Set(['urgent', 'high', 'medium', 'low', 'none']);

export class CaseStore {
  constructor(dataDir) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const file = path.join(path.resolve(dataDir), 'cases.sqlite');
    try { if (lstatSync(file).isSymbolicLink()) throw new Error('Case database must not be a symlink.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
        priority TEXT NOT NULL, labels TEXT NOT NULL DEFAULT '[]', source_event_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cases_account_updated ON cases(account_id, updated_at DESC);
    `);
    if (process.platform !== 'win32') chmodSync(file, 0o600);
  }

  validate(input, partial = false) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new EngineError('A case needs valid details.');
    const allowed = new Set(['title', 'description', 'status', 'priority', 'labels', 'sourceEventId']);
    if (Object.keys(input).some(key => !allowed.has(key))) throw new EngineError('A case contains an unsupported field.');
    const out = {};
    if (!partial || Object.hasOwn(input, 'title')) {
      if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 160) throw new EngineError('Use a case title between 1 and 160 characters.');
      out.title = input.title.trim();
    }
    if (!partial || Object.hasOwn(input, 'description')) {
      if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 8000)) throw new EngineError('Case details must be under 8,000 characters.');
      out.description = input.description || '';
    }
    if (!partial || Object.hasOwn(input, 'status')) {
      const status = input.status || 'open';
      if (!STATUSES.has(status)) throw new EngineError('Choose open, in progress or resolved.');
      out.status = status;
    }
    if (!partial || Object.hasOwn(input, 'priority')) {
      const priority = input.priority || 'none';
      if (!PRIORITIES.has(priority)) throw new EngineError('Choose a supported priority.');
      out.priority = priority;
    }
    if (!partial || Object.hasOwn(input, 'labels')) {
      const labels = input.labels || [];
      if (!Array.isArray(labels) || labels.length > 8 || labels.some(label => typeof label !== 'string' || !label.trim() || label.trim().length > 32)) throw new EngineError('Use up to eight short labels.');
      out.labels = [...new Set(labels.map(label => label.trim().toLowerCase()))];
    }
    if (Object.hasOwn(input, 'sourceEventId')) {
      if (input.sourceEventId !== null && (typeof input.sourceEventId !== 'string' || input.sourceEventId.length > 100)) throw new EngineError('The linked event is invalid.');
      out.sourceEventId = input.sourceEventId;
    }
    return out;
  }

  safe(row) { return { id: row.id, title: row.title, description: row.description, status: row.status, priority: row.priority, labels: JSON.parse(row.labels), sourceEventId: row.source_event_id, createdAt: row.created_at, updatedAt: row.updated_at }; }
  list(accountId, status = '') {
    if (status && !STATUSES.has(status)) throw new EngineError('Choose a supported case status.');
    const rows = status
      ? this.db.prepare('SELECT * FROM cases WHERE account_id=? AND status=? ORDER BY CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 ELSE 4 END, updated_at DESC').all(accountId, status)
      : this.db.prepare('SELECT * FROM cases WHERE account_id=? ORDER BY CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 ELSE 4 END, updated_at DESC').all(accountId);
    return rows.map(row => this.safe(row));
  }
  create(accountId, input) {
    const value = this.validate(input);
    const row = { id: randomUUID(), account_id: accountId, ...value, labels: JSON.stringify(value.labels), source_event_id: value.sourceEventId || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO cases(id,account_id,title,description,status,priority,labels,source_event_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(row.id, row.account_id, row.title, row.description, row.status, row.priority, row.labels, row.source_event_id, row.created_at, row.updated_at);
    return this.safe(row);
  }
  update(accountId, id, input) {
    const changes = this.validate(input, true);
    if (!Object.keys(changes).length) throw new EngineError('Choose a case detail to update.');
    const existing = this.db.prepare('SELECT * FROM cases WHERE id=? AND account_id=?').get(id, accountId);
    if (!existing) throw new EngineError('Case not found.', 404);
    const next = { ...this.safe(existing), ...changes, updatedAt: new Date().toISOString() };
    this.db.prepare('UPDATE cases SET title=?,description=?,status=?,priority=?,labels=?,source_event_id=?,updated_at=? WHERE id=? AND account_id=?')
      .run(next.title, next.description, next.status, next.priority, JSON.stringify(next.labels), next.sourceEventId || null, next.updatedAt, id, accountId);
    return this.safe(this.db.prepare('SELECT * FROM cases WHERE id=? AND account_id=?').get(id, accountId));
  }
  close() { this.db.close(); }
}
