const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const line = source.split('\n').find(line => line.includes('const esc ='));
const escape = vm.runInNewContext(line + '\nesc');
assert.equal(escape('Hello \u{1F600} <script>'), 'Hello  &lt;script&gt;');
assert.equal(escape('USD/IDR +1.5%'), 'USD/IDR +1.5%');
assert.equal(escape('\u{1F1EE}\u{1F1E9}'), '');
for (const file of ['index.html', 'js/app.js', 'js/scan.js', 'analisa.json', 'berita.json', 'kalender.json']) {
  const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.ok(!/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(content), file);
}
console.log('UI text and incoming emoji checks passed');
