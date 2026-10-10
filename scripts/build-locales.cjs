// Build-time UI translation only. Journal records and publisher content never enter this script.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'js', 'locales');
const cacheDirectory = path.join(os.tmpdir(),'journalingtrade-locale-cache');
fs.mkdirSync(directory, {recursive: true});
fs.mkdirSync(cacheDirectory,{recursive:true});
const file = name => fs.readFileSync(path.join(root, name), 'utf8');
const normalize = value => value.replace(/\s+/g, ' ').trim();
const id = value => 'ui_' + crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
const dataPath = name => path.join(name.startsWith('cache-') || name==='source-english' ? cacheDirectory : directory,name+'.json');
const save = (name, data) => fs.writeFileSync(dataPath(name), JSON.stringify(data, null, 2) + '\n');
const read = name => fs.existsSync(dataPath(name)) ? JSON.parse(fs.readFileSync(dataPath(name),'utf8')) : {};
let nextRequest = 0;
async function throttle() { const delay = Math.max(0,nextRequest-Date.now()); nextRequest = Date.now()+delay+700; if(delay) await new Promise(resolve=>setTimeout(resolve,delay)); }
const decode = value => value.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[\da-f]+|\d+);/gi, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[entity] ?? String.fromCodePoint(entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3,-1),16) : parseInt(entity.slice(2,-1),10))));

