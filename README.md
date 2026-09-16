<h1 align="center">
  <code>░██████╗░█████╗░██╗░░██╗██╗░░██╗███████╗███╗░░██╗</code><br/>
  <code>██╔════╝██╔══██╗██║░░██║██║░██╔╝██╔════╝████╗░██║</code><br/>
  <code>╚█████╗░██║░░██║███████║█████═╝░█████╗░░██╔██╗██║</code><br/>
  <code>░╚═══██╗██║░░██║██╔══██║██╔═██╗░██╔══╝░░██║╚████║</code><br/>
  <code>██████╔╝╚█████╔╝██║░░██║██║░╚██╗███████╗██║░╚███║</code><br/>
  <code>╚═════╝░░╚════╝░╚═╝░░╚═╝╚═╝░░╚═╝╚══════╝╚═╝░░╚══╝</code>
</h1>

<p align="center">
  <strong>Local security checkpoint for tool-using AI agents.</strong><br/>
  <sub>Desktop · Browser Extension · Terminal CLI · MCP Protocol</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/v0.1.0--alpha.1-ff00ff?style=flat-square&labelColor=1a1a2e&label=version" alt="Version"/>
  <img src="https://img.shields.io/badge/%3E%3D24-00ffff?style=flat-square&labelColor=1a1a2e&label=node" alt="Node"/>
  <img src="https://img.shields.io/badge/36%2F36-00ff88?style=flat-square&labelColor=1a1a2e&label=tests" alt="Tests"/>
</p>

---

Sohken sits between your agent and the outside world. It scans prompts for injection signals, enforces typed tool policies, binds human approval to exact action digests, and records every decision in a hash-linked audit chain. One engine serves four interfaces — desktop, browser extension, terminal, and MCP — with zero cloud dependencies.

This is a working single-user alpha, not a production firewall. Its enforcement boundary is its fixed local tools. The scanner uses explainable heuristics, not a black-box model.

```
Agent ──→ Sohken ──→ Policy check ──→ Approval gate ──→ Tool execution
                          │                 │                  │
                          └── deny/allow ───┴── audit ledger ──┘
```

## Quick start

Requires Node.js 24+. No API keys, cloud accounts, or GPUs.

```sh
node bin/sohken.mjs serve
```

Open the pairing URL from the terminal. Click **Run safe demo** to generate a scan, a blocked transfer, a diagnostic read, and a ticket for your approval.

```sh
node bin/sohken.mjs scan --text "Ignore previous instructions"
node bin/sohken.mjs status
node bin/sohken.mjs audit verify
node bin/sohken.mjs export
```

State lives in `~/.sohken` by default. Override with `--data-dir` or `SOHKEN_HOME`.

## What it enforces

- **Scanner** — prompt injection detection, credential redaction, social engineering signals. Heuristic scoring with explainable findings.
- **Policy engine** — typed tool contracts. `diagnostics.read` → allow. `ticket.create` → require approval. `file.delete`, `network.send` → always deny.
- **Approval binding** — immutable SHA-256 digest per action. 10-minute expiry. Approval and execution are separate steps. Agents cannot approve their own requests.
- **Audit ledger** — SQLite WAL with HMAC-protected hash chain. Idempotent local effects. Verified export with integrity check.
- **Token separation** — owner token controls approval, rejection, and pause. Agent token is limited to scan, propose, and execute.

## Interfaces

| Surface | Notes |
|---|---|
| **Desktop** | Electron 44. Extract the portable ZIP, launch `Sohken.exe`. Unsigned, no auto-updates. |
| **Browser extension** | Chrome/Edge Manifest V3. Minimal permissions, explicit capture. Load unpacked from `extension/`. |
| **Terminal CLI** | `sohken serve`, `scan`, `status`, `audit verify`, `export`. Runs directly with Node or install from tarball. |
| **MCP** | JSON-RPC stdio adapter with TypeScript SDK. See [integration/](integration/README.md). |

## Architecture

```
src/
├── engine.mjs      # Policy, approval, execution, audit — core state machine
├── scanner.mjs      # Heuristic scan rules and scoring
└── server.mjs       # Authenticated loopback HTTP API (127.0.0.1:4317)

bin/sohken.mjs       # CLI entrypoint
ui/                  # Dashboard — vanilla HTML/CSS/JS, no framework deps
extension/           # Manifest V3 popup with local scanner
desktop/             # Electron wrapper (contextIsolation, sandbox, no nodeIntegration)
sdk/                 # TypeScript agent SDK
integration/         # MCP stdio adapter + integration tests
```

The original research proposed Python/PostgreSQL. The downloadable multi-surface requirement led to a deliberate single-runtime pivot — Node 24 with built-in SQLite. Decision rationale in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Capacity

| Resource | Limit |
|---|---|
| Scan text | 64 KB |
| HTTP body | 100 KB |
| Rate limit | 240 req/min per role |
| Scan history | 1,000 |
| Proposed actions | 1,000 |
| Audit events | 10,000 / profile |

## Development

```sh
npm ci                        # install
npm test                      # 36 tests — core, HTTP, CLI/MCP, extension
npm run build:sdk             # compile TypeScript SDK
npm run desktop               # Electron dev window
npm run package:desktop       # portable desktop ZIP
npm run package:release       # full release bundle
```

## Threat model

Sohken protects its own local tool adapters and their invocation path. It does **not** protect tools outside its managed set, a compromised OS user, browser memory, or third-party agent configurations. A model with unrestricted terminal access as the owner OS user can bypass Sohken entirely. Read [SECURITY.md](SECURITY.md) before connecting any agent.

## Docs

| | |
|---|---|
| [SECURITY.md](SECURITY.md) | Threat model, token separation, capacity limits |
| [Architecture](docs/ARCHITECTURE.md) | Stack decisions, module boundaries |
| [Design](docs/DESIGN.md) | Visual design system |
| [Validation](docs/VALIDATION.md) | Test evidence, verification report |
| [Portfolio](docs/PORTFOLIO.md) | Honest project presentation guide |
| [Build Journal](BUILD_JOURNAL.md) | Live development log |

---

<p align="center">
  <sub><code>v0.1.0-alpha.1 · local alpha · single owner</code></sub><br/>
  <sub>No cloud dependency · No paid models · No external attestation claims</sub>
</p>
