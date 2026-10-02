import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccountStore } from '../src/accounts.mjs';

test('local password reset clears sessions and accepts the new password', async t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sohken-account-'));
  const store = new AccountStore(dir, null);
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal(store.hasAccounts(), false);
  const created = await store.register('owner@example.test', 'first secure password');
  assert.equal(store.hasAccounts(), true);
  assert.equal(store.listAccounts()[0].email, 'owner@example.test');
  assert.ok(store.session(created.token));
  await store.resetPassword('owner@example.test', 'second secure password');
  assert.equal(store.session(created.token), null);
  await assert.rejects(store.login('owner@example.test', 'first secure password'), /Email or password is incorrect/);
  const signedIn = await store.login('owner@example.test', 'second secure password');
  assert.ok(signedIn.token);
});
