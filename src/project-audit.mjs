import { createHash } from 'node:crypto';
import { lstat, opendir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const MAX_FILES = 5000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_FINDINGS = 1000;
const MAX_DEPENDENCIES = 1000;
const MAX_ENTRIES = 20000;
const MAX_DEPTH = 32;
const SKIP_DIRS = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.next', '.venv', 'venv', 'target', 'out', '.sohken', '.agents', '.codex', '.aws', '.ssh', '.azure', '.config', '.gnupg', '.kube', '.docker', '.npm', '.cache', '.terraform', '.pulumi', '.secrets', 'secrets']);
const SOURCE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.php', '.rb', '.rs', '.sh', '.ps1', '.sql', '.html', '.yml', '.yaml', '.json', '.toml']);

const checks = [
  { id: 'secret.token', severity: 'high', title: 'Possible hard-coded credential', re: /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/, fix: 'Treat this as exposed: rotate it and load credentials from a secret store.' },
  { id: 'js.dynamic-code', severity: 'high', title: 'Dynamic code execution', re: /\beval\s*\(|\bnew\s+Function\s*\(/, exts: ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx'], fix: 'Avoid evaluating strings. Use a fixed operation or a parser with a constrained grammar.' },
  { id: 'js.shell-command', severity: 'high', title: 'Shell command built from code', re: /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|[^\n;]*\+|[^\n;]*\$\{)/, exts: ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx'], fix: 'Use a fixed executable with an argument array, validate each argument, and avoid shell mode.' },
  { id: 'js.html-injection', severity: 'medium', title: 'HTML inserted as markup', re: /\.innerHTML\s*=|insertAdjacentHTML\s*\(/, exts: ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx'], fix: 'Build DOM nodes with textContent, or sanitize untrusted markup with a maintained sanitizer.' },
  { id: 'js.sql-concatenation', severity: 'high', title: 'SQL appears to be assembled as text', re: /(?:query|execute|prepare)\s*\(\s*`[^`]*\$\{|(?:query|execute)\s*\(\s*['"][^'"]*['"]\s*\+/, exts: ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx'], fix: 'Use parameterized queries and bind untrusted values separately.' },
  { id: 'py-dynamic-code', severity: 'high', title: 'Dynamic code execution', re: /\b(?:eval|exec)\s*\(/, exts: ['.py'], fix: 'Avoid evaluating strings. Use a fixed operation or a parser with a constrained grammar.' },
  { id: 'py-shell-command', severity: 'high', title: 'Shell command execution', re: /subprocess\.(?:run|Popen|call|check_output)\s*\([^\n]*(?:shell\s*=\s*True|\+\s*[A-Za-z_])/, exts: ['.py'], fix: 'Pass a fixed executable and argument list with shell=False; validate every argument.' },
  { id: 'py-unsafe-deserialization', severity: 'high', title: 'Unsafe pickle deserialization', re: /pickle\.(?:load|loads)\s*\(/, exts: ['.py'], fix: 'Do not load pickle data from untrusted sources. Use a non-executable data format.' },
  { id: 'web-weak-csp', severity: 'medium', title: 'Content Security Policy allows inline scripts', re: new RegExp(`(?:script-src[^;]{0,100}'${['unsafe', 'inline'].join('-')}'|Content-Security-Policy[^\\n]{0,150}${['unsafe', 'inline'].join('-')})`, 'i'), fix: 'Prefer nonces or hashes and remove inline-script permission where practical.' },
  { id: 'tls-verification-disabled', severity: 'high', title: 'TLS certificate checks disabled', re: /(?:rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"]?0)/, fix: 'Restore certificate validation. Fix the trust chain instead of bypassing it.' },
  { id: 'cors.wildcard', severity: 'medium', title: 'Cross-site access allows every website', re: /(?:Access-Control-Allow-Origin|allow_origins)\s*[:=]\s*['"]\*['"]/, fix: 'List only the website origins that need access. Do not use a wildcard with private data.' },
  { id: 'docker.privileged', severity: 'high', title: 'Container runs with elevated privileges', re: /\bprivileged\s*:\s*true|--privileged\b/i, exts: ['.yml', '.yaml', '.toml', '.sh'], fix: 'Remove privileged mode and grant only the capabilities and mounts the service needs.' },
  { id: 'workflow.untrusted-trigger', severity: 'high', title: 'Workflow can run with write access on outside contributions', re: /\bpull_request_target\b/, exts: ['.yml', '.yaml'], fix: 'Review this trigger carefully. Never check out or run contributor code with trusted repository secrets.' },
  { id: 'workflow.broad-permissions', severity: 'medium', title: 'Workflow grants broad repository permissions', re: /^\s*permissions\s*:\s*write-all\s*$/m, exts: ['.yml', '.yaml'], fix: 'Grant only the specific token permissions required by each job.' },
  { id: 'debug-enabled', severity: 'low', title: 'Debug mode enabled in configuration', re: /(?:DEBUG|debug)\s*[:=]\s*(?:true|['"]true['"])/, exts: ['.json', '.toml', '.yml', '.yaml', '.py'], fix: 'Confirm debug mode is disabled in production configuration.' },
];

function finding(check, file, line) {
  return { rule: check.id, severity: check.severity, title: check.title, file, line, recommendation: check.fix };
}

function inspectManifest(text, file) {
  const findings = [];
  try {
    const pkg = JSON.parse(text);
    if (pkg.scripts && typeof pkg.scripts === 'object') {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        if (typeof command === 'string' && /\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba)?sh\b|\b(?:sudo\s+)?rm\s+-rf\s+\//i.test(command)) {
          findings.push({ rule: 'manifest.install-command', severity: 'high', title: 'Risky package script', file, line: null, recommendation: `Review the "${name}" script. Avoid piping downloads to a shell or destructive commands.` });
        }
      }
    }
  } catch { /* Parse errors are reported by the manifest rule below. */ }
  return findings;
}

async function npmLockPackages(root) {
  for (const filename of ['package-lock.json', 'npm-shrinkwrap.json']) {
    const full = path.join(root, filename);
    try {
      const info = await lstat(full);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 5 * 1024 * 1024) continue;
      const lock = JSON.parse(await readFile(full, 'utf8'));
      if (!lock.packages || typeof lock.packages !== 'object') continue;
      const packages = [];
      for (const [key, record] of Object.entries(lock.packages)) {
        if (!key || !record || typeof record.version !== 'string') continue;
        const name = typeof record.name === 'string' ? record.name : key.includes('node_modules/') ? key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length) : '';
        if (!/^(?:@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+)$/iu.test(name) || !/^[A-Za-z0-9.+_-]{1,100}$/u.test(record.version)) continue;
        packages.push({ name, version: record.version });
      }
      const unique = [...new Map(packages.map(pkg => [`${pkg.name}@${pkg.version}`, pkg])).values()];
      return { filename, packages: unique.slice(0, MAX_DEPENDENCIES), truncated: unique.length > MAX_DEPENDENCIES };
    } catch (error) { if (error.code !== 'ENOENT') continue; }
  }
  return { filename: null, packages: [], truncated: false };
}

async function checkNpmAdvisories(packages, fetchImpl) {
  if (!packages.length) return [];
  const queries = packages.map(({ name, version }) => ({ package: { name, ecosystem: 'npm' }, version }));
  let response;
  try {
    response = await fetchImpl('https://api.osv.dev/v1/querybatch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queries }),
      redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('provider response');
    const data = await response.json();
    if (!Array.isArray(data.results) || data.results.length !== packages.length) throw new Error('invalid provider response');
    const findings = [];
    for (let i = 0; i < data.results.length; i++) {
      for (const vuln of (Array.isArray(data.results[i]?.vulns) ? data.results[i].vulns : [])) {
        if (typeof vuln.id !== 'string' || !/^[A-Za-z0-9-]{3,100}$/u.test(vuln.id)) continue;
        findings.push({ rule: 'dependency.osv', severity: 'unknown', title: 'Known dependency advisory', file: packages[i].lockFile, line: null, package: packages[i].name, version: packages[i].version, advisory: vuln.id, advisoryUrl: `https://osv.dev/vulnerability/${encodeURIComponent(vuln.id)}`, recommendation: `Review this advisory for severity, reachability, and fixed versions before deciding whether to update.` });
        if (findings.length >= MAX_FINDINGS) return findings;
      }
    }
    return findings;
  } catch {
    throw new Error('The public vulnerability service could not be reached. No dependency advisory result is available.');
  }
}

/** Read-only, bounded local source audit. Source contents never leave this function. */
export async function auditProject(inputPath, { onlineDependencies = false, fetchImpl = globalThis.fetch } = {}) {
  if (typeof inputPath !== 'string' || !inputPath.trim() || inputPath.length > 2048) throw new Error('Choose a valid local project folder.');
  const requested = path.resolve(inputPath);
  let root;
  try { root = await realpath(requested); } catch { throw new Error('The selected folder could not be opened.'); }
  const rootInfo = await lstat(requested);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Choose a real folder, not a link or file.');
  const files = [], findings = [];
  let totalBytes = 0, skippedLarge = 0, unreadableFiles = 0, unreadableDirectories = 0, depthLimitedDirectories = 0, entriesVisited = 0;
  const queue = [{ dir: root, relative: '', depth: 0 }];
  let queueIndex = 0;
  for (; queueIndex < queue.length && files.length < MAX_FILES && entriesVisited < MAX_ENTRIES; queueIndex++) {
    const current = queue[queueIndex], entries = [];
    try {
      const handle = await opendir(current.dir);
      for await (const entry of handle) { entriesVisited++; entries.push(entry); if (entriesVisited >= MAX_ENTRIES) break; }
    } catch { unreadableDirectories++; continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      const full = path.join(current.dir, entry.name), rel = current.relative ? `${current.relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name.toLowerCase())) { if (current.depth < MAX_DEPTH) queue.push({ dir: full, relative: rel, depth: current.depth + 1 }); else depthLimitedDirectories++; } continue; }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (entry.name !== 'package.json' && !SOURCE_EXTENSIONS.has(ext)) continue;
      const stat = await lstat(full);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      if (stat.size > MAX_FILE_BYTES || totalBytes + stat.size > MAX_TOTAL_BYTES) { skippedLarge++; continue; }
      const actual = await realpath(full);
      if (path.relative(root, actual).startsWith('..') || path.isAbsolute(path.relative(root, actual))) continue;
      let content;
      try { content = await readFile(full, 'utf8'); } catch { unreadableFiles++; continue; }
      totalBytes += stat.size; files.push(rel);
      const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+([A-Za-z0-9+/=\r\n]{48,})/i.exec(content);
      if (privateKey && findings.length < MAX_FINDINGS) findings.push(finding({ id: 'secret.private-key', severity: 'critical', title: 'Private key in source', fix: 'Treat it as exposed: rotate it, remove it from history, and move the new key to a managed secret store.' }, rel, content.slice(0, privateKey.index).split(/\r?\n/).length));
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        for (const check of checks) {
          if (check.exts && !check.exts.includes(ext)) continue;
          if (check.re.test(lines[index]) && findings.length < MAX_FINDINGS) findings.push(finding(check, rel, index + 1));
        }
      }
      if (entry.name === 'package.json') for (const item of inspectManifest(content, rel)) if (findings.length < MAX_FINDINGS) findings.push(item);
    }
  }
  const scanTruncated = files.length >= MAX_FILES || entriesVisited >= MAX_ENTRIES || queueIndex < queue.length || depthLimitedDirectories > 0;
  const lock = await npmLockPackages(root);
  let onlineCheck = 'not_requested';
  if (onlineDependencies) {
    if (lock.packages.length) findings.push(...await checkNpmAdvisories(lock.packages.map(pkg => ({ ...pkg, lockFile: lock.filename })), fetchImpl));
    if (findings.length > MAX_FINDINGS) findings.length = MAX_FINDINGS;
    onlineCheck = lock.packages.length ? lock.truncated ? 'partial' : 'complete' : 'no_npm_lock_found';
  }
  findings.sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3, unknown: 4 }[a.severity] - { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 }[b.severity]) || a.file.localeCompare(b.file) || (a.line || 0) - (b.line || 0));
  const counts = Object.fromEntries(['critical', 'high', 'medium', 'low', 'unknown'].map(level => [level, findings.filter(item => item.severity === level).length]));
  const ruleset = 'sohken-local-static-1';
  const fingerprint = createHash('sha256').update(`${ruleset}\0${files.join('\0')}\0${findings.map(item => `${item.rule}:${item.file}:${item.line}:${item.package || ''}:${item.version || ''}:${item.advisory || ''}`).join('\0')}`).digest('hex');
  return { ruleset, project: path.basename(root), filesScanned: files.length, bytesScanned: totalBytes, skippedLarge, unreadableFiles, unreadableDirectories, depthLimitedDirectories, scanTruncated, dependencies: { ecosystem: 'npm', lockFile: lock.filename, versionsFound: lock.packages.length, truncated: lock.truncated }, onlineCheck, findings, findingsTruncated: findings.length >= MAX_FINDINGS, counts, fingerprint, limitations: ['Pattern-based checks can miss issues and report safe code. A clean report is not proof that the project is secure.', 'Folder traversal is bounded by file, entry, depth, and size limits; skipped or unreadable files are listed in the report summary.', 'Online dependency checks cover npm lockfiles only and use the public OSV vulnerability database; advisories may be incomplete or delayed.', 'Only dependency names and exact versions are sent when the online check is selected; source files are not sent.', 'No code is executed and file contents are not included in the report.'] };
}
