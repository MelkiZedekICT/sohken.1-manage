import {scanText,limitText} from './scanner.mjs';
const $ = id => document.getElementById(id);
let token = '';
const status = message => { $('status').textContent = message; };
const agentToken = value => /^sohken_agent_[A-Za-z0-9_-]{20,}$/.test(value);
function render(result,origin) {
  $('result').hidden=false;
  $('level').textContent=String(result.level || 'unknown').toUpperCase();
  $('summary').textContent=String(result.summary || 'Inspect the findings below.');
  $('findings').replaceChildren();
  for (const finding of (Array.isArray(result.findings)?result.findings:[]).slice(0,100)) {
    const li=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('p'),meta=document.createElement('small');
    title.textContent=String(finding.title || finding.rule || 'Indicator');
    detail.textContent=String(finding.detail || '');
    meta.textContent=`${String(finding.severity || 'review').toUpperCase()} · Line ${Number(finding.line)||1}`;
    li.append(title,detail,meta);$('findings').append(li);
  }
  status(`${origin} scan complete.${result.truncated?' Only the first 64 KB was checked.':''}`);
}
try {
  // Session storage is not exposed to content scripts by default. Never use local/sync storage for credentials.
  const stored=await chrome.storage.session.get('agentToken');
  if (agentToken(stored.agentToken || '')) {token=stored.agentToken;status('Paired for this browser session. Local-engine scanning is off until selected.');}
} catch {status('Session storage unavailable. Pairing will last only while this popup is open.');}
$('pair').addEventListener('click',async()=>{
  const candidate=$('token').value.trim();$('token').value='';
  if (!agentToken(candidate)) {status('Use a Sohken agent token beginning sohken_agent_. Owner tokens are not accepted.');return;}
  token=candidate;
  try {await chrome.storage.session.set({agentToken:token});status('Agent token saved for this browser session. Enable local-engine scanning when ready.');}
  catch {status('Agent token paired for this popup only; browser session storage is unavailable.');}
});
$('forget').addEventListener('click',async()=>{
  token='';$('token').value='';$('remote').checked=false;
  try {await chrome.storage.session.remove('agentToken');}catch{}
  status('Disconnected. Scans run inside the extension.');
});
$('scan').addEventListener('click',async()=>{
  const bounded=limitText($('content').value);
  if (!bounded.text.trim()) {status('Paste text or capture a page before scanning.');return;}
  $('scan').disabled=true;
  try {
    if (!$('remote').checked) {render(scanText($('content').value),'Extension-only');return;}
    if (!agentToken(token)) {status('Pair with an agent token before sending text to the local engine.');return;}
    status('Sending the displayed text to your local Sohken engine…');
    const response=await fetch('http://127.0.0.1:4317/api/scan',{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({text:bounded.text,source:'browser-extension'}),signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error(`Local engine returned ${response.status}. Check that it is running and the agent token is valid.`);
    const result=await response.json();render({...result,truncated:bounded.truncated},'Local-engine');
  } catch(error) {status(error.name==='TimeoutError'?'Local engine timed out. You can turn off local-engine scanning and retry.':`Scan failed. ${error.message}`);}
  finally {$('scan').disabled=false;}
});
$('page').addEventListener('click',async()=>{
  $('page').disabled=true;
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id) throw new Error('No active tab is available.');
    const [capture]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
      const excluded='input,textarea,select,option,button,script,style,noscript,iframe,[contenteditable], [hidden], [aria-hidden="true"]';
      const blocked=node=>{const element=node?.nodeType===1?node:node?.parentElement;return !element || Boolean(element.closest(excluded));};
      const selection=window.getSelection();
      if (selection && !selection.isCollapsed && !blocked(selection.anchorNode) && !blocked(selection.focusNode)) {
        // Clone the selection and remove controls so a range spanning a form does not include its values.
        const container=document.createElement('div');
        for (let i=0;i<selection.rangeCount;i++) container.append(selection.getRangeAt(i).cloneContents());
        container.querySelectorAll(excluded).forEach(node=>node.remove());
        const selected=(container.textContent||'').slice(0,64000);
        return {text:selected,kind:'selection',limited:selected.length>=64000};
      }
      const walker=document.createTreeWalker(document.body || document.documentElement,NodeFilter.SHOW_TEXT);
      let text='',node,visited=0;
      while ((node=walker.nextNode()) && visited++<30000 && text.length<64000) {
        if (blocked(node) || !node.textContent.trim()) continue;
        const element=node.parentElement,style=getComputedStyle(element);
        if (style.display==='none'||style.visibility!=='visible'||!element.getClientRects().length) continue;
        text+=node.textContent.trim()+'\n';
      }
      return {text:text.slice(0,64000),kind:'visible page text',limited:text.length>=64000||visited>=30000};
    }});
    if (!capture?.result?.text?.trim()) throw new Error('No readable text was found. Paste the text manually.');
    const bounded=limitText(capture.result.text);$('content').value=bounded.text;$('result').hidden=true;
    status(`Captured ${capture.result.kind}${bounded.truncated||capture.result.limited?' (limited excerpt)':''}. Review the text, then click Scan text. Nothing has been sent.`);
  } catch {status('This page cannot be read, or has no readable text. Browser settings, store pages, and some PDFs are restricted. Paste text manually.');}
  finally {$('page').disabled=false;}
});
