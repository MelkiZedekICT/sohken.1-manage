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

## 2026-09-24 — Public launch and simpler language

- Replaced technical labels in the desktop app and browser add-on with plain names: Text check, Review, History, Private app key and Agent key.
- Built a separate public Sohken page in `web/`. It explains the working limits, includes a browser-only text demo, shows Free and Founder plans, and collects early-access email requests.
- Founder price is ₹799 once for the first 50 people. Joining the list does not charge anyone; visitors see the private build before any payment request.
- The public page stores only the submitted email, selected plan, join time and page source. Product text stays in the visitor's browser during the demo.
- Pricing direction was checked against current public agent-security offers. Sohken stays much lower because this is a local early build with a narrow supported action set.
- Fixed the release builder to use the Windows archive tool after the PowerShell archive module failed to load. The earlier package-cache permission failure was fixed by moving the cache inside the project.
- Built all three downloads successfully: Windows app ZIP, browser add-on ZIP and terminal package. A checksum file records each download's size and fingerprint.
- Re-ran 36 checks successfully. The full desktop flow also passed in a real browser after updating its labels: connect, demo, allow, run, text check, history check, narrow layout and reduced motion.
- Prepared the public page for AppDeploy using its required starter and private email store. Publication is waiting for explicit approval to share the website source with AppDeploy after the automatic approval check stopped the upload.
- Added tests for the public text check and a self-service way to remove an early-access email.
- Added a four-week Founder launch plan with simple goals, a low-cost rule, success numbers, and a checklist to complete before taking payment.

## 2026-09-16 — Sumi visual redesign

- Applied the requested Japanese-inspired palette: charcoal, warm ivory, indigo navigation, sage status and vermilion risk accents.
- Reworked typography, spacing, navigation, controls and metric hierarchy; replaced decorative guard gradients with a restrained checkpoint panel.
- Added short reveal and interaction animations plus reduced-motion support. Pending approvals now sort first; activity sorting uses the actual event timestamp.
- Created Figma design file: https://www.figma.com/design/oDscr164NN77uMMUEvID5a . Design specification and browser validation in progress.
