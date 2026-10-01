import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CaseStore } from '../src/cases.mjs';

test('cases can be created, searched by status and updated without crossing accounts', t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sohken-cases-'));
  const store = new CaseStore(dir);
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  const first = store.create('account-a', { title: '  Unexpected credential access  ', description: 'Investigate the event.', priority: 'urgent', labels: ['Credential', 'review'], sourceEventId: 'evt-12' });
  store.create('account-b', { title: 'Private case' });
  assert.equal(first.title, 'Unexpected credential access');
  assert.deepEqual(first.labels, ['credential', 'review']);
  assert.equal(store.list('account-a').length, 1);
  assert.equal(store.list('account-b')[0].title, 'Private case');
  const updated = store.update('account-a', first.id, { status: 'in_progress', priority: 'high' });
  assert.equal(updated.status, 'in_progress');
  assert.equal(updated.priority, 'high');
  assert.equal(store.list('account-a', 'open').length, 0);
  assert.equal(store.list('account-a', 'in_progress').length, 1);
  assert.throws(() => store.update('account-b', first.id, { status: 'resolved' }), /not found/);
});

test('case validation rejects unsupported states, oversized labels and extra fields', t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sohken-cases-'));
  const store = new CaseStore(dir);
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.throws(() => store.create('account-a', { title: 'Bad status', status: 'done' }), /open, in progress or resolved/);
  assert.throws(() => store.create('account-a', { title: 'Too many labels', labels: Array(9).fill('label') }), /eight short labels/);
  assert.throws(() => store.create('account-a', { title: 'Unexpected input', owner: true }), /unsupported field/);
});
