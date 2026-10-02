import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const script = readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

test('public page assets resolve as a static site', () => {
  assert.match(html, /href="\.\/src\/styles\.css"/);
  assert.match(html, /src="\.\/src\/main\.js"/);
  assert.ok(existsSync(path.join(root, 'src', 'styles.css')));
  assert.ok(existsSync(path.join(root, 'src', 'check.js')));
  assert.match(html, /github\.com\/MelkiZedekICT\/sohken\.1-manage\/releases/);
});

test('public page has no account, email collection, payment or service API', () => {
  assert.doesNotMatch(html, /<form\b|type="email"|api\/join|api\/leave|Join the list/i);
  assert.doesNotMatch(script, /fetch\s*\(|XMLHttpRequest|innerHTML|@appdeploy/);
  assert.match(html, /Plus checkout is not available/);
  assert.match(html, /does not control arbitrary agent tools/);
});