function sourceTokens(source) {
  const result = [];
  let i = 0;
  const push = (kind, start, value = source.slice(start, i)) => result.push({kind,start,end:i,value});
  function scan(expression = false) {
    let braces = 0, previous;
    while (i < source.length) {
      const start = i, character = source[i];
      if (/\s/.test(character)) { i++; continue; }
      if (source.startsWith('//',i)) { i = source.indexOf('\n',i); if(i<0) i=source.length; continue; }
      if (source.startsWith('/*',i)) { const end=source.indexOf('*/',i+2); i=end<0?source.length:end+2; continue; }
      if (['"',"'",'`'].includes(character)) {
        let interpolated = false;
        for (i++; i < source.length;) {
          if (source[i] === '\\') { i+=2; continue; }
          if (source[i] === character) { i++; break; }
          if (character==='`' && source.startsWith('${',i)) { interpolated=true; i+=2; scan(true); }
          else i++;
        }
        if (!interpolated) push('literal',start,vm.runInNewContext(source.slice(start,i)));
        previous = 'value';
        continue;
      }
      if (character==='/' && (!previous || /^[([{=:,;!?&|+*%~<>-]$/.test(previous) || /^(return|throw|case|yield|await)$/.test(previous))) {
        let bracket = false;
        for(i++;i<source.length;i++) {
          if(source[i]==='\\') i++;
          else if(source[i]==='[') bracket=true;
          else if(source[i]===']') bracket=false;
          else if(source[i]==='/' && !bracket) { i++; break; }
        }
        while(/[A-Za-z]/.test(source[i] || '')) i++;
        push('regex',start); previous='value'; continue;
      }
      if (/[A-Za-z_$]/.test(character)) {
        for(i++;/[\w$]/.test(source[i] || '');i++);
        previous=source.slice(start,i); push('word',start); continue;
      }
      i++;
      if(expression && character==='}' && braces===0) return;
      if(character==='{') braces++;
      if(character==='}') braces--;
      push('punctuation',start); previous=character;
    }
  }
  scan();
  return result;
}
const literals = source => sourceTokens(source).filter(token=>token.kind==='literal');
function bilingualCopy(source, reverse = false) {
  const tokens = sourceTokens(source), result = [];
  for(let i=0;i<tokens.length-5;i++) {
    const [callee,open,first,comma,second,close]=tokens.slice(i,i+6);
    if(callee.kind!=='word' || !/^(uiText|newsText|kalText)$/.test(callee.value) && !(reverse && callee.value==='text')) continue;
    if(tokens[i-1]?.value==='.' || open.value!=='(' || first.kind!=='literal' || comma.value!==',' || second.kind!=='literal' || close.value!==')') continue;
    result.push(callee.value==='text' ? {en:first.value,original:second.value} : {en:second.value,original:first.value});
  }
  return result;
}

async function translateBatch(values, from, to) {
  const params = new URLSearchParams({client:'gtx',sl:from,tl:to});
  for (const value of values) params.append('q',value);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await throttle();
      const response = await fetch('https://translate.googleapis.com/translate_a/t?' + params, {signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error('Translation response ' + response.status);
      const data = await response.json();
      const rows = data.map(row=>Array.isArray(row)?row[0]:row);
      if (rows.length!==values.length || rows.some(row=>typeof row!=='string' || !row.trim())) throw new Error('Translation result incomplete');
      return rows;
    } catch (error) {
      if (error.message === 'Translation result incomplete' || attempt === 4) {
        if (error.message === 'Translation result incomplete' && values.length > 1) {
          const middle = Math.ceil(values.length / 2);
          return [...await translateBatch(values.slice(0,middle),from,to),...await translateBatch(values.slice(middle),from,to)];
        }
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, error.message.includes('429') ? 10000 * (attempt + 1) : 1500 * (attempt + 1)));
    }
  }
}

async function translateStrings(values, from, to, existing = {}, cacheName) {
  const translated = {...existing};
  const pending = [...new Set(values)].filter(value => value.trim() && !translated[value]);
  for (let i = 0; i < pending.length;) {
    const batch = []; let length = 0;
    while (i < pending.length && (length < 3400 || !batch.length)) { length += pending[i].length + 14; batch.push(pending[i++]); }
    const rows = await translateBatch(batch, from, to);
    batch.forEach((value,index) => { translated[value] = rows[index]; });
    if (cacheName) save(cacheName,translated);
  }
  return translated;
}

const protectedParts = /(<\/?(?:br|span|strong|b|em|i)(?:\s[^>]*)?>|\$\{[^}]+\}|\{[A-Za-z][A-Za-z0-9_]*\}|\b(?:PDF|PNG|JPG|CSV|TXT|JSON|USD|IDR|EUR|GBP|JPY|CPI|PCE|NFP|FOMC|SL|TP|RR|R:R|WIB|BI-Rate|TradingView|journalingtrade|Google|Supabase|Plus|Pro|Free)\b)/g;
function pieces(value) { return value.split(protectedParts).filter(Boolean); }
function translatable(value) { protectedParts.lastIndex = 0; return !protectedParts.test(value) && /[\p{L}]/u.test(value); }

async function buildSource() {
  const app = file('js/app.js');
  const previous = read('en');
  const english = {...previous, ...JSON.parse(file('scripts/locale-extra.json'))};
  const lookup = read('lookup');
  const add = (en, original = en) => {
    if (typeof en !== 'string' || !en.trim()) return;
    const normalized = normalize(en), key = Object.keys(english).find(key => normalize(english[key]) === normalized) || id(normalized);
    english[key] = en;
    lookup[normalize(original)] = key; lookup[normalized] = key;
  };
  Object.entries(english).forEach(([key,value]) => { lookup[normalize(value)] = key; });
  for (const name of ['js/app.js','js/fed.js','js/scan.js','js/home.js','js/news-select.js']) {
    const source = file(name), tokens = literals(source);
    for(const {en,original} of bilingualCopy(source,name==='js/fed.js')) add(en,original);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i], before = source.slice(Math.max(0,token.start-70),token.start);
      if (/language\s*===?\s*['"]en['"]\s*\?\s*$/.test(before)) add(token.value, tokens[i+1]?.value);
    }
  }
  for (const match of app.matchAll(/names:\s*\[([^\]]+)\]/g)) {
    const rows = literals(match[1]);
    if(rows.length===2) add(rows[1].value,rows[0].value);
  }
  const categories = app.match(/const newsCategoryNames = ([^;]+);/);
  if(categories) for(const row of Object.values(vm.runInNewContext('('+categories[1]+')'))) add(row[1],row[0]);
  const calendar = app.slice(app.indexOf('const kalCategories = ['),app.indexOf('function kalEventCategory'));
  for(const line of calendar.split('\n')) { const rows=literals(line); if(rows.length>=3) add(rows[2].value,rows[1].value); }
  const html = file('index.html').replace(/<(script|style|svg|code|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const candidates = new Set();
  for (const match of html.matchAll(/>([^<>]+)</g)) {
    const text = normalize(decode(match[1]));
    if (text && /[\p{L}]/u.test(text) && !lookup[text] && !/^[\d.$%\s/+·—:()\-]*[A-Z\d]{1,8}[\d.$%\s/+·—:()\-]*$/.test(text)) candidates.add(text);
  }
  for (const match of html.matchAll(/(?:placeholder|title|aria-label)="([^"]+)"/g)) {
    const text = normalize(decode(match[1]));
    if (/[\p{L}]/u.test(text) && !lookup[text] && !/\n|\|/.test(text) && text.length < 300) candidates.add(text);
  }
  const sourceEnglish = await translateStrings([...candidates], 'auto', 'en', read('source-english'));
  save('source-english',sourceEnglish);
  for (const candidate of candidates) add(sourceEnglish[candidate],candidate);
  save('en',english); save('lookup',lookup);
  return english;
}

async function buildCatalog() {
  const cldr = await (await fetch('https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/territoryInfo.json')).json();
  const app = file('js/app.js');
  const countries = new Set(app.match(/const kalCountryCodes = '([^']+)'/)[1].split(' '));
  Object.keys(JSON.parse(file('regional-sources.json'))).filter(code => /^[A-Z]{2}$/.test(code)).forEach(code => countries.add(code));
  const overrides = {
    ZA:['af','en','nr','nso','ss','st','tn','ts','ve','xh','zu'], ET:['am','aa','om','so','ti'],
    ZW:['bzw','en','kck','khi','nd','ndc','nmq','ny','sn','st','tn','toi','ts','ve','xh'],
    DZ:['ar','ber-Latn','ber-Tfng'], MA:['ar','ber-Latn','ber-Tfng'], IQ:['ar','ckb'],
    NZ:['en','mi'], TW:['zh-Hant'], CN:['zh-Hans'], HK:['zh-Hant','en','yue'], CH:['de','fr','it','rm'],
    ME:['sr-Latn'], RS:['sr-Cyrl','sr-Latn'], BA:['bs','hr','sr-Cyrl','sr-Latn'],
    EU:['bg','hr','cs','da','nl','en','et','fi','fr','de','el','hu','ga','it','lv','lt','mt','pl','pt','ro','sk','sl','es','sv']
  };
  const normalizeCode = code => ({'zh':'zh-Hans','zh_Hant':'zh-Hant','sr':'sr-Cyrl','sh':'sr-Latn','sw_CD':'sw'}[code] || code.replaceAll('_','-'));
  const mapping = {};
  for (const country of [...countries].sort()) {
    const population = cldr.supplemental.territoryInfo[country]?.languagePopulation || {};
    const languages = Object.entries(population).filter(([,row]) => ['official','de_facto_official'].includes(row._officialStatus)).map(([code]) => normalizeCode(code));
    mapping[country] = [...new Set(overrides[country] || (languages.length ? languages : ['en']))].sort();
  }
  const languages = [...new Set(['en','id',...Object.values(mapping).flat()])].sort();
  const native = {nr:'isiNdebele',nd:'isiNdebele (Zimbabwe)',nso:'Sepedi',ss:'SiSwati',st:'Sesotho',tn:'Setswana',ts:'itsonga',ve:'Tshivenḓa',aa:'Qafar af',om:'Afaan Oromoo',ti:'ትግርኛ',yue:'粵語','ber-Latn':'Tamaziɣt (latine)','ber-Tfng':'ⵜⴰⵎⴰⵣⵉⵖⵜ','sr-Latn':'Srpski (latinica)','sr-Cyrl':'Српски (ћирилица)','zh-Hans':'简体中文','zh-Hant':'繁體中文',ny:'Chichewa',gn:'Avañe’ẽ',mi:'te reo Māori'};
  const names = {bzw:'Chibarwe',kck:'Kalanga',khi:'Khoisan languages',ndc:'Ndau',nmq:'Nambya',toi:'Tonga (Zimbabwe)','ber-Latn':'Tamazight (Latin)','ber-Tfng':'Tamazight (Tifinagh)'};
  const unavailable = new Set(['nd','rm','bzw','kck','khi','ndc','nmq','toi']);
  const englishNames = new Intl.DisplayNames(['en'], {type:'language'});
  const catalog = languages.map(code => ({code, name:names[code] || englishNames.of(code), nativeName:native[code] || names[code] || new Intl.DisplayNames([code],{type:'language'}).of(code), direction:['ar','fa','he','ur','ps','sd','ug','ks','dv','ckb'].includes(code.split('-')[0]) ? 'rtl' : 'ltr', available:!unavailable.has(code), countries:Object.keys(mapping).filter(country => mapping[country].includes(code))}));
  save('catalog',{version:1,default:'en',source:'Unicode CLDR territoryInfo national official/de facto statuses, plus nationwide constitutional language lists and script variants. Sign languages are excluded from text UI. Unavailable translations are explicitly disabled.',sources:['https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/territoryInfo.json','https://www.constituteproject.org/constitution/Zimbabwe_2017'],countries:mapping,languages:catalog});
  return catalog;
}

const serviceCode = code => ({'zh-Hans':'zh-CN','zh-Hant':'zh-TW','sr-Cyrl':'sr','sr-Latn':'sr-Latn','nb':'no','kok':'gom','mni':'mni-Mtei','ber-Tfng':'ber'}[code] || code);
function cyrillic(value, code) {
  const az = {'A':'А','a':'а','B':'Б','b':'б','C':'Ҹ','c':'ҹ','Ç':'Ч','ç':'ч','D':'Д','d':'д','E':'Е','e':'е','Ə':'Ә','ə':'ә','F':'Ф','f':'ф','G':'Ҝ','g':'ҝ','Ğ':'Ғ','ğ':'ғ','H':'Һ','h':'һ','X':'Х','x':'х','I':'Ы','ı':'ы','İ':'И','i':'и','J':'Ж','j':'ж','K':'К','k':'к','Q':'Г','q':'г','L':'Л','l':'л','M':'М','m':'м','N':'Н','n':'н','O':'О','o':'о','Ö':'Ө','ö':'ө','P':'П','p':'п','R':'Р','r':'р','S':'С','s':'с','Ş':'Ш','ş':'ш','T':'Т','t':'т','U':'У','u':'у','Ü':'Ү','ü':'ү','V':'В','v':'в','Y':'Ј','y':'ј','Z':'З','z':'з'};
  const uz = {'A':'А','a':'а','B':'Б','b':'б','D':'Д','d':'д','E':'Е','e':'е','F':'Ф','f':'ф','G':'Г','g':'г','H':'Ҳ','h':'ҳ','I':'И','i':'и','J':'Ж','j':'ж','K':'К','k':'к','L':'Л','l':'л','M':'М','m':'м','N':'Н','n':'н','O':'О','o':'о','P':'П','p':'п','Q':'Қ','q':'қ','R':'Р','r':'р','S':'С','s':'с','T':'Т','t':'т','U':'У','u':'у','V':'В','v':'в','X':'Х','x':'х','Y':'Й','y':'й','Z':'З','z':'з'};
  const map = code === 'az-Cyrl' ? az : uz;
  return pieces(value).map(piece=>translatable(piece) ? (code==='uz-Cyrl' ? piece.replace(/O['ʻ’]/g,'Ў').replace(/o['ʻ’]/g,'ў').replace(/G['ʻ’]/g,'Ғ').replace(/g['ʻ’]/g,'ғ').replace(/Sh/g,'Ш').replace(/sh/g,'ш').replace(/Ch/g,'Ч').replace(/ch/g,'ч').replace(/Yo/g,'Ё').replace(/yo/g,'ё').replace(/Yu/g,'Ю').replace(/yu/g,'ю').replace(/Ya/g,'Я').replace(/ya/g,'я').replace(/Ye/g,'Е').replace(/ye/g,'е').replace(/(^|[^\p{L}])E/gu,'$1Э').replace(/(^|[^\p{L}])e/gu,'$1э') : piece).replace(/[A-Za-zƏəÖöÜüÇçŞşĞğİı]/g,character=>map[character] || character) : piece).join('');
}
function serbianLatin(value) {
  const cyrillic='АБВГДЂЕЖЗИЈКЛМНОПРСТЋУФХЦЧШабвгдђежзијклмнопрстћуфхцчш', latin=['A','B','V','G','D','Đ','E','Ž','Z','I','J','K','L','M','N','O','P','R','S','T','Ć','U','F','H','C','Č','Š','a','b','v','g','d','đ','e','ž','z','i','j','k','l','m','n','o','p','r','s','t','ć','u','f','h','c','č','š'];
  const map=Object.fromEntries([...cyrillic].map((character,index)=>[character,latin[index]]));
  Object.assign(map,{'Љ':'Lj','Њ':'Nj','Џ':'Dž','љ':'lj','њ':'nj','џ':'dž'});
  return value.replace(/[\p{Script=Cyrillic}]/gu,character=>map[character] || character);
}
const journalTerms = {'zh-Hans':'交易日志','zh-Hant':'交易日誌',ja:'トレード記録',ko:'거래 일지',ar:'سجل التداول',fa:'دفتر معاملات',he:'יומן מסחר','sr-Cyrl':'Дневник трговања','sr-Latn':'Dnevnik trgovanja',ru:'Торговый журнал',es:'Diario de trading',fr:'Journal de trading',de:'Trading Journal',pt:'Diário de trading',nn:'Handelsjournal',nb:'Handelsjournal',no:'Handelsjournal',it:'Diario di trading',pl:'Dziennik transakcji',cs:'Obchodní deník',sl:'Trgovalni dnevnik',sk:'Obchodný denník',sq:'Ditari i tregtimit',tr:'İşlem günlüğü',el:'Ημερολόγιο συναλλαγών',vi:'Nhật ký giao dịch'};
async function buildTranslation(language, english) {
  const cacheName = 'cache-' + language.code;
  const unique = [...new Set(Object.values(english).flatMap(pieces).filter(translatable))];
  let translated;
  if (language.code === 'nn') {
    const bokmal = await translateStrings(unique,'en','no',read('cache-nb'),'cache-nb');
    translated = {...read(cacheName)};
    for (let i=0;i<unique.length;i+=15) {
      const batch = unique.slice(i,i+15).filter(value=>!translated[value]);
      if (!batch.length) continue;
      const query = batch.map((value,index)=>'__JT'+index.toString().padStart(4,'0')+'__ '+bokmal[value].trim()+' .').join('\n\n');
      const response = await fetch('https://apertium.org/apy/translate?' + new URLSearchParams({langpair:'nob|nno',q:query,markUnknown:'no'}),{signal:AbortSignal.timeout(30000)});
      const data = await response.json(), output = data.responseData?.translatedText || '';
      const markers = [...output.matchAll(/__JT(\d{4})__/g)];
      if (markers.length!==batch.length) throw new Error('Apertium translation markers changed');
      batch.forEach((value,index)=>{translated[value]=output.slice(markers[index].index+markers[index][0].length,markers[index+1]?.index ?? output.length).trim().replace(/\s*\.$/,'');});
      save(cacheName,translated);
    }
  } else translated = await translateStrings(unique,'en',serviceCode(language.code),read(cacheName),cacheName);
  save(cacheName,translated);
  const dictionary = {};
  for (const [key,value] of Object.entries(english)) dictionary[key] = pieces(value).map(piece => translatable(piece) ? piece.replace(piece.trim(),translated[piece]) : piece).join('');
  if(language.code==='sr-Latn') for(const key of Object.keys(dictionary)) dictionary[key]=serbianLatin(dictionary[key]);
  if (['az-Cyrl','uz-Cyrl'].includes(language.code)) for (const key of Object.keys(dictionary)) dictionary[key]=cyrillic(dictionary[key],language.code);
  if(journalTerms[language.code]) dictionary.journal=journalTerms[language.code];
  save(language.code,dictionary);
}

module.exports = {literals,bilingualCopy,pieces,translatable};
if (require.main === module) (async () => {
  const english = await buildSource();
  const catalog = await buildCatalog();
  console.log('Source:',Object.keys(english).length,'keys. Countries:',new Set(catalog.flatMap(row=>row.countries)).size,'Languages:',catalog.length);
  if (process.argv.includes('--source-only')) return;
  const selected = process.argv.find(arg=>arg.startsWith('--language='))?.slice(11);
  const queue = catalog.filter(row=>row.code !== 'en' && row.available && (!selected || row.code===selected)).sort((a,b)=>(a.code==='id'?-1:b.code==='id'?1:0)), failures = [];
  await Promise.all(Array.from({length:2},async () => {
    while (queue.length) {
      const language = queue.shift();
      try { await buildTranslation(language,english); console.log('Built',language.code); }
      catch(error) { failures.push(language.code); console.error('FAILED',language.code,error.message); }
    }
  }));
  if (failures.length) throw new Error('Incomplete locales: '+failures.join(', '));
})().catch(error=>{console.error(error);process.exitCode=1;});
