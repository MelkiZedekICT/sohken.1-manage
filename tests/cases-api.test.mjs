import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../src/server.mjs';

async function fixture(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sohken-case-api-'));
  const server = await startServer({ dataDir: dir, port: 0 });
  t.after(async () => { await server.close(); rmSync(dir, { recursive: true, force: true }); });
  return server;
}

test('case API requires a signed-in account session', async t => {
  const server = await fixture(t);
  const headers = { Authorization: `Bearer ${server.ownerToken}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${server.url}/api/cases`, { headers })).status, 401);
  assert.equal((await fetch(`${server.url}/api/cases`, { method: 'POST', headers, body: JSON.stringify({ title: 'No session' }) })).status, 401);
});

test('case API keeps data and updates private to each signed-in account', async t => {
  const server = await fixture(t);
  const signup = async email => {
    const response = await fetch(`${server.url}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery staple' }) });
    assert.equal(response.status, 201);
    return response.headers.get('set-cookie').split(';', 1)[0];
  };
  const first = await signup('first@example.test');
  const second = await signup('second@example.test');
  const send = (cookie, route, body, method = 'GET') => fetch(`${server.url}${route}`, { method, headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const created = await send(first, '/api/cases', { title: 'Agent tried to open a private file', priority: 'high', labels: ['access-review'] }, 'POST');
  assert.equal(created.status, 201);
  const { case: record } = await created.json();
  assert.equal((await (await send(first, '/api/cases')).json()).cases.length, 1);
  assert.equal((await (await send(second, '/api/cases')).json()).cases.length, 0);
  const changed = await send(first, `/api/cases/${record.id}`, { status: 'resolved' }, 'PATCH');
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).case.status, 'resolved');
  assert.equal((await send(second, `/api/cases/${record.id}`, { status: 'resolved' }, 'PATCH')).status, 404);
});
