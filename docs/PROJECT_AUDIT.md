# Sohken project check

The local project check walks source and configuration files and looks for known risky patterns. It is available in the local dashboard under **Project check** and in the terminal:

```sh
sohken audit project --path C:\Projects\my-app
```

The check is read-only. It does not execute project code, install packages, or return matching source lines. By default it does not contact a vulnerability service. A report includes a relative file name, line, rule, recommendation, ruleset version, counts and a fingerprint. The result summary is added to Sohken's local event history; file contents are not retained.

Current checks include credential-like values, private-key blocks, dynamic code evaluation, shell execution patterns, SQL text assembly, markup insertion, unsafe Python deserialization, disabled TLS validation, permissive cross-site access, risky package scripts, privileged containers, and selected CI workflow patterns. It ignores common generated/dependency folders, local credential/config folders, symbolic links, unsupported file types, files larger than 512 KB, directories deeper than 32 levels, and any data beyond 5,000 files, 20,000 folder entries or 20 MB. Findings are capped at 1,000. The report says when scan limits or unreadable files made the result incomplete.

For an optional current npm advisory lookup, select the checkbox in the dashboard or add `--online-dependencies` in the terminal. Sohken reads npm package names and exact versions from `package-lock.json` or `npm-shrinkwrap.json` and sends those values to Google's public [OSV querybatch API](https://google.github.io/osv.dev/post-v1-querybatch/). It does not send source files. Dependency records are shown as unranked until a reviewer checks the linked advisory for severity, reachability, and fixed versions. OSV reports matching records; a match does not prove a package is reachable or exploitable, and no match does not prove the package is safe.

This is an early static pattern checker. It can miss issues and report safe code. It does not understand program flow, inspect every language, check every lockfile format, run a web scan, test a deployed server, or provide a security certification. Use specialist static analysis, dependency review, tests, and human security review before release. Do not describe a clean report as “secure.”

The endpoint only works when Sohken binds to loopback. It requires the local owner credential and returns an error in remote mode. Do not expose the local service to a network. It is not a remote repository scanner.
