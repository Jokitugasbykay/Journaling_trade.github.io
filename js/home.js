(function () {
  'use strict';
  const home = document.getElementById('view-beranda');
  if (!home) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visited = false;
  try { visited = localStorage.getItem('jt_seen_intro') === '1'; } catch {}
  function update() {
    const active = home.classList.contains('active');
    home.classList.toggle('home-motion-paused', document.hidden || !active || reduced.matches);
    if (!active || reduced.matches) home.classList.toggle('home-play-intro', false);
    if (active && !document.hidden && !visited) {
      visited = true;
      home.classList.toggle('home-play-intro', !reduced.matches);
      try { localStorage.setItem('jt_seen_intro', '1'); } catch {}
    }
  }
  home.addEventListener('animationend', event => {
    if (event.animationName === 'home-candle-grow' && event.target.style.getPropertyValue('--i') === '17') home.classList.toggle('home-play-intro', false);
  });
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
  update();
})();
