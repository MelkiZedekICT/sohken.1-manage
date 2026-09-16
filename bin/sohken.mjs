#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const HELP = `Sohken — a local security checkpoint for agent actions

Usage: sohken <command> [options]

  serve                    Start the local engine and dashboard
  scan --text "TEXT"       Inspect text (or --file PATH, or piped stdin)
  status                   Show engine status and available local tools
  actions propose --tool TOOL --args '{"key":"value"}' [--key KEY]
                           Request a policy decision before an action
  approve ID --digest HASH Approve the exact reviewed action as operator
  reject ID --digest HASH  Reject the exact reviewed action as operator
  execute ID               Execute an allowed or operator-approved action
  pause | resume           Pause or resume action execution
  audit verify             Verify the local audit chain
  export                   Print a sanitized JSON export
  demo                     Run safe local demonstration fixtures
  mcp                      Serve the agent-only MCP interface over stdio
  help                     Show this help

Global options:
  --data-dir PATH           Local state directory (SOHKEN_HOME or ~/.sohken)
  --port PORT               Engine port (SOHKEN_PORT or 4317)

Start with: sohken serve
Then open the dashboard URL printed in that terminal. Treat its pairing link
like a password. Only tools routed through Sohken are protected.
CLI auth: SOHKEN_TOKEN, otherwise local ownerToken in config.json.
MCP auth: SOHKEN_AGENT_TOKEN, otherwise local agentToken in config.json.
MCP never offers approve, reject, pause, export, or owner credentials.
`;

const VALUE_OPTIONS = new Set(['data-dir', 'port', 'text', 'file', 'tool', 'args', 'key', 'digest']);
export function parseArgs(argv) {
  const positional = [];
  const options = Object.create(null);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const equal = arg.indexOf('=');
    const key = arg.slice(2, equal < 0 ? undefined : equal);
    if (!VALUE_OPTIONS.has(key)) throw new Error(`Unknown option: --${key}`);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: --${key}`);
    const value = equal < 0 ? argv[++i] : arg.slice(equal + 1);
    if (value === undefined || (equal < 0 && value.startsWith('--'))) throw new Error(`Missing value for --${key}`);
    options[key] = value;
  }
  return { positional, options };
}

