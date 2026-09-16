# Validation evidence

Local validation on Windows, 2026-09-16. This is an alpha engineering report, not an independent security audit.

- 36 automated checks passed: scanner limits and redaction, strict JSON, fixed tool contracts, owner/agent authorization, origin and Host validation, exact approval and expiry, pause, idempotent concurrent execution, database tampering, restart persistence, storage limits, MCP protocol and extension scanner.
- Actual browser integration passed: private pairing URL cleared, demo, approve and execute, scan findings, audit verification, and no uncaught page errors.
- Five application views checked at widths 390, 800 and 1440 pixels with no horizontal document overflow. Reduced-motion preference disables the view animation.
- Figma specification board visually inspected; overlapping motion text corrected and checked again.
- The npm command resolved a broken global wrapper in this machine. Running the installed npm CLI directly works. Tests were also run directly with Node; all 36 passed.

Screenshots are in `docs/screenshots/`. These are local demonstration records; no real incidents or external agent enforcement are implied.

## Not yet established

Native desktop packaging and launch validation are in progress. Browser extension capture has not yet been exercised inside an installed browser extension. Cross-platform CI configuration is supplied but has not run remotely. Hermes client compatibility, penetration testing, accessibility conformance, ML accuracy, external tool mediation and production deployment are not established by these checks.
