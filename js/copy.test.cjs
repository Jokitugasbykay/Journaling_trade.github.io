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
for (const file of ['index.html', 'js/app.js', 'js/scan.js', 'berita.json', 'kalender.json']) {
  const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.ok(!/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(content), file);
}
console.log('UI text and incoming emoji checks passed');

const matchesSearch = vm.runInNewContext(source.slice(source.indexOf('      function newsMatchesSearch('), source.indexOf('      function updateNewsSearch(')) + '\nnewsMatchesSearch');
assert.ok(matchesSearch({title:'Fed weighs inflation data'}, 'Reuters', '  REUTERS inflation  '));
assert.ok(matchesSearch({title:'Café prices rise'}, 'Reuters', 'cafe'));
assert.ok(matchesSearch({title:'Fed weighs inflation data'}, 'Reuters', ''));
assert.ok(!matchesSearch({title:'Fed weighs inflation data'}, 'Reuters', 'fed oil'));
assert.ok(!matchesSearch({title:'Fed weighs inflation data'}, 'Reuters', '<script>'));
console.log('News search matches archive headlines and publishers without case/spacing/accent sensitivity');

const guideStart = source.indexOf('      Object.assign(englishCopy,');
const guideEnd = source.indexOf("      document.querySelectorAll('[data-i18n]')", guideStart);
const guideCopy = vm.runInNewContext('const englishCopy = {};\n' + source.slice(guideStart, guideEnd) + '\nenglishCopy');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const match of html.matchAll(/data-i18n="(guide[^"]+)"/g)) assert.ok(guideCopy[match[1]], match[1]);
assert.ok(!html.includes('class="learning-sources"'));
console.log('English guide coverage passed');

(async () => {
  const nodes = new Map();
  const data = {version:1, fx:{source:'https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/default.aspx', currency:'USD', unit:1, sell:17999.55, buy:17820.45, date:'2026-10-07', status:'ok'}};
  const context = {language:'en', settings:{kurs:100}, esc:escape, AbortSignal,
    $: id => { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); },
    fetch: async () => ({ok:true, json:async () => data}), saveData() {}, renderJournalTable() {}, renderStatistics() {}, runAllCalculators() {}};
  context.window = context;
  vm.runInNewContext(source.slice(source.indexOf('      let exchangeBusy = false;'), source.indexOf('      /* Formatting Helpers */')), context);
  await context.refreshExchangeRate();
  assert.equal(context.settings.kurs, 17910);
  assert.equal(nodes.get('p-kurs-input').value, 17910);
  data.fx.buy = 20000;
  await context.refreshExchangeRate();
  assert.equal(context.settings.kurs, 17910, 'Invalid BI quote changed the journal rate');
  assert.ok(nodes.get('exchange-status').textContent.includes('unavailable'));
  console.log('BI midpoint conversion and invalid quote rejection passed');
})().catch(error => { console.error(error); process.exitCode = 1; });

// News navigation mounts one real market widget and rejects removed social views.
{
  const ticker = { script: null, querySelector() { return this.script; }, replaceChildren(widget) { this.widget = widget; }, appendChild(script) { this.script = script; } };
  const nodes = new Map([['market-ticker', ticker], ['sub-berita-ringkasan', {}], ['sub-berita-kalender', {}]]);
  const buttons = ['ringkasan', 'kalender'].map(sub => ({ dataset: { sub }, classList: { toggle() {} } }));
  let newsAllowed = true;
  let chartSymbol;
  const context = { canReadNews: () => newsAllowed, renderNewsRegionControls() {}, detectNewsRegion() {}, $: id => nodes.get(id),
    document: { querySelectorAll: () => buttons, createElement: () => ({attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(type, listener) { this.listener = listener; }}) },
    openTradingView(symbol) { chartSymbol = symbol; }, renderPublisherNews() {}, renderEconomicCalendar() {}, pagePath: route => '/' + route + '/',
    location: { pathname: '/economic-news/' }, history: { pushState() {} } };
  context.window = context;
  vm.runInNewContext(source.slice(source.indexOf('      window.switchBeritaSub ='), source.indexOf('      function restoreRoute()')), context);
  context.switchBeritaSub('ringkasan');
  const script = ticker.script;
  assert.equal(script.type, 'module');
  assert.equal(script.src, 'https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js');
  assert.equal(ticker.widget.attributes.theme, 'dark');
  let prevented = false;
  ticker.widget.listener({preventDefault() { prevented = true; }, detail: {context: {symbol: 'FX:GBPUSD'}}});
  assert.ok(prevented);
  assert.equal(chartSymbol, 'FX:GBPUSD');
  ticker.widget.listener({preventDefault() {}, detail: {context: {symbol: 'javascript:alert(1)'}}});
  assert.equal(chartSymbol, 'FX:GBPUSD');
  assert.ok(html.indexOf('id="bi-indicators"') < html.indexOf('id="market-ticker"'));
  context.switchBeritaSub('kalender');
  assert.equal(ticker.script, script, 'Navigation duplicated the ticker');
  assert.equal(nodes.get('sub-berita-ringkasan').hidden, true);
  context.switchBeritaSub('sosial');
  assert.equal(nodes.get('sub-berita-kalender').hidden, false);
  newsAllowed = false;
  context.switchBeritaSub('ringkasan');
  assert.equal(nodes.get('sub-berita-kalender').hidden, false);
  assert.ok(!html.includes('sub-berita-sosial'));
  console.log('News tabs, access guard and ticker mounting passed');
}
