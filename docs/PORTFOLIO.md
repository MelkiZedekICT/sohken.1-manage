# Presenting Sohken for CSE / AI internships

## Accurate project description

Built a local security gateway for agent tool calls with desktop, CLI, browser-extension and MCP interfaces. Implemented role-separated authorization, exact-payload approvals, SQLite transactional execution, idempotency and audit-integrity checks. Developed adversarial API and protocol tests and a TypeScript integration SDK.

Use this only for work you have reviewed and can explain. Credit AI-assisted implementation where your application or interview expects it. Do not claim a trained model, production deployment, customer adoption, universal injection prevention or benchmark accuracy that was not measured.

## Five-minute demonstration

1. Explain the threat boundary: a model suggests; the gateway authorizes.
2. Run the fixture demo and show that an external send is denied independently of model wording.
3. Inspect the exact local ticket arguments and digest; approve, then execute.
4. Repeat execution and show the same ticket ID instead of a duplicate.
5. Verify the audit chain and explain why local verification is not external attestation.
6. Show the MCP tool list without approval controls and explain owner/agent separation.

## Interview discussion points

- Why scan scores cannot authorize actions.
- How HMAC binding differs from hashing and why keys must be outside the attacker boundary.
- What SQLite transactions guarantee for local effects, and why remote APIs need reconciliation.
- Why a browser extension does not automatically guard another agent's terminal.
- Why a passing curated suite says little about unseen model-driven attacks.
- Which metrics would be needed before adding real integrations.

## Next portfolio milestones

Add one genuinely read-only real integration with restricted credentials; build a labeled benign/adversarial evaluation dataset; compare a detector baseline against policy enforcement; report false blocks and task utility; add a second provider only after data-flow controls. These are future work, not current achievements.
