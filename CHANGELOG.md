# Changelog

All notable changes to Sohken are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0-alpha.2] — 2026-09-28

### Added

- **Pre-auth rate limiting** — connection-level flood protection that fires before token comparison, preventing brute-force token enumeration and timing side-channels. 60 failed attempts per minute per IP triggers a 30-second lockout. Stale entries are evicted every 5 minutes.
- **Scanner: multi-turn manipulation detection** (`multi-turn-plant`) — detects deferred instruction patterns where attackers plant execution triggers for future agent turns ("in your next message, execute…").
- **Scanner: tool-result injection detection** (`tool-result-spoof`) — catches spoofed JSON result payloads embedded in untrusted content to trick agents into believing actions were authorized.
- **Scanner: markdown image exfiltration detection** (`markdown-exfiltration`) — identifies markdown image URLs with long query parameters used to exfiltrate data via image requests to attacker-controlled servers.
- **Scanner: unicode homoglyph obfuscation detection** (`unicode-homoglyph`) — flags mixed Cyrillic, Greek, or fullwidth characters alongside Latin text used to bypass keyword-based security filters.
- **`GET /api/metrics` endpoint** — owner-only endpoint returning structured operational health data: uptime, request counters (scans, proposals, approvals, rejections, executions, auth failures, rate limits, errors), engine state summary, audit chain integrity, and rate limiter status.
- **Request counters** — all API routes now increment category-specific counters exposed via `/api/metrics`.
- **10 new tests** — adversarial scanner tests (multi-turn, tool-result spoofing, markdown exfil, homoglyphs, combined multi-vector), false-positive resistance on benign technical content, metrics endpoint access control, auth failure counter tracking.
- **`CONTRIBUTING.md`** — security-first contribution guide with scanner rule addition process, commit convention, and merge criteria.
- **`CHANGELOG.md`** — this file.

### Changed

- Auth failure now records the remote IP and increments a per-IP failure counter before the timing-safe comparison runs (defense-in-depth against token enumeration).
- Rate limit rejections now increment a dedicated `rate_limited` counter.
- Error handler now increments an `errors` counter for operational visibility.
- Server `close()` now cleans up the connection rate limiter eviction interval.
- Test suite expanded from 36 to 49 tests (core + integration + extension).

### Security

- Pre-auth rate limiting closes the gap where unauthenticated floods could probe token timing. The lockout is IP-scoped and time-limited to avoid permanent denial-of-service on legitimate loopback clients.
- Four new scanner rules address attack vectors identified in the research backlog: P01 (retrieved content redirects agent), P02 (tool metadata poisoning), P05 (data crosses forbidden boundary), and filter evasion via unicode homoglyphs.

## [0.1.0-alpha.1] — 2026-09-16

### Added

- Core engine: policy evaluation, approval binding, execution, hash-linked audit chain.
- Scanner: 10 heuristic detection rules for injection, credential exposure, destructive commands.
- HTTP server: authenticated loopback API at 127.0.0.1:4317 with strict origin/host validation.
- CLI: `serve`, `scan`, `status`, `audit verify`, `export`, `demo`, `mcp`.
- Dashboard: vanilla HTML/CSS/JS at `/`, owner-authenticated.
- Browser extension: Chrome/Edge Manifest V3 popup with local scanner.
- MCP adapter: JSON-RPC stdio for Hermes-compatible agents.
- TypeScript SDK: agent-scoped client with typed tool requests.
- Desktop: Electron 44 wrapper with contextIsolation and sandbox.
- 36 tests covering core security invariants, HTTP boundaries, CLI, MCP, and extension scanner.
- Public web page: early-access landing with browser-only text check and Founder/Free plan selection.
- Documentation: SECURITY.md, ARCHITECTURE.md, DESIGN.md, VALIDATION.md, PORTFOLIO.md.
- CI: GitHub Actions on ubuntu-latest and windows-latest with Node 24.
