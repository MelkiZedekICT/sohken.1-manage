import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, lstatSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { Engine, EngineError, initConfig } from './engine.mjs';

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PROFILE_ID = /^[0-9a-f-]{36}$/u;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class AccountStore {
  constructor(dataDir, legacyEngine) {
    this.root = path.resolve(dataDir);
    this.legacyEngine = legacyEngine;
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    const dbFile = path.join(this.root, 'accounts.sqlite');
    try { if (lstatSync(dbFile).isSymbolicLink()) throw new Error('Account database must not be a symlink.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.db = new DatabaseSync(dbFile);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', subscription_id TEXT,
        subscription_state TEXT NOT NULL DEFAULT 'free', plus_until INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS billing_events (
        event_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS account_settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS account_credentials (
        token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('owner','agent'))
      );
      CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
    `);
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    if (process.platform !== 'win32') chmodSync(dbFile, 0o600);
    this.engines = new Map();
    this.passwordWork = 0;
  }

  async passwordHash(password) {
    const salt = randomBytes(16);
    if (this.passwordWork >= 2) throw new EngineError('Sign-in is busy. Try again in a moment.', 503);
    this.passwordWork++;
    try {
      const digest = await scryptAsync(password, salt, 64, { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
      return `scrypt$131072$8$1$${salt.toString('base64url')}$${Buffer.from(digest).toString('base64url')}`;
    } finally { this.passwordWork--; }
  }

  async verifyPassword(password, encoded) {
    const [, n, r, p, saltText, digestText] = String(encoded).split('$');
    if (n !== '131072' || r !== '8' || p !== '1' || !saltText || !digestText) return false;
    const expected = Buffer.from(digestText, 'base64url');
    if (this.passwordWork >= 2) throw new EngineError('Sign-in is busy. Try again in a moment.', 503);
    this.passwordWork++;
    try {
      const actual = Buffer.from(await scryptAsync(password, Buffer.from(saltText, 'base64url'), expected.length, { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }));
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } finally { this.passwordWork--; }
  }

  safeAccount(row) {
    if (!row) return null;
    const active = Number(row.plus_until) > Date.now();
    return {
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
      plan: active ? 'plus' : 'free',
      planName: active ? 'Plus' : 'Free',
      plusUntil: active ? new Date(Number(row.plus_until)).toISOString() : null,
      subscriptionState: row.subscription_state,
    };
  }

  validate(emailValue, password) {
    if (typeof emailValue !== 'string') throw new Error('Enter your email address.');
    const email = emailValue.trim().normalize('NFKC').toLowerCase();
    if (email.length > 160 || !EMAIL.test(email)) throw new Error('Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Use a password between 12 and 128 characters.');
    return email;
  }

  async register(emailValue, password) {
    const email = this.validate(emailValue, password);
    const id = randomUUID();
    const passwordHash = await this.passwordHash(password);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO accounts(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id, email, passwordHash, new Date().toISOString());
      this.db.prepare(`INSERT OR IGNORE INTO account_settings(key,value) VALUES('legacy_account_id',?)`).run(id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE')) throw new Error('An account already uses that email. Sign in instead.');
      throw error;
    }
    return this.startSession(id);
  }

  async login(emailValue, password) {
    if (typeof emailValue !== 'string' || typeof password !== 'string' || password.length > 128) throw new Error('Email or password is incorrect.');
    const email = emailValue.trim().normalize('NFKC').toLowerCase();
    if (!EMAIL.test(email) || email.length > 160) throw new Error('Email or password is incorrect.');
    const row = this.db.prepare('SELECT * FROM accounts WHERE email=?').get(email);
    if (!row) { await this.passwordHash(password); throw new Error('Email or password is incorrect.'); }
    if (!await this.verifyPassword(password, row.password_hash)) throw new Error('Email or password is incorrect.');
    return this.startSession(row.id);
  }

  startSession(accountId) {
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    this.db.prepare('INSERT INTO sessions(token_hash,account_id,expires_at,created_at) VALUES(?,?,?,?)')
      .run(hash(token), accountId, now + SESSION_DAYS * 86400000, now);
    return { token, account: this.safeAccount(this.db.prepare('SELECT * FROM accounts WHERE id=?').get(accountId)) };
  }

  session(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/u.test(token)) return null;
    const row = this.db.prepare(`SELECT a.*,s.token_hash,s.expires_at FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=?`).get(hash(token));
    if (!row || Number(row.expires_at) <= Date.now()) return null;
    return { account: this.safeAccount(row), accountId: row.id };
  }

  revoke(token) {
    if (typeof token === 'string' && /^[a-f0-9]{64}$/u.test(token)) this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
  }

  accountById(id) { return this.safeAccount(this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id)); }
  hasAccounts() { return Boolean(this.db.prepare('SELECT 1 FROM accounts LIMIT 1').get()); }
  listAccounts() { return this.db.prepare('SELECT * FROM accounts ORDER BY created_at').all().map(row => this.safeAccount(row)); }

  async resetPassword(emailValue, password) {
    const email = this.validate(emailValue, password);
    const row = this.db.prepare('SELECT id FROM accounts WHERE email=?').get(email);
    if (!row) throw new Error('No local account uses that email address.');
    const passwordHash = await this.passwordHash(password);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE accounts SET password_hash=? WHERE id=?').run(passwordHash, row.id);
      this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(row.id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.accountById(row.id);
  }

  engineFor(id) {
    if (!PROFILE_ID.test(id)) throw new Error('Invalid account profile.');
    const legacyId = this.db.prepare(`SELECT value FROM account_settings WHERE key='legacy_account_id'`).get()?.value;
    if (id === legacyId) return this.legacyEngine;
    let engine = this.engines.get(id);
    if (!engine) {
      const dir = path.join(this.root, 'profiles', id);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      engine = new Engine({ dataDir: dir, config: initConfig(dir) });
      this.engines.set(id, engine);
      this.db.prepare(`INSERT OR IGNORE INTO account_credentials(token_hash,account_id,role) VALUES(?,?,?)`).run(hash(engine.config.ownerToken), id, 'owner');
      this.db.prepare(`INSERT OR IGNORE INTO account_credentials(token_hash,account_id,role) VALUES(?,?,?)`).run(hash(engine.config.agentToken), id, 'agent');
    }
    return engine;
  }

  engineForToken(token) {
    if (typeof token !== 'string') return null;
    const credential = this.db.prepare('SELECT account_id,role FROM account_credentials WHERE token_hash=?').get(hash(token));
    return credential ? { engine: this.engineFor(credential.account_id), account: this.accountById(credential.account_id), role: credential.role } : null;
  }

  saveSubscription(accountId, subscriptionId) {
    if (typeof subscriptionId !== 'string' || !/^sub_[A-Za-z0-9]+$/u.test(subscriptionId)) throw new Error('Payment provider returned an invalid subscription.');
    this.db.prepare(`UPDATE accounts SET subscription_id=?,subscription_state='pending' WHERE id=?`).run(subscriptionId, accountId);
  }

  acceptBillingEvent(eventId, subscriptionId, eventName, untilSeconds) {
    if (typeof eventId !== 'string' || !eventId || typeof subscriptionId !== 'string') return false;
    const row = this.db.prepare('SELECT id FROM accounts WHERE subscription_id=?').get(subscriptionId);
    if (!row) return false;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO billing_events(event_id,received_at) VALUES(?,?)').run(eventId, Date.now());
      const activates = ['subscription.activated', 'subscription.charged', 'subscription.resumed'].includes(eventName);
      const downgrades = ['subscription.cancelled', 'subscription.paused', 'subscription.halted', 'subscription.completed'].includes(eventName);
      if (activates) {
        const providerExpiry = Number(untilSeconds) * 1000;
        const plusUntil = Number.isFinite(providerExpiry) && providerExpiry > Date.now() ? providerExpiry : Date.now() + 35 * 86400000;
        this.db.prepare(`UPDATE accounts SET plan='plus',subscription_state='active',plus_until=? WHERE id=?`).run(plusUntil, row.id);
      }
      else if (downgrades) this.db.prepare(`UPDATE accounts SET subscription_state=?,plus_until=? WHERE id=?`).run(eventName.slice('subscription.'.length), Number(untilSeconds || 0) * 1000, row.id);
      this.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE')) return true;
      throw error;
    }
  }

  close() { for (const engine of this.engines.values()) engine.close(); this.engines.clear(); this.db.close(); }
}

export function parseCookies(header = '') {
  const cookies = Object.create(null);
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key === 'sohken_session') cookies[key] = value;
  }
  return cookies;
}

export function sessionCookie(token, clear = false) {
  return `sohken_session=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_DAYS * 86400}${process.env.SOHKEN_SECURE_COOKIES === 'true' ? '; Secure' : ''}`;
}

export function signatureMatches(body, signature, secret) {
  if (!Buffer.isBuffer(body) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/iu.test(signature) || !secret) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

