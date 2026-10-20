const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(rootDir, 'js/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

// 1. Verify index.html toolbar markup
assert.ok(indexHtml.includes('id="news-reset-all"'), 'index.html must have #news-reset-all');
assert.ok(indexHtml.includes('onclick="resetAllNewsFilters()"'), 'index.html must bind resetAllNewsFilters()');

// 2. Verify window.resetAllNewsFilters logic
function createMockEnvironment(isFounder = true) {
  const elements = new Map();
  const searchInput = { value: 'some query' };
  const searchBox = {
    classes: new Set(['isi']),
    classList: {
      remove(name) { this.classes.delete(name); },
      add(name) { this.classes.add(name); },
      contains(name) { return this.classes.has(name); }
    }
  };
  searchBox.classList.classes = searchBox.classes;
  const searchInfo = { hidden: false };
  const sourceSelect = { value: 'trade_with_fnc' };
  const regionSelect = { value: 'global_founder' };

  elements.set('news-search', searchInput);
  elements.set('news-search-box', searchBox);
  elements.set('news-search-info', searchInfo);
  elements.set('news-source', sourceSelect);
  elements.set('news-region', regionSelect);

  let rendered = false;
  let savedPref = false;
  let defaultRegionCalled = false;
  let currentPath = '/economic-news/?article=test123';

  const ctx = {
    $: id => elements.get(id),
    isNewsFounder: () => isFounder,
    saveNewsRegionPreference: () => { savedPref = true; },
    defaultCalendarRegion: () => { defaultRegionCalled = true; },
    renderPublisherNews: () => { rendered = true; },
    pagePath: route => `/${route}/`,
    location: { pathname: currentPath },
    history: {
      pushState: (_state, _title, url) => { currentPath = url; ctx.location.pathname = url; }
    },
    newsCategory: 'fed',
    newsQuery: 'rate cut',
    newsSelectedSource: 'reuters',
    newsSourceAttempt: 'reuters',
    newsRegion: 'global_founder',
    newsRegionMode: 'manual',
    newsVisibleCount: 36
  };
  ctx.window = ctx;

  const fnMatch = appSource.match(/window\.resetAllNewsFilters\s*=\s*function\s*\(\)\s*\{[\s\S]*?\n      \};/);
  assert.ok(fnMatch, 'window.resetAllNewsFilters must be defined in app.js');

  vm.runInNewContext(fnMatch[0], ctx);

  return { ctx, elements, getStatus: () => ({ rendered, savedPref, defaultRegionCalled, currentPath }) };
}

// Test founder reset
{
  const { ctx, elements, getStatus } = createMockEnvironment(true);
  ctx.window.resetAllNewsFilters();

  assert.equal(ctx.newsCategory, '', 'Category must reset to empty');
  assert.equal(ctx.newsQuery, '', 'Query must reset to empty');
  assert.equal(elements.get('news-search').value, '', 'Search input must be cleared');
  assert.equal(elements.get('news-search-box').classList.contains('isi'), false, 'isi class removed');
  assert.equal(elements.get('news-search-info').hidden, true, 'Search info hidden');
  assert.equal(ctx.newsSelectedSource, '', 'Selected source reset');
  assert.equal(elements.get('news-source').value, '', 'Source dropdown reset to empty');
  assert.equal(ctx.newsRegion, '', 'Founder region reset to empty string (All regions)');
  assert.equal(ctx.newsRegionMode, 'manual', 'Founder mode stays manual');
  assert.equal(ctx.newsVisibleCount, 12, 'Pagination reset to 12');

  const status = getStatus();
  assert.ok(status.rendered, 'renderPublisherNews called');
  assert.ok(status.savedPref, 'saveNewsRegionPreference called');
  assert.ok(status.defaultRegionCalled, 'defaultCalendarRegion called');
  assert.equal(status.currentPath, '/economic-news/', 'Navigated back from article to news browse');
}

// Test non-founder reset
{
  const { ctx, elements, getStatus } = createMockEnvironment(false);
  ctx.window.resetAllNewsFilters();

  assert.equal(ctx.newsRegion, '', 'Non-founder newsRegion reset');
  assert.equal(ctx.newsRegionMode, 'auto', 'Non-founder mode reset to auto');
  assert.equal(ctx.newsVisibleCount, 12, 'Pagination reset to 12');
  assert.ok(getStatus().rendered, 'renderPublisherNews called');
}

console.log('All news reset all unit tests passed successfully!');
