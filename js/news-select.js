(function () {
  'use strict';
  if (!('showPopover' in HTMLElement.prototype)) return;

  function isMobileSheet() {
    return window.innerWidth <= 768;
  }

  function animateSheetOpen(panel) {
    if (!isMobileSheet()) {
      panel.classList.add('is-sheet-in');
      return;
    }
    panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
    panel.style.transform = '';
    // force reflow then slide up
    void panel.offsetHeight;
    requestAnimationFrame(() => {
      panel.classList.add('is-sheet-in');
    });
  }

  function animateSheetClose(panel) {
    return new Promise((resolve) => {
      if (!isMobileSheet() || !panel.matches(':popover-open')) {
        panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
        panel.style.transform = '';
        resolve();
        return;
      }
      const finish = () => {
        panel.removeEventListener('transitionend', onEnd);
        panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
        panel.style.transform = '';
        resolve();
      };
      const onEnd = (e) => {
        if (e.target !== panel || (e.propertyName && e.propertyName !== 'transform')) return;
        finish();
      };
      panel.addEventListener('transitionend', onEnd);
      panel.classList.remove('is-sheet-in');
      // safety timeout
      setTimeout(finish, 380);
    });
  }

  function bindSheetDrag(panel, handleEl) {
    if (!handleEl || handleEl.dataset.dragBound === '1') return;
    handleEl.dataset.dragBound = '1';
    let startY = 0;
    let currentY = 0;
    let dragging = false;

    const onStart = (clientY) => {
      if (!isMobileSheet() || !panel.matches(':popover-open')) return;
      dragging = true;
      startY = clientY;
      currentY = 0;
      panel.classList.add('is-sheet-dragging');
    };
    const onMove = (clientY) => {
      if (!dragging) return;
      currentY = Math.max(0, clientY - startY);
      panel.style.transform = 'translate3d(0, ' + currentY + 'px, 0)';
    };
    const onEnd = async () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-sheet-dragging');
      const threshold = Math.min(140, panel.offsetHeight * 0.22);
      if (currentY > threshold) {
        // dismiss
        panel.style.transform = 'translate3d(0, 100%, 0)';
        panel.classList.remove('is-sheet-in');
        setTimeout(() => {
          try { panel.hidePopover(); } catch (_) {}
          panel.style.transform = '';
        }, 280);
      } else {
        // snap back up
        panel.style.transform = '';
        panel.classList.add('is-sheet-in');
      }
      currentY = 0;
    };

    handleEl.addEventListener('touchstart', (e) => {
      if (e.touches[0]) onStart(e.touches[0].clientY);
    }, { passive: true });
    handleEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches[0]) onMove(e.touches[0].clientY);
    }, { passive: false });
    handleEl.addEventListener('touchend', onEnd);
    handleEl.addEventListener('touchcancel', onEnd);

    handleEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      handleEl.setPointerCapture?.(e.pointerId);
      onStart(e.clientY);
    });
    handleEl.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      onMove(e.clientY);
    });
    handleEl.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      onEnd();
    });
  }


  const controls = [];
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>';
  const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
  const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const regionShapes = {
    AUTO:'M12 2v4m0 12v4M2 12h4m12 0h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
    ALL:'m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5'
  };
  const mapRegions = ['AFRICA','ANTARCTICA','ASIA','EUROPE','MIDDLE_EAST','NORTH_AMERICA','OCEANIA','SOUTH_AMERICA'];
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const uiText = (id, en) => window.JTI18n?.text(id, en) ?? (document.documentElement.lang === 'id' ? id : en);
  const words = id => id === 'news-region' ? uiText('Cari region…', 'Search regions…') : uiText('Cari penerbit…', 'Search publishers…');
  // Treat phones/tablets and any touch-primary device as touch UI.
  const isTouchUI = () =>
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
    window.innerWidth <= 768 ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0);

  for (const id of ['news-region', 'news-source']) {
    const select = document.getElementById(id);
    if (!select) continue;
    const label = document.querySelector('label[for="' + id + '"]');
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.id = id + '-button'; trigger.className = 'news-select-trigger';
    trigger.innerHTML = icon + '<span></span><svg class="news-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
    const panel = document.createElement('div');
    panel.id = id + '-menu'; panel.className = 'news-select-menu'; panel.setAttribute('popover', 'auto');
    const selectTitle = label?.textContent || (id === 'news-region' ? uiText('Region berita', 'News region') : uiText('Sumber berita', 'News source'));
    panel.innerHTML =
      '<div class="news-select-header">' +
        '<div class="news-select-handle" aria-hidden="true"></div>' +
        '<div class="news-select-header-content">' +
          '<span class="news-select-title">' + selectTitle + '</span>' +
          '<button type="button" class="news-select-close" aria-label="' + uiText('Tutup', 'Close') + '">' + closeIcon + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="news-select-search">' + searchIcon + '<input type="search" role="combobox" aria-autocomplete="list" autocomplete="off" spellcheck="false" inputmode="none" readonly tabindex="-1"></div>' +
      '<div class="news-select-options" role="listbox"></div>' +
      '<p class="news-select-empty" role="status" hidden></p>';
    const input = panel.querySelector('input'), list = panel.querySelector('[role="listbox"]'), empty = panel.querySelector('p');
    const searchWrap = panel.querySelector('.news-select-search');
    const closeBtn = panel.querySelector('.news-select-close');
    if (closeBtn) closeBtn.addEventListener('click', () => panel.hidePopover());
    list.id = id + '-options';
    input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('popovertarget', panel.id); trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false');
    if (select.getAttribute('aria-describedby')) trigger.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
    if (label) label.htmlFor = trigger.id;
    select.after(trigger, panel); select.hidden = true;
    let rows = [], active = -1, searchEnabled = false;
    const isOpen = () => panel.matches(':popover-open');

    function lockSearchInput() {
      searchEnabled = false;
      input.setAttribute('readonly', 'readonly');
      input.setAttribute('inputmode', 'none');
      input.tabIndex = -1;
      if (document.activeElement === input) {
        try { input.blur(); } catch (_) {}
      }
    }
    function unlockSearchInput() {
      searchEnabled = true;
      input.removeAttribute('readonly');
      input.setAttribute('inputmode', 'search');
      input.tabIndex = 0;
    }
    function enableSearchAndFocus() {
      unlockSearchInput();
      requestAnimationFrame(() => {
        try { input.focus({ preventScroll: true }); } catch (_) { try { input.focus(); } catch (__) {} }
      });
    }

    // Block browser/popover auto-focus that would open the keyboard.
    input.addEventListener('focus', event => {
      if (!searchEnabled && isTouchUI()) {
        event.preventDefault();
        event.stopPropagation();
        try { input.blur(); } catch (_) {}
        // Keep focus on the trigger so the sheet stays usable without a keyboard.
        try { trigger.focus({ preventScroll: true }); } catch (_) {}
      }
    }, true);

    // Only open the keyboard when the user deliberately taps the search row.
    searchWrap.addEventListener('pointerup', event => {
      if (!isTouchUI()) return;
      if (!searchEnabled) {
        event.preventDefault();
        event.stopPropagation();
        enableSearchAndFocus();
      }
    });
    searchWrap.addEventListener('click', event => {
      if (!isTouchUI()) return;
      if (!searchEnabled) {
        event.preventDefault();
        event.stopPropagation();
        enableSearchAndFocus();
      }
    });

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
      select.value = row.dataset.value;
      document.body.classList.remove('news-select-locked');
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
        const allPrefix = uiText('Semua', 'All') + ' ';
        row.textContent = id === 'news-region' && (mapRegions.includes(option.value) || option.value === 'ALL') && option.textContent.startsWith(allPrefix) ? option.textContent.slice(allPrefix.length) : option.textContent;
        const marker = document.createElement('span'); marker.className = 'news-select-option-icon'; marker.setAttribute('aria-hidden', 'true');
        const shape = regionShapes[option.value || 'ALL'];
        const drawing = shape ? '<path d="' + shape + '"/>' : '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>';
        marker.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">' + drawing + '</svg>') + '")';
        if (id === 'news-region' && mapRegions.includes(option.value)) marker.style.backgroundImage = 'url("css/maps/' + option.value.toLowerCase() + '.svg")';
        row.append(marker);
        row.addEventListener('click', () => choose(row));
        row.addEventListener('pointermove', e => {
          if (e.pointerType !== 'touch') highlight(rows.indexOf(row), false);
        });
        list.append(row); rows.push(row);
      }
      empty.hidden = rows.length > 0;
      empty.textContent = uiText('Tidak ada pilihan yang cocok.', 'No matches found.');
      highlight(Math.max(0, rows.findIndex(row => row.dataset.value === (previous ?? select.value))), false);
    }
    function position() {
      if (window.innerWidth <= 768) {
        panel.style.width = '100%';
        panel.style.maxWidth = '100%';
        panel.style.left = '0';
        panel.style.right = '0';
        panel.style.top = 'auto';
        panel.style.bottom = '0';
        panel.style.maxHeight = '85vh';
        return;
      }
      panel.style.right = 'auto';
      panel.style.maxWidth = 'none';
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
      trigger.querySelector('span').textContent = select.selectedOptions[0]?.textContent || uiText('Semua sumber', 'All sources');
      trigger.disabled = select.disabled || document.getElementById('news-content')?.hidden === true;
      trigger.setAttribute('aria-label', (label?.textContent || '') + ': ' + trigger.querySelector('span').textContent);
      input.placeholder = words(id); input.setAttribute('aria-label', words(id));
      list.setAttribute('aria-label', label?.textContent || words(id));
      if (trigger.disabled && isOpen()) panel.hidePopover();
      if (isOpen()) { render(); position(); }
    }
    panel.addEventListener('beforetoggle', event => {
      if (event.newState !== 'open') {
        document.body.classList.remove('news-select-locked');
        panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
        panel.style.transform = '';
        lockSearchInput();
        return;
      }
      if (window.innerWidth <= 768) {
        document.body.classList.add('news-select-locked');
      }
      input.value = ''; active = -1; rows = [];
      lockSearchInput();
      sync(); render(); list.scrollTop = 0; position();
      // slide-up after popover paints
      panel.classList.remove('is-sheet-in');
      requestAnimationFrame(() => animateSheetOpen(panel));
    });
    panel.addEventListener('toggle', () => {
      const open = String(isOpen()); trigger.setAttribute('aria-expanded', open); input.setAttribute('aria-expanded', open);
      if (isOpen()) {
        if (isTouchUI()) {
          lockSearchInput();
          // Popover API may focus the first focusable control; bounce focus off the input.
          const bounce = () => {
            if (document.activeElement === input || searchWrap.contains(document.activeElement)) {
              try { input.blur(); } catch (_) {}
              try { trigger.focus({ preventScroll: true }); } catch (_) {}
            }
          };
          bounce();
          requestAnimationFrame(bounce);
          setTimeout(bounce, 50);
          setTimeout(bounce, 150);
        } else {
          unlockSearchInput();
          input.focus();
        }
      } else {
        document.body.classList.remove('news-select-locked');
        lockSearchInput();
      }
    });
    panel.addEventListener('focusout', event => {
      if (window.innerWidth <= 768) return;
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
      if (input.value && ['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : active + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'PageDown' ? 8 : -8);
      highlight(Math.max(0, Math.min(rows.length - 1, next)));
    });
    select.addEventListener('change', sync);
    controls.push({sync, panel, position}); sync();
  }
  window.syncNewsSelects = () => controls.forEach(control => control.sync());
  const close = () => {
    if (window.innerWidth <= 768) return;
    controls.forEach(({panel}) => { if (panel.matches(':popover-open')) panel.hidePopover(); });
  };
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      controls.forEach(control => { if (control.panel.matches(':popover-open')) control.position(); });
    } else {
      close();
    }
  });
  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('pageshow', () => {
    controls.forEach(({panel}) => {
      panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
      panel.style.transform = '';
      try { if (panel.matches(':popover-open')) panel.hidePopover(); } catch (_) {}
    });
    document.body.classList.remove('news-select-locked');
  });
})();
