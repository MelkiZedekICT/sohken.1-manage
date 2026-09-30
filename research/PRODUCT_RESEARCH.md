# Sohken product research and launch path

Checked 30 September 2026. Sources below are primary security guidance, protocol or payment documentation, or product pricing pages.

## What users need solved

Agents can read untrusted text and then choose tools. That creates a path from a malicious email, page, tool description, or tool result to an unintended action. OWASP describes real attack patterns such as an injected email directing an assistant to search an inbox and forward private data. It recommends limiting tools, permissions, and autonomy, checking actions at the system boundary, and recording activity. The [OWASP Excessive Agency guidance](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) gives the product a useful design rule: Sohken should control specific actions, explain its choice, and ask the person before sensitive work.

MCP brings additional risks because tool descriptions and responses can carry hostile instructions. OWASP's [MCP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html) calls out tool poisoning, changed tools, confused deputies, over-scoped credentials, replay, and untrusted servers. The [OWASP Agentic Applications Top 10](https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/) adds goal hijacking and identity or privilege abuse. A text scanner is helpful, but the product's strongest feature remains the action gate.

The MCP specification is still evolving. Its official [July 2026 update](https://blog.modelcontextprotocol.io/posts/2026-07-28/) describes current authorization changes and the shift from Dynamic Client Registration toward Client ID Metadata Documents. Sohken should keep its local stdio adapter simple and add remote OAuth only when there is a concrete hosted use case.

## Product comparison

[Permit Agent Security](https://agent.security/pricing) lists a free community plan with up to 1,000 human and agent identities and a starting Pro price of US$25/month. It focuses on organization authorization, gateways, audit logs, OAuth, and policy controls. Sohken targets an individual builder first: private local activity, a clear review step, a browser add-on, and terminal or MCP connections. ₹199/month makes Plus affordable for an individual, but Sohken has a smaller tool set and must not claim organization controls, broad coverage, or formal compliance.

## Plans implemented

| Plan | Price | Included |
| --- | ---: | --- |
| Free | ₹0 | Text checks, protected reviews, 25 recent activity entries, browser add-on, terminal tool |
| Plus | ₹199/month | Free features, full activity history, evidence export, activity integrity check |

The server checks Plus access on the full-history, export, and integrity endpoints. It never trusts a price sent by the browser. Razorpay runs the hosted subscription page; only a signature-verified server webhook can grant the Plus plan. The payment flow is deliberately inactive until the operator configures a monthly INR 199 plan, merchant keys, and a public HTTPS webhook.

## Account and payment safety

- Passwords use a unique salt and slow scrypt derivation. OWASP recommends slow, salted password hashing and lists scrypt as a fallback when Argon2id is unavailable in the runtime ([Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).
- Browser sessions are random, stored only as hashes on the server, and sent in HttpOnly, SameSite cookies. The [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) warns against keeping session keys in local or session storage.
- Each account gets a separate Sohken data profile. The first account on an existing installation adopts its prior local history so an upgrade does not lose work.
- Razorpay subscriptions require a plan created in the merchant dashboard. The official [create subscription API](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/?preferred-country=IN) returns a hosted `short_url`; the [create plan API](https://razorpay.com/docs/api/payments/subscriptions/create-plan/?preferred-country=IN) takes the amount in paise. Sohken uses ₹199 as 19,900 paise and asks Razorpay for monthly subscription events.
- Razorpay documents webhook HMAC signing and captured-payment checks in its [security checklist](https://razorpay.com/security/checklist). Sohken verifies the raw-body signature, records event IDs once, and never unlocks Plus from a browser redirect alone.

## What is still required before a public paid launch

1. Deploy the account service behind HTTPS on storage that survives restarts; set Secure cookies and keep Razorpay keys on that server only.
2. Add email verification and password recovery, plus a self-service cancellation and account removal flow.
3. Write plain-language privacy, terms, cancellation, refund, and data-retention pages. Show purchase terms before checkout.
4. Set up a Razorpay sandbox plan and webhook, then check first payment, renewal, failed payment, cancellation, replayed webhook, and refund cases before live mode.
5. Add backups and restore instructions. SQLite profiles are suitable for this small self-hosted pilot; a shared hosted service should move accounts and activity to PostgreSQL before meaningful concurrent use.
6. Sign desktop releases, add automatic updates, and provide a supported installer. The current Windows archive is an unsigned alpha build.
7. Expand the fixed action catalog only after a real integration can enforce the same allow, deny, approval, and audit rules at the destination.

The public early-access source has not been sent to a hosting service. Previous automatic review stopped that upload because the site source would be shared with the named host. This change prepares the local account and billing code and can be pushed to GitHub; it does not publish the site or turn on live payments.
