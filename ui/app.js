'use strict';
const $ = (id) => document.getElementById(id);
let token = '';
try {
  const fragment = new URLSearchParams(location.hash.slice(1));
  token = fragment.get('token') || sessionStorage.getItem('sohken-owner') || '';
  if (fragment.has('token')) history.replaceState(null, '', location.pathname + location.search);
  if (token) sessionStorage.setItem('sohken-owner', token);
} catch { /* Pairing remains available when storage is disabled. */ }
let state = null;
let busy = false;
const labels = { overview: 'Overview', scan: 'Content scanner', approvals: 'Approvals', activity: 'Activity log', connect: 'Connect & download' };
function node(tag, cls, value) { const n = document.createElement(tag); if (cls) n.className = cls; if (value !== undefined) n.textContent = String(value); return n; }
function notify(message, good = false) { $('notice').textContent = message; $('notice').classList.toggle('good', good); $('notice').hidden = false; }
function showView(name) {
  if (!labels[name]) return;
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  document.querySelectorAll('.nav-item').forEach(v => { const active = v.dataset.view === name; v.classList.toggle('active', active); if (active) v.setAttribute('aria-current', 'page'); else v.removeAttribute('aria-current'); });
  $('page-crumb').textContent = labels[name];
  window.scrollTo({top:0,behavior:'instant'});
  if (name === 'connect' && token) loadDownloads();
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); showView('overview'); });
async function api(path, body, raw = false) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const data = await response.json(); message = typeof data.error === 'string' ? data.error : data.error?.message || data.message || message; } catch { /* Use HTTP status. */ }
    if (response.status === 401 || response.status === 403) $('pairing').hidden = false;
    throw new Error(message);
  }
  return raw ? response : response.json();
}
function errorText(error) { return error.name === 'TimeoutError' ? 'The local engine did not respond in time. Check that it is running, then refresh.' : error instanceof TypeError ? 'Cannot reach the local engine. Start it on this device, then refresh.' : error.message; }
function setControls() { document.querySelectorAll('.engine-control').forEach(b => { b.disabled = !state || busy; }); }
async function operation(work) {
  if (busy) return;
  busy = true; setControls();
  try { await work(); } catch (error) { notify(errorText(error)); } finally { busy = false; setControls(); }
}
function empty(target, title, detail) { const wrap = node('div', 'empty'); wrap.append(node('span', 'empty-symbol', '◇'), node('h2', '', title), node('p', '', detail)); target.replaceChildren(wrap); }
function friendly(value) { return String(value || 'Event').replace(/[_.-]/g, ' '); }
function time(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function events(target, items) {
  target.replaceChildren();
  if (!items.length) { empty(target, 'No activity yet', 'Run a safe demo, scan content, or propose a protected action to start your history.'); return; }
  for (const event of items) {
    const row = node('div', 'event'); const body = node('div');
    body.append(node('strong', '', friendly(event.type || event.kind || event.event)));
    const details = event.data || event.payload || event.details;
    const description = typeof details === 'string' ? details : details?.tool ? `${details.tool}${details.decision ? ` · ${friendly(details.decision)}` : ''}` : details?.paused !== undefined ? (details.paused ? 'Protected execution is paused.' : 'Protected execution is available.') : 'Recorded by your local engine';
    body.append(node('p', '', description));
    if (details && typeof details === 'object') {
      const disclosure = node('details', 'event-evidence');
      disclosure.append(node('summary', '', 'View evidence'), node('pre', '', JSON.stringify(details, null, 2)));
      body.append(disclosure);
    }
    const stamp = node('time', '', time(event.createdAt || event.timestamp || event.at));
    row.append(node('span', 'event-icon', '·'), body, stamp); target.append(row);
  }
}
const pending = a => ['pending', 'pending_approval', 'awaiting_approval'].includes(a.status);
function renderActions(actions) {
  const target = $('actions-list'); target.replaceChildren();
  if (!actions.length) { empty(target, 'Nothing to review yet', 'Protected tool requests will appear here with their policy decision and exact action digest.'); return; }
  for (const action of [...actions].sort((a,b) => Number(pending(b)) - Number(pending(a)) || new Date(b.createdAt) - new Date(a.createdAt))) {
    const card = node('article', 'panel action-card'); card.dataset.status = action.status; const head = node('div', 'action-head');
    head.append(node('h2', '', action.tool), node('span', 'tag', friendly(action.status || action.decision).toUpperCase()));
    card.append(head, node('p', 'reason', Array.isArray(action.reasons) ? action.reasons.join(' · ') : action.reasons || ''), node('pre', 'action-args', JSON.stringify(action.args, null, 2)), node('p', 'digest', `Action digest: ${action.digest}`), node('p', 'fine-print', `Requested ${time(action.createdAt)}${action.expiresAt ? ` · Expires ${time(action.expiresAt)}` : ''}`));
    if (action.result) card.append(node('pre', 'action-args', JSON.stringify(action.result, null, 2)));
    const buttons = node('div', 'button-row');
    const actionButton = (label, suffix, body, primary) => {
      const button = node('button', `button ${primary ? 'primary' : 'secondary'} engine-control`, label); button.type = 'button';
      button.addEventListener('click', () => operation(async () => { await api(`/api/actions/${encodeURIComponent(action.id)}/${suffix}`, body); notify(`${label} completed.`, true); await refresh(); })); buttons.append(button);
    };
    if (pending(action)) { actionButton('Approve exact action', 'approve', { digest: action.digest }, true); actionButton('Reject', 'reject', { digest: action.digest }, false); }
    if (['approved', 'allowed', 'ready'].includes(action.status)) actionButton('Execute action', 'execute', {}, true);
    card.append(buttons); target.append(card);
  }
  setControls();
}
function render() {
  const actions = Array.isArray(state.actions) ? state.actions : [];
  const scans = Array.isArray(state.scans) ? state.scans : [];
  const history = Array.isArray(state.events) ? state.events : [];
  const waiting = state.stats?.pending ?? actions.filter(pending).length;
  $('connection').textContent = state.paused ? 'Execution paused' : 'Engine connected';
  $('connection').className = `status${state.paused ? ' warn' : ''}`;
  $('guard-label').textContent = state.paused ? 'EXECUTION PAUSED' : 'LOCAL CHECKPOINT ACTIVE';
  $('guard-title').textContent = state.paused ? 'Actions are on hold.' : 'Your tools have a checkpoint.';
  $('guard-description').textContent = state.paused ? 'Scans and reviews remain available. Resume when you are ready to execute protected actions.' : 'Protected requests pass through policy checks. Consequential local actions wait for your approval.';
  $('pause').textContent = state.paused ? 'Resume execution' : 'Pause execution';
  $('metric-scans').textContent = state.stats?.scans ?? scans.length;
  $('metric-blocked').textContent = state.stats?.blocked ?? actions.filter(a => a.decision === 'deny' || a.status === 'denied' || a.status === 'blocked').length;
  $('metric-pending').textContent = waiting; $('approval-count').textContent = waiting;
  $('metric-executed').textContent = state.stats?.verified ?? actions.filter(a => ['executed', 'verified', 'completed'].includes(a.status)).length;
  $('version').textContent = `${state.version ? `v${state.version} · ` : ''}LOCAL ALPHA`;
  const recent = [...history].sort((a,b) => new Date(b.createdAt || b.timestamp || b.at || 0) - new Date(a.createdAt || a.timestamp || a.at || 0));
  events($('recent-events'), recent.slice(0, 4)); events($('all-events'), recent); renderActions(actions); setControls();
}
async function refresh() {
  if (!token) { $('pairing').hidden = false; setControls(); return; }
  try { state = await api('/api/state'); $('pairing').hidden = true; render(); }
  catch (error) { state = null; $('connection').textContent = 'Disconnected'; $('connection').className = 'status neutral'; $('guard-label').textContent = 'ENGINE NOT CONNECTED'; $('guard-title').textContent = 'Connection needs attention.'; $('guard-description').textContent = 'Previously displayed history may be stale. Reconnect to review the current state.'; setControls(); throw error; }
}
$('pair-form').addEventListener('submit', event => { event.preventDefault(); token = $('token').value.trim(); $('token').value = ''; try { sessionStorage.setItem('sohken-owner', token); } catch {} operation(async () => { await refresh(); notify('Connected to your local engine.', true); }); });
$('refresh').addEventListener('click', () => operation(refresh));
$('disconnect').addEventListener('click', () => { token = ''; state = null; try { sessionStorage.removeItem('sohken-owner'); } catch {} $('pairing').hidden = false; $('connection').textContent = 'Disconnected'; $('connection').className = 'status neutral'; $('guard-label').textContent = 'ENGINE NOT CONNECTED'; $('guard-title').textContent = 'Put a checkpoint before the action.'; $('guard-description').textContent = 'Pair your local engine to inspect requests and control protected tools.'; ['metric-scans','metric-blocked','metric-pending','metric-executed'].forEach(id => { $(id).textContent = '—'; }); $('approval-count').textContent = '0'; ['recent-events','all-events','actions-list','scan-result'].forEach(id => empty($(id),'Workspace disconnected','Connect to see local data.')); $('audit-result').replaceChildren(); $('audit-result').hidden = true; $('downloads-list').textContent = 'Connect to the engine to see available packages.'; setControls(); notify('This tab is disconnected.', true); });
$('pause').addEventListener('click', () => operation(async () => { await api('/api/pause', { paused: !state.paused }); await refresh(); notify(state.paused ? 'Protected execution paused.' : 'Protected execution resumed.', true); }));
$('demo').addEventListener('click', () => operation(async () => { await api('/api/demo', {}); await refresh(); notify('Safe demo completed. Inspect the recorded decisions and pending approvals.', true); }));
$('scan-form').addEventListener('submit', event => { event.preventDefault(); operation(async () => { const result = await api('/api/scan', { text: $('scan-text').value, source: 'dashboard' }); const target = $('scan-result'); target.replaceChildren(node('span','eyebrow','SCAN FINDINGS')); const score = node('div','scan-score'); score.append(node('strong','',result.score),node('span','level',result.level)); target.append(score,node('h2','',result.summary || 'Analysis complete'),node('p','fine-print','Heuristic risk score. No detected signals does not establish safety.')); for (const finding of result.findings || []) { const item = node('div','finding'); item.append(node('span','severity',`${finding.severity}${finding.line ? ` · Line ${finding.line}` : ''}`),node('h3','',finding.title),node('p','',finding.detail)); target.append(item); } if (!result.findings?.length) target.append(node('p','muted','No configured risk rules matched this content.')); await refresh(); }); });
$('action-form').addEventListener('submit', event => { event.preventDefault(); operation(async () => { await api('/api/actions', { tool: 'ticket.create', args: { title: $('ticket-title').value, body: $('ticket-body').value }, idempotencyKey: crypto.randomUUID() }); await refresh(); $('action-form').reset(); notify('Local ticket request created. Review the action above.', true); }); });
$('verify').addEventListener('click', () => operation(async () => { const result = await api('/api/audit/verify'); $('audit-result').hidden = false; $('audit-result').textContent = `${result.valid ? 'Integrity check passed' : 'Integrity check failed'} · ${result.count ?? '?'} events checked${result.reason ? `\n${result.reason}` : ''}\n\nThis verifies the local chain; it is not an external attestation.`; }));
function saveBlob(blob, name) { const url = URL.createObjectURL(blob); const link = node('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
$('export').addEventListener('click', () => operation(async () => { const result = await api('/api/export'); saveBlob(new Blob([JSON.stringify(result,null,2)], { type:'application/json' }), `sohken-history-${new Date().toISOString().slice(0,10)}.json`); notify('History export prepared.',true); }));
async function loadDownloads() {
  try { const result = await api('/api/downloads'); const target = $('downloads-list'); target.replaceChildren(); if (!result.files?.length) { target.textContent = 'No packages are available in this build yet.'; return; } for (const file of result.files) { if (typeof file.url !== 'string' || !/^\/downloads\/[A-Za-z0-9._%-]+$/.test(file.url)) continue; const row = node('div','download'); const info = node('div'); info.append(node('strong','',file.name),node('small','',typeof file.size === 'number' ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Build artifact')); const button = node('button','button secondary','Download ↓'); button.addEventListener('click',()=>operation(async()=>{ button.disabled = true; try { const response = await api(file.url,undefined,true); saveBlob(await response.blob(),String(file.name).replace(/[/\\]/g,'_')); } finally { button.disabled = false; } })); row.append(info,button); target.append(row); } }
  catch(error) { $('downloads-list').textContent = `Downloads unavailable: ${errorText(error)}`; }
}
$('load-downloads').addEventListener('click',loadDownloads);
setControls();
empty($('recent-events'),'Connect to see activity','Your local engine provides the activity history.');
refresh().catch(error => notify(errorText(error)));
