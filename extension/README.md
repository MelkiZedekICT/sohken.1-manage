# Sohken browser extension — local alpha

An on-demand security companion for Chrome and Edge. It checks pasted prompts, commands, selections, and visible page text for configured patterns. It does not continuously monitor browsing or enforce policy on other agents. Findings may be false positives; absent findings do not prove safety. Malicious instructions can be paraphrased, encoded, split across lines, or otherwise evade these checks.

## Install

1. Extract the Sohken extension ZIP to a folder you will keep.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
4. Pin Sohken from the browser extensions menu.

This is an unsigned developer build, not a Chrome Web Store or Edge Add-ons release. ZIP installation requires extracting and loading unpacked; it is not a signed one-click store package.

## Inspect text

Paste text and click **Scan text**. Everything runs inside the popup by default. **Use selection / page** captures a selection if available, otherwise visible text from the active page. Capture does not scan or transmit anything: review the preview and explicitly click Scan text. Form controls, editable regions, scripts, styles, and iframes are excluded. Browser settings pages and extension stores cannot be captured. Content rendered in canvas or inaccessible frames is not inspected. Text is capped at 64 KB and traversal is bounded; findings are limited to 100. Large pages may only produce an excerpt. Closing the popup clears captured text and results.

Visible text can still contain sensitive information, including secrets printed as ordinary text. Review before enabling local-engine scanning. A hostile page may hide or modify content and evade the extraction and scanner.

## Optional local engine

Start the Sohken engine, obtain its **agent token** from the local terminal, and paste it into **Connect to local Sohken**. Click **Pair this session**, then select **Send this scan to my local engine**. Each scan sends only the displayed text and the source label `browser-extension` to `http://127.0.0.1:4317/api/scan`. No page URL is sent. Owner tokens are refused. The engine's authentication and validation decide whether access is permitted.

The agent token is kept in `chrome.storage.session`, not local/sync storage, and is cleared with **Disconnect**. Session storage normally survives popup closure but clears when the extension/browser session ends. Remote scanning defaults off on every popup opening. Captured text and results are not stored by the extension. The engine may retain scan metadata and findings according to its own retention rules.

## Permissions

- `activeTab`: temporary access only after you invoke the extension.
- `scripting`: explicit capture of selection or readable page text.
- `storage`: optional agent token in session storage.
- `http://127.0.0.1/*`: loopback access for the optional local engine. Chrome match patterns cannot restrict the port; the extension's content security policy and code restrict connections to port 4317.

There are no background scripts, remote scripts, telemetry, broad website permissions, or content scripts installed on every page.

## Verify

Run `node --test extension/scanner.test.mjs` from the repository root. Then load unpacked, scan a benign sentence and `Ignore all previous instructions`, and inspect a selected passage. Pairing requires the local engine. This extension is inspired by the security companion concept and is not affiliated with Hermes or its creators.