export function resolveSettings(options = {}, env = process.env) {
  const portText = String(options.port ?? env.SOHKEN_PORT ?? '4317');
  if (!/^\d{1,5}$/.test(portText)) throw new Error('Port must be an integer from 1 to 65535.');
  const port = Number(portText);
  if (port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
  const dataDir = path.resolve(options['data-dir'] ?? env.SOHKEN_HOME ?? path.join(homedir(), '.sohken'));
  return { dataDir, port, url: `http://127.0.0.1:${port}` };
}

export async function loadToken(settings, agentOnly = false, env = process.env) {
  const explicit = agentOnly ? env.SOHKEN_AGENT_TOKEN : env.SOHKEN_TOKEN;
  const validate = (token) => {
    if (agentOnly && !token.startsWith('sohken_agent_')) throw new Error('MCP requires an agent credential; owner credentials are not accepted.');
    return token;
  };
  if (explicit) return validate(explicit);
  let config;
  try { config = JSON.parse(await readFile(path.join(settings.dataDir, 'config.json'), 'utf8')); }
  catch { throw new Error('No readable local credentials. Start `sohken serve` with the same data directory first.'); }
  const token = agentOnly ? config.agentToken : config.ownerToken;
  if (typeof token !== 'string' || !token) throw new Error(`Missing ${agentOnly ? 'agent' : 'owner'} credential. Start the local engine first.`);
  return validate(token);
}

export function createClient(settings, token, fetchImpl = globalThis.fetch) {
  // Never take a remote base URL from environment, input text, or MCP arguments.
  const base = `http://127.0.0.1:${settings.port}`;
  return async function request(route, body) {
    if (!route.startsWith('/api/') || route.includes('..')) throw new Error('Invalid API route.');
    let response;
    try {
      response = await fetchImpl(base + route, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new Error(`Cannot reach Sohken at ${base}. Start 'sohken serve' and check the port.`); }
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Engine returned an invalid response (HTTP ${response.status}).`); }
    if (!response.ok) {
      const detail = typeof data.error === 'string' ? data.error : data.error?.message;
      throw new Error(detail ? `HTTP ${response.status}: ${detail}` : `Engine rejected request (HTTP ${response.status}).`);
    }
    return data;
  };
}

function required(options, name) {
  if (typeof options[name] !== 'string' || !options[name]) throw new Error(`Required: --${name}`);
  return options[name];
}

async function readScanText(options) {
  if (Object.hasOwn(options, 'text') && Object.hasOwn(options, 'file')) throw new Error('Use either --text or --file, not both.');
  if (Object.hasOwn(options, 'text')) return options.text;
  if (Object.hasOwn(options, 'file')) {
    const text = await readFile(options.file, 'utf8');
    if (Buffer.byteLength(text) > 65536) throw new Error('Scan input exceeds 64 KB.');
    return text;
  }
  if (process.stdin.isTTY) throw new Error('Provide --text, --file, or pipe text into sohken scan.');
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk.toString('utf8');
    if (Buffer.byteLength(text) > 65536) throw new Error('Scan input exceeds 64 KB.');
  }
  return text;
}

export async function main(argv = process.argv.slice(2)) {
  const { positional, options } = parseArgs(argv);
  const [command = 'help', subcommand, ...extra] = positional;
  if (options.help || command === 'help') { process.stdout.write(HELP); return; }
  const settings = resolveSettings(options);
  if (command === 'serve') {
    if (subcommand) throw new Error('Usage: sohken serve [--data-dir PATH] [--port PORT]');
    const { startServer } = await import('../src/server.mjs');
    const engine = await startServer({ dataDir: settings.dataDir, port: settings.port });
    process.stdout.write(`Sohken is running locally at ${engine.url}\nOpen dashboard (private owner pairing link):\n${engine.url}/#token=${encodeURIComponent(engine.ownerToken)}\nData: ${settings.dataDir}\nPress Ctrl+C to stop.\n`);
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await engine.close();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    return;
  }
  if (command === 'mcp') {
    if (subcommand) throw new Error('Usage: sohken mcp [--data-dir PATH] [--port PORT]');
    const { runMcp } = await import('../integration/mcp.mjs');
    await runMcp(createClient(settings, await loadToken(settings, true)));
    return;
  }
  const request = createClient(settings, await loadToken(settings));
  let result;
  if (command === 'scan') {
    if (subcommand) throw new Error('Usage: sohken scan --text TEXT | --file PATH | < piped text');
    const text = await readScanText(options);
    if (!text.trim()) throw new Error('Scan input must not be empty.');
    if (Buffer.byteLength(text) > 65536) throw new Error('Scan input exceeds 64 KB.');
    result = await request('/api/scan', { text, source: 'terminal' });
  } else if (command === 'actions' && subcommand === 'propose' && !extra.length) {
    const tool = required(options, 'tool');
    let args;
    try { args = JSON.parse(required(options, 'args')); } catch { throw new Error('--args must be a JSON object.'); }
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('--args must be a JSON object.');
    result = await request('/api/actions', { tool, args, ...(options.key ? { idempotencyKey: options.key } : {}) });
  } else if (['approve', 'reject', 'execute'].includes(command)) {
    if (!subcommand || extra.length) throw new Error(`Usage: sohken ${command} ID${command === 'execute' ? '' : ' --digest HASH'}`);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(subcommand)) throw new Error('Invalid action ID.');
    result = await request(`/api/actions/${encodeURIComponent(subcommand)}/${command}`, command === 'execute' ? {} : { digest: required(options, 'digest') });
  } else if (command === 'audit' && subcommand === 'verify' && !extra.length) {
    result = await request('/api/audit/verify');
  } else if (!subcommand && command === 'status') {
    result = await request('/api/state');
  } else if (!subcommand && ['pause', 'resume'].includes(command)) {
    result = await request('/api/pause', { paused: command === 'pause' });
  } else if (!subcommand && command === 'export') {
    result = await request('/api/export');
  } else if (!subcommand && command === 'demo') {
    result = await request('/api/demo', {});
  } else {
    throw new Error(`Unknown command. Run 'sohken help' for usage.`);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Sohken: ${error.message}\n`);
    process.exitCode = 1;
  });
}
