# Sohken local alpha implementation

User scope: build a Hermes-inspired security companion available as desktop app, browser extension, and terminal tool. Use one shared local core and persistent history. This is an independent product, not a Hermes fork or affiliation.

## Architecture decision

Node 24 LTS, built-in SQLite and HTTP, static accessible UI, Electron desktop wrapper, Manifest V3 extension, CLI and stdio MCP adapter. This deliberately replaces the research roadmap's Python/PostgreSQL prototype with a portable single-user stack to meet the new downloadable multi-surface requirement. No cloud account, GPU or paid model required. Deterministic scans are transparent heuristics, not a claim of universal prompt-injection detection. Fixed local tools enforce rules; external unmanaged tools are not protected.

## Core contract

Loopback server at 127.0.0.1:4317 by default. Local owner authentication with random token; agent token has scan/propose/execute/read scope, never approval/policy/settings. Browser extension uses agent token for scans only. Desktop and operator CLI use owner identity. Tokens stored only in private application config, never source or distributions.

API responses JSON. GET /api/state -> {version,mode,paused,stats,actions,scans,events,tools,policy}. POST /api/scan {text,source?} -> {id,score,level,findings:[{rule,severity,title,detail,line}],summary,createdAt}; POST /api/actions {tool,args,idempotencyKey?} -> action. POST /api/actions/:id/approve {digest} and /reject {digest}; POST /api/actions/:id/execute {}. POST /api/pause {paused}; POST /api/demo {} runs safe fixtures. GET /api/audit/verify. GET /api/export sanitized JSON. No initial auto-seeded events. Action {id,tool,args,digest,decision,status,reasons,createdAt,expiresAt,result?}. Policy {version,allowedTools,approvalTools,maxActions}; tools fixed: diagnostics.read {service}; ticket.create {title,body}; file.delete {path} and network.send {url,body} always denied (no implementation). Ticket effects stored locally, verified, idempotent; no real external writes. Local DB, WAL, integrity chain. No raw scan content persisted; redact secrets in returned/stored action views.

Desktop UI consumes same API using Authorization bearer from fragment during initial pairing (cleared immediately; token stored in sessionStorage). Runtime HTTP server rejects foreign Origins and Hosts; no CORS wildcard. Electron contextIsolation true, nodeIntegration false, sandbox true; navigation/new windows denied. Extension popup runs scan-only local heuristics and can optionally send selected page text to authenticated local engine; no broad host access or background page collection.

## Build sequence

1. Core: scanners, strict contracts, SQLite ledger, policy, approval binding, execution, HTTP, security tests.
2. Interfaces: desktop dashboard; minimal-permission extension; CLI and stdio MCP over authenticated local HTTP.
3. Integration: contract/end-to-end tests, browser review, package terminal tarball + extension zip + Windows desktop portable zip. Do not publish to public stores or claim signing.
4. Documentation: install, Hermes connection, threat model, evidence and explicit limitations. macOS/Linux packages only if actually built on a suitable platform.

## Specialist work boundaries

App Builder skill calls for specialist coordination. UI agent owns ui/; extension agent owns extension/; CLI agent owns bin/, integration/. Root owns src/, tests/, desktop/, package manifest and packaging. All specialists use the contract above and avoid editing others' files.
