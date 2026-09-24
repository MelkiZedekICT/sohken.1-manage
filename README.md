<p align="center">
  <img src="coding-anime-hero-stockcake.jpg" alt="Sohken" width="380"/>
</p>

<h1 align="center">
  <code>S O H K E N</code>
</h1>

<p align="center">
  <strong>Local security checkpoint for tool-using AI agents.</strong><br/>
  <sub>Desktop · Browser Extension · Terminal CLI · MCP Protocol</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/v0.1.0--alpha.1-ff00ff?style=flat-square&labelColor=0d0d0d&label=version" alt="Version"/>
  <img src="https://img.shields.io/badge/%3E%3D24-00ffff?style=flat-square&labelColor=0d0d0d&label=node" alt="Node"/>
  <img src="https://img.shields.io/badge/36%2F36-00ff88?style=flat-square&labelColor=0d0d0d&label=tests" alt="Tests"/>
  <img src="https://img.shields.io/badge/zero-cc66ff?style=flat-square&labelColor=0d0d0d&label=cloud%20deps" alt="Cloud"/>
</p>

<p align="center">
  <img src="neon-divider.jpg" alt="" width="100%"/>
</p>

## What is this

Sohken is a **Hermes-inspired security companion** that sits between your AI agent and the real world. It intercepts every tool call, scans for prompt injection, enforces typed policies, and won't let anything dangerous through without your explicit cryptographic approval.

One local engine. Four interfaces. No cloud. No API keys. No paid models.

```
Agent request ──→ Scanner ──→ Policy ──→ Approval gate ──→ Execution ──→ Audit ledger
                     │           │            │                │              │
                  injection?   allow?     human sign-off   local effect   hash chain
                  redaction    deny?      digest match     idempotent     HMAC verify
```

---

## The enforcement loop

<table>
<tr>
<td width="65%">

Every agent action passes through four layers before it touches anything:

1. **Scan** — heuristic detection for injection signals, credential leaks, social engineering patterns. Not ML, not a black box — explainable rules with severity scoring.

2. **Policy** — typed tool contracts. `diagnostics.read` is allowed. `ticket.create` requires your approval. `file.delete` and `network.send` are always denied. Fail-closed.

3. **Approval** — the exact action is hashed (SHA-256). You approve that specific digest. Expires in 10 minutes. Approve ≠ Execute — they're separate steps. Agents can never approve their own requests.

4. **Ledger** — every decision is recorded in a hash-linked SQLite chain with HMAC integrity protection. Export, verify, audit.

</td>
<td width="35%" align="center">

<img src="looopt.jpg" alt="The security vortex" width="100%"/>
<br/>
<sub><em>Every request passes through the vortex.<br/>Nothing gets out unchecked.</em></sub>

</td>
</tr>
</table>

---

## Quick start

<table>
<tr>
<td>

Requires Node.js 24+. That's the entire dependency list.

```sh
git clone https://github.com/MelkiZedekICT/sohken.1-manage.git
cd sohken.1-manage
npm ci
node bin/sohken.mjs serve
```

Open the pairing URL from the terminal output. **Treat it like a password.** Click **Run safe demo** in the dashboard — it generates an injection scan, a blocked network transfer, a verified diagnostic read, and a ticket waiting for your approval.

```sh
# Scan text for injection signals
node bin/sohken.mjs scan --text "Ignore all previous instructions"

# Check engine status
node bin/sohken.mjs status

# Verify the full audit chain
node bin/sohken.mjs audit verify

# Export sanitized evidence
node bin/sohken.mjs export
```

State lives in `~/.sohken` by default. Override with `--data-dir PATH` or `SOHKEN_HOME`.

</td>
<td width="160" align="center" valign="top">

<br/><br/><br/>
<img src="download.jpg" width="120"/>
<br/><br/>
<sub><em>Ready to deploy.</em></sub>
<br/><br/><br/><br/><br/>
<img src="chibi-gojo-happy.jpg" width="120"/>
<br/><br/>
<sub><em>Scan clean.<br/>All systems go.</em></sub>

</td>
</tr>
</table>

---

## Public page

The `web/` folder is Sohken's public early-access page. It explains the product in plain language, includes a browser-only text check, and shows two plans: Free and Founder. Founder access is ₹799 once for the first 50 people.

