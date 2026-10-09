(function () {
  'use strict';
  const home = document.getElementById('view-beranda');
  if (!home) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('home-motion-toggle');
  let visited = false;
  try { visited = localStorage.getItem('jt_seen_intro') === '1'; } catch {}
  function update() {
    const active = home.classList.contains('active');
    home.classList.toggle('home-motion-paused', document.hidden || !active || reduced.matches);
    toggle.hidden = reduced.matches;
    if (active && !document.hidden && !visited) {
      visited = true;
      home.classList.toggle('home-play-intro', !reduced.matches);
      try { localStorage.setItem('jt_seen_intro', '1'); } catch {}
    }
  }
  toggle.addEventListener('click', () => {
    const paused = home.classList.toggle('home-user-paused');
    toggle.setAttribute('aria-pressed', String(paused));
    updateLabel();
  });
  function updateLabel() {
    const paused = home.classList.contains('home-user-paused'), en = document.documentElement.lang === 'en';
    toggle.textContent = en ? paused ? 'Resume animation' : 'Pause animation' : paused ? 'Lanjutkan animasi' : 'Jeda animasi';
  }
  new MutationObserver(updateLabel).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  new MutationObserver(update).observe(home, {attributes:true, attributeFilter:['class']});
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener('change', update);
  if ('IntersectionObserver' in window) {
    const nativeReveal = CSS.supports('animation-timeline', 'view()');
    if (!nativeReveal) home.classList.add('home-reveal-fallback');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.classList.add('home-visible');
        entry.target.classList.toggle('home-demo-paused', !entry.isIntersecting);
      }
    }, {threshold:.08});
    home.querySelectorAll('.home-reveal,.home-hero-visual').forEach(element => observer.observe(element));
  }
  update(); updateLabel();
})();
