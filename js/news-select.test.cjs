const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/news-select.js', 'utf8');

function harness(popovers = true) {
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
      this.listeners = new Map(); this.dataset = {}; this.style = {}; this.value = ''; this.textContent = '';
      this.classes = new Set(); this.classList = {toggle:(name, enabled)=>enabled ? this.classes.add(name) : this.classes.delete(name)};
    }
    set innerHTML(html) {
      this.html = html;
      if (this.tagName === 'BUTTON') this.append(new Element('span'));
      else { this.append(new Element('input'), new Element('div'), new Element('p')); this.children[1].setAttribute('role', 'listbox'); }
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    after(...children) { this.siblings = children; }
    replaceChildren() { this.children = []; }
    querySelector(selector) { return this.children.find(child=>selector === '[role="listbox"]' ? child.getAttribute('role') === 'listbox' : child.tagName.toLowerCase() === selector); }
    addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(callback); }
    dispatchEvent(event) { for (const callback of this.listeners.get(event.type) || []) callback(event); return true; }
    matches() { return !!this.open; }
    contains(node) { return node === this || this.children.some(child=>child.contains(node)); }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    getBoundingClientRect() { return {width:220, left:20, top:100, bottom:140}; }
  }
  if (popovers) {
    Element.prototype.showPopover = function () {
      if (this.open) return;
      this.dispatchEvent({type:'beforetoggle',newState:'open'}); this.open = true; this.dispatchEvent({type:'toggle'});
    };
    Element.prototype.hidePopover = function () { this.open = false; this.dispatchEvent({type:'toggle'}); };
  }
  const nodes = new Map(), labels = new Map();
  nodes.set('news-content', Object.assign(new Element(), {hidden:false}));
  document = {documentElement:{lang:'en'}, body:new Element('body'), activeElement:null, getElementById:id=>nodes.get(id),
    querySelector:selector=>labels.get(selector), createElement:tag=>new Element(tag)};
  function option(value, text, parent, props = {}) { return Object.assign(new Element('option'), {value, textContent:text, parentElement:parent}, props); }
  for (const id of ['news-region', 'news-source']) {
    const select = new Element('select'), group = new Element('optgroup'), disabledGroup = new Element('optgroup');
    group.label = id === 'news-region' ? 'Countries' : 'Publishers'; disabledGroup.label = 'Locked'; disabledGroup.disabled = true;
    select.options = [option('all', 'All sources', select), option('cafe', 'Café News', group),
      option('bbc', 'BBC News', group), option('html', '<img src=x onerror=alert(1)>', group),
      option('locked', 'Locked region', group, {disabled:true}), option('group-locked', 'Locked publisher', disabledGroup),
      option('hidden', 'Hidden publisher', group, {hidden:true})];
    select.value = 'all'; Object.defineProperty(select, 'selectedOptions', {get:()=>select.options.filter(item=>item.value === select.value)});
    select.setAttribute('aria-describedby', id + '-help'); nodes.set(id, select);
    labels.set('label[for="' + id + '"]', Object.assign(new Element('label'), {textContent:id === 'news-region' ? 'News region' : 'News source'}));
  }
  const microtasks = [], context = {document, HTMLElement:Element, Event, innerHeight:800, innerWidth:400,
    queueMicrotask:callback=>microtasks.push(callback), addEventListener(){}};
  context.window = context; vm.runInNewContext(source, context);
  const flush = ()=>{ while (microtasks.length) microtasks.shift()(); };
  function control(id) {
    const select = nodes.get(id), [trigger, panel] = select.siblings || [];
    const input = panel?.querySelector('input'), list = panel?.querySelector('[role="listbox"]'), empty = panel?.querySelector('p');
    return {select, trigger, panel, input, list, empty,
      rows:()=>list.children.filter(child=>child.getAttribute('role') === 'option'),
      open:()=>{ panel.showPopover(); flush(); },
      search:value=>{ input.value = value; input.dispatchEvent({type:'input'}); },
      key:(target, key)=>{ const event = {type:'keydown',key,preventDefault(){this.prevented = true;}}; target.dispatchEvent(event); flush(); return event; }};
  }
  return {document,context,control,flush};
}

