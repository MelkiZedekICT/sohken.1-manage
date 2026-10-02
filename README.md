# Sohken

Sohken is a local security companion for developers using AI agents. The alpha can inspect supported project files for common risky patterns and review a limited set of typed actions routed through its local service. It cannot see or control tools an agent uses outside those integrations.

**Status:** downloadable local alpha. The public site is static. There is no hosted user service or working checkout, and Plus at ₹199/month is a planned price only. No release is guaranteed to detect every vulnerability, and no software is non-hackable.

## Run the app

Requirements: Node.js 24 or newer.

```sh
npm ci
npm start
```

Open the loopback address shown in the terminal (normally `http://127.0.0.1:4317`) and create an account for this computer. See [HOW_TO_RUN.md](HOW_TO_RUN.md) for the complete setup, desktop, extension, CLI and developer instructions.

## What works

- Read-only checks for selected local source and settings files, with file and line evidence.
- Optional dependency advisory lookup after the user opts in; it sends package names and versions to OSV, not source files.
- Local text checks and a bounded set of typed action requests handled through Sohken.
- Owner and agent access scopes, an exact-action approval gate, SQLite history and audit-chain checks.
- Windows desktop wrapper, browser add-on, terminal commands, TypeScript SDK and MCP stdio adapter.

This is an alpha pattern checker, not a full code analyzer, malware detector, cloud service, OS sandbox or security certification. Review [SECURITY.md](SECURITY.md) and [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) before connecting an agent.

## Developer checks

```sh
npm ci
npm test
npm run build:sdk
```

On Windows, build the desktop app and release downloads with:

```powershell
npm run package:desktop
npm run package:release
```

This creates the full source ZIP, extension ZIP, CLI package and checksums in `release/`. If the Windows desktop build is present, it also creates a portable desktop ZIP. Packaging makes local files; it does not publish a release. The full source ZIP includes `HOW_TO_RUN.md` and omits local state, installed packages and Git metadata.

## Main folders

| Folder | What is in it |
|---|---|
| `src/` | Local service, action rules, accounts, cases and project checks |
| `bin/` | Terminal command |
| `ui/` | Local dashboard |
| `extension/` | Browser add-on |
| `desktop/` | Windows desktop wrapper |
| `integration/` | MCP connection and tests |
| `sdk/` | TypeScript client |
| `tests/` | Service and project-check tests |
| `web/` | Static product and download page |
| `docs/` | Design, architecture, deployment and readiness notes |
| `research/` | Product research and build plan |
| `assets/images/` | README and project images |
| `miscellaneous/` | Extra material not needed to run Sohken |

## Data and plans

The local application stores account and case data on that computer in `%USERPROFILE%\.sohken` on Windows or `~/.sohken` on macOS/Linux by default. It does not sync that data to the website. The static site has no sign-up, email collection, user database or payment service.

Free local features are available for testing. Plus is planned at ₹199/month, but billing, hosted accounts and subscription management are not ready. Users cannot be charged by the current app or website.

## Documents

- [How to run Sohken](HOW_TO_RUN.md)
- [Security notes](SECURITY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Project check limits](docs/PROJECT_AUDIT.md)
- [Data and deployment](docs/DATA_AND_DEPLOYMENT.md)
- [Release readiness](docs/PRODUCTION_READINESS.md)
- [Build plan](docs/BUILD_PLAN.md)
- [Build journal](BUILD_JOURNAL.md)
- [Contribution guide](CONTRIBUTING.md)
