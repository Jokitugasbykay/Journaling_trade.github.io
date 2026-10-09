(function () {
  'use strict';
  if (!('showPopover' in HTMLElement.prototype)) return;
  const controls = [];
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>';
  const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
  const regionShapes = {
    AUTO:'M12 2v4m0 12v4M2 12h4m12 0h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
    ALL:'m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
    AFRICA:'m7 3 7-1 4 4 2 5-4 1-2 7-3 3-3-7-4-1-2-5 3-4 2-2Z',
    ANTARCTICA:'m3 10 4-2 2-3 4 1 2-2 3 4 3 3-1 5-4 2-3-2-4 2-3-3-4-1 1-4Z',
    ASIA:'m2 7 5-4 5 1 3-2 7 4-2 4-4 1-1 5-3-2-2 6-3-7-4-1-1-5Z',
    EUROPE:'m5 4 4 1 2-3 3 3-1 4 4-2 3 3-4 3-1 4-4-1-3 5-2-3 2-4-4-2 2-4Z',
    MIDDLE_EAST:'m5 4 7 1 3-2 4 4-2 4 3 3-4 5-3-3-3 4-2-6-4-2 1-5Z',
    NORTH_AMERICA:'m3 4 5-2 4 3 7-2 3 4-5 3-3 5-4 1 3 4-3 2-2-5-4-3 1-5-2-3Z',
    OCEANIA:'m3 12 4-4 4 1 4-3 4 4 1 5-5 2-5-1-4 2-4-3 1-3Zm17 6 2 3',
    SOUTH_AMERICA:'m5 2 8 2 5 5-3 5-3 4-2 5-3-4-1-6-3-4 2-7Z'
  };
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = (id, en) => id === 'news-region' ? en ? 'Search regions…' : 'Cari region…' : en ? 'Search publishers…' : 'Cari penerbit…';

  for (const id of ['news-region', 'news-source']) {
    const select = document.getElementById(id);
    if (!select) continue;
    const label = document.querySelector('label[for="' + id + '"]');
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.id = id + '-button'; trigger.className = 'news-select-trigger';
    trigger.innerHTML = icon + '<span></span><svg class="news-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
    const panel = document.createElement('div');
    panel.id = id + '-menu'; panel.className = 'news-select-menu'; panel.setAttribute('popover', 'auto');
    panel.innerHTML = '<div class="news-select-search">' + searchIcon + '<input type="search" role="combobox" aria-autocomplete="list" autocomplete="off" spellcheck="false" autofocus></div><div class="news-select-options" role="listbox"></div><p class="news-select-empty" role="status" hidden></p>';
    const input = panel.querySelector('input'), list = panel.querySelector('[role="listbox"]'), empty = panel.querySelector('p');
    list.id = id + '-options';
    input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('popovertarget', panel.id); trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false');
    if (select.getAttribute('aria-describedby')) trigger.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
    if (label) label.htmlFor = trigger.id;
    select.after(trigger, panel); select.hidden = true;
    let rows = [], active = -1;
    const isOpen = () => panel.matches(':popover-open');
    function highlight(index, scroll = true) {
      active = index;
      rows.forEach((row, n) => row.classList.toggle('is-active', n === index));
      if (rows[index]) {
        input.setAttribute('aria-activedescendant', rows[index].id);
        if (scroll) rows[index].scrollIntoView({block:'nearest'});
      } else input.removeAttribute('aria-activedescendant');
    }
    function choose(row) {
      if (!row || select.disabled || trigger.disabled || row.disabled) return;
      // The backing select retains the application's access validation and change handler.
      select.value = row.dataset.value;
      panel.hidePopover(); trigger.focus();
      select.dispatchEvent(new Event('change', {bubbles:true}));
    }
    function render() {
      const previous = rows[active]?.dataset.value;
      const query = normalize(input.value.trim());
      list.replaceChildren(); rows = [];
      let group;
      for (const option of select.options) {
        if (option.hidden || option.disabled || option.parentElement.disabled || !normalize(option.textContent).includes(query)) continue;
        const heading = option.parentElement.tagName === 'OPTGROUP' ? option.parentElement.label : '';
        if (heading && heading !== group) {
          const title = document.createElement('div'); title.className = 'news-select-group'; title.textContent = heading;
          title.setAttribute('aria-hidden', 'true'); list.append(title);
        }
        group = heading;
        const row = document.createElement('button');
        row.type = 'button'; row.tabIndex = -1; row.className = 'news-select-option';
        row.id = id + '-option-' + rows.length; row.dataset.value = option.value;
        row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(option.value === select.value));
        row.setAttribute('aria-label', (heading ? heading + ': ' : '') + option.textContent);
        row.textContent = id === 'news-region' && regionShapes[option.value] && option.value !== 'AUTO' ? option.textContent.replace(/^(All|Semua)\s/, '') : option.textContent;
        const marker = document.createElement('span'); marker.className = 'news-select-option-icon'; marker.setAttribute('aria-hidden', 'true');
        const shape = regionShapes[option.value || 'ALL'];
        const drawing = shape ? '<path d="' + shape + '"/>' : '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>';
        marker.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">' + drawing + '</svg>') + '")';
        row.append(marker);
        row.addEventListener('click', () => choose(row));
        row.addEventListener('pointermove', () => highlight(rows.indexOf(row), false));
        list.append(row); rows.push(row);
      }
      empty.hidden = rows.length > 0;
      empty.textContent = document.documentElement.lang === 'en' ? 'No matches found.' : 'Tidak ada pilihan yang cocok.';
      highlight(Math.max(0, rows.findIndex(row => row.dataset.value === (previous ?? select.value))), false);
    }
    function position() {
      const box = trigger.getBoundingClientRect(), below = innerHeight - box.bottom - 12;
      const above = below < 240 && box.top > below;
      const width = Math.min(Math.max(box.width, 440), innerWidth - 24);
      panel.style.width = width + 'px';
      panel.style.left = Math.max(12, Math.min(box.left, innerWidth - width - 12)) + 'px';
      panel.style.maxHeight = Math.min(620, above ? box.top - 12 : below) + 'px';
      panel.style.top = above ? 'auto' : box.bottom + 8 + 'px';
      panel.style.bottom = above ? innerHeight - box.top + 8 + 'px' : 'auto';
    }
    function sync() {
      const en = document.documentElement.lang === 'en';
      trigger.querySelector('span').textContent = select.selectedOptions[0]?.textContent || (en ? 'All sources' : 'Semua sumber');
      trigger.disabled = select.disabled || document.getElementById('news-content')?.hidden === true;
      trigger.setAttribute('aria-label', (label?.textContent || '') + ': ' + trigger.querySelector('span').textContent);
      input.placeholder = words(id, en); input.setAttribute('aria-label', words(id, en));
      list.setAttribute('aria-label', label?.textContent || words(id, en));
      if (trigger.disabled && isOpen()) panel.hidePopover();
      if (isOpen()) { render(); position(); }
    }
    panel.addEventListener('beforetoggle', event => {
      if (event.newState !== 'open') return;
      input.value = ''; active = -1; rows = []; sync(); render(); list.scrollTop = 0; position();
    });
    panel.addEventListener('toggle', () => {
      const open = String(isOpen()); trigger.setAttribute('aria-expanded', open); input.setAttribute('aria-expanded', open);
      if (isOpen()) input.focus();
    });
    panel.addEventListener('focusout', event => {
      const next = event.relatedTarget;
      if (isOpen() && next && !panel.contains(next) && next !== trigger) panel.hidePopover();
    });
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); panel.showPopover();
        if (event.key === 'End' || event.key === 'ArrowUp') highlight(rows.length - 1);
      }
    });
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); panel.hidePopover(); trigger.focus(); return; }
      if (event.key === 'Enter') { event.preventDefault(); choose(rows[active]); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) return;
      // Home/End retain text editing unless the query is empty; arrows browse the results.
      if (input.value && ['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : active + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'PageDown' ? 8 : -8);
      highlight(Math.max(0, Math.min(rows.length - 1, next)));
    });
    select.addEventListener('change', sync);
    controls.push({sync, panel}); sync();
  }
  window.syncNewsSelects = () => controls.forEach(control => control.sync());
  const close = () => controls.forEach(({panel}) => { if (panel.matches(':popover-open')) panel.hidePopover(); });
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close);
})();