for (const id of ['news-region', 'news-source']) {
  const h = harness(), c = h.control(id); let changes = 0;
  c.select.addEventListener('change', ()=>changes++);
  assert.equal(c.select.hidden, true);
  assert.equal(c.trigger.getAttribute('aria-describedby'), id + '-help');
  c.open(); assert.equal(h.document.activeElement, c.input);
  c.list.scrollTop = 200; c.panel.hidePopover(); c.open();
  assert.equal(c.list.scrollTop, 0, 'Opening the menu must show Quick access instead of retaining an old scroll position');
  assert.equal(c.trigger.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(c.rows().map(row=>row.dataset.value), ['all', 'cafe', 'bbc', 'html'], 'Hidden and locked options must not be selectable');
  // During mouse focus transfer activeElement may temporarily be body before the option receives focus.
  h.document.activeElement = h.document.body;
  c.panel.dispatchEvent({type:'focusout',relatedTarget:c.rows()[1]}); h.flush();
  assert.equal(c.panel.open, true, 'Focus moving to an option must not close the menu before its click');
  c.panel.dispatchEvent({type:'focusout',relatedTarget:null}); h.flush();
  assert.equal(c.panel.open, true, 'An unknown focus destination must not prematurely close the menu');
  c.panel.dispatchEvent({type:'focusout',relatedTarget:c.trigger}); h.flush();
  assert.equal(c.panel.open, true, 'Focus returning to the trigger must not close the menu prematurely');
  c.panel.dispatchEvent({type:'focusout',relatedTarget:h.document.body}); h.flush();
  assert.equal(c.panel.open, false, 'Focus moving outside the dropdown must close it');
  assert.equal(changes, 0, 'Focus transfers must not change the selected value');
  c.open();
  c.rows().find(row=>row.dataset.value === 'cafe').dispatchEvent({type:'click'});
  assert.equal(c.select.value, 'cafe'); assert.equal(changes, 1, 'A selection must dispatch exactly one backing select change');
  assert.equal(c.trigger.querySelector('span').textContent, 'Café News');
  assert.equal(c.trigger.getAttribute('aria-expanded'), 'false'); assert.equal(h.document.activeElement, c.trigger);

  c.open(); c.search('CAFE');
  assert.deepEqual(c.rows().map(row=>row.dataset.value), ['cafe'], 'Search must ignore accents and case');
  c.search('not a publisher'); assert.equal(c.empty.hidden, false); assert.equal(c.empty.textContent, 'No matches found.');
  c.key(c.input, 'Enter'); assert.equal(changes, 1, 'Enter on no results must not change selection');
  c.search(''); c.key(c.input, 'Home'); c.key(c.input, 'ArrowDown'); c.key(c.input, 'ArrowDown');
  assert.equal(c.input.getAttribute('aria-activedescendant'), id + '-option-2');
  c.key(c.input, 'Enter'); assert.equal(c.select.value, 'bbc'); assert.equal(changes, 2);
  c.key(c.trigger, 'ArrowUp'); assert.equal(h.document.activeElement, c.input);
  assert.equal(c.input.getAttribute('aria-activedescendant'), id + '-option-3');
  c.key(c.input, 'Escape'); assert.equal(c.panel.open, false); assert.equal(h.document.activeElement, c.trigger); assert.equal(changes, 2);

  c.open(); c.search('BBC'); c.select.options.find(option=>option.value === 'bbc').textContent = 'BBC World';
  c.select.value = 'cafe'; h.context.syncNewsSelects();
  assert.equal(c.trigger.querySelector('span').textContent, 'Café News');
  assert.equal(c.input.value, 'BBC', 'Sync must preserve an open search'); assert.equal(h.document.activeElement, c.input);
  assert.equal(c.rows()[0].textContent, 'BBC World'); assert.equal(changes, 2, 'Sync must not synthesize changes');
  c.select.disabled = true; h.context.syncNewsSelects(); assert.equal(c.trigger.disabled, true); assert.equal(c.panel.open, false);
  c.rows()[0].dispatchEvent({type:'click'}); assert.equal(changes, 2, 'Disabled controls must reject stale row clicks');
  c.select.disabled = false; h.context.syncNewsSelects(); assert.equal(c.trigger.disabled, false);
  c.open(); const raw = c.rows().find(row=>row.dataset.value === 'html');
  assert.equal(raw.textContent, '<img src=x onerror=alert(1)>'); assert.equal(raw.html, undefined, 'Publisher text must never be inserted as HTML');
  assert.equal(raw.children.length, 1);
  assert.equal(raw.children[0].className, 'news-select-option-icon');
  assert.ok(raw.children[0].style.backgroundImage.startsWith('url("data:image/svg+xml,'));
  c.select.value = 'html'; c.select.dispatchEvent(new Event('change'));
  assert.equal(c.trigger.querySelector('span').textContent, raw.textContent);
  h.document.documentElement.lang = 'id'; h.context.syncNewsSelects(); c.search('missing');
  assert.equal(c.empty.textContent, 'Tidak ada pilihan yang cocok.'); assert.match(c.input.placeholder, /^Cari /);
  c.key(c.input, 'Escape'); c.open(); const stale = c.rows()[0], beforeRevoke = changes;
  h.document.getElementById('news-content').hidden = true; h.context.syncNewsSelects();
  assert.equal(c.trigger.disabled, true); assert.equal(c.panel.open, false, 'Revoking news access must close an open dropdown');
  stale.dispatchEvent({type:'click'}); assert.equal(changes, beforeRevoke, 'A stale option must not dispatch after access is revoked');
  h.document.getElementById('news-content').hidden = false; h.context.syncNewsSelects();
  assert.equal(c.trigger.disabled, false); c.open(); c.rows()[0].dispatchEvent({type:'click'});
  assert.equal(changes, beforeRevoke + 1, 'Restoring news access must restore selection');
}
const fallback = harness(false);
for (const id of ['news-region', 'news-source']) {
  const c = fallback.control(id); assert.equal(c.select.hidden, undefined); assert.equal(c.trigger, undefined);
  c.select.value = 'bbc'; let changes = 0; c.select.addEventListener('change', ()=>changes++); c.select.dispatchEvent(new Event('change'));
  assert.equal(changes, 1, 'Browsers without popovers must retain a working native select');
}
{
  const h = harness(), c = h.control('news-source');
  h.document.documentElement.lang = 'fr';
  h.context.JTI18n = {text:(_id,en)=>({'Search publishers…':'Rechercher des éditeurs…','No matches found.':'Aucun résultat.'}[en] || en)};
  h.context.syncNewsSelects(); c.open(); c.search('missing');
  assert.equal(c.input.placeholder, 'Rechercher des éditeurs…');
  assert.equal(c.empty.textContent, 'Aucun résultat.');
  assert.equal(c.trigger.querySelector('span').textContent, 'All sources', 'Publisher option text is owned by the backing select');
}
console.log('News dropdown selection, search, keyboard, sync, access and native fallback checks passed');
