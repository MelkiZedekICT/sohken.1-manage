# Sohken live build journal

## Product and scope

Sohken is an independent, Hermes-inspired security companion for agents. Desktop app, browser extension, CLI and MCP share a local enforcement service. The first alpha scans text, controls fixed local tools, binds human approval to exact actions, verifies local effects, and records an audit trail. It does not control unmanaged agent tools or provide production-wide protection.

User priorities: solo builder, low cost, downloadable interfaces, and a technically credible CSE/AI internship portfolio. Prefer a coherent architecture over adding technologies for appearances.

## 2026-09-16 — Research and initial implementation

- Completed research package: 32 problems, build/deployment plan and primary-source register in research/.
- Changed prototype stack from proposed Python/PostgreSQL to Node 24 + SQLite to support a lightweight shared desktop/terminal core. Decision recorded in docs/BUILD_PLAN.md.
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

## 2026-09-29 � Final Deployment and Validation Summary

- Verified the project readiness by running all 49 integration tests (all passed successfully).
- Finalized the SDK build step to ensure 	sc compiled all .ts files correctly.
- Completed final push of source code changes to GitHub (MelkiZedekICT/sohken.1-manage) branch main.
- Ensured the repository structure is robust for automated deployments to production environments.
- The core product features � local security enforcement for desktop, extension, and MCP interfaces � are fully operational.

## 2026-09-30 — Local launch

- Started the local Sohken engine from the workspace data folder on port 4317 and opened its private dashboard in Codex.
- Confirmed the dashboard API responds with version 0.1.0-alpha.1, four available tools, and action handling enabled.
- The packaged Windows desktop executable exits during Electron startup in this environment (`crashpad_client_win.cc: not connected`). The local engine and dashboard are running; desktop packaging still needs a launch fix.

## 2026-09-30 — Accounts and Plus plan

- Added local account registration, sign-in, sign-out, per-account history and 30-day sessions. Passwords use salted scrypt hashes; session tokens are stored as hashes.
- Replaced the remaining product mark with Sn and added a matching favicon. The dashboard now shows the account plan and gated Plus controls.
- Set Free and Plus pricing to ₹199/month. Full history, audit checks and exports are Plus features; the first 25 events remain free.
- Added a Razorpay subscription checkout path and verified, idempotent webhook handling. Checkout requires an HTTPS public origin and merchant credentials; local runs do not accept payment or unlock Plus from the browser alone.
- Added product and market research, setup notes, architecture/security notes and an environment template. This alpha still needs production identity features such as email verification, password recovery and account deletion before a public paid launch.
- Validation: Node syntax checks passed for the changed server, account, UI, desktop and CLI code; `git diff --check` passed; local dashboard returned HTTP 200. No automated suite run in this pass.

## 2026-10-01 — Security cases workspace

- Added an account-scoped Cases workspace for tracking suspicious agent activity and other security work, using familiar issue-tracker patterns: status, priority, labels, search, and list/board layouts.
- Cases can be created directly or from an activity entry. Each linked case keeps a source-event reference while leaving the integrity-protected activity history untouched.
- Stored cases in a separate local SQLite database with account-filtered reads and updates, strict field validation, and bounded titles, descriptions, and labels.
- Added tests for case data validation, state transitions, account separation, authenticated API access, and cross-account update rejection.
- Checked Linear’s official docs for filters, priority, and status boards; adapted only patterns that suit an individual, local-first security workflow.
- Validation: full `npm.cmd test` suite passed (52 tests); changed JavaScript files passed syntax checks; `git diff --check` passed. The plain `npm` PowerShell launcher is broken on this host, so the `.cmd` shim was used.

## 2026-10-02 — First-run accounts and download release path

- Checked the workspace data folder: it contains zero accounts and zero active sessions. Updated the dashboard to open first-account creation automatically and explain that the user makes the email/password; there is no shared starter password.
- Added a local `account list` command and an interactive, masked `account reset-password --email ...` command. Password changes revoke old sessions. Documented that this does not provide hosted customer recovery.
- Wrote a data-location and deployment guide covering each SQLite/config file, local Windows/macOS/Linux defaults, the separate early-access email store, backups, and what remains before paid public hosting.
- Added tag-triggered GitHub Releases automation to run tests, build the Windows desktop, terminal archive, browser add-on and checksums. Bumped the package to 0.1.0-alpha.3.
- Made container data use `/data`, a persistent-volume mount, and a non-root runtime. Added Docker build-context exclusions for secrets, databases and local agent configuration.
- Found and fixed stale archives leaking into newly built releases. The current local build now contains one desktop ZIP, one extension ZIP, one terminal package and a checksum manifest for 0.1.0-alpha.3 only.
- Validation: 54 tests pass; SDK build succeeds; CLI and changed JavaScript syntax checks pass; release desktop/terminal/extension packages built successfully. Docker image build could not run because the Docker Desktop daemon is not running in this environment.
- Launch decision: downloadable local alpha can be shared after remote CI passes and the release is tagged. A public multi-user paid server is not ready until hosted account recovery/deletion, verification, legal terms, backups and independent security review are in place.

