// Token Radar dashboard: renders window.RADAR (written by main.ts as data.js).
// No network, no fetch: the whole dataset is already in the page.
//
// Views, from the URL, so screenshots can show each one:
//   ?view=board            the full ranked board (default)
//   ?view=detail&slug=X    the board with X's detail view open
//   ?view=filtered         the board filtered to the watchlist, sorted by TVL
//   ?view=live             the live-token section at the top of the page
// Filters and sorting also work by hand: search, category, chain, minimum
// TVL, watchlist only, and sort by implied value, TVL, 7-day growth or age.

(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'Token Radar: no data loaded.'; return; }
  var rows = D.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function ageText(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 365) return (n / 365).toFixed(1) + 'y';
    return n + 'd';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Header stats.
  var stats = document.getElementById('stats');
  var watchTop = rows.filter(function (r) { return D.watchlist.indexOf(r.slug) >= 0; });
  stats.innerHTML =
    '<div><dt>Board rows</dt><dd>' + rows.length + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + D.early_size + '</dd></div>' +
    '<div><dt>Top implied</dt><dd>' + money(rows[0].implied_value_usd) + '</dd></div>';

  // Filter controls.
  var qEl = document.getElementById('q');
  var catEl = document.getElementById('category');
  var chainEl = document.getElementById('chain');
  var minEl = document.getElementById('mintvl');
  var wlEl = document.getElementById('watchlist');
  var sortEl = document.getElementById('sort');
  var countEl = document.getElementById('count');
  var bodyEl = document.getElementById('rows');

  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  cats.forEach(function (c) { catEl.add(new Option(c, c)); });
  chains.forEach(function (c) { chainEl.add(new Option(c, c)); });

  var params = new URLSearchParams(window.location.search);
  var view = params.get('view') || 'board';
  if (view === 'filtered') { wlEl.checked = true; }
  if (params.get('category')) { catEl.value = params.get('category'); }
  if (params.get('watchlist') === '1') { wlEl.checked = true; }
  if (params.get('sort')) { sortEl.value = params.get('sort'); }

  function filtered() {
    var q = qEl.value.trim().toLowerCase();
    var cat = catEl.value, chain = chainEl.value;
    var min = Number(minEl.value), wl = wlEl.checked;
    var out = rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (chain && r.chains.indexOf(chain) < 0) return false;
      if (r.tvl_usd < min) return false;
      if (wl && D.watchlist.indexOf(r.slug) < 0) return false;
      return true;
    });
    var sort = sortEl.value;
    var key = { rank: 'implied_value_usd', tvl: 'tvl_usd', growth: 'change_7d', age: 'age_days' }[sort];
    out.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av === null || av === undefined) av = -Infinity;
      if (bv === null || bv === undefined) bv = -Infinity;
      return bv - av || a.rank - b.rank;
    });
    return out;
  }

  function render() {
    var list = filtered();
    countEl.textContent = list.length + ' of ' + rows.length + ' protocols';
    bodyEl.innerHTML = list.map(function (r) {
      var wl = D.watchlist.indexOf(r.slug) >= 0;
      var g = r.change_7d === null ? '<span>—</span>' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + g + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td>' +
        '<td>' + (wl ? '<span class="tag watch">Watchlist</span>' : '<span class="tag">Early</span>') + '</td></tr>';
    }).join('');
  }

  function showDetail(slug) {
    var r = bySlug[slug];
    var box = document.getElementById('detail');
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    var wl = D.watchlist.indexOf(r.slug) >= 0;
    var base = Math.round(r.tvl_usd * D.model.base_multiple);
    box.hidden = false;
    box.innerHTML =
      '<h2>' + esc(r.name) + ' <span class="tag' + (wl ? ' watch' : '') + '">' + (wl ? 'Watchlist' : 'Early find') + '</span></h2>' +
      '<p class="sub">Rank ' + r.rank + ' of ' + rows.length + ' · ' + esc(r.category || 'No category') + ' · ' + esc(r.chains.join(', ')) +
      ' · Listed ' + esc(r.listed_at || 'unknown') + ' · Records no token.</p>' +
      '<dl class="detail-grid">' +
      '<div><dt>Implied value</dt><dd>' + money(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day growth</dt><dd>' + pct(r.change_7d) + '</dd></div>' +
      '<div><dt>Age with no token</dt><dd>' + ageText(r.age_days) + '</dd></div></dl>' +
      '<h3>How the value is worked out</h3>' +
      '<table class="model-break"><thead><tr><th>Step</th><th>Figure</th><th>Multiplier</th></tr></thead><tbody>' +
      '<tr><td>Base: TVL × 0.22</td><td>' + money(base) + '</td><td>× 0.22</td></tr>' +
      '<tr><td>Growth: 7d ' + pct(r.change_7d) + '</td><td>clamped −50% to +150%</td><td>× ' + r.growth_multiplier.toFixed(2) + '</td></tr>' +
      '<tr><td>Maturity: age ' + ageText(r.age_days) + '</td><td>capped at 3 years</td><td>× ' + r.maturity_multiplier.toFixed(2) + '</td></tr>' +
      '<tr><td>Chains: ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</td><td>' + esc(r.chains.join(', ')) + '</td><td>× ' + r.chain_multiplier.toFixed(2) + '</td></tr>' +
      '<tr><td><strong>Implied value</strong></td><td><strong>' + money(r.implied_value_usd) + '</strong></td><td></td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan — 7 steps</h3><ol>' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>';
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.classList.toggle('selected', tr.getAttribute('data-slug') === slug);
    });
  }

  // Live-token table, kept apart from the ranked board.
  document.getElementById('live-rows').innerHTML = D.live.map(function (r) {
    return '<tr><td><span class="name">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td><td>' + esc(r.chains.slice(0, 3).join(', ')) + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + (r.mcap_usd === null ? '—' : money(r.mcap_usd)) + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td></tr>';
  }).join('');

  document.getElementById('source').textContent =
    'Snapshot ' + D.as_of + ' · ' + D.source + ' · Floor $' + D.floor_usd.toLocaleString('en-US') +
    ' · Model ' + D.model_version + ' · ' + rows.length + ' rows, ' + D.watchlist_size + ' on the watchlist.';

  [qEl, catEl, chainEl, minEl, wlEl, sortEl].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      sortEl.value = th.getAttribute('data-sort');
      render();
    });
  });
  bodyEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });

  render();
  if (view === 'detail' && params.get('slug')) {
    showDetail(params.get('slug'));
    document.getElementById('detail').scrollIntoView();
  }
  if (view === 'live') {
    document.querySelector('.live').scrollIntoView();
  }
})();
