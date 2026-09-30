# Security boundary — local alpha

Protected: Sohken's fixed local adapters and their HTTP/MCP invocation path. Not protected: tools outside Sohken, a compromised operating-system user, arbitrary code, a hostile administrator, browser memory, or third-party agent integrations configured with bypass credentials.

The owner token approves/rejects actions and controls execution pause. The agent token can scan, propose and execute only authorized actions. Dashboard accounts use salted scrypt password hashes and random server-side sessions sent only in HttpOnly, SameSite cookies. Session rows contain a hash of the session value and expire after 30 days. Each account has its own SQLite activity profile; the first account adopts activity from the existing local installation.

Default bind is 127.0.0.1. Host and Origin validation reject foreign websites and rebinding requests. Only authenticated agent scans are permitted from extension origins. Tokens are not included in package artifacts. The data directory uses restrictive Unix modes; on Windows it relies on the user's profile ACL. Keep it private. No encryption-at-rest claim is made: full-disk encryption and OS access control remain operator responsibilities.

Public mode requires an exact `SOHKEN_PUBLIC_ORIGIN`, HTTPS, and `SOHKEN_SECURE_COOKIES=true`. Put the server behind a trusted reverse proxy and firewall. This remains an early release: email verification, password reset, account deletion and a full independent security review are not implemented. Do not treat account sign-up alone as a production identity service.

Plus checkout requires a server-side Razorpay monthly INR 199 plan and merchant credentials. Never put payment secrets in a desktop, extension, website bundle, or Git. The server confirms the exact configured plan amount before creating a subscription, validates Razorpay's HMAC signature over the raw webhook body, and grants Plus only for the matching subscription events. Browser redirects cannot grant paid access. The public webhook requires the HTTPS deployment above.

Scan content is not saved. Source labels and findings are saved; avoid putting private content in source labels. Approved ticket text is persisted and included in exports. Denied arguments are replaced with placeholders. Regex redaction is not comprehensive PII detection. Exports remain private artifacts to review before sharing.

Action digests and mutable state are HMAC-protected using the local key. This can detect action-database tampering when the config key remains uncompromised. The event chain detects changes relative to stored adjacent records; without an independent external checkpoint it cannot prove that the entire log was not rewritten or truncated. A successful local integrity check is not attestation.

Local ticket creation, verification and action completion share one SQLite transaction. This supports idempotent local retries. It does not solve exactly-once behavior for unrelated remote APIs. Approval expires after ten minutes and is checked again at execution. Pause stops new execution, not already completed effects.

Capacity: 64 KB scan text, 100 KB HTTP body, 240 authenticated requests/minute per role bucket, 1,000 scans, 1,000 proposed actions and 10,000 events/profile. Export evidence and use a new profile at capacity; there is no automatic retention deletion. This design intentionally bounds the full-chain audit verification work in the alpha.

Future release requirements: externally anchored audit checkpoints, separated OS/service identities, real connector idempotency/reconciliation, persisted budgets, provider adapters, adversarial model evaluations, encrypted payload storage, managed secrets and independent security review. Current heuristics are advisory. Deny-by-policy is enforced independently of scan scores.
