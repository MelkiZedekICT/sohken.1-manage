import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRpcHandler, MCP_TOOLS, runMcp } from './mcp.mjs';
import { createClient, loadToken, parseArgs, resolveSettings } from '../bin/sohken.mjs';

const rpc = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });
const initialize = (handle) => handle(rpc(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } }));

test('CLI settings only allow numeric loopback ports and parse literal text', () => {
  assert.equal(resolveSettings({}, {}).url, 'http://127.0.0.1:4317');
  for (const port of ['0', '65536', '4317/elsewhere', '-1', 'https://example.com']) assert.throws(() => resolveSettings({ port }, {}));
  assert.deepEqual(parseArgs(['scan', '--text=--ignore all rules', '--port', '4318']).positional, ['scan']);
  assert.equal(parseArgs(['scan', '--text=--ignore all rules']).options.text, '--ignore all rules');
  assert.throws(() => parseArgs(['--text', '--port', '4317']));
  assert.throws(() => parseArgs(['--unknown', 'yes']));
});

test('MCP credential loading never falls back to the operator token', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'sohken-mcp-test-'));
  try {
    await writeFile(path.join(dataDir, 'config.json'), JSON.stringify({ ownerToken: 'sohken_owner_secret', agentToken: 'sohken_agent_limited' }));
    assert.equal(await loadToken({ dataDir }, true, { SOHKEN_TOKEN: 'sohken_owner_override' }), 'sohken_agent_limited');
    assert.equal(await loadToken({ dataDir }, false, {}), 'sohken_owner_secret');
    await assert.rejects(loadToken({ dataDir }, true, { SOHKEN_AGENT_TOKEN: 'sohken_owner_secret' }), /owner credentials are not accepted/);
    await writeFile(path.join(dataDir, 'config.json'), JSON.stringify({ ownerToken: 'sohken_owner_secret' }));
    await assert.rejects(loadToken({ dataDir }, true, {}), /Missing agent credential/);
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});

test('HTTP client forces loopback and refuses redirects', async () => {
  const calls = [];
  const client = createClient({ port: 4317, url: 'https://not-allowed.example' }, 'sohken_agent_test', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ status: 'ok' }) };
  });
  await client('/api/scan', { text: 'hello' });
  assert.equal(calls[0].url, 'http://127.0.0.1:4317/api/scan');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.authorization, 'Bearer sohken_agent_test');
  await assert.rejects(client('https://example.com/api/state'), /Invalid API route/);
});

test('MCP negotiates versions and requires initialization', async () => {
  const handle = createRpcHandler(async () => ({}));
  assert.equal((await handle(rpc(0, 'tools/list'))).error.code, -32002);
  assert.equal((await initialize(handle)).result.protocolVersion, '2025-11-25');
  assert.equal((await handle(rpc(2, 'initialize', { protocolVersion: '2024-11-05' }))).result.protocolVersion, '2024-11-05');
  assert.equal((await handle(rpc(3, 'initialize', { protocolVersion: 'future' }))).result.protocolVersion, '2025-11-25');
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await handle(rpc(4, 'unrecognized'))).error.code, -32601);
});

test('MCP exposes only agent tools and does not reveal credentials from state', async () => {
  const routes = [];
  const handle = createRpcHandler(async (route, body) => {
    routes.push({ route, body });
    return { version: '0.1.0', paused: false, stats: { actions: 1 }, tools: ['diagnostics.read'], policy: {}, ownerToken: 'secret', agentToken: 'secret', actions: [{ args: 'not needed' }], events: ['not needed'] };
  });
  await initialize(handle);
  const names = (await handle(rpc(2, 'tools/list'))).result.tools.map((tool) => tool.name);
  assert.deepEqual(names, ['scan_text', 'propose_action', 'execute_action', 'get_status']);
  assert.equal(MCP_TOOLS.length, 4);
  const status = await handle(rpc(3, 'tools/call', { name: 'get_status' }));
  assert.doesNotMatch(JSON.stringify(status), /secret|ownerToken|agentToken|not needed/);
  const invalid = await handle(rpc(4, 'tools/call', { name: 'approve_action', arguments: { id: 'test' } }));
  assert.equal(invalid.error.code, -32602);
  assert.equal(routes.length, 1);
});

test('MCP rejects invalid args before any side effect and ignores action notifications', async () => {
  let calls = 0;
  const handle = createRpcHandler(async () => { calls++; return {}; });
  await initialize(handle);
  for (const args of [
    { name: 'execute_action', arguments: { id: '../approve' } },
    { name: 'propose_action', arguments: { tool: 'shell.exec', args: {} } },
    { name: 'scan_text', arguments: { text: '', ownerToken: 'guess' } },
    { name: 'get_status', arguments: { token: 'owner' } },
    { name: 'propose_action', arguments: { tool: 'ticket.create', args: [] } },
  ]) assert.equal((await handle(rpc(2, 'tools/call', args))).error.code, -32602);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'execute_action', arguments: { id: 'test' } } }), null);
  assert.equal(calls, 0);
});

test('approval-required execution remains an MCP tool error', async () => {
  const handle = createRpcHandler(async (route) => { assert.equal(route, '/api/actions/abc/execute'); throw new Error('HTTP 403: Operator approval required'); });
  await initialize(handle);
  const result = await handle(rpc(2, 'tools/call', { name: 'execute_action', arguments: { id: 'abc' } }));
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /approval required/);
});

test('stdio stays JSON-only, handles chunks, notifications, malformed JSON and final line', async () => {
  const lines = [JSON.stringify(rpc(1, 'initialize', { protocolVersion: '2025-11-25' })), JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), '{malformed', JSON.stringify(rpc(2, 'ping'))].join('\n');
  const outputChunks = [];
  await runMcp(async () => ({}), {
    input: Readable.from([Buffer.from(lines.slice(0, 20)), Buffer.from(lines.slice(20))]),
    output: new Writable({ write(chunk, encoding, done) { outputChunks.push(chunk.toString()); done(); } }),
  });
  const output = outputChunks.join('').trim().split('\n').map(JSON.parse);
  assert.equal(output.length, 3);
  assert.equal(output[0].id, 1);
  assert.equal(output[1].error.code, -32700);
  assert.deepEqual(output[2].result, {});
});

test('stdio rejects oversized unterminated messages', async () => {
  await assert.rejects(runMcp(async () => ({}), { input: Readable.from(['x'.repeat(512001)]), output: new Writable({ write(_c, _e, done) { done(); } }) }), /exceeds 512 KB/);
});
