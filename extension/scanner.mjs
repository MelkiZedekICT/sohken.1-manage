export const MAX_BYTES = 64000;
const rules = [
  {rule:'instruction-override',severity:'high',title:'Instruction override language',detail:'This text asks a recipient to disregard prior instructions. Review its origin and intended authority.',test:/\b(?:ignore|disregard|forget|override)\b.{0,45}\b(?:previous|prior|system|developer|all)\b.{0,25}\b(?:instructions?|prompts?|rules?)\b/i},
  {rule:'secret-request',severity:'high',title:'Possible request to disclose credentials',detail:'The text combines disclosure language with credential names. Do not share secrets without checking the destination and authorization.',test:/\b(?:send|upload|reveal|print|exfiltrate|share)\b.{0,100}\b(?:api[ _-]?keys?|passwords?|tokens?|credentials?|secrets?)\b/i},
  {rule:'credential-pattern',severity:'high',title:'Possible embedded credential',detail:'A string resembles a private credential. This heuristic cannot establish whether it is real or active.',test:/(?:\b(?:sk|ghp|github_pat)[_-][A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[A-Z0-9]{16}\b)/},
  {rule:'destructive-command',severity:'high',title:'Destructive command pattern',detail:'A command resembles recursive deletion or disk formatting. Inspect the target and require explicit authorization before execution.',test:/(?:\brm\s+(?:-[a-zA-Z]*[rf][a-zA-Z]*\s+){1,2}|\bRemove-Item\b.*-Recurse|\bformat\s+[a-z]:|\bmkfs(?:\.|\s))/i},
  {rule:'remote-execution',severity:'medium',title:'Download-and-execute pattern',detail:'The text resembles a command that executes downloaded content. Inspect the content and source before running it.',test:/(?:\b(?:curl|wget)\b.{0,180}\|\s*(?:sh|bash|zsh|powershell)|\b(?:iex|Invoke-Expression)\b.{0,100}\b(?:DownloadString|iwr|Invoke-WebRequest)\b)/i},
  {rule:'authority-claim',severity:'medium',title:'Claim of elevated authority',detail:'The content claims system or developer authority. A claim inside a page is not an authenticated permission grant.',test:/(?:\[(?:SYSTEM|DEVELOPER)\]|<\|(?:system|developer)\|>|\byou are now (?:the )?(?:system|administrator|root)\b)/i}
];
export function limitText(value) {
  const bytes = new TextEncoder().encode(String(value));
  if (bytes.length <= MAX_BYTES) return {text:String(value),truncated:false};
  return {text:new TextDecoder().decode(bytes.slice(0,MAX_BYTES)).replace(/\uFFFD$/,''),truncated:true};
}
export function scanText(value) {
  const {text,truncated} = limitText(value);
  const findings = [];
  for (const [index,line] of text.split(/\r?\n/).entries()) {
    for (const rule of rules) if (rule.test.test(line)) findings.push({rule:rule.rule,severity:rule.severity,title:rule.title,detail:rule.detail,line:index+1});
    if (findings.length >= 100) break;
  }
  const score = Math.min(100,findings.reduce((n,f)=>n+(f.severity==='high'?35:15),0));
  return {score,level:score>=35?'high':score?'medium':'low',findings:findings.slice(0,100),truncated,summary:findings.length?'Review these indicators before giving an agent access.':'No configured indicators matched. This is not proof of safety.'};
}
