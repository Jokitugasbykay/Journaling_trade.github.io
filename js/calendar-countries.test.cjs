const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/app.js', 'utf8');
const helper = source.slice(source.indexOf('      function kalCountryCode('), source.indexOf('      const kalCategories ='));
const storage = new Map();
function reopen() {
  return vm.runInNewContext('let kalCountries, kalCache = null;\n' + helper + '\n({readKalCountries, setKalCountries})', {
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)}
  });
}
const selected = () => JSON.parse(JSON.stringify(reopen().readKalCountries()));
assert.deepEqual(selected(), ['US']);
for (const countries of [['US', 'GB', 'JP'], [], null, ['US']]) {
  reopen().setKalCountries(countries);
  assert.deepEqual(selected(), countries);
}
for (const invalid of ['broken JSON', '"US"', '["ZZ"]']) {
  storage.set('fncjt_calendar_countries', invalid);
  assert.deepEqual(selected(), ['US']);
}
console.log('Calendar country persistence checks passed');
