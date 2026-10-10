const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {literals,bilingualCopy} = require('./build-locales.cjs');
const root = path.resolve(__dirname,'..'), directory = path.join(root,'js','locales');
const read = name => JSON.parse(fs.readFileSync(path.join(directory,name+'.json'),'utf8'));
const catalog = read('catalog'), english = read('en'), keys = Object.keys(english).sort();
const lookup = read('lookup'), normalize = value => value.replace(/\s+/g,' ').trim();
const protectedTokens = value => [...value.matchAll(/<[^>]+>|\$\{[^}]+\}|\{[A-Za-z][A-Za-z0-9_]*\}/g)].map(match=>match[0]).sort();
assert.deepEqual(literals("names: ['Asia', 'Asia']; // ignored 'quote'").map(token=>token.value),['Asia','Asia'],'Bilingual array extraction');
assert.deepEqual(bilingualCopy(`
  // A user's quote must not hide the next call. uiText('fake', 'Fake');
  const escape = /[&<>"']/g;
  const ignored = "uiText('fake', 'Fake')";
  uiText('Masuk untuk 10 upload Free setiap 12 jam.', 'Sign in for 10 Free uploads every 12 hours.');
  /* uiText('fake', 'Fake'); */
  const view = \`<p>\${newsText('Berita', 'News')} \${\`\${kalText('Hari Ini', 'Today')}\`}<\/p>\`;
  text('Unavailable', 'Tidak tersedia');
` ,true),[
  {en:'Sign in for 10 Free uploads every 12 hours.',original:'Masuk untuk 10 upload Free setiap 12 jam.'},
  {en:'News',original:'Berita'}, {en:'Today',original:'Hari Ini'},
  {en:'Unavailable',original:'Tidak tersedia'}
],'Dynamic UI extraction must ignore comments/regex/quoted code and read template expressions');
assert.equal(catalog.default,'en');
assert.equal(new Set(catalog.languages.map(row=>row.code)).size,catalog.languages.length,'Duplicate language codes');
const languages = new Set(catalog.languages.map(row=>row.code));
const app = fs.readFileSync(path.join(root,'js','app.js'),'utf8');
const codes = app.match(/const kalCountryCodes = '([^']+)'/)[1].split(' ');
Object.keys(JSON.parse(fs.readFileSync(path.join(root,'regional-sources.json'),'utf8'))).filter(code=>/^[A-Z]{2}$/.test(code)).forEach(code=>codes.push(code));
for (const code of new Set(codes)) {
  assert.ok(catalog.countries[code]?.length,'Missing country languages: '+code);
  for (const language of catalog.countries[code]) assert.ok(languages.has(language),'Country points to unknown language: '+code+'/'+language);
}
let unchanged = 0;
for (const language of catalog.languages) {
  assert.ok(['ltr','rtl'].includes(language.direction));
  assert.ok(language.name && language.nativeName,'Missing language names: '+language.code);
  if (language.available === false) { assert.ok(!fs.existsSync(path.join(directory,language.code+'.json')),'Unavailable language must not have an English duplicate: '+language.code); continue; }
  const dictionary = read(language.code);
  if(language.code.endsWith('-Cyrl')) assert.ok(/[\p{Script=Cyrillic}]/u.test(dictionary.journal),'Missing Cyrillic script: '+language.code);
  if(language.code==='sr-Latn') assert.ok(!/[\p{Script=Cyrillic}]/u.test(Object.values(dictionary).join('')),'Wrong Serbian script');
  assert.deepEqual(Object.keys(dictionary).sort(),keys,'Missing/extra keys: '+language.code);
  for (const key of keys) {
    assert.ok(typeof dictionary[key]==='string' && dictionary[key].trim(),'Blank string: '+language.code+'/'+key);
    assert.deepEqual(protectedTokens(dictionary[key]),protectedTokens(english[key]),'Changed markup/interpolation: '+language.code+'/'+key);
    if (language.code!=='en' && dictionary[key]===english[key]) unchanged++;
  }
}
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) assert.ok(english[match[1]],'Missing static key: '+match[1]);
for(const file of ['app.js','fed.js','scan.js','home.js','news-select.js']) {
  const source = fs.readFileSync(path.join(root,'js',file),'utf8');
  for(const {en,original} of bilingualCopy(source,file==='fed.js')) {
    const key = lookup[normalize(en)];
    assert.ok(key && english[key],'Missing dynamic UI copy: '+file+' / '+en);
    assert.equal(normalize(english[key]),normalize(en),'Wrong dynamic English lookup: '+file+' / '+en);
    assert.ok(english[lookup[normalize(original)]],'Missing dynamic original lookup: '+file+' / '+original);
  }
}
console.log(JSON.stringify({countries:Object.keys(catalog.countries).length,languages:catalog.languages.length,translatedLanguages:catalog.languages.filter(row=>row.available).length,unavailableLanguages:catalog.languages.filter(row=>!row.available).map(row=>({code:row.code,name:row.name,countries:row.countries})),keys:keys.length,rtl:catalog.languages.filter(row=>row.available && row.direction==='rtl').map(row=>row.code),unchangedEntries:unchanged,notes:'Official regional languages and sign languages are excluded from text UI. Some Zimbabwean constitutional written languages and Romansh lack a reliable translation provider and are disabled explicitly. Unchanged brand names, technical abbreviations and cognates are allowed. Linguistic quality requires native-speaker review; this audit verifies structural completeness and token safety.'},null,2));
