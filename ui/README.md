# Sohken dashboard

Dependency-free UI served from the loopback engine. Root HTTP routes must serve `/`, `/styles.css`, and `/app.js`. Owner token pairing is accepted in `#token=...`, removed from the URL immediately, and retained only in session storage. Alternatively enter it in the pairing form. No remote assets, telemetry, HTML injection, or raw scan text storage in this UI.

## Focused review checklist

- With no token, show disconnected state and pairing; disable engine actions. Metrics must be unknown, never fabricated.
- With an owner token in the fragment, clear the fragment before any API request; confirm no token enters a request URL.
- Pair, refresh, disconnect, and reconnect. Disconnect clears displayed results and the stored token.
- Paste HTML/script-like content into scans and ticket fields; it must remain literal text in every resulting view.
- Scan blank input (native validation), benign text, suspicious instructions, and a secret-like fixture. Show returned findings and the heuristic limitation.
- Propose a local ticket; inspect args, digest, expiry and reasons. Approve sends the exact returned digest. Execution remains a separate click. Rejection is available for pending requests.
- Pause/resume execution and confirm current state. Do not claim that scans or unrelated external tools are stopped.
- Verify audit success/failure and export sanitized JSON. Download returned packages using authenticated fetch, rejecting nonlocal download URLs.
- Stop the engine, then refresh; display disconnected status, stale-history notice and disabled controls. Handle rejected credentials visibly.
- Test tab navigation, visible focus, skip link, screen reader labels, 200% zoom and narrow window widths. Respect reduced-motion preference.
- Check available packages against actual build outputs. Empty lists must explain that no packages are available.

`GET /api/state` arrays provide display records; optional totals come from `stats.scans`, `stats.blocked`, `stats.pending`, and `stats.verified`. Audit verification expects `{valid,count,reason?}`. The UI does not infer protection for tools outside the engine.
