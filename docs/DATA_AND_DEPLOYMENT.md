# Sohken data and deployment

## Where data is stored

The downloadable app is local-first. Each installation keeps its data on that computer; it does not send account or case records to Sohken's website.

| File | Contents |
| --- | --- |
| `config.json` | Local owner/agent keys and signing secret. Keep private. |
| `sohken.sqlite` | Activity, approved notes/actions, and scanner findings. Raw text sent to the text scanner is not retained. |
| `accounts.sqlite` | Account email, salted password hash, hashed session keys, and plan state. |
| `cases.sqlite` | Case titles/details, status, priority, labels, and linked activity references. |
| `profiles/<account-id>/` | Separate engine data for additional accounts on this installation. |

By default, Windows uses `%USERPROFILE%\.sohken`; macOS and Linux use `~/.sohken`. Set `SOHKEN_HOME` or pass `--data-dir` to choose another location. The local development server started for this workspace currently uses `C:\DeveloperFiles\Sohken\.sohken`. I checked its account table on 2 October 2026: it contains **zero accounts and zero active sessions**, so there are no existing credentials on this data directory. Create the first Free account from the dashboard; no invite or password is supplied by the project.

To inspect or recover an account in a local installation, run these commands from the project folder, using the same data directory as the server:

```powershell
node bin/sohken.mjs account list
node bin/sohken.mjs account reset-password --email you@example.com
```

For the downloadable terminal bundle, install its `.tgz` file with `npm install --global .\sohken-security-0.1.0-alpha.3.tgz`, then run `sohken account list` or `sohken account reset-password --email you@example.com`. The desktop app and terminal command use `%USERPROFILE%\.sohken` by default. If `SOHKEN_HOME` was set or the server was started with `--data-dir`, pass that same location with `--data-dir PATH` to the command.

The reset asks for the new password twice without displaying it and signs out existing sessions for that account. For this workspace's development server, add `--data-dir C:\DeveloperFiles\Sohken\.sohken` to both commands. The reset works only for someone who can access the machine and its local data directory; it is not a hosted customer password-recovery flow.

The public page in `web/` is now static. It has no sign-up form, account database, analytics or payment backend. It does not collect user emails. Its text check stays in the browser, and its download buttons open GitHub Releases. To publish it, configure GitHub Pages to use GitHub Actions, then manually run the **Publish Sohken website** workflow. Full steps are in [web/README.md](../web/README.md).

There is no encryption-at-rest layer. On a personal computer, protect the operating-system login and disk; make backups of the complete data directory and keep them private. Never publish `config.json`, any SQLite file, a data-directory backup, or payment secrets.

## Recommended first release: downloadable local beta

The lowest-cost path is to publish app downloads as assets on the GitHub repository's Releases page. GitHub Releases are designed to package notes and binary files for people to download ([GitHub release guide](https://docs.github.com/en/repositories/releasing-projects-on-github)). A tag-triggered workflow has now been added at `.github/workflows/release.yml`: it runs the tests, builds the SDK, packages the Windows desktop app, terminal bundle, browser extension and checksums, then publishes them as a prerelease for alpha tags.

After this change is pushed and the workflow appears on GitHub:

1. Confirm the `Security boundary tests` workflow passes on `main`.
2. From the reviewed commit, create and push the matching package tag:

   ```powershell
   git tag v0.1.0-alpha.3
   git push origin v0.1.0-alpha.3
   ```

3. Watch **Actions → Build and publish Sohken downloads**. When it passes, people can get the desktop ZIP, terminal package, extension ZIP, and checksums from `https://github.com/MelkiZedekICT/sohken.1-manage/releases`.
4. Mark the GitHub release as a pre-release and say plainly that this is an unsigned alpha. The current desktop ZIP is not code-signed, so Windows may warn before opening it. Do not call this a security-certified product.

Do not create the tag until this commit is on `main` and CI is green. A GitHub tag starts the public build and release job.

## Hosted service readiness

The Docker image stores app records under `/data`; mount a durable private volume at that path. Container layers can disappear when a container is replaced, while Docker volumes persist separately ([Docker volume guidance](https://docs.docker.com/engine/storage/volumes/)). The image listens on port 7860 and requires an exact public HTTPS origin plus secure cookies in remote mode. Set `SOHKEN_PUBLIC_ORIGIN=https://your-domain.example` and `SOHKEN_SECURE_COOKIES=true` in the hosting service. Add Razorpay variables only to the server's secret store.

This is **not ready for a public shared paid service**. Before inviting public sign-ups to one hosted database, Sohken still needs user email verification, consumer self-service password recovery, account deletion/export, plain-language privacy and purchase terms, cancellation/refund handling, tested backup restoration, monitoring, release signing, and independent security review. The local password-reset command is an operator recovery path, not a substitute for those hosted account features. Do not connect live Razorpay keys or accept payments yet.

Hugging Face's own storage documentation says a Space's regular disk is ephemeral and recommends attached buckets for data that must survive restarts ([Spaces storage guidance](https://huggingface.co/docs/hub/main/spaces-storage)). Never run the customer account service on an ephemeral filesystem. A public landing page can be deployed separately, but remove or configure its email-collection form and clearly disclose where submitted addresses go.

## Deployment choices

- **Now:** GitHub Releases for downloadable, local-first alpha builds; keep the account and agent data on each user's machine.
- **Next:** publish the static marketing/download page with GitHub Pages after publishing the alpha Release assets. The page does not collect email or accept payment.
- **Later:** deploy the authenticated app server only after the hosted identity, recovery, deletion, privacy, billing, backup, and security-review work above is finished.
