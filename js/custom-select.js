/**
 * Kaystrade Universal Custom Select Component
 * Replaces native OS dropdowns and dialog pickers with a modern, dark-themed,
 * accessible UI component across all mobile and desktop browsers.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function createSvg(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    let d = '';
    if (name === 'chevron-down') d = 'M6 9l6 6 6-6';
    else if (name === 'check') d = 'M20 6L9 17l-5-5';
    else if (name === 'x') d = 'M18 6L6 18M6 6l12 12';
    else if (name === 'search') d = 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z';
    else d = 'M12 2v20M2 12h20';
    path.setAttribute('d', d);
    svg.append(path);
    return svg;
  }

  function getSelectTitle(select) {
    if (select.getAttribute('aria-label')) return select.getAttribute('aria-label');
    if (select.id) {
      const label = document.querySelector('label[for="' + select.id + '"]');
      if (label && label.textContent.trim()) return label.textContent.trim();
    }
    const parentLabel = select.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('select, button, input').forEach(el => el.remove());
      const txt = clone.textContent.trim();
      if (txt) return txt;
    }
    return 'Pilih Opsi';
  }

  let activePanel = null;
  let activeBackdrop = null;

  function closeActiveSelect() {
    if (activePanel) {
      activePanel.classList.remove('is-open');
      const trigger = activePanel._trigger;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      activePanel = null;
    }
    if (activeBackdrop) {
      activeBackdrop.classList.remove('is-open');
      activeBackdrop = null;
    }
    document.body.classList.remove('custom-select-locked');
  }

  document.addEventListener('click', (e) => {
    if (activePanel && !activePanel.contains(e.target) && (!activePanel._trigger || !activePanel._trigger.contains(e.target))) {
      closeActiveSelect();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePanel) {
      closeActiveSelect();
    }
  });

  window.addEventListener('resize', () => {
    if (activePanel && window.innerWidth > 768 && activePanel._positionFn) {
      activePanel._positionFn();
    }
  });

  window.addEventListener('scroll', () => {
    if (activePanel && window.innerWidth > 768 && activePanel._positionFn) {
      activePanel._positionFn();
    }
  }, true);

  function enhanceSelect(select) {
    if (!select || select.dataset.customEnhanced === 'true') return;
    // Skip if inside Pro Workspace or already enhanced by news-select
    if (select.id === 'pro-section-selector' || select.id === 'news-region' || select.id === 'news-source') return;
    if (select.closest && select.closest('.pro-workspace')) return;
    // Skip if explicitly hidden in markup
    if (select.style.display === 'none' || select.hidden) return;

    select.dataset.customEnhanced = 'true';
    select.classList.add('app-custom-select-native');

    const isFullWidth = Boolean(select.closest('.modal-body, .field-group, .form-group') || select.style.width === '100%');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'app-custom-select-trigger' + (isFullWidth ? ' full-width' : '');
    if (select.id) trigger.dataset.targetId = select.id;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const labelText = document.createElement('span');
    labelText.className = 'app-custom-select-text';

    const chevron = createSvg('chevron-down');
    chevron.classList.add('app-custom-select-chevron');
    trigger.append(labelText, chevron);

    // Modal Sheet Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'app-custom-select-backdrop';
    backdrop.addEventListener('click', closeActiveSelect);

    // Custom Panel / Bottom Sheet
    const panel = document.createElement('div');
    panel.className = 'app-custom-select-panel';
    panel._trigger = trigger;

    // Mobile Sheet Header
    const sheetHeader = document.createElement('div');
    sheetHeader.className = 'app-custom-select-header';

    const handle = document.createElement('div');
    handle.className = 'app-custom-select-handle';

    const headerContent = document.createElement('div');
    headerContent.className = 'app-custom-select-header-content';

    const titleEl = document.createElement('span');
    titleEl.className = 'app-custom-select-title';
    titleEl.textContent = getSelectTitle(select);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'app-custom-select-close';
    closeBtn.setAttribute('aria-label', 'Tutup');
    closeBtn.append(createSvg('x'));
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActiveSelect();
    });

    headerContent.append(titleEl, closeBtn);
    sheetHeader.append(handle, headerContent);

    // Search bar for dropdowns with many items (> 6 options)
    const searchWrap = document.createElement('div');
    searchWrap.className = 'app-custom-select-search';
    const searchIcon = createSvg('search');
    searchIcon.classList.add('app-custom-select-search-icon');
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Cari opsi...';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;
    searchWrap.append(searchIcon, searchInput);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'app-custom-select-options';
    optionsContainer.setAttribute('role', 'listbox');

    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'app-custom-select-empty';
    emptyNotice.textContent = 'Tidak ada pilihan yang cocok';
    emptyNotice.style.display = 'none';

    panel.append(sheetHeader, searchWrap, optionsContainer, emptyNotice);

    function syncTriggerLabel() {
      const selected = select.options[select.selectedIndex] || select.options[0];
      labelText.textContent = selected ? selected.textContent.trim() : '';
      trigger.disabled = Boolean(select.disabled);
      titleEl.textContent = getSelectTitle(select);

      for (const btn of optionsContainer.querySelectorAll('.app-custom-select-option')) {
        const isSelected = btn.dataset.value === select.value;
        btn.classList.toggle('is-selected', isSelected);
        btn.setAttribute('aria-selected', String(isSelected));
      }
    }

    function renderOptions() {
      optionsContainer.replaceChildren();
      const query = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;

      for (const opt of select.options) {
        if (opt.hidden) continue;
        const text = opt.textContent.trim();
        const matches = !query || text.toLowerCase().includes(query) || (opt.value && opt.value.toLowerCase().includes(query));
        if (!matches) continue;

        visibleCount++;
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = 'app-custom-select-option';
        itemBtn.dataset.value = opt.value;
        itemBtn.setAttribute('role', 'option');

        const optText = document.createElement('span');
        optText.className = 'app-custom-select-option-text';
        optText.textContent = text;

        const check = createSvg('check');
        check.classList.add('app-custom-select-option-check');

        itemBtn.append(optText, check);

        itemBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          select.value = opt.value;
          syncTriggerLabel();
          closeActiveSelect();
          trigger.focus();
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
        });

        optionsContainer.append(itemBtn);
      }

      emptyNotice.style.display = visibleCount === 0 ? 'block' : 'none';
      searchWrap.style.display = select.options.length > 6 ? 'flex' : 'none';
      syncTriggerLabel();
    }

    searchInput.addEventListener('input', renderOptions);

    function positionFloatingPanel() {
      if (window.innerWidth <= 768) {
        panel.style.top = '';
        panel.style.bottom = '';
        panel.style.left = '';
        panel.style.width = '';
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const placeAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
      const width = Math.max(rect.width, 220);

      panel.style.width = Math.min(width, window.innerWidth - 24) + 'px';
      panel.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + 'px';

      if (placeAbove) {
        panel.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
        panel.style.top = 'auto';
        panel.style.maxHeight = Math.min(320, spaceAbove) + 'px';
      } else {
        panel.style.top = (rect.bottom + 6) + 'px';
        panel.style.bottom = 'auto';
        panel.style.maxHeight = Math.min(320, spaceBelow) + 'px';
      }
    }
    panel._positionFn = positionFloatingPanel;

    function openSelect() {
      if (trigger.disabled || select.disabled) return;
      if (activePanel && activePanel !== panel) closeActiveSelect();

      searchInput.value = '';
      renderOptions();

      // Ensure panel & backdrop are attached to document.body
      if (!backdrop.parentElement) document.body.append(backdrop);
      if (!panel.parentElement) document.body.append(panel);

      backdrop.style.zIndex = '100000';
      panel.style.zIndex = '100005';
      positionFloatingPanel();

      requestAnimationFrame(() => {
        backdrop.classList.add('is-open');
        panel.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        activePanel = panel;
        activeBackdrop = backdrop;
        if (window.innerWidth <= 768) {
          document.body.classList.add('custom-select-locked');
        }
        // Auto-scroll to selected option
        const selectedBtn = optionsContainer.querySelector('.app-custom-select-option.is-selected');
        if (selectedBtn) {
          selectedBtn.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (panel.classList.contains('is-open')) closeActiveSelect();
      else openSelect();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!panel.classList.contains('is-open')) {
          openSelect();
        }
      }
    });

    panel.addEventListener('keydown', (e) => {
      const options = Array.from(optionsContainer.querySelectorAll('.app-custom-select-option:not([disabled])'));
      if (!options.length) return;
      const currentIndex = options.indexOf(document.activeElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        options[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        options[prev]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        options[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        options[options.length - 1]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeActiveSelect();
        trigger.focus();
      }
    });

    select.addEventListener('change', syncTriggerLabel);
    select.addEventListener('input', syncTriggerLabel);

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        renderOptions();
      });
      observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
    }

    // Insert trigger directly after the native select
    select.after(trigger);
    renderOptions();
  }

  function initAllSelects() {
    const selects = document.querySelectorAll('select');
    selects.forEach(enhanceSelect);
  }

  // Run on DOMContentLoaded or immediately if ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSelects);
  } else {
    initAllSelects();
  }

  // Watch for dynamically added select elements (modals, tabs, etc.)
  // Only childList — attribute watching caused freezes when modals toggled class/style.
  if (typeof MutationObserver !== 'undefined') {
    let timer = null;
    const debouncedInit = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        initAllSelects();
      }, 120);
    };
    const bodyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          debouncedInit();
          break;
        }
      }
    });
    bodyObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.initCustomSelects = initAllSelects;
  window.enhanceCustomSelect = enhanceSelect;
  window.closeActiveSelect = closeActiveSelect;
})();
