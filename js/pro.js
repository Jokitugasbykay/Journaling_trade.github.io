(function () {
  'use strict';
  var parts = ['js/pro.chunk.0.js', 'js/pro.chunk.1.js', 'js/pro.chunk.2.js', 'js/pro.chunk.3.js', 'js/pro.chunk.4.js', 'js/pro.chunk.5.js', 'js/pro.chunk.6.js'];
  var i = 0, buf = '';
  function next() {
    if (i >= parts.length) {
      try { (0, eval)(buf); } catch (e) { console.error('[JTPRO] failed to load pro.js', e); }
      return;
    }
    fetch(parts[i], { cache: 'no-cache' }).then(function (r) { return r.text(); }).then(function (t) {
      buf += t; i++; next();
    }).catch(function (e) {
      console.error('[JTPRO] missing chunk', parts[i], e);
    });
  }
  next();
})();