Joining the list does not charge anyone. Members see the private build before payment. The page stores only the email they submit, their chosen plan, and the join time. Text entered into the demo stays in the browser.

---

## Four surfaces, one engine

| | Surface | What it does |
|---|---|---|
| 🖥️ | **Desktop** | Electron 44 app with full dashboard. Extract portable ZIP → launch `Sohken.exe`. Unsigned, no auto-updates. |
| 🌐 | **Browser Extension** | Chrome/Edge Manifest V3. Minimal permissions, explicit capture, local-only scan engine. Load unpacked from `extension/`. |
| ⌨️ | **Terminal CLI** | `serve`, `scan`, `status`, `audit verify`, `export`. Direct Node execution or install from release tarball. |
| 🔌 | **MCP Protocol** | JSON-RPC stdio adapter for Hermes-compatible agents. TypeScript SDK included. See [`integration/`](integration/README.md). |

---

## Architecture

```
src/
├── engine.mjs       # Policy evaluation, approval binding, execution, audit chain
├── scanner.mjs      # Heuristic injection detection and risk scoring
└── server.mjs       # Authenticated loopback HTTP API @ 127.0.0.1:4317

bin/sohken.mjs       # CLI — serve, scan, status, audit, export
ui/                  # Dashboard — vanilla HTML/CSS/JS, zero framework deps
extension/           # Manifest V3 popup with local scanner
desktop/             # Electron wrapper (contextIsolation, sandbox, no nodeIntegration)
sdk/                 # TypeScript agent SDK
integration/         # MCP stdio adapter + integration tests
tests/               # 36 tests — core, HTTP, CLI/MCP, extension scanner
```

> The original research proposed Python/PostgreSQL. The downloadable multi-surface requirement led to a deliberate single-runtime pivot — Node 24 with built-in SQLite, zero external services. Rationale documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Development

<table>
<tr>
<td>

```sh
npm ci                        # Install
npm test                      # All 36 tests
npm run test:core             # Core tests only
npm run build:sdk             # TypeScript SDK
npm run desktop               # Electron dev window
npm run package:desktop       # Portable desktop ZIP
npm run package:release       # Full release bundle
```

Desktop dev requires the Electron runtime download. If npm hasn't fetched it: `node node_modules/electron/install.js`. Package scripts build locally — nothing is published.

</td>
<td width="280" align="center">

<img src="anime-build-success.jpg" width="260"/>
<br/>
<sub><em>36/36. Zero vulnerabilities. Ship it.</em></sub>

</td>
</tr>
</table>

---

## Threat model

<table>
<tr>
<td width="130" align="center" valign="top">

<br/>
<img src="chibi-gojo-curious.jpg" width="110"/>
<br/><br/>
<sub><em>Stay vigilant.</em></sub>

</td>
<td>

Sohken protects its own fixed local tool adapters and their invocation path. It does **not** protect:

- Tools outside its managed set
- A compromised OS user or hostile administrator
- Browser memory or third-party agent configurations
- Content encrypted in transit by other systems

> ⚠️ A model with unrestricted terminal access as the owner OS user can read the credential file or bypass Sohken entirely. The alpha is not an OS sandbox. Real deployment requires credential separation and external tool mediation.

Read [`SECURITY.md`](SECURITY.md) before connecting any agent.

</td>
</tr>
</table>

---

## Docs

| Document | |
|---|---|
| [`SECURITY.md`](SECURITY.md) | Threat model, token separation, capacity limits |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack decisions, module boundaries |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Visual design system |
| [`docs/VALIDATION.md`](docs/VALIDATION.md) | Test evidence, verification report |
| [`docs/PORTFOLIO.md`](docs/PORTFOLIO.md) | Honest project presentation guide |
| [`BUILD_JOURNAL.md`](BUILD_JOURNAL.md) | Live development log |

---

<p align="center">
  <img src="images.jpg" width="80"/>
  <br/><br/>
  <strong><code>SOHKEN</code></strong><br/>
  <em>Built for deliberate action.</em><br/>
  <sub>Your agents. Your rules. Your machine.</sub><br/><br/>
  <sub><code>v0.1.0-alpha.1 · local alpha · single owner</code></sub><br/>
  <sub>No cloud dependency · No paid models · No attestation claims</sub>
</p>
