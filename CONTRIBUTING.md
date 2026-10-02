# Contributing to Sohken

Sohken is a security tool. Every contribution must preserve the security invariants that make it useful.

## Before you start

1. Read [`SECURITY.md`](SECURITY.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
2. Run `npm ci && npm test` — all tests must pass before and after your change.
3. Open an issue or discussion before large changes. Design conversations save rework.

## Development setup

```sh
node --version   # >= 24.0.0
npm ci
npm test         # Core, HTTP, CLI/MCP, extension and website checks
```

Desktop development additionally requires `node node_modules/electron/install.js` for the Electron runtime.

## Security-first development rules

These rules exist because Sohken is a security boundary, not a feature app.

1. **Fail closed.** Unknown decisions, missing policy, corrupt state → deny. Never default to allow.
2. **No shell, no eval, no dynamic import from user input.** Tool adapters are fixed typed functions.
3. **Credential separation.** Owner tokens never appear in agent-accessible responses. Agent tokens never gain approval authority.
4. **Timing safety.** All token comparisons use `timingSafeEqual`. Pre-auth rate limiting runs before comparison.
5. **Audit integrity.** Every state mutation appends a hash-linked event. Tests verify chain tamper detection.
6. **Redaction before storage.** Credentials and denied request arguments are redacted before they enter the database or event chain.
7. **Symlink rejection.** Data directory, config file, and database paths reject symlinks to prevent path traversal.

## Adding a scanner rule

1. Add the rule object to the `rules` array in [`src/scanner.mjs`](src/scanner.mjs).
2. Each rule needs: `id` (kebab-case), `severity` (critical/high/medium), `title`, `pattern` (RegExp), `detail`.
3. Write at least two tests in [`tests/core.test.mjs`](tests/core.test.mjs):
   - One that triggers the rule on a realistic attack payload.
   - One that confirms benign technical content does **not** trigger it.
4. If the rule can match legitimate content, document the trade-off in the `detail` field.
5. Run `npm test` — zero false positives on the existing benign content suite.

## Commit convention

```
type: concise description

Body explains why, not what. Reference issue numbers.
```

Types: `feat`, `fix`, `test`, `docs`, `security`, `chore`, `style`, `refactor`.

Security-relevant changes must use the `security` type and explain the threat model change.

## Pull request checklist

- [ ] `npm test` passes with zero failures
- [ ] No new dependencies added without justification
- [ ] No credentials, tokens, or secrets in committed code
- [ ] Security invariants preserved (fail-closed, credential separation, audit chain)
- [ ] New scanner rules include both positive and false-positive-resistant tests
- [ ] Documentation updated if behavior changed

## What we will not merge

- Dependencies on cloud services, paid APIs, or external models for core functionality.
- `eval`, `Function()`, dynamic `import()` from user-controlled strings.
- Changes that make the audit chain mutable or bypassable.
- Scanner rules without false-positive testing.
- Code that mixes owner and agent credential scopes.

## License

Contributions are made under the same license as the project (see [`package.json`](package.json)). By submitting a pull request, you agree that your contribution may be used under these terms.
