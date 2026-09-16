# Sohken live build journal

## Product and scope

Sohken is an independent, Hermes-inspired security companion for agents. Desktop app, browser extension, CLI and MCP share a local enforcement service. The first alpha scans text, controls fixed local tools, binds human approval to exact actions, verifies local effects, and records an audit trail. It does not control unmanaged agent tools or provide production-wide protection.

User priorities: solo builder, low cost, downloadable interfaces, and a technically credible CSE/AI internship portfolio. Prefer a coherent architecture over adding technologies for appearances.

## 2026-09-16 — Research and initial implementation

- Completed research package: 32 problems, build/deployment plan and primary-source register in research/.
- Changed prototype stack from proposed Python/PostgreSQL to Node 24 + SQLite to support a lightweight shared desktop/terminal core. Decision recorded in sohken-build.md.
- Added core scanner, fixed-tool policy, SQLite action ledger, exact approval digest, local ticket execution, audit verification and authenticated loopback HTTP API.
- Added dashboard, Manifest V3 extension, CLI and stdio MCP source files through specialist work.
- Extension agent reported five scanner tests passing. Desktop packaging and integrated security tests were not completed before interruption.
- Official npm metadata lookup succeeded with elevated network access: Electron 44.4.1 and @electron/packager 20.3.0. Dependencies are not yet installed.

## 2026-09-16 — Resumed integration

- User requested this live journal. It will record meaningful changes, corrections, checks and remaining limitations as work proceeds.
- Verified that dashboard and CLI/MCP files exist despite a specialist usage-limit interruption. Their integration still needs validation.
- Current work: inspect interface contracts; add adversarial/core tests; fix failures; complete desktop wrapper and downloadable packaging; add typed SDK, CI and portfolio documentation.

## Current release status

Source implementation in progress. No native desktop binary built yet. No extension store publication. No Hermes end-to-end integration claim. No paid model or cloud dependency. Research performance targets remain unmeasured.

## Journal convention

### Integration and security patches

- Installed pinned Electron, Electron Packager, TypeScript and Node types. Install-time dependency audit reported zero vulnerabilities.
- First test run: 32/33 passed. Fetch did not send an overridden Host header in the rebinding test. Replaced it with a low-level HTTP request; rejection is now verified.
- Denied action argument values are no longer retained. Added keyed integrity protection for mutable approval state.
- Added limits of 1,000 scans and 10,000 audit events; protected writes stop at capacity.
- Fixed private-key redaction case handling and dashboard activity timestamps.
- Integrated tests: 36/36 passed across core, HTTP, CLI/MCP and extension scanner.

Append dated entries for changes and test evidence. Distinguish implemented, tested, packaged and externally validated. Record failed approaches and patches when they affect architecture or security. Never record credentials, pairing tokens or private scanned content here.

## 2026-09-16 — Sumi visual redesign

- Applied the requested Japanese-inspired palette: charcoal, warm ivory, indigo navigation, sage status and vermilion risk accents.
- Reworked typography, spacing, navigation, controls and metric hierarchy; replaced decorative guard gradients with a restrained checkpoint panel.
- Added short reveal and interaction animations plus reduced-motion support. Pending approvals now sort first; activity sorting uses the actual event timestamp.
- Created Figma design file: https://www.figma.com/design/oDscr164NN77uMMUEvID5a . Design specification and browser validation in progress.
