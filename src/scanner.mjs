import { createHash } from 'node:crypto';

export const MAX_TEXT = 65536;
const rules = [
  { id:'credential-private-key', severity:'critical', title:'Private key material', pattern:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, detail:'Keep private keys out of agent context and tool outputs.' },
  { id:'credential-api-key', severity:'critical', title:'Possible API credential', pattern:/\b(?:sk-[a-zA-Z0-9_-]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})\b/, detail:'A credential-like value was detected. Rotate real exposed credentials and remove them from shared context.' },
  { id:'credential-assignment', severity:'high', title:'Potential embedded secret', pattern:/(?:api[_ -]?key|password|secret|access[_ -]?token)\s*[:=]\s*["']?[^\s"',;]{6,}/i, detail:'A secret-looking assignment may expose authentication material.' },
  { id:'instruction-override', severity:'high', title:'Instruction override attempt', pattern:/(?:ignore|disregard|forget|override)\s+(?:(?:all|the|your|any)\s+)?(?:previous|prior|system|safety|security|earlier)\s+(?:instructions|prompts|rules|policy|policies)/i, detail:'This text asks an agent to change its instruction hierarchy. Treat retrieved content as data, not authority.' },
  { id:'authority-spoof', severity:'high', title:'Possible authority impersonation', pattern:/(?:\[\s*(?:system|developer)\s*\]|<\/?(?:system|developer)>|you are now (?:the administrator|in developer mode)|system override)/i, detail:'Role-like markers can impersonate higher-priority instructions inside ordinary content.' },
  { id:'data-exfiltration', severity:'high', title:'Sensitive data transfer request', pattern:/(?:send|upload|post|transmit|exfiltrate|forward).{0,90}(?:secret|password|api.?key|private.?key|credentials|private (?:data|repo))/i, detail:'The text combines a transfer instruction with sensitive information. Verify both authority and destination.' },
  { id:'approval-bypass', severity:'high', title:'Approval bypass request', pattern:/(?:without|skip|bypass|disable).{0,35}(?:approval|confirmation|permission|security checks)/i, detail:'Approval cannot be granted by tool output or by the requesting agent.' },
  { id:'destructive-command', severity:'high', title:'Potentially destructive operation', pattern:/(?:\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r|\bdrop\s+(?:table|database)\b|\bRemove-Item\b.{0,80}-Recurse|\bformat\s+[a-z]:)/i, detail:'A destructive operation appears in the content. This is a signal for review, not proof it would execute.' },
  { id:'download-execute', severity:'high', title:'Download-and-execute pattern', pattern:/(?:curl|wget).{0,180}\|\s*(?:ba)?sh\b|\b(?:iex|Invoke-Expression)\b.{0,80}\b(?:irm|Invoke-RestMethod)\b/i, detail:'Executing downloaded content can introduce unreviewed code. Inspect it before granting execution.' },
  { id:'encoded-instructions', severity:'medium', title:'Encoded instruction pattern', pattern:/(?:base64|atob|frombase64string).{0,80}(?:exec|eval|decode|instruction)|(?:exec|eval).{0,80}(?:base64|atob)/i, detail:'Encoding can conceal executable content or instructions from a superficial review.' }
];

export function redact(text) {
  return String(text)
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|$)/gi,'[REDACTED PRIVATE KEY]')
    .replace(/\b(?:sk-[a-zA-Z0-9_-]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})\b/g,'[REDACTED CREDENTIAL]')
    .replace(/((?:api[_ -]?key|password|secret|access[_ -]?token)\s*[:=]\s*)["']?[^\s"',;]{6,}["']?/gi,'$1[REDACTED]');
}
export function redactValue(value) {
  if(typeof value==='string') return redact(value);
  if(Array.isArray(value)) return value.map(redactValue);
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/^(?:password|secret|token|apiKey|authorization)$/i.test(k)?'[REDACTED]':redactValue(v)]));
  return value;
}
export function scanText(text) {
  if(typeof text!=='string' || !text.trim()) throw new Error('Enter some text to scan.');
  if(Buffer.byteLength(text,'utf8')>MAX_TEXT) throw new Error('Text exceeds the 64 KB scan limit.');
  const findings=[];
  for(const r of rules) {
    const match=r.pattern.exec(text);
    if(match) findings.push({rule:r.id,severity:r.severity,title:r.title,detail:r.detail,line:text.slice(0,match.index).split('\n').length});
  }
  const score=Math.min(100,findings.reduce((s,f)=>s+({critical:70,high:35,medium:15}[f.severity]),0));
  return {score,level:score>=70?'critical':score>=35?'high':score>0?'medium':'low',findings,
    summary:findings.length?`${findings.length} review signal${findings.length===1?'':'s'} found. Check context before acting.`:'No known patterns detected. This does not establish that the content is safe.',
    bytes:Buffer.byteLength(text),fingerprint:createHash('sha256').update(text).digest('hex')};
}
