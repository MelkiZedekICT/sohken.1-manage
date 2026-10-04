const rules = [
  { pattern: /ignore (?:all |any )?(?:earlier|previous|prior) instructions/i, label: 'It tries to replace earlier instructions.' },
  { pattern: /(?:private key|password|secret|api key|credential)/i, label: 'It may contain or request private information.' },
  { pattern: /(?:send|upload|post|share).{0,60}(?:outside|external|remote|webhook)/i, label: 'It may send information outside your computer.' },
  { pattern: /(?:delete everything|remove all|format disk|rm\s+-rf)/i, label: 'It may ask for a harmful action.' },
];

export function inspectText(text) {
  return rules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.label);
}
