# Security boundary — local alpha

Protected: Sohken's fixed local adapters and their HTTP/MCP invocation path. Not protected: tools outside Sohken, a compromised operating-system user, arbitrary code, a hostile administrator, browser memory, or third-party agent integrations configured with bypass credentials.

The owner token approves/rejects actions and controls execution pause. The agent token can scan, propose and execute only authorized local actions. The dashboard uses session storage; injected same-origin JavaScript could steal its token, so the server has a restrictive CSP and UI dynamic values use textContent. Do not expose this service to the internet.

Default bind is 127.0.0.1. Host and Origin validation reject foreign websites and rebinding requests. Only authenticated agent scans are permitted from extension origins. Tokens are not included in package artifacts. The data directory uses restrictive Unix modes; on Windows it relies on the user's profile ACL. Keep it private. No encryption-at-rest claim is made: full-disk encryption and OS access control remain operator responsibilities.

Scan content is not saved. Source labels and findings are saved; avoid putting private content in source labels. Approved ticket text is persisted and included in exports. Denied arguments are replaced with placeholders. Regex redaction is not comprehensive PII detection. Exports remain private artifacts to review before sharing.

Action digests and mutable state are HMAC-protected using the local key. This can detect action-database tampering when the config key remains uncompromised. The event chain detects changes relative to stored adjacent records; without an independent external checkpoint it cannot prove that the entire log was not rewritten or truncated. A successful local integrity check is not attestation.

Local ticket creation, verification and action completion share one SQLite transaction. This supports idempotent local retries. It does not solve exactly-once behavior for unrelated remote APIs. Approval expires after ten minutes and is checked again at execution. Pause stops new execution, not already completed effects.

Capacity: 64 KB scan text, 100 KB HTTP body, 240 authenticated requests/minute per role bucket, 1,000 scans, 1,000 proposed actions and 10,000 events/profile. Export evidence and use a new profile at capacity; there is no automatic retention deletion. This design intentionally bounds the full-chain audit verification work in the alpha.

Future release requirements: externally anchored audit checkpoints, separated OS/service identities, real connector idempotency/reconciliation, persisted budgets, provider adapters, adversarial model evaluations, encrypted payload storage, managed secrets and independent security review. Current heuristics are advisory. Deny-by-policy is enforced independently of scan scores.
