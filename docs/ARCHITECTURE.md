# Architecture decisions

## Shared local engine

Desktop and CLI run the same Node server. The browser extension can scan offline or send explicitly selected text to that server. The MCP adapter only forwards agent-scoped requests and exposes no approval capability. Typed SDK clients use the same HTTP boundary. There is no autonomous LLM in this first release; policy and scanning are deterministic.

## SQLite for local accounts

The local install keeps each account in a separate SQLite profile, and the first account adopts existing activity on that device. This preserves a small setup and private local history. SQLite is suitable for the single-builder pilot. A hosted service with concurrent customers should move account, billing, and activity records to PostgreSQL before scale.

Account sign-in uses salted scrypt password hashes and server-side, revocable sessions in HttpOnly cookies. Razorpay keys stay on the server. Plus access comes only from signed subscription webhooks; the browser cannot set its own plan.

## Fixed policy before programmable policies

Only known typed adapters exist. An unknown tool fails rather than falling through to a shell. ticket.create requires exact owner approval; diagnostics.read uses clearly labeled fixtures. network.send and file.delete never touch their destinations. This gives a small enforceable boundary before adding OPA and actual integrations.

## Execution state

Proposal is normalized and bound to a stable key. Policy returns deny, allow or require_approval. Pending actions require owner approval of a digest that includes the ID, tool, arguments, policy version and expiry. Dispatch checks the signed state, expiry and pause again. Local effect, independent local readback and completion event commit together. Retry returns the same stored effect.

## Technology choices for a portfolio

TypeScript supplies a discriminated tool-request SDK; Node supplies HTTP/JSON-RPC and packaging interoperability; SQL supports transactional state; Electron/Manifest V3 demonstrate client-platform boundaries. Tests cover failure and adversarial cases. The design values explainable invariants over an unnecessarily large stack.

## Public references checked during implementation

- [Hermes Desktop shared core](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)
- [Hermes MCP configuration](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)
- [Chrome activeTab permissions](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Node SQLite API](https://nodejs.org/api/sqlite.html)
- [MCP stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

Reference date: 16 September 2026. Sohken is independent; no Hermes, NVIDIA or MIT affiliation is claimed.
