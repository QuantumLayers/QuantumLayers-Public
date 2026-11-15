/* Hover layer for the static dataset charts: crosshair + tooltip with every
   series' value at the nearest x. The chart itself is plain SVG written by
   build.js, so it reads (and indexes) fine without this script. */
(function () {
  'use strict';
  function fmt(v, unit) {
    var a = Math.abs(v), s;
    if (a >= 1e12) s = (v / 1e12).toFixed(2) + ' T';
    else if (a >= 1e9) s = (v / 1e9).toFixed(2) + ' B';
    else if (a >= 1e6) s = (v / 1e6).toFixed(2) + ' M';
    else s = v.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 0 : a >= 10 ? 1 : 2 });
    if (unit === '%') return s + '%';
    if (unit === 'US$') return '$' + s;
    return unit ? s + ' ' + unit : s;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  document.querySelectorAll('figure.chart').forEach(function (fig) {
    var dataEl = fig.querySelector('.chart-data');
    var svg = fig.querySelector('svg');
    var tip = fig.querySelector('.tip');
    var cross = fig.querySelector('.cross');
    if (!dataEl || !svg) return;
    var d = JSON.parse(dataEl.textContent);
    var sx = function (x) { return d.L + ((x - d.x0) / (d.x1 - d.x0)) * (d.W - d.L - d.R); };

    function move(clientX) {
      var r = svg.getBoundingClientRect();
      var vx = ((clientX - r.left) / r.width) * d.W;
      var x = d.x0 + ((vx - d.L) / (d.W - d.L - d.R)) * (d.x1 - d.x0);
      var rows = [], label = null, bestX = null;
      d.series.forEach(function (s) {
        var best = null, dist = Infinity;
        for (var i = 0; i < s.p.length; i++) {
          var dd = Math.abs(s.p[i][0] - x);
          if (dd < dist) { dist = dd; best = s.p[i]; }
        }
        if (best && dist <= (d.x1 - d.x0) / 40) {
          if (bestX === null) { bestX = best[0]; label = best[1]; }
          rows.push({ n: s.n, i: s.i, v: best[2] });
        }
      });
      if (!rows.length) { hide(); return; }
      rows.sort(function (a, b) { return b.v - a.v; });
      cross.setAttribute('x1', sx(bestX)); cross.setAttribute('x2', sx(bestX));
      cross.style.display = '';
      tip.innerHTML = '<b>' + esc(label) + '</b>' + rows.map(function (r) {
        return '<div><span class="sw s' + r.i + '"></span>' + esc(r.n) + '<span class="v">' + esc(fmt(r.v, d.unit)) + '</span></div>';
      }).join('');
      tip.hidden = false;
      var px = (sx(bestX) / d.W) * r.width;
      var left = px + 14;
      if (left + tip.offsetWidth > r.width) left = px - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + 'px';
    }
    function hide() { tip.hidden = true; cross.style.display = 'none'; }
    svg.addEventListener('mousemove', function (e) { move(e.clientX); });
    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('touchstart', function (e) { move(e.touches[0].clientX); }, { passive: true });
    svg.addEventListener('touchmove', function (e) { move(e.touches[0].clientX); }, { passive: true });
  });
})();
