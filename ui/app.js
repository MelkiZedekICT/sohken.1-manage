'use strict';
const $ = (id) => document.getElementById(id);
let token = '';
try {
  if (new URLSearchParams(location.hash.slice(1)).has('token')) history.replaceState(null, '', location.pathname + location.search);
  sessionStorage.removeItem('sohken-owner');
} catch { /* Pairing remains available when storage is disabled. */ }
let state = null;
let account = null;
let checkoutReady = false;
let authMode = 'login';
let busy = false;
const labels = { overview: 'Overview', scan: 'Text check', project: 'Project check', approvals: 'Review', cases: 'Cases', activity: 'History', connect: 'Get Sohken' };
let caseItems = [];
let caseLayout = 'list';
function node(tag, cls, value) { const n = document.createElement(tag); if (cls) n.className = cls; if (value !== undefined) n.textContent = String(value); return n; }
function notify(message, good = false) { $('notice').textContent = message; $('notice').classList.toggle('good', good); $('notice').hidden = false; }
function showView(name) {
  if (!labels[name]) return;
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  document.querySelectorAll('.nav-item').forEach(v => { const active = v.dataset.view === name; v.classList.toggle('active', active); if (active) v.setAttribute('aria-current', 'page'); else v.removeAttribute('aria-current'); });
  $('page-crumb').textContent = labels[name];
  window.scrollTo({top:0,behavior:'instant'});
  if (name === 'connect' && (token || account)) { loadDownloads(); refreshPlan(); }
  if (name === 'cases' && account) loadCases();
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); showView('overview'); });
async function api(path, body, raw = false, methodOverride) {
  const response = await fetch(path, { method: methodOverride || (body === undefined ? 'GET' : 'POST'), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000), cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const data = await response.json(); message = typeof data.error === 'string' ? data.error : data.error?.message || data.message || message; } catch { /* Use HTTP status. */ }
    const error = new Error(message); error.status = response.status; throw error;
  }
  return raw ? response : response.json();
}
function errorText(error) { return error.name === 'TimeoutError' ? 'Sohken did not respond in time. Check that it is open, then refresh.' : error instanceof TypeError ? 'Cannot reach Sohken. Start it on this device, then refresh.' : error.message; }
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
  if (!items.length) { empty(target, 'No history yet', 'Run the safe demo, check text, or ask for an action to begin.'); return; }
  for (const event of items) {
    const row = node('div', 'event'); const body = node('div');
    body.append(node('strong', '', friendly(event.type || event.kind || event.event)));
    const details = event.data || event.payload || event.details;
    const description = typeof details === 'string' ? details : details?.tool ? `${details.tool}${details.decision ? ` · ${friendly(details.decision)}` : ''}` : details?.paused !== undefined ? (details.paused ? 'Actions are paused.' : 'Actions are available.') : 'Recorded by Sohken';
    body.append(node('p', '', description));
    if (details && typeof details === 'object') {
      const disclosure = node('details', 'event-evidence');
      disclosure.append(node('summary', '', 'Show details'), node('pre', '', JSON.stringify(details, null, 2)));
      body.append(disclosure);
    }
    const stamp = node('time', '', time(event.createdAt || event.timestamp || event.at));
    if (account) { const makeCase = node('button', 'text-button event-case', 'Create case'); makeCase.type = 'button'; makeCase.addEventListener('click', () => openCaseComposer({ title: friendly(event.type || event.kind || 'Security event'), description: `${description}${event.id || event.seq ? `\n\nEvent reference: ${event.id || event.seq}` : ''}`, sourceEventId: String(event.id || event.seq || '') })); body.append(makeCase); }
    row.append(node('span', 'event-icon', '·'), body, stamp); target.append(row);
  }
}
const pending = a => ['pending', 'pending_approval', 'awaiting_approval'].includes(a.status);
function renderActions(actions) {
  const target = $('actions-list'); target.replaceChildren();
  if (!actions.length) { empty(target, 'Nothing to review yet', 'Agent requests will appear here with Sohken’s reason and action code.'); return; }
  for (const action of [...actions].sort((a,b) => Number(pending(b)) - Number(pending(a)) || new Date(b.createdAt) - new Date(a.createdAt))) {
    const card = node('article', 'panel action-card'); card.dataset.status = action.status; const head = node('div', 'action-head');
    head.append(node('h2', '', action.tool), node('span', 'tag', friendly(action.status || action.decision).toUpperCase()));
    card.append(head, node('p', 'reason', Array.isArray(action.reasons) ? action.reasons.join(' · ') : action.reasons || ''), node('pre', 'action-args', JSON.stringify(action.args, null, 2)), node('p', 'digest', `Action code: ${action.digest}`), node('p', 'fine-print', `Asked ${time(action.createdAt)}${action.expiresAt ? ` · Choice ends ${time(action.expiresAt)}` : ''}`));
    if (action.result) card.append(node('pre', 'action-args', JSON.stringify(action.result, null, 2)));
    const buttons = node('div', 'button-row');
    const actionButton = (label, suffix, body, primary) => {
      const button = node('button', `button ${primary ? 'primary' : 'secondary'} engine-control`, label); button.type = 'button';
      button.addEventListener('click', () => operation(async () => { await api(`/api/actions/${encodeURIComponent(action.id)}/${suffix}`, body); notify(`${label} completed.`, true); await refresh(); })); buttons.append(button);
    };
    if (pending(action)) { actionButton('Allow this action', 'approve', { digest: action.digest }, true); actionButton('Keep blocked', 'reject', { digest: action.digest }, false); }
    if (['approved', 'allowed', 'ready'].includes(action.status)) actionButton('Run action', 'execute', {}, true);
    card.append(buttons); target.append(card);
  }
  setControls();
}
function render() {
  const actions = Array.isArray(state.actions) ? state.actions : [];
  const scans = Array.isArray(state.scans) ? state.scans : [];
  const history = Array.isArray(state.events) ? state.events : [];
  const waiting = state.stats?.pending ?? actions.filter(pending).length;
  $('connection').textContent = state.paused ? 'Actions paused' : 'Sohken connected';
  $('connection').className = `status${state.paused ? ' warn' : ''}`;
  $('guard-label').textContent = state.paused ? 'ACTIONS PAUSED' : 'SOHKEN IS READY';
  $('guard-title').textContent = state.paused ? 'Actions are on hold.' : 'Your tools have a checkpoint.';
  $('guard-description').textContent = state.paused ? 'Text checks and reviews still work. Resume when you are ready.' : 'Sohken checks requests against your rules. Important actions wait for your choice.';
  $('pause').textContent = state.paused ? 'Resume actions' : 'Pause actions';
  $('metric-scans').textContent = state.stats?.scans ?? scans.length;
  $('metric-blocked').textContent = state.stats?.blocked ?? actions.filter(a => a.decision === 'deny' || a.status === 'denied' || a.status === 'blocked').length;
  $('metric-pending').textContent = waiting; $('approval-count').textContent = waiting;
  $('metric-executed').textContent = state.stats?.verified ?? actions.filter(a => ['executed', 'verified', 'completed'].includes(a.status)).length;
  $('version').textContent = `${state.version ? `v${state.version} · ` : ''}LOCAL ALPHA`;
  const recent = [...history].sort((a,b) => new Date(b.createdAt || b.timestamp || b.at || 0) - new Date(a.createdAt || a.timestamp || a.at || 0));
  events($('recent-events'), recent.slice(0, 4)); events($('all-events'), recent); renderActions(actions); setControls();
}
function openCaseComposer(prefill = {}) {
  $('case-composer').hidden = false;
  $('case-title').value = String(prefill.title || '').slice(0, 160);
  $('case-description').value = String(prefill.description || '').slice(0, 8000);
  $('case-priority').value = 'none'; $('case-labels').value = '';
  $('case-source').value = String(prefill.sourceEventId || '');
  showView('cases'); $('case-title').focus();
}
function caseCard(item) {
  const card = node('article', 'case-card'); card.dataset.priority = item.priority; card.dataset.status = item.status;
  const head = node('div', 'case-card-head'); head.append(node('span', 'case-key', `SN-${item.id.slice(0, 6).toUpperCase()}`), node('span', `case-priority priority-${item.priority}`, item.priority === 'none' ? 'No priority' : friendly(item.priority)));
  card.append(head, node('h2', 'case-title', item.title));
  if (item.description) card.append(node('p', 'case-description', item.description));
  if (item.labels.length) { const labels = node('div', 'case-labels'); for (const label of item.labels) labels.append(node('span', 'case-label', label)); card.append(labels); }
  if (item.sourceEventId) card.append(node('p', 'case-source', `Linked to activity ${item.sourceEventId.slice(0, 12)}`));
  const controls = node('div', 'case-controls');
  const status = document.createElement('select'); status.setAttribute('aria-label', `Status for ${item.title}`); for (const [value, text] of [['open','Open'],['in_progress','In progress'],['resolved','Resolved']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; status.append(option); } status.value = item.status;
  status.addEventListener('change', () => updateCase(item.id, { status: status.value }));
  const priority = document.createElement('select'); priority.setAttribute('aria-label', `Priority for ${item.title}`); for (const [value, text] of [['none','No priority'],['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; priority.append(option); } priority.value = item.priority;
  priority.addEventListener('change', () => updateCase(item.id, { priority: priority.value }));
  controls.append(status, priority, node('time', 'case-updated', time(item.updatedAt))); card.append(controls); return card;
}
function renderCases() {
  const query = $('case-search').value.trim().toLowerCase(), filter = $('case-filter').value;
  const visible = caseItems.filter(item => (!filter || filter === 'all' || item.status === filter) && (!query || `${item.title} ${item.description} ${item.labels.join(' ')}`.toLowerCase().includes(query)));
  $('case-count').textContent = String(caseItems.filter(item => item.status !== 'resolved').length);
  const list = $('case-list'), board = $('case-board'); list.replaceChildren(); board.replaceChildren();
  list.hidden = caseLayout !== 'list'; board.hidden = caseLayout !== 'board';
  if (!visible.length) { empty(list, caseItems.length ? 'No matching cases' : 'No cases yet', caseItems.length ? 'Change the search or status filter.' : 'Create a case or turn an activity item into one.'); return; }
  if (caseLayout === 'list') { for (const item of visible) list.append(caseCard(item)); return; }
  for (const [status, title] of [['open','Open'],['in_progress','In progress'],['resolved','Resolved']]) {
    if (filter !== 'all' && filter !== status) continue;
    const column = node('section', 'case-column'); const heading = node('div', 'case-column-heading'); heading.append(node('h2', '', title), node('span', 'tag', String(visible.filter(item => item.status === status).length))); column.append(heading);
    const items = visible.filter(item => item.status === status); if (!items.length) column.append(node('p', 'case-column-empty', 'Nothing here yet.'));
    for (const item of items) column.append(caseCard(item)); board.append(column);
  }
}
async function loadCases() {
  if (!account) return;
  try { caseItems = (await api('/api/cases')).cases; renderCases(); }
  catch (error) { if (error.status !== 401) notify(errorText(error)); }
}
async function updateCase(id, changes) {
  try { const result = await api(`/api/cases/${encodeURIComponent(id)}`, changes, false, 'PATCH'); caseItems = caseItems.map(item => item.id === id ? result.case : item); renderCases(); }
  catch (error) { notify(errorText(error)); renderCases(); }
}
$('new-case').addEventListener('click', () => openCaseComposer());
$('cancel-case').addEventListener('click', () => { $('case-composer').hidden = true; $('case-form').reset(); });
$('case-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('case-form').querySelector('[type="submit"]'); button.disabled = true;
  try {
    const result = await api('/api/cases', { title: $('case-title').value, description: $('case-description').value, priority: $('case-priority').value, labels: $('case-labels').value.split(',').map(value => value.trim()).filter(Boolean), sourceEventId: $('case-source').value || null });
    caseItems.unshift(result.case); $('case-form').reset(); $('case-composer').hidden = true; renderCases(); notify('Case created. Your security work stays on this device.', true);
  } catch (error) { notify(errorText(error)); } finally { button.disabled = false; }
});
$('case-search').addEventListener('input', renderCases); $('case-filter').addEventListener('change', renderCases);
for (const [id, layout] of [['case-list-mode','list'],['case-board-mode','board']]) $(id).addEventListener('click', () => { caseLayout = layout; $('case-list-mode').classList.toggle('active', layout === 'list'); $('case-board-mode').classList.toggle('active', layout === 'board'); $('case-list-mode').setAttribute('aria-pressed', String(layout === 'list')); $('case-board-mode').setAttribute('aria-pressed', String(layout === 'board')); renderCases(); });
async function refresh() {
  if (!token) {
    try { const result = await api('/api/auth/me'); account = result.account; renderAccount(); }
    catch { account = null; renderAccount(); try { const setup = await api('/api/auth/setup'); setAuthMode(setup.needsAccount ? 'register' : 'login'); $('auth-note').textContent = setup.needsAccount ? 'First time here? Create a Free account for this device. No invitation or payment is needed.' : setup.local ? 'Forgot the password on this device? Use the Sohken terminal tool with this same data folder to reset it.' : 'Password recovery is not configured for this hosted service yet.'; } catch { setAuthMode('login'); } $('auth-screen').hidden = false; $('pairing').hidden = true; setControls(); return; }
  }
  try { state = await api('/api/state'); $('pairing').hidden = true; render(); if (account) await loadCases(); }
  catch (error) { if (error.status === 401 && !token) { account = null; renderAccount(); showAuth('Your session ended. Sign in again.'); return; } state = null; $('connection').textContent = 'Disconnected'; $('connection').className = 'status neutral'; $('guard-label').textContent = 'ENGINE NOT CONNECTED'; $('guard-title').textContent = 'Connection needs attention.'; $('guard-description').textContent = 'Previously displayed history may be stale. Reconnect to review the current state.'; setControls(); throw error; }
}
function showAuth(message = '') { $('auth-screen').hidden = false; $('auth-status').textContent = message; $('pairing').hidden = true; $('auth-email').focus(); setControls(); }
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'register';
  $('auth-title').textContent = signup ? 'Make this space yours.' : 'Welcome back.';
  $('auth-description').textContent = signup ? 'Create an account for your private Sohken workspace.' : 'Sign in to open your protected workspace.';
  $('auth-submit').textContent = signup ? 'Create account →' : 'Sign in →';
  $('auth-password').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  $('auth-password-hint').hidden = !signup;
  $('auth-password').minLength = signup ? 12 : 1;
  $('auth-switch').textContent = signup ? 'Already have an account? Sign in' : 'New to Sohken? Create an account';
  $('auth-status').textContent = '';
}
$('auth-switch').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('auth-submit'); button.disabled = true; $('auth-status').textContent = 'Opening your workspace…';
  try {
    const result = await api(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, { email: $('auth-email').value, password: $('auth-password').value });
    account = result.account; $('auth-password').value = ''; $('auth-screen').hidden = true; await refresh(); renderAccount(); $('main').focus();
  } catch (error) { $('auth-status').textContent = errorText(error); }
  finally { button.disabled = false; }
});
$('account-button').addEventListener('click', () => { if (account) showView('connect'); else showAuth(); });
function renderAccount() {
  $('account-button').textContent = account ? `${account.planName} · ${account.email}` : 'Sign in';
  $('plan-status').textContent = account ? `${account.planName} · Local on this device` : 'Free · Local on this device';
  $('plan-title').textContent = account ? account.planName : 'Free';
  $('plan-description').textContent = account?.plan === 'plus' ? 'Full local history, history export and record checks.' : 'Text checks, reviews and your latest history.';
  $('plan-status-detail').textContent = account?.plan === 'plus' ? `Plus active${account.plusUntil ? ` until ${new Date(account.plusUntil).toLocaleDateString()}` : ''} · history stays on this device` : `25 recent events · activity stays on this device${account && !checkoutReady ? ' · Plus checkout is being set up' : ''}`;
  $('verify').textContent = account?.plan === 'plus' ? 'Check history' : 'Check history · Plus';
  $('export').textContent = account?.plan === 'plus' ? 'Save a copy ↓' : 'Save a copy · Plus';
  $('upgrade-plan').hidden = !account || account.plan === 'plus';
  $('upgrade-plan').disabled = Boolean(account && !checkoutReady);
  $('upgrade-plan').textContent = checkoutReady ? 'Get Plus · ₹199 / month' : 'Plus · checkout not ready';
  $('refresh-plan').hidden = !account;
  $('sign-out').hidden = !account;
}
async function refreshPlan() {
  if (!account) return;
  try { const result = await api('/api/billing/status'); account = result.account; checkoutReady = result.configured; renderAccount(); }
  catch (error) { notify(errorText(error)); }
}
$('refresh-plan').addEventListener('click', refreshPlan);
$('upgrade-plan').addEventListener('click', async () => {
  const button = $('upgrade-plan'); button.disabled = true;
  try { const result = await api('/api/billing/subscribe', {}); window.location.assign(result.url); }
  catch (error) { notify(errorText(error)); }
  finally { button.disabled = false; }
});
$('sign-out').addEventListener('click', async () => {
  try { await api('/api/auth/logout', {}); } catch { /* Clear this tab even if the server is unreachable. */ }
  account = null; token = ''; state = null; caseItems = []; renderCases();
  try { sessionStorage.removeItem('sohken-owner'); } catch { /* Browser storage may be disabled. */ }
  renderAccount(); showAuth('You are signed out.');
});
$('pair-form').addEventListener('submit', event => { event.preventDefault(); token = $('token').value.trim(); $('token').value = ''; try { sessionStorage.setItem('sohken-owner', token); } catch {} operation(async () => { await refresh(); notify('Sohken is connected.', true); }); });
$('refresh').addEventListener('click', () => operation(refresh));
$('disconnect').addEventListener('click', () => { token = ''; state = null; try { sessionStorage.removeItem('sohken-owner'); } catch {} $('pairing').hidden = false; $('connection').textContent = 'Disconnected'; $('connection').className = 'status neutral'; $('guard-label').textContent = 'SOHKEN NOT CONNECTED'; $('guard-title').textContent = 'Check before your agent acts.'; $('guard-description').textContent = 'Connect Sohken to review requests and control supported tools.'; ['metric-scans','metric-blocked','metric-pending','metric-executed'].forEach(id => { $(id).textContent = '—'; }); $('approval-count').textContent = '0'; ['recent-events','all-events','actions-list','scan-result'].forEach(id => empty($(id),'Sohken is disconnected','Connect to see local information.')); $('audit-result').replaceChildren(); $('audit-result').hidden = true; $('downloads-list').textContent = 'Connect Sohken to see downloads.'; setControls(); notify('This tab is disconnected.', true); });
$('pause').addEventListener('click', () => operation(async () => { await api('/api/pause', { paused: !state.paused }); await refresh(); notify(state.paused ? 'Actions are paused.' : 'Actions can run again.', true); }));
$('demo').addEventListener('click', () => operation(async () => { await api('/api/demo', {}); await refresh(); notify('Safe demo completed. Inspect the recorded decisions and pending approvals.', true); }));
$('scan-form').addEventListener('submit', event => { event.preventDefault(); operation(async () => { const result = await api('/api/scan', { text: $('scan-text').value, source: 'dashboard' }); const target = $('scan-result'); target.replaceChildren(node('span','eyebrow','CHECK RESULTS')); const score = node('div','scan-score'); score.append(node('strong','',result.score),node('span','level',result.level)); target.append(score,node('h2','',result.summary || 'Check complete'),node('p','fine-print','A simple warning score. No warning does not mean the text is safe.')); for (const finding of result.findings || []) { const item = node('div','finding'); item.append(node('span','severity',`${finding.severity}${finding.line ? ` · Line ${finding.line}` : ''}`),node('h3','',finding.title),node('p','',finding.detail)); target.append(item); } if (!result.findings?.length) target.append(node('p','muted','None of Sohken’s set warnings matched this text.')); await refresh(); }); });
$('project-audit-form').addEventListener('submit', event => { event.preventDefault(); operation(async () => {
  const report = await api('/api/project-audit', { path: $('project-path').value.trim(), onlineDependencies: $('audit-online-dependencies').checked });
  const target = $('project-audit-result'); target.replaceChildren(node('span', 'eyebrow', 'LOCAL PROJECT REPORT'));
  const dependencyStatus = report.onlineCheck === 'complete' ? `${report.dependencies.versionsFound} npm versions checked online` : report.onlineCheck === 'partial' ? `First ${report.dependencies.versionsFound} npm versions checked online (limit)` : report.onlineCheck === 'no_npm_lock_found' ? 'No npm lock file found for online check' : 'Online dependency check not requested';
  target.append(node('h2', '', `${report.project} · ${report.findings.length} finding${report.findings.length === 1 ? '' : 's'}`), node('p', 'muted', `${report.filesScanned} files checked · ${(report.bytesScanned / 1024).toFixed(1)} KB read · Rules ${report.ruleset} · ${dependencyStatus}`));
  if (report.scanTruncated || report.dependencies.truncated || report.unreadableFiles || report.unreadableDirectories || report.skippedLarge) target.append(node('p', 'fine-print', `Check incomplete: ${report.scanTruncated ? 'a folder scan limit was reached. ' : ''}${report.dependencies.truncated ? 'The npm lock has more versions than the online lookup limit. ' : ''}${report.skippedLarge ? `${report.skippedLarge} large files skipped. ` : ''}${report.unreadableFiles ? `${report.unreadableFiles} files could not be read. ` : ''}${report.unreadableDirectories ? `${report.unreadableDirectories} folders could not be read.` : ''}`));
  const counts = node('div', 'project-audit-counts'); for (const level of ['critical', 'high', 'medium', 'low', 'unknown']) counts.append(node('span', `tag audit-${level}`, `${level === 'unknown' ? 'unranked' : level}: ${report.counts[level]}`)); target.append(counts);
  if (!report.findings.length) target.append(node('p', 'muted', 'No configured warning patterns matched. This does not establish that the project is safe.'));
  for (const finding of report.findings) { const item = node('article', 'finding'); item.append(node('span', `severity severity-${finding.severity}`, `${finding.severity}${finding.line ? ` · Line ${finding.line}` : ''}`), node('h3', '', finding.title), node('code', 'audit-path', finding.file), ...(finding.package ? [node('p', 'fine-print', `${finding.package}@${finding.version}`)] : []), node('p', '', finding.recommendation)); if (finding.advisoryUrl) { const link = node('a', 'audit-advisory', finding.advisory); link.href = finding.advisoryUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); } target.append(item); }
  if (report.findingsTruncated) target.append(node('p', 'fine-print', 'The report reached its finding limit. Review the checked files with a specialist analyzer.'));
  const details = node('details', 'audit-limitations'); details.append(node('summary', '', 'What this check cannot tell you')); for (const limitation of report.limitations) details.append(node('p', 'fine-print', limitation)); target.append(details);
  const save = node('button', 'button secondary', 'Save report ↓'); save.type = 'button'; save.addEventListener('click', () => { const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `sohken-audit-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); }); target.append(save);
  await refresh();
}); });
$('action-form').addEventListener('submit', event => { event.preventDefault(); operation(async () => { await api('/api/actions', { tool: 'ticket.create', args: { title: $('ticket-title').value, body: $('ticket-body').value }, idempotencyKey: crypto.randomUUID() }); await refresh(); $('action-form').reset(); notify('Local ticket request created. Review the action above.', true); }); });
$('verify').addEventListener('click', () => operation(async () => { const result = await api('/api/audit/verify'); $('audit-result').hidden = false; $('audit-result').textContent = `${result.valid ? 'History looks unchanged' : 'History may have changed'} · ${result.count ?? '?'} entries checked${result.reason ? `\n${result.reason}` : ''}\n\nThis only checks the record on this computer.`; }));
function saveBlob(blob, name) { const url = URL.createObjectURL(blob); const link = node('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
$('export').addEventListener('click', () => operation(async () => { const result = await api('/api/export'); saveBlob(new Blob([JSON.stringify(result,null,2)], { type:'application/json' }), `sohken-history-${new Date().toISOString().slice(0,10)}.json`); notify('Your history copy is ready.',true); }));
async function loadDownloads() {
  try { const result = await api('/api/downloads'); const target = $('downloads-list'); target.replaceChildren(); if (!result.files?.length) { target.textContent = 'No packages are available in this build yet.'; return; } for (const file of result.files) { if (typeof file.url !== 'string' || !/^\/downloads\/[A-Za-z0-9._%-]+$/.test(file.url)) continue; const row = node('div','download'); const info = node('div'); info.append(node('strong','',file.name),node('small','',typeof file.size === 'number' ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Build artifact')); const button = node('button','button secondary','Download ↓'); button.addEventListener('click',()=>operation(async()=>{ button.disabled = true; try { const response = await api(file.url,undefined,true); saveBlob(await response.blob(),String(file.name).replace(/[/\\]/g,'_')); } finally { button.disabled = false; } })); row.append(info,button); target.append(row); } }
  catch(error) { $('downloads-list').textContent = `Downloads unavailable: ${errorText(error)}`; }
}
$('load-downloads').addEventListener('click',loadDownloads);
setControls();
renderAccount();
empty($('recent-events'),'Connect to see history','Sohken keeps the history on this computer.');
refresh().catch(error => notify(errorText(error)));