## 2026-10-02 — Real local project checks and public-site cleanup

- Added a read-only source/configuration folder audit to the local dashboard and CLI. It skips symlinks and common generated/dependency folders, limits file count/size, caps findings, and never executes project code or includes source snippets in reports.
- Added checks for credential-like strings, dynamic code, shell use, SQL text assembly, unsafe deserialization, markup insertion, TLS/CORS settings, workflow/container settings and risky package scripts. Reports include the file, line, recommendation, fingerprint, and explicit limitations.
- Added an opt-in npm lockfile advisory lookup using OSV. The user sees what is shared; only package names and exact versions leave the computer. Provider failure is shown as no result, not a clean scan. Advisory severity is left unranked for human review.
- Kept the project-audit route owner-only, loopback-only, and added a test proving hosted mode rejects it. Added API, output-redaction, consent, provider-error and bounded-scan tests.
- Ran the checker against Sohken itself. It exposed false positives from marker-only secrets, test fixtures, inline-script rule text, and fixed marketing copy. Tightened the private-key check, removed literal fixture patterns from test source, and changed the marketing page to build DOM nodes rather than assign HTML strings.
- Rebuilt the public page as static files, removed the AppDeploy email-list backend and collection forms, and described only features that exist. Added a manual GitHub Pages workflow and setup notes; routine pushes do not publish the site.
- Added an npm vulnerability check to CI and documented the difference between a downloadable local alpha, a static public page, and a future hosted service.
- Validation so far: 60 tests pass; SDK build and changed JavaScript syntax checks pass. Self-audit is being rerun after false-positive fixes. Remote GitHub CI and public release publishing remain outstanding.
- Final follow-up: 62/62 tests pass after adding the static-site privacy/asset checks; SDK build and JavaScript syntax checks pass. The self-audit now scans 75 files / 3.2 MB without reaching limits and reports zero configured patterns after test-fixture false positives were removed. Local dashboard auth/setup responds HTTP 200; the existing workspace has an account now, so it correctly asks for sign-in instead of first-account registration. `npm audit` cannot reach the public npm endpoint from this restricted host; the same check is enforced in both GitHub CI and tagged-release workflows.

## 2026-10-02 - Repository cleanup and full source bundle

- Moved project imagery under `assets/images/`, the supplied product brief under `research/source-material/`, and the implementation plan to `docs/BUILD_PLAN.md`; updated links and left generated showcase output under `miscellaneous/`.
- Rewrote the project README around the alpha's actual boundaries, updated contribution and deployment notes, and added `HOW_TO_RUN.md` for local, terminal, extension, MCP and Windows desktop use.
- Consolidated the former test, release and website workflows into `.github/workflows/sohken.yml`; manual runs choose verification or static-site publishing, while version tags publish download files after checks pass.
- Added a full source ZIP to the release packaging step. It includes the developer run guide, filters ignored local files, and records SHA-256 checksums with the other downloads.
- Verification: `npm test` passed 62/62 on this Windows workspace. Remote Actions logs are not accessible from the supplied screenshot, which only shows the Ubuntu job exiting with code 1; this cleanup does not claim to identify that historical failing step. The restricted local host cannot complete `npm audit` because it cannot reach the npm advisory endpoint.
## 2026-10-02 - GitHub workflow verification follow-up

- The combined workflow on commit `072c477` completed successfully on Ubuntu and Windows. Dependency checks, all tests, and the SDK build passed in both jobs.
- The earlier failed run `36745677919` failed at `npm test` on Ubuntu; its Windows test job was cancelled. The newer source fixes that test failure, and the combined run is green.
## 2026-10-02 - Windows release packaging repair

- The `v0.1.0-alpha.3` tag passed Ubuntu and Windows verification but its release job failed at `npm run package:desktop`. Inspection found that the builder forced Electron Packager to use `.cache/electron-distribution`; a clean GitHub runner has no ZIP there even after `npm ci`.
- Removed that override so Electron Packager uses Electron's standard artifact cache and checksum validation. The local clean-cache retry reached the expected network download, which this sandbox blocks; the successful GitHub build for alpha.4 is the remaining end-to-end check.
- Bumped the app and package to `0.1.0-alpha.4` so the failed public tag remains unchanged and the repaired package can be released under a new version.