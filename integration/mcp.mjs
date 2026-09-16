import { StringDecoder } from 'node:string_decoder';

const SUPPORTED_VERSIONS = ['2025-11-25', '2024-11-05'];
const MAX_MESSAGE_BYTES = 512_000;
const objectSchema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

export const MCP_TOOLS = [
  {
    name: 'scan_text',
    description: 'Inspect supplied text for heuristic signs of prompt injection and secret exposure. Findings are advisory; a clean result is not proof of safety. Raw text is not persisted by the engine.',
    inputSchema: objectSchema({ text: { type: 'string', minLength: 1, maxLength: 65536 } }, ['text']),
    annotations: { title: 'Scan supplied text', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'propose_action',
    description: 'Request a policy decision for a fixed local tool. diagnostics.read is read-only; ticket.create creates a LOCAL demo ticket and needs operator approval. file.delete and network.send are always denied. Never bypass a denied or approval-required result by using another tool.',
    inputSchema: objectSchema({
      tool: { type: 'string', enum: ['diagnostics.read', 'ticket.create', 'file.delete', 'network.send'] },
      args: { type: 'object' },
      idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
    }, ['tool', 'args']),
    annotations: { title: 'Propose a protected local action', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'execute_action',
    description: 'Execute a previously proposed local action by ID. Engine policy and exact-payload operator approval are enforced. This tool cannot approve its own actions and cannot execute arbitrary shell commands or external integrations.',
    inputSchema: objectSchema({ id: { type: 'string', minLength: 1, maxLength: 128 } }, ['id']),
    annotations: { title: 'Execute an authorized local action', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_status',
    description: 'Read the local engine mode, pause state, tool policy, and summary counts. Owner credentials and approval controls are never returned.',
    inputSchema: objectSchema({}),
    annotations: { title: 'Read checkpoint status', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

class RpcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RpcError(-32602, 'Parameters must be an object.');
}

function validateArgs(name, value) {
  const tool = MCP_TOOLS.find((entry) => entry.name === name);
  if (!tool) throw new RpcError(-32602, 'Unknown tool.');
  requireObject(value);
  const schema = tool.inputSchema;
  for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties, key)) throw new RpcError(-32602, `Unknown argument: ${key}`);
  for (const key of schema.required) if (!Object.hasOwn(value, key)) throw new RpcError(-32602, `Missing argument: ${key}`);
  for (const [key, item] of Object.entries(value)) {
    const rule = schema.properties[key];
    if (rule.type === 'object') requireObject(item);
    if (rule.type === 'string' && (typeof item !== 'string' || item.length < (rule.minLength ?? 0) || item.length > (rule.maxLength ?? 128000))) throw new RpcError(-32602, `Invalid argument: ${key}`);
    if (rule.enum && !rule.enum.includes(item)) throw new RpcError(-32602, `Unsupported ${key}.`);
  }
  if (name === 'execute_action' && !/^[A-Za-z0-9_-]{1,128}$/.test(value.id)) throw new RpcError(-32602, 'Invalid action ID.');
  if (name === 'scan_text' && Buffer.byteLength(value.text, 'utf8') > 65536) throw new RpcError(-32602, 'Scan text exceeds 64 KB.');
}

export function createRpcHandler(request) {
  let initialized = false;
  return async function handle(message) {
    const isObject = message && typeof message === 'object' && !Array.isArray(message);
    const hasId = isObject && Object.hasOwn(message, 'id');
    const id = hasId && (typeof message.id === 'string' || Number.isSafeInteger(message.id)) ? message.id : null;
    if (!isObject || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (hasId && id === null)) {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    }
    // Notifications must not have responses or perform actions.
    if (!hasId) return null;
    try {
      let result;
      const params = message.params ?? {};
      requireObject(params);
      if (message.method === 'initialize') {
        const requested = params.protocolVersion;
        if (typeof requested !== 'string') throw new RpcError(-32602, 'protocolVersion is required.');
        initialized = true;
        result = {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'sohken', version: '0.1.0' },
          instructions: 'Sohken protects only its own fixed local tools. Approval is performed separately by the human operator in the local dashboard or CLI. Scan findings are heuristic and do not prove content safe. Never request or reveal owner tokens.',
        };
      } else if (message.method === 'ping') {
        result = {};
      } else {
        if (!initialized) throw new RpcError(-32002, 'Initialize the MCP connection first.');
        if (message.method === 'tools/list') result = { tools: MCP_TOOLS };
        else if (message.method === 'tools/call') {
          if (typeof params.name !== 'string') throw new RpcError(-32602, 'Tool name is required.');
          const args = params.arguments ?? {};
          validateArgs(params.name, args);
          try {
            let data;
            if (params.name === 'scan_text') data = await request('/api/scan', { text: args.text, source: 'mcp' });
            if (params.name === 'propose_action') data = await request('/api/actions', args);
            if (params.name === 'execute_action') data = await request(`/api/actions/${encodeURIComponent(args.id)}/execute`, {});
            if (params.name === 'get_status') {
              const state = await request('/api/status');
              data = { version: state.version, mode: state.mode, paused: state.paused, stats: state.stats, tools: state.tools, policy: state.policy };
            }
            result = { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false };
          } catch (error) {
            result = { content: [{ type: 'text', text: error.message }], isError: true };
          }
        } else throw new RpcError(-32601, 'Method not found');
      }
      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      return { jsonrpc: '2.0', id, error: { code: error instanceof RpcError ? error.code : -32603, message: error instanceof RpcError ? error.message : 'Internal error' } };
    }
  };
}

export async function runMcp(request, { input = process.stdin, output = process.stdout } = {}) {
  const handle = createRpcHandler(request);
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  const send = (response) => { if (response) output.write(JSON.stringify(response) + '\n'); };
  const consumeLine = async (line) => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); }
    catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }
    send(await handle(message));
  };
  // Serial processing bounds work and preserves action order; no unbounded queue.
  for await (const chunk of input) {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (Buffer.byteLength(line) > MAX_MESSAGE_BYTES) throw new Error('MCP message exceeds 512 KB.');
      await consumeLine(line);
    }
    if (Buffer.byteLength(buffer) > MAX_MESSAGE_BYTES) throw new Error('MCP message exceeds 512 KB.');
  }
  buffer += decoder.end();
  if (Buffer.byteLength(buffer) > MAX_MESSAGE_BYTES) throw new Error('MCP message exceeds 512 KB.');
  if (buffer.trim()) await consumeLine(buffer);
}
