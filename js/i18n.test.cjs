const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/i18n.js', 'utf8');

const dictionaries = {
  en: {title: 'Overview', search: 'Search trades', html: '<strong>Overview</strong>', rows: '{total} positions', greeting: 'Hello ${name}'},
  id: {title: 'Ringkasan', search: 'Cari transaksi', html: '<strong>Ringkasan</strong>', rows: '{total} posisi', greeting: 'Halo ${name}'},
  ar: {title: 'نظرة عامة', search: 'البحث عن الصفقات', html: '<strong>نظرة عامة</strong>', rows: '{total} صفقات', greeting: 'مرحبا ${name}'}
};
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
};
const response = (value, ok = true) => ({ok, json: async () => value});

function harness(saved = '') {
  const storage = new Map(saved ? [['fncjt_language', saved]] : []);
  const events = [], calls = [], pending = new Map(), failures = new Set();
  const element = (attributes = {}, data = {}) => ({
    isConnected: true, dataset: data, innerHTML: 'Overview', attributes: {...attributes},
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const parent = {closest: () => null};
  const staticText = {textContent: '  Overview  ', parentElement: parent, isConnected: true};
  const changedByApp = {textContent: 'Overview', parentElement: parent, isConnected: true};
  const excluded = {textContent: 'Overview', parentElement: {closest: () => ({})}, isConnected: true};
  const initialNodes = [staticText, changedByApp, excluded];
  const tagged = element({}, {i18n: 'html'});
  const search = element({placeholder: 'Search trades', 'aria-label': 'Search trades'});
  const changedAttribute = element({title: 'Overview'});
  const dynamicNote = {textContent: 'Overview', parentElement: parent, isConnected: true};
  const document = {
    currentScript: {src: 'https://example.test/js/i18n.js'}, body: {}, documentElement: {lang: '', dir: ''},
    createTreeWalker() {
      let index = -1;
      return {currentNode: null, nextNode() { this.currentNode = initialNodes[++index]; return Boolean(this.currentNode); }};
    },
    querySelectorAll(selector) { return selector === '[data-i18n]' ? [tagged] : [search, changedAttribute]; },
    dispatchEvent(event) { events.push(event.detail.language); }
  };
  const catalog = {default: 'en', languages: [
    {code: 'en', available: true, direction: 'ltr'},
    {code: 'id', available: true, direction: 'ltr'},
    {code: 'ar', available: true, direction: 'rtl'},
    {code: 'pending', available: false, direction: 'ltr'}
  ], countries: {ID: ['id'], SA: ['ar']}};
  const context = {
    document, URL, NodeFilter: {SHOW_TEXT: 4},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
    fetch: async url => {
      const name = String(url).match(/([^/]+)\.json$/)[1];
      calls.push(name);
      if (pending.has(name)) return pending.get(name).promise;
      if (failures.has(name)) return response(null, false);
      return response(name === 'lookup' ? {'Overview': 'title', 'Search trades': 'search'} : name === 'catalog' ? catalog : dictionaries[name]);
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  changedByApp.textContent = 'User note: <script>private</script>';
  changedAttribute.setAttribute('title', 'User-provided title');
  return {api: context.JTI18n, storage, events, calls, pending, failures, document, staticText, changedByApp, excluded, tagged, search, changedAttribute, dynamicNote};
}

(async () => {
  const initial = harness();
  await initial.api.ready;
  assert.equal(initial.api.language, 'en');
  assert.equal(initial.api.locale, 'en-GB');
  assert.equal(initial.document.documentElement.lang, 'en');
  assert.equal(initial.storage.get('fncjt_language'), 'en');
  assert.equal(initial.api.key('rows', '', {total: 7}), '7 positions');
  assert.equal(initial.api.key('missing', 'Fallback {value}', {value: 9}), 'Fallback 9');

  await initial.api.setLanguage('ar');
  assert.equal(initial.api.direction, 'rtl');
  assert.equal(initial.document.documentElement.dir, 'rtl');
  assert.equal(initial.staticText.textContent, '  نظرة عامة  ');
  assert.equal(initial.search.getAttribute('placeholder'), 'البحث عن الصفقات');
  assert.equal(initial.search.getAttribute('aria-label'), 'البحث عن الصفقات');
  assert.equal(initial.tagged.innerHTML, '<strong>نظرة عامة</strong>', 'Static tagged copy lost its markup');
  assert.equal(initial.changedByApp.textContent, 'User note: <script>private</script>');
  assert.equal(initial.changedAttribute.getAttribute('title'), 'User-provided title');
  assert.equal(initial.excluded.textContent, 'Overview');
  assert.equal(initial.dynamicNote.textContent, 'Overview', 'Dynamically added user/news content must remain untouched');
  assert.equal(initial.api.text('private user note', 'private user note'), 'private user note');
  assert.equal(initial.api.text('Hello ${name}', 'Hello Alice <b>& $&'), 'مرحبا Alice <b>& $&', 'Template values must be preserved verbatim');

  await initial.api.setLanguage('pending');
  assert.equal(initial.api.language, 'en');
  assert.ok(!initial.calls.includes('pending'), 'Unavailable languages must not be fetched');
  assert.equal(initial.staticText.textContent, '  Overview  ');

  const savedFailure = harness('id');
  savedFailure.failures.add('id');
  await savedFailure.api.ready;
  assert.equal(savedFailure.api.language, 'en', 'Failed saved language must recover using already loaded English');
  assert.equal(savedFailure.storage.get('fncjt_language'), 'en');
  assert.ok(savedFailure.api.languages.length > 0, 'Language catalog must remain available after startup recovery');
  await assert.rejects(savedFailure.api.setLanguage('id'), /Language file unavailable/);
  assert.equal(savedFailure.api.language, 'en', 'A failed explicit change must retain the current language');
  savedFailure.failures.delete('id');
  await savedFailure.api.setLanguage('id');
  assert.equal(savedFailure.api.language, 'id', 'Failed requests must be evicted so a retry can succeed');
  assert.equal(savedFailure.api.key('rows', '', {total: 3}), '3 posisi');

  const race = harness();
  await race.api.ready;
  const slow = deferred();
  race.pending.set('id', slow);
  const older = race.api.setLanguage('id');
  const newer = race.api.setLanguage('ar');
  assert.equal(await newer, true);
  slow.resolve(response(dictionaries.id));
  assert.equal(await older, false, 'A stale language response must not overwrite a later selection');
  assert.equal(race.api.language, 'ar');
  assert.equal(race.storage.get('fncjt_language'), 'ar');
  assert.equal(race.events.join(','), 'en,ar');
  console.log('Language default, failure recovery, retry, races, markup, interpolation and user-content preservation passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
