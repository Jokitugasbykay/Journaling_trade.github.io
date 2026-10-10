const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/app.js', 'utf8');
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, {
    value: '', options: [], style: {}, attributes: {}, innerHTML: '',
    classList: { toggle() {}, remove() {}, add() {} },
    setAttribute(key, value) { this.attributes[key] = value; }
  });
  return nodes.get(id);
};
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const context = {
  $: node, document: {querySelectorAll: () => []}, language: 'en', console, uiText: (_id,en) => en,
  profile: {currentAccount: 'a'}, settings: {kurs: 17000}, esc,
  safeId: value => value.replace(/[^a-z0-9-]/gi, ''),
  computeTradeMetrics: trade => ({pnlUSD: trade.pnl, pnlIDR: trade.pnl * 17000, rr: 2, riskUSD: 10}),
  fmtPLUSD: value => '$' + value.toFixed(2), fmtPLIDR: value => 'Rp' + value,
  fmtUSD: value => '$' + value.toFixed(2),
  trades: [
    {id: 'a-win', accountId: 'a', market: 'EURUSD', result: 'Win', pnl: 100, strategy: 'Breakout', reason: '<script>alert(1)</script>', date: '2026-10-10', jam: '09:00'},
    {id: 'a-loss', accountId: 'a', market: 'XAUUSD', result: 'Loss', pnl: -1, strategy: 'Pullback'},
    {id: 'b-win', accountId: 'b', market: 'BTCUSD', result: 'Win', pnl: 1000, strategy: 'Other account'}
  ]
};
context.window = context;
vm.runInNewContext(source.slice(source.indexOf('      function updateFilterOptions()'), source.indexOf('      /* Upload jurnal trade engine')), context);
context.renderJournalTable();
assert.equal(node('j-stat-total').textContent, '2');
assert.equal(node('j-stat-winrate').textContent, '50.0%');
assert.equal(node('j-stat-netpl').textContent, '$99.00');
assert.equal(node('j-stat-pf').textContent, '100.00', 'Finite profit factor was incorrectly shown as infinity');
assert.equal(node('journal-row-count').textContent, 'Showing 2 of 2 positions');
assert.equal((node('journal-tbody').innerHTML.match(/<td(?:\s|>)/g) || []).length, 28, 'Header/body columns no longer align');
assert.ok(!node('journal-tbody').innerHTML.includes('BTCUSD'));
assert.ok(!node('filter-market').innerHTML.includes('BTCUSD'));
assert.ok(!node('filter-strategy').innerHTML.includes('Other account'));
assert.ok(node('journal-tbody').innerHTML.includes('&lt;script&gt;'));
assert.ok(!node('journal-tbody').innerHTML.includes('<script>'));
assert.equal(node('j-bar-win').style.flexGrow, 1);
assert.equal(node('j-bar-be').hidden, true);
context.setResultFilter('Loss', node('chip-filter-loss'));
assert.equal(node('journal-row-count').textContent, 'Showing 1 of 2 positions');
assert.equal(node('chip-filter-loss').attributes['aria-pressed'], 'true');
assert.equal(node('chip-filter-all').attributes['aria-pressed'], 'false');
assert.ok(!node('journal-tbody').innerHTML.includes('EURUSD'));
context.resetJournalFilters();
assert.equal(node('journal-row-count').textContent, 'Showing 2 of 2 positions');
context.profile.currentAccount = 'b';
context.renderJournalTable();
assert.equal(node('j-stat-total').textContent, '1');
assert.equal(node('j-stat-winrate').textContent, '100.0%');
assert.equal(node('j-stat-pf').textContent, '∞');
assert.ok(!node('journal-tbody').innerHTML.includes('EURUSD'));
context.profile.currentAccount = 'empty';
context.renderJournalTable();
assert.equal(node('journal-empty-msg').style.display, 'block');
assert.equal(node('journal-row-count').textContent, 'Showing 0 of 0 positions');
assert.equal(node('journal-tbody').innerHTML, '');
console.log('Journal account isolation, metrics, filters, accessibility state and escaped notes passed');
