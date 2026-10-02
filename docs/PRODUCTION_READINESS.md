# Sohken release readiness

## What is real today

- The app runs locally and stores accounts and activity in SQLite under the user's Sohken data folder.
- Text checks use fixed, explainable patterns.
- The new Project check reads bounded local source/configuration files, reports findings with paths and lines, and never runs inspected code.
- Optional npm advisory lookup sends only package names and versions to the public OSV API after the user opts in.
- Fixed action rules, approval digests, local fixture actions, and the event integrity check are implemented and tested.
- The public page is a static set of files. It no longer collects emails or offers checkout. A manual GitHub Pages workflow is prepared.

## What this does not mean

No software can be promised “non-hackable.” Sohken is an alpha and is not an enterprise-certified scanner. It does not inspect every language or dependency ecosystem, understand application data flow, verify a deployed service, or protect agent tools that bypass Sohken. Several action adapters still operate on local fixtures rather than customer systems.

The authenticated application API is not a public multi-customer service. Email verification, hosted password recovery, account deletion/export, PostgreSQL-backed hosted tenancy, data retention controls, tested backups/restore, operational monitoring, and complete billing cancellation/refund handling remain unfinished. Do not expose this API to public account creation or accept payment.

## Safe release order

1. Run tests and the npm advisory check in the combined GitHub workflow; review any finding before release.
2. Keep workflow actions pinned to reviewed commit SHAs and update them deliberately.
3. Run `sohken audit project --path .` locally and triage the result. The pattern scanner can report test examples and harmless uses; explain accepted findings in the release review.
4. Build the alpha downloads and publish them as a prerelease only. Keep signing status and limitations visible.
5. Publish the static web page only after checking that its download links resolve to the published release assets. It has no user database or server endpoint.
6. Keep the authenticated application API bound to loopback. Deploying it publicly requires completing the hosted-service work above and an independent security assessment.

## Engineering bar to raise before public business use

Use [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) to define testable web controls and [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) to structure the secure build/release process. NIST has published a draft SSDF 1.2 revision, so check its status before adopting it as a formal requirement. For an agent-security product, add adversarial tests for direct-call bypass, malicious tool metadata, untrusted content, identity boundaries, replay, and partial external failures. Have an independent reviewer test the finished architecture before describing it as enterprise-ready.
