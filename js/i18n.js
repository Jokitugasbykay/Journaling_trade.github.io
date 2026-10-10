(() => {
  'use strict';
  const base = new URL('./locales/', document.currentScript.src);
  let language = 'en', dictionary = {}, english = {}, lookup = {}, templates = [], catalog = {languages:[],countries:{}}, revision = 0;
  const loaded = new Map(), originals = [], normalize = value => String(value ?? '').replace(/\s+/g,' ').trim();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('[data-i18n],script,style,svg,code,textarea')) originals.push({node,original:node.textContent,last:node.textContent});
  }
  const attributes = [...document.querySelectorAll('[placeholder],[title],[aria-label]')].flatMap(element => ['placeholder','title','aria-label'].filter(name => element.hasAttribute(name)).map(name => ({element,name,original:element.getAttribute(name),last:element.getAttribute(name)})));
  const get = async name => {
    const response = await fetch(new URL(name + '.json',base));
    if (!response.ok) throw new Error('Language file unavailable: ' + name);
    return response.json();
  };
  const format = (value, variables = {}) => value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token,name) => Object.hasOwn(variables,name) ? String(variables[name]) : token);
  const key = (name,fallback = '',variables) => format(dictionary[name] ?? english[name] ?? fallback,variables);
  const text = (id,en) => {
    const source = en ?? id, name = lookup[normalize(source)] || lookup[normalize(id)];
    if (name) return key(name,source);
    // Only known interface templates are matched. Captured values are preserved verbatim.
    for (const {name,tokens,pattern} of templates) {
      const match = String(source).match(pattern);
      if (match) return tokens.reduce((translated,token,index)=>translated.replace(token,()=>match[index+1]),key(name,source));
    }
    return String(source ?? '');
  };
  const apply = (root = document) => {
    root.querySelectorAll('[data-i18n]').forEach(element=>{
      const value = key(element.dataset.i18n,element.innerHTML);
      if (element.innerHTML !== value) element.innerHTML = value;
    });
    for (const entry of originals) {
      if (!entry.node.isConnected || entry.node.textContent !== entry.last) continue;
      const name = lookup[normalize(entry.original)];
      if (!name) continue;
      entry.last = entry.original.replace(entry.original.trim(),key(name,entry.original.trim()));
      entry.node.textContent = entry.last;
    }
    for (const entry of attributes) {
      if (!entry.element.isConnected || entry.element.getAttribute(entry.name) !== entry.last) continue;
      const name = lookup[normalize(entry.original)];
      if (!name) continue;
      entry.last = key(name,entry.original); entry.element.setAttribute(entry.name,entry.last);
    }
    document.documentElement.lang = language;
    document.documentElement.dir = catalog.languages.find(row=>row.code===language)?.direction || 'ltr';
  };
  const setLanguage = async code => {
    if (!catalog.languages.some(row=>row.code===code && row.available !== false)) code = 'en';
    const requested = ++revision;
    if (!loaded.has(code)) loaded.set(code,get(code).catch(error=>{loaded.delete(code);throw error;}));
    const next = await loaded.get(code);
    if (requested !== revision) return false;
    dictionary = next; language = code;
    try { localStorage.setItem('fncjt_language',language); } catch {}
    apply();
    document.dispatchEvent(new CustomEvent('jt:language',{detail:{language}}));
    return true;
  };
  const api = {key,text,format,apply,setLanguage,get language(){return language;},get locale(){return language==='en'?'en-GB':language;},get direction(){return catalog.languages.find(row=>row.code===language)?.direction || 'ltr';},get languages(){return catalog.languages;},get countries(){return catalog.countries;}};
  window.JTI18n = api;
  api.ready = Promise.all([get('en'),get('lookup'),get('catalog')]).then(async ([baseCopy,index,metadata])=>{
    english = baseCopy; lookup = index; catalog = metadata; loaded.set('en',Promise.resolve(english));
    templates = Object.entries(english).filter(([,value])=>value.includes('${')).map(([name,value])=>({name,tokens:[...value.matchAll(/\$\{[^}]+\}/g)].map(match=>match[0]),pattern:new RegExp('^'+value.split(/\$\{[^}]+\}/g).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('([\\s\\S]*?)')+'$')}));
    let saved = 'en'; try { saved = localStorage.getItem('fncjt_language') || 'en'; } catch {}
    if (saved === 'zh') saved = 'zh-Hans';
    try { await setLanguage(saved); }
    catch { await setLanguage('en'); }
    return api;
  });
})();
