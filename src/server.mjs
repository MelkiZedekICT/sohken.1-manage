import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { readFileSync, readdirSync, lstatSync, createReadStream } from 'node:fs';
import { Engine, EngineError, initConfig, object } from './engine.mjs';
import { AccountStore, parseCookies, sessionCookie, signatureMatches } from './accounts.mjs';
import { CaseStore } from './cases.mjs';
import { auditProject } from './project-audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function parseStrictJSON(text) {
    let at = 0;
    const ws = () => { while (/\s/.test(text[at] || '!')) at++; };
    const fail = () => { throw new EngineError('Invalid or ambiguous JSON.'); };
    function string() { const start = at; if (text[at++] !== '"') fail(); while (at < text.length) { if (text[at] === '\\') { at += 2; continue; } if (text[at++] === '"') { try { return JSON.parse(text.slice(start, at)); } catch { fail(); } } } fail(); }
    function value(depth = 0) {
        if (depth > 10) fail(); ws(); const c = text[at]; if (c === '"') return string();
        if (c === '{') { at++; const out = Object.create(null), keys = new Set(); ws(); if (text[at] === '}') { at++; return out; } while (true) { ws(); const key = string(); if (keys.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) fail(); keys.add(key); ws(); if (text[at++] !== ':') fail(); out[key] = value(depth + 1); ws(); const end = text[at++]; if (end === '}') return out; if (end !== ',') fail(); } }
        if (c === '[') { at++; const out = []; ws(); if (text[at] === ']') { at++; return out; } while (true) { out.push(value(depth + 1)); ws(); const end = text[at++]; if (end === ']') return out; if (end !== ',') fail(); } }
        const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at)); if (!m) fail(); at += m[0].length; const v = JSON.parse(m[0]); if (typeof v === 'number' && !Number.isFinite(v)) fail(); return v;
    }
    const result = value(); ws(); if (at !== text.length) fail(); return result;
}
function equal(a, b) { return typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
function readBody(req) { return new Promise((resolve, reject) => { let size = 0, chunks = []; req.on('data', chunk => { size += chunk.length; if (size > 100000) { reject(new EngineError('Request body too large.', 413)); chunks = []; } else chunks.push(chunk); }); req.on('end', () => { if (size > 100000) return; if (!String(req.headers['content-type'] || '').startsWith('application/json')) return reject(new EngineError('Use application/json.', 415)); try { resolve(parseStrictJSON(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } }); req.on('error', reject); }); }
function readRawBody(req) { return new Promise((resolve, reject) => { let size = 0, chunks = []; req.on('data', chunk => { size += chunk.length; if (size > 100000) { reject(new EngineError('Request body too large.', 413)); chunks = []; } else chunks.push(chunk); }); req.on('end', () => size > 100000 ? reject(new EngineError('Request body too large.', 413)) : resolve(Buffer.concat(chunks))); req.on('error', reject); }); }
export async function startServer({ dataDir = process.env.SOHKEN_HOME || path.join(os.homedir(), '.sohken'), port = Number(process.env.PORT || process.env.SOHKEN_PORT || 4317), host = process.env.SOHKEN_HOST || process.env.HOST || (process.env.SPACE_ID ? '0.0.0.0' : '127.0.0.1'), releaseDir = path.join(ROOT, 'release') } = {}) {
    const remoteMode = process.env.SOHKEN_ALLOW_REMOTE === 'true' || Boolean(process.env.SPACE_ID) || host === '0.0.0.0';
    const publicOrigin = process.env.SOHKEN_PUBLIC_ORIGIN;
    if (remoteMode && !publicOrigin) throw new Error('Set SOHKEN_PUBLIC_ORIGIN to the public HTTPS address before exposing Sohken.');
    if (remoteMode && process.env.SOHKEN_SECURE_COOKIES !== 'true') throw new Error('Set SOHKEN_SECURE_COOKIES=true when exposing Sohken.');
    if (publicOrigin) {
        const parsed = new URL(publicOrigin);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== publicOrigin || (remoteMode && parsed.protocol !== 'https:')) throw new Error('SOHKEN_PUBLIC_ORIGIN must be an exact origin; public deployments must use HTTPS.');
    }
    const billingReady = remoteMode && Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_PLAN_ID && process.env.RAZORPAY_WEBHOOK_SECRET);
    const config = initConfig(dataDir), engine = new Engine({ dataDir, config }), accounts = new AccountStore(dataDir, engine), cases = new CaseStore(dataDir); let origin; const rate = new Map();
    const startedAt = Date.now();
    const counters = { requests: 0, auth_failures: 0, rate_limited: 0, scans: 0, project_audits: 0, proposals: 0, approvals: 0, rejections: 0, executions: 0, errors: 0 };
    // Pre-auth connection-level rate limit: 60 failed auth attempts per minute per socket IP triggers a 30s lockout.
    // This fires before token comparison, blocking brute-force enumeration without leaking timing info.
    const connRate = new Map();
    const authRate = new Map();
    function connLimit(ip) { const now = Date.now(); let b = connRate.get(ip); if (!b) { b = { window: now, failures: 0, locked: 0 }; connRate.set(ip, b); } if (now < b.locked) return false; if (now - b.window > 60000) { b.window = now; b.failures = 0; } return true; }
    function connFail(ip) { const b = connRate.get(ip); if (!b) return; if (++b.failures >= 60) { b.locked = Date.now() + 30000; b.failures = 0; } }
    function authLimit(key, max, interval) { const now = Date.now(); let b = authRate.get(key); if (!b || now >= b.expires) { b = { window: now, expires: now + interval, count: 0 }; authRate.set(key, b); } if (b.count >= max) throw new EngineError('Too many account requests. Please wait a little and try again.', 429); b.count++; }
    // Evict stale entries every 5 minutes to prevent memory growth on long-running instances.
    const connEvict = setInterval(() => { const cutoff = Date.now() - 120000; for (const [ip, b] of connRate) if (b.window < cutoff && b.locked < Date.now()) connRate.delete(ip); for (const [key, b] of authRate) if (b.expires < Date.now()) authRate.delete(key); }, 300000); connEvict.unref();
    function json(res, status, payload) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
    const server = http.createServer(async (req, res) => {
        counters.requests++;
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        try {
            const remoteIp = process.env.SOHKEN_TRUST_PROXY === 'true' && typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : req.socket.remoteAddress || 'unknown';
            if (!connLimit(remoteIp)) { counters.rate_limited++; throw new EngineError('Too many failed attempts. Wait 30 seconds.', 429); }
            if (req.headers.host !== new URL(origin).host) throw new EngineError('Host not permitted. Use the configured Sohken address.', 403);
            const url = new URL(req.url, origin), p = url.pathname; const requestOrigin = req.headers.origin;
            const extension = typeof requestOrigin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(requestOrigin);
            if (requestOrigin && requestOrigin !== origin && !extension) throw new EngineError('Origin not permitted.', 403);
            if (extension) { if (!['/api/scan', '/api/health'].includes(p)) throw new EngineError('Extension origin can only scan.', 403); res.setHeader('Access-Control-Allow-Origin', requestOrigin); res.setHeader('Vary', 'Origin'); }
            if (req.method === 'OPTIONS') { if (!extension && requestOrigin !== origin) throw new EngineError('Origin not permitted.', 403); res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.writeHead(204); res.end(); return; }
            if (req.method === 'GET' && ['/', '/index.html', '/app.js', '/styles.css', '/style.css', '/favicon.svg'].includes(p)) {
                const name = p === '/' ? 'index.html' : p.slice(1); const file = path.join(ROOT, 'ui', name); try { const s = lstatSync(file); if (!s.isFile() || s.isSymbolicLink()) throw new Error(); const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)]; res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8' }); res.end(readFileSync(file)); return; } catch { throw new EngineError('UI asset not found.', 404); }
            }
            const cookies = parseCookies(req.headers.cookie || '');
            const userSession = accounts.session(cookies.sohken_session);
            if (req.method === 'GET' && p === '/api/health') return json(res, 200, { status: 'ok', version: engine.state().version });
            if (req.method === 'GET' && p === '/api/auth/setup') return json(res, 200, { needsAccount: !accounts.hasAccounts(), local: !remoteMode });
            if (req.method === 'GET' && p === '/api/auth/me') {
                if (!userSession) throw new EngineError('Sign in to open your workspace.', 401);
                return json(res, 200, { account: userSession.account });
            }
            if (req.method === 'POST' && ['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(p)) {
                if (p.endsWith('/register')) authLimit(`register:${remoteIp}`, 5, 3600000);
                if (p.endsWith('/login')) authLimit(`login:${remoteIp}`, 10, 60000);
                const input = await readBody(req);
                if (p === '/api/auth/logout') {
                    object(input, []); accounts.revoke(cookies.sohken_session); res.setHeader('Set-Cookie', sessionCookie('', true));
                    return json(res, 200, { message: 'You are signed out.' });
                }
                object(input, ['email', 'password']);
                try {
                    const result = p.endsWith('/register') ? await accounts.register(input.email, input.password) : await accounts.login(input.email, input.password);
                    res.setHeader('Set-Cookie', sessionCookie(result.token));
                    return json(res, p.endsWith('/register') ? 201 : 200, { account: result.account });
                } catch (error) {
                    if (p.endsWith('/login') && error.message === 'Email or password is incorrect.') { connFail(remoteIp); counters.auth_failures++; }
                    if (/password|email|account|valid email|characters/u.test(error.message)) throw new EngineError(error.message, error.message.startsWith('Email or password') ? 401 : 400);
                    throw error;
                }
            }
            if (req.method === 'POST' && p === '/api/payments/razorpay/webhook') {
                const raw = await readRawBody(req), signature = req.headers['x-razorpay-signature'];
                const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
                if (!signatureMatches(raw, signature, secret)) throw new EngineError('Payment notice could not be verified.', 401);
                const event = parseStrictJSON(raw.toString('utf8'));
                const subscription = event?.payload?.subscription?.entity;
                const eventId = req.headers['x-razorpay-event-id'] || createHash('sha256').update(raw).digest('hex');
                if (subscription?.id && subscription.plan_id === process.env.RAZORPAY_PLAN_ID) accounts.acceptBillingEvent(String(eventId), subscription.id, event.event, subscription.current_end);
                return json(res, 200, { received: true });
            }
            const auth = req.headers.authorization?.replace(/^Bearer /, '');
            const accountCredential = userSession ? null : accounts.engineForToken(auth);
            const account = userSession?.account || accountCredential?.account || null;
            const requestEngine = userSession ? accounts.engineFor(userSession.accountId) : accountCredential?.engine || engine;
            const requestConfig = requestEngine.config;
            const role = userSession ? 'owner' : accountCredential?.role || (equal(auth, requestConfig.ownerToken) ? 'owner' : equal(auth, requestConfig.agentToken) ? 'agent' : null);
            if (!role) { connFail(remoteIp); counters.auth_failures++; throw new EngineError('Pair with a valid local token.', 401); }
            if (extension && role !== 'agent') throw new EngineError('Use an agent token for the browser extension.', 403);
            const bucket = role + (extension ? ':extension' : ''); const now = Date.now(); let b = rate.get(bucket); if (!b || now - b.at > 60000) { b = { at: now, n: 0 }; rate.set(bucket, b); } if (++b.n > 240) { counters.rate_limited++; throw new EngineError('Too many requests. Wait a minute.', 429); }
            const owner = () => { if (role !== 'owner') throw new EngineError('Only the local owner can perform this operation.', 403); };
            const accountOnly = () => { if (!userSession) throw new EngineError('Sign in to manage your Sohken plan.', 401); };
            const isPlus = Boolean(account?.plan === 'plus');
            const downloads = () => { try { return readdirSync(releaseDir).filter(name => /^sohken-[a-zA-Z0-9._-]+\.(?:zip|tgz|json|txt)$/.test(name)).flatMap(name => { const s = lstatSync(path.join(releaseDir, name)); return s.isFile() && !s.isSymbolicLink() ? [{ name, size: s.size, url: '/downloads/' + name }] : []; }); } catch { return []; } };
            if (req.method === 'GET') {
                if (p === '/api/cases') { accountOnly(); return json(res, 200, { cases: cases.list(userSession.accountId, url.searchParams.get('status') || '') }); }
                if (p === '/api/state') { owner(); const state = requestEngine.state(); if (account && !isPlus) state.events = state.events.slice(0, 25); return json(res, 200, state); }
                if (p === '/api/status') { const { version, mode, paused, stats, tools, policy } = requestEngine.state(); return json(res, 200, { version, mode, paused, stats, tools, policy }); }
                if (p === '/api/metrics') { owner(); const s = requestEngine.state(); return json(res, 200, { uptime_ms: Date.now() - startedAt, counters, engine: { actions: s.stats.actions, blocked: s.stats.blocked, pending: s.stats.pending, verified: s.stats.verified, scans: s.stats.scans }, audit: requestEngine.verify(), rate_buckets: rate.size, conn_rate_entries: connRate.size }); }
                if (p === '/api/audit/verify') { owner(); if (account && !isPlus) throw new EngineError('Full history checks are part of Sohken Plus.', 402); return json(res, 200, requestEngine.verify()); }
                if (p === '/api/export') { owner(); if (account && !isPlus) throw new EngineError('History export is part of Sohken Plus.', 402); res.setHeader('Content-Disposition', 'attachment; filename="sohken-evidence.json"'); return json(res, 200, requestEngine.export()); }
                if (p === '/api/downloads') { owner(); return json(res, 200, { files: downloads() }); }
                if (p === '/api/connection') { owner(); return json(res, 200, { agentToken: requestConfig.agentToken, url: origin }); }
                if (p === '/api/billing/status') { accountOnly(); return json(res, 200, { account: userSession.account, configured: billingReady }); }
                if (/^\/api\/actions\/[a-f0-9-]{36}$/.test(p)) return json(res, 200, requestEngine.getAction(p.split('/')[3]));
                if (p.startsWith('/downloads/')) { owner(); const name = p.slice('/downloads/'.length); if (!downloads().some(d => d.name === name)) throw new EngineError('Download not found.', 404); res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"` }); createReadStream(path.join(releaseDir, name)).pipe(res); return; }
            }
            if (req.method === 'POST' || req.method === 'PATCH') {
                const input = await readBody(req);
                if (p === '/api/project-audit') {
                    owner(); object(input, ['path', 'onlineDependencies']);
                    if (remoteMode) throw new EngineError('Project folder checks run only in the local Sohken app.', 403);
                    if (input.onlineDependencies !== undefined && typeof input.onlineDependencies !== 'boolean') throw new EngineError('Choose whether to check public dependency advisories.', 400);
                    try {
                        const report = await auditProject(input.path, { onlineDependencies: input.onlineDependencies === true });
                        requestEngine.tx(() => requestEngine.event('project.audit_completed', { fingerprint: report.fingerprint, files: report.filesScanned, dependencyVersions: report.dependencies.versionsFound, onlineCheck: report.onlineCheck, findings: report.findings.length, counts: report.counts }));
                        counters.project_audits++;
                        return json(res, 200, report);
                    } catch (error) { if (error instanceof EngineError) throw error; throw new EngineError(error.message || 'The project could not be checked.', 400); }
                }
                if (p === '/api/cases' && req.method === 'POST') { accountOnly(); return json(res, 201, { case: cases.create(userSession.accountId, input) }); }
                const caseMatch = /^\/api\/cases\/([a-f0-9-]{36})$/.exec(p);
                if (caseMatch && req.method === 'PATCH') { accountOnly(); return json(res, 200, { case: cases.update(userSession.accountId, caseMatch[1], input) }); }
                if (p === '/api/billing/subscribe') {
                    accountOnly(); object(input, []);
                    const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET, planId = process.env.RAZORPAY_PLAN_ID;
                    if (!billingReady || !key || !secret || !/^plan_[A-Za-z0-9]+$/u.test(planId || '')) throw new EngineError('Plus checkout opens after the public server and Razorpay webhook are configured.', 503);
                    const authHeader = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
                    const planResponse = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(12000) });
                    const plan = await planResponse.json();
                    if (!planResponse.ok || plan.period !== 'monthly' || plan.interval !== 1 || plan.item?.amount !== 19900 || plan.item?.currency !== 'INR') throw new EngineError('The configured Razorpay plan must be ₹199 per month.', 503);
                    const response = await fetch('https://api.razorpay.com/v1/subscriptions', { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_id: planId, total_count: 120, quantity: 1, customer_notify: true, notes: { sohken_user_id: userSession.accountId } }), signal: AbortSignal.timeout(12000) });
                    const result = await response.json();
                    if (!response.ok || typeof result.short_url !== 'string') throw new EngineError('The payment service could not start checkout. Try again later.', 502);
                    accounts.saveSubscription(userSession.accountId, result.id);
                    return json(res, 200, { url: result.short_url, status: 'pending' });
                }
                if (p === '/api/scan') { counters.scans++; return json(res, 200, requestEngine.scan(input)); }
                if (p === '/api/actions') { counters.proposals++; return json(res, 201, requestEngine.propose(input)); }
                if (p === '/api/pause') { owner(); object(input, ['paused']); return json(res, 200, requestEngine.setPaused(input.paused)); }
                if (p === '/api/demo') { owner(); object(input, []); return json(res, 200, requestEngine.demo()); }
                const match = /^\/api\/actions\/([a-f0-9-]{36})\/(approve|reject|execute)$/.exec(p);
                if (match) { if (match[2] === 'execute') { counters.executions++; object(input, []); return json(res, 200, requestEngine.execute(match[1])); } owner(); if (match[2] === 'approve') counters.approvals++; else counters.rejections++; return json(res, 200, requestEngine.decide(match[1], input, match[2] === 'approve')); }
            }
            throw new EngineError('Route not found.', 404);
        } catch (e) { counters.errors++; if (!res.headersSent) json(res, e instanceof EngineError ? e.status : 400, { error: e instanceof EngineError ? e.message : e.message?.includes('64 KB') || e.message === 'Enter some text to scan.' ? e.message : 'Request could not be processed.' }); else res.end(); }
    });
    server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxHeadersCount = 30;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); }); const bindHost = host === '0.0.0.0' ? '127.0.0.1' : host; origin = publicOrigin || `http://${bindHost}:${server.address().port}`;
    return { server, url: origin, ...config, engine, counters, close: () => new Promise(resolve => { clearInterval(connEvict); server.close(() => { cases.close(); accounts.close(); engine.close(); resolve(); }); server.closeIdleConnections(); }) };
}
