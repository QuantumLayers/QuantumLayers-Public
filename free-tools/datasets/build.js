#!/usr/bin/env node
/**
 * Builds the static public-dataset pages under free-tools/datasets/.
 *
 *   node free-tools/datasets/build.js                 # fetch every dataset in datasets.json
 *   node free-tools/datasets/build.js --only <slug>   # one dataset
 *   node free-tools/datasets/build.js --fixtures <dir> # read <dir>/<slug>.json instead of fetching
 *
 * For each entry in datasets.json it fetches the API, parses the body with
 * the same parser QuantumLayers' REST connector uses (../public-api-tester/
 * api-parse.js), renames/types the columns, and writes:
 *   datasets/<slug>/index.html   — static page: facts, chart (inline SVG), preview, schema.org Dataset
 *   datasets/<slug>/<slug>.csv   — the full table
 * then regenerates datasets/index.html (the hub) and free-tools/sitemap.xml.
 *
 * Pages state facts only — no interpretation. That belongs to the
 * "Analyze This!" posts each page links to (see datasets/README.md).
 *
 * A dataset whose fetch or parse fails keeps its previous page untouched;
 * the run reports it and exits 1 only if every dataset failed.
 * manifest.json remembers each dataset's CSV hash, so "last changed" only
 * moves when the data does (scheduled rebuilds don't churn every page).
 *
 * No dependencies. Node >= 18 (global fetch). Behind an HTTPS proxy, run
 * with NODE_USE_ENV_PROXY=1 (Node >= 22.21).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const P = require('../public-api-tester/api-parse.js');
const S = require('../ql-stats.js');

const DIR = __dirname;
const TOOLS = path.resolve(DIR, '..');
const SITE = 'https://quantumlayers.com/tools';
const REGISTRY = JSON.parse(fs.readFileSync(path.join(DIR, 'datasets.json'), 'utf8')).datasets;
const MANIFEST_PATH = path.join(DIR, 'manifest.json');
const manifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : {};
const TODAY = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ONLY = argVal('--only');
const FIXTURES = argVal('--fixtures');

// Categorical palette (validated with the dataviz skill's checker on these
// surfaces: dark #14171c all-pass; light #ffffff needs the legend + table,
// which every page has). Fixed order; color follows the series, never rank.
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const utm = (slug, content) => `utm_source=quantumlayers-tools&amp;utm_medium=dataset-page&amp;utm_campaign=${slug}&amp;utm_content=${content}`;

function prettify(col) {
  return col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(v, unit) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  let s;
  if (a >= 1e12) s = (v / 1e12).toFixed(2) + ' T';
  else if (a >= 1e9) s = (v / 1e9).toFixed(2) + ' B';
  else if (a >= 1e6) s = (v / 1e6).toFixed(2) + ' M';
  else s = v.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 0 : a >= 10 ? 1 : 2 });
  if (!unit) return s;
  if (unit === '%') return s + '%';
  if (unit === 'US$') return '$' + s;
  return s + ' ' + unit;
}

/** "2024" | "2024-03" | "2024-03-15" | "2024-03-15 10:00" -> fractional year. */
function toX(v) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(String(v));
  if (!m) return NaN;
  const y = +m[1], mo = m[2] ? +m[2] - 1 : 0, d = m[3] ? +m[3] - 1 : 0;
  if (!m[2]) return y;
  if (!m[3]) return y + (mo + 0.5) / 12;
  return y + (mo + d / 31) / 12;
}

async function fetchBody(ds) {
  if (FIXTURES) {
    const f = path.join(FIXTURES, ds.slug + '.json');
    if (!fs.existsSync(f)) throw new Error('no fixture ' + f);
    return fs.readFileSync(f, 'utf8');
  }
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(ds.api_url, {
        headers: { Accept: 'application/json, application/xml;q=0.9, */*;q=0.5', 'User-Agent': 'quantumlayers-public-datasets/1.0 (+https://quantumlayers.com/tools/datasets/)' },
        signal: AbortSignal.timeout(90000),
      });
      const body = await res.text();
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + body.slice(0, 200));
      return body;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------
// table shaping
// ---------------------------------------------------------------------
function shape(ds, parsed) {
  const map = ds.columns;
  const outCols = Object.values(map);
  const missing = new Set((ds.missing_values || []).map(Number));
  let rows = parsed.rows.map((r) => {
    const o = {};
    for (const [src, dst] of Object.entries(map)) {
      let v = r[src];
      if (typeof v === 'string') v = v.trim();
      o[dst] = v === undefined || v === '' ? null : v;
    }
    return o;
  });
  // Type each column with QuantumLayers' own rules, then coerce numbers.
  const types = {};
  for (const c of outCols) {
    const vals = rows.map((r) => r[c]).filter((v) => v !== null);
    types[c] = S.inferType(vals.map((v) => (typeof v === 'number' ? v : String(v))), c);
    if (types[c] === 'integer' || types[c] === 'float') {
      rows.forEach((r) => {
        if (r[c] === null) return;
        const n = Number(r[c]);
        r[c] = Number.isFinite(n) && !missing.has(n) ? n : null;
      });
    } else {
      rows.forEach((r) => { if (r[c] !== null) r[c] = String(r[c]); });
    }
  }
  // Drop rows whose every value column is empty (e.g. World Bank years not yet published).
  const valueCols = outCols.filter((c) => types[c] === 'integer' || types[c] === 'float');
  if (valueCols.length) rows = rows.filter((r) => valueCols.some((c) => r[c] !== null));
  if (ds.sort) {
    rows.sort((a, b) => {
      for (const k of ds.sort) {
        const x = a[k], y = b[k];
        if (x === y) continue;
        if (x === null) return 1;
        if (y === null) return -1;
        return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      }
      return 0;
    });
  }
  return { rows, cols: outCols, types };
}

function toCSV(cols, rows) {
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n') + '\n';
}

// ---------------------------------------------------------------------
// facts (no interpretation)
// ---------------------------------------------------------------------
function seriesOf(ds, t) {
  const ch = ds.chart;
  const out = [];
  if (ch.series) {
    const byName = new Map();
    for (const r of t.rows) {
      if (r[ch.series] === null || r[ch.y] === null) continue;
      if (!byName.has(r[ch.series])) byName.set(r[ch.series], []);
      byName.get(r[ch.series]).push({ xv: r[ch.x], y: r[ch.y] });
    }
    let names = ch.show ? ch.show.filter((n) => byName.has(n)) : [...byName.keys()];
    if (ch.hide) names = names.filter((n) => !ch.hide.includes(n));
    names.slice(0, 8).forEach((n) => out.push({ name: n, key: n, points: byName.get(n) }));
    return { series: out, total: byName.size, unit: ch.unit };
  }
  for (const c of ch.y) {
    const pts = t.rows.filter((r) => r[c] !== null && r[ch.x] !== null).map((r) => ({ xv: r[ch.x], y: r[c] }));
    out.push({ name: (ch.labels && ch.labels[c]) || prettify(c), key: c, points: pts });
  }
  return { series: out, total: out.length, unit: ch.unit };
}

function factsRows(sr) {
  return sr.series.map((s) => {
    if (!s.points.length) return null;
    let mn = s.points[0], mx = s.points[0];
    for (const p of s.points) { if (p.y < mn.y) mn = p; if (p.y > mx.y) mx = p; }
    const last = s.points.reduce((a, p) => (String(p.xv) > String(a.xv) ? p : a), s.points[0]);
    const first = s.points.reduce((a, p) => (String(p.xv) < String(a.xv) ? p : a), s.points[0]);
    return { name: s.name, first, last, min: mn, max: mx, n: s.points.length };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------
// chart: static inline SVG + a small hover layer
// ---------------------------------------------------------------------
function aggregate(points, mode) {
  if (!mode) return points.map((p) => ({ x: toX(p.xv), label: String(p.xv), y: p.y }));
  const len = mode === 'year' ? 4 : 7;
  const groups = new Map();
  for (const p of points) {
    const k = String(p.xv).slice(0, len);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p.y);
  }
  return [...groups.entries()].sort().map(([k, ys]) => ({ x: toX(k), label: k, y: ys.reduce((a, b) => a + b, 0) / ys.length }));
}

function niceTicks(lo, hi, n) {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function chartSVG(ds, sr) {
  const ch = ds.chart;
  let series = sr.series.map((s, i) => ({ ...s, idx: i, pts: aggregate(s.points, ch.aggregate) }));
  // Few series get direct labels in a right-hand gutter (never on the lines).
  const direct = series.length <= 4;
  const gutter = direct ? Math.min(150, 14 + 6.6 * Math.max(...series.map((s) => s.name.length))) : 16;
  const W = 760, H = 340, L = 64, R = gutter, T = 14, B = 30;
  if (ch.x_from != null) series = series.map((s) => ({ ...s, pts: s.pts.filter((p) => p.x >= ch.x_from) }));
  const all = series.flatMap((s) => s.pts);
  if (!all.length) return '';
  let x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x));
  let y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y));
  if (y0 > 0 && y0 / (y1 || 1) < 0.35) y0 = 0; // start at zero when it doesn't flatten the lines
  const pad = (y1 - y0) * 0.06 || 1; y1 += pad; if (y0 !== 0) y0 -= pad;
  if (x1 === x0) x1 = x0 + 1;
  const sx = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const yt = niceTicks(y0, y1, 5);
  const span = x1 - x0;
  const xstep = span > 40 ? 10 : span > 16 ? 5 : span > 6 ? 2 : 1;
  const xt = [];
  for (let v = Math.ceil(x0 / xstep) * xstep; v <= x1; v += xstep) xt.push(v);
  let g = '';
  for (const v of yt) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="tick" x="${L - 8}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end">${esc(fmt(v, sr.unit === 'US$' ? 'US$' : ''))}</text>`;
  for (const v of xt) g += `<text class="tick" x="${sx(v).toFixed(1)}" y="${H - 10}" text-anchor="middle">${v}</text>`;
  g += `<line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`;
  if (y0 < 0 && y1 > 0) g += `<line class="zero" x1="${L}" x2="${W - R}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}"/>`;
  if (ch.mark_today) {
    const now = new Date().getUTCFullYear();
    if (now > x0 && now < x1) g += `<line class="today" x1="${sx(now).toFixed(1)}" x2="${sx(now).toFixed(1)}" y1="${T}" y2="${H - B}"/><text class="tick" x="${(sx(now) - 5).toFixed(1)}" y="${T + 10}" text-anchor="end">IMF projections from ${now} →</text>`;
  }
  for (const s of series) {
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
    g += `<path class="s${s.idx}" d="${d}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  // Direct labels at line ends when there are few series (legend is always shown too).
  if (direct) {
    const ends = series.map((s) => ({ s, p: s.pts[s.pts.length - 1] })).filter((e) => e.p).sort((a, b) => sy(a.p.y) - sy(b.p.y));
    let lastY = -Infinity;
    for (const e of ends) {
      const y = Math.max(sy(e.p.y) + 4, lastY + 13);
      lastY = y;
      g += `<text class="dlabel" x="${(W - R + 8).toFixed(1)}" y="${y.toFixed(1)}">${esc(e.s.name)}</text>`;
    }
  }
  const legend = series.length > 1 ? `<ul class="legend">${series.map((s) => `<li><span class="sw s${s.idx}"></span>${esc(s.name)}</li>`).join('')}</ul>` : '';
  const hover = {
    unit: sr.unit || '', x0, x1, y0, y1, W, H, L, R, T, B,
    series: series.map((s) => ({ n: s.name, i: s.idx, p: s.pts.map((p) => [+p.x.toFixed(4), p.label, +p.y.toPrecision(6)]) })),
  };
  const what = ch.aggregate ? ` (${ch.aggregate === 'month' ? 'monthly' : 'yearly'} averages)` : '';
  return `
  <figure class="chart">
    ${legend}
    <div class="plot">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ds.title + what)} — line chart; the table below has the values">${g}<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/></svg>
      <div class="tip" hidden></div>
    </div>
    <figcaption>${esc(ds.title)}${esc(what)}. Source: ${esc(ds.attribution)}.</figcaption>
    <script type="application/json" class="chart-data">${JSON.stringify(hover).replace(/</g, '\\u003c')}</script>
  </figure>`;
}

// ---------------------------------------------------------------------
// page
// ---------------------------------------------------------------------
const SHARED_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />`;

const LOGO = 'https://quantumlayers.com/wp-content/uploads/2026/08/cropped-image-rounded.png';
/** The quantumlayers.com site header (styled by the shared site theme). */
function siteHeader(hub, campaign) {
  const q = utm(campaign, 'header');
  return `<header class="ql-site-header">
  <div class="ql-site-header-inner">
    <a class="ql-logo" href="https://quantumlayers.com/?${q}"><img src="${LOGO}" alt="QuantumLayers" width="40" height="40" /></a>
    <nav class="ql-nav" aria-label="Site">
      <a class="ql-link" href="${hub}" aria-current="page">Free tools</a>
      <a class="ql-link" href="https://quantumlayers.com/pricing?${q}">Pricing</a>
      <a class="ql-link" href="https://quantumlayers.com/help">Help</a>
      <a class="ql-link" href="https://quantumlayers.com/blog">Blog</a>
    </nav>
    <div class="ql-nav-right">
      <a class="ql-link ql-hide-sm" href="https://github.com/quantumlayers/quantumlayers-public/tree/main/free-tools/datasets" target="_blank" rel="noopener">GitHub</a>
      <a class="ql-link ql-hide-sm" href="https://quantumlayers.com/ql-login">Login</a>
      <a class="ql-link" href="https://quantumlayers.com/ql-register?${q}">Register</a>
    </div>
  </div>
</header>
`;
}

function seriesCSS() {
  // The site (and its shared theme) is dark-only, so only the dark-surface steps are used.
  return `<style>
  ${SERIES_DARK.map((c, i) => `.s${i}{stroke:${c}} .sw.s${i}{background:${c}}`).join('\n  ')}
</style>`;
}

function datasetPage(ds, t, sr, meta) {
  const url = `${SITE}/datasets/${ds.slug}/`;
  const csvName = `${ds.slug}.csv`;
  const facts = factsRows(sr);
  const xs = t.rows.map((r) => r[ds.chart.x]).filter((v) => v !== null).map(String).sort();
  const coverage = xs.length ? `${xs[0]} – ${xs[xs.length - 1]}` : '—';
  const preview = t.rows.length <= 60 ? t.rows : t.rows.slice(0, 30);
  const numeric = (c) => t.types[c] === 'integer' || t.types[c] === 'float';
  const fieldDesc = (c) => (ds.fields && (ds.fields[c] || ds.fields['*'])) || '';
  const testerHash = new URLSearchParams({ url: ds.api_url, path: ds.response_path || '' }).toString();
  const others = REGISTRY.filter((d) => d.slug !== ds.slug && d.source === ds.source).slice(0, 6);
  const analysis = ds.analysis && ds.analysis.published
    ? `<aside class="analysis"><span class="kind-tag">KIND · ANALYSIS</span><p><b>What does this data show?</b> Trends, breaks and forecasts are covered in <a href="${esc(ds.analysis.url)}">${esc(ds.analysis.title)}</a>.</p></aside>`
    : '';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: ds.title,
    description: ds.description + (ds.note ? ' ' + ds.note : ''),
    url,
    keywords: ds.keywords,
    license: ds.license_url,
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: ds.source, url: ds.source_url },
    publisher: { '@type': 'Organization', name: 'QuantumLayers', url: 'https://quantumlayers.com' },
    isBasedOn: ds.api_url,
    temporalCoverage: xs.length ? `${xs[0]}/${xs[xs.length - 1]}` : undefined,
    dateModified: meta.changed,
    variableMeasured: t.cols.filter(numeric).map((c) => ({ '@type': 'PropertyValue', name: c, description: fieldDesc(c) })),
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: url + csvName }],
    includedInDataCatalog: { '@type': 'DataCatalog', name: 'QuantumLayers public datasets', url: `${SITE}/datasets/` },
  };
  const unit = sr.unit === 'US$' ? 'US$' : sr.unit;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(ds.title)} — data, chart & CSV | QuantumLayers</title>
<meta name="description" content="${esc(ds.description)} Download as CSV or connect it as a live dataset." />
<link rel="canonical" href="${url}" />
${SHARED_HEAD}
<link rel="stylesheet" href="../datasets.css" />
<link rel="stylesheet" href="../../ql-theme.css" />
${seriesCSS()}
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head>
<body>
${siteHeader('../../', 'dataset-' + ds.slug)}<div class="wrap">
  <nav class="crumbs"><a href="../../">Free data tools</a> / <a href="../">Public datasets</a> / ${esc(ds.source)}</nav>

  <header class="hero">
    <h1>${esc(ds.title)}</h1>
    <p class="lede">${esc(ds.description)}</p>
    ${ds.note ? `<p class="note">${esc(ds.note)}</p>` : ''}
    <div class="actions">
      <a class="btn-primary" href="${csvName}" download>Download CSV</a>
      <a class="btn-ghost" href="../../public-api-tester/#${esc(testerHash)}">Open in the API tester</a>
      <a class="btn-ghost" href="#use">API URL &amp; settings</a>
    </div>
  </header>

  <section class="tiles">
    <div class="tile"><span class="n">${t.rows.length.toLocaleString('en-US')}</span><span class="l">rows</span></div>
    <div class="tile"><span class="n">${t.cols.length}</span><span class="l">columns</span></div>
    <div class="tile"><span class="n">${esc(coverage)}</span><span class="l">coverage</span></div>
    ${ds.chart.series ? `<div class="tile"><span class="n">${sr.total.toLocaleString('en-US')}</span><span class="l">${esc(ds.chart.series)} values</span></div>` : ''}
    <div class="tile"><span class="n">${esc(meta.changed)}</span><span class="l">data last changed</span></div>
  </section>

  ${chartSVG(ds, sr)}
  ${ds.chart.series && sr.total > sr.series.length ? `<p class="note">Chart shows ${sr.series.length} of ${sr.total.toLocaleString('en-US')} ${esc(ds.chart.series)} values; the table and CSV have all of them.</p>` : ''}

  ${analysis}

  <section class="panel">
    <h2>Key figures</h2>
    <div class="scroll"><table class="t">
      <thead><tr><th>${ds.chart.series ? esc(prettify(ds.chart.series)) : 'Series'}</th><th class="num">First</th><th class="num">Latest</th><th class="num">Minimum</th><th class="num">Maximum</th></tr></thead>
      <tbody>${facts.map((f) => `<tr><th scope="row">${esc(f.name)}</th><td class="num">${esc(fmt(f.first.y, unit))} <small>${esc(f.first.xv)}</small></td><td class="num">${esc(fmt(f.last.y, unit))} <small>${esc(f.last.xv)}</small></td><td class="num">${esc(fmt(f.min.y, unit))} <small>${esc(f.min.xv)}</small></td><td class="num">${esc(fmt(f.max.y, unit))} <small>${esc(f.max.xv)}</small></td></tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="panel">
    <h2>Data preview</h2>
    <p class="sub">${preview.length < t.rows.length ? `First ${preview.length} of ${t.rows.length.toLocaleString('en-US')} rows. ` : `All ${t.rows.length} rows. `}<a href="${csvName}" download>Download the full CSV</a>.</p>
    <div class="scroll tall"><table class="t">
      <thead><tr>${t.cols.map((c) => `<th${numeric(c) ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${preview.map((r) => `<tr>${t.cols.map((c) => (r[c] === null ? '<td class="null">—</td>' : `<td${numeric(c) ? ' class="num"' : ''}>${esc(numeric(c) ? +Number(r[c]).toPrecision(8) : r[c])}</td>`)).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="panel">
    <h2>Fields</h2>
    <div class="scroll"><table class="t">
      <thead><tr><th>Column</th><th>Type</th><th>Description</th></tr></thead>
      <tbody>${t.cols.map((c) => `<tr><td><code>${esc(c)}</code></td><td>${esc(t.types[c])}</td><td>${esc(fieldDesc(c))}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="panel" id="use">
    <h2>Source and API</h2>
    <dl class="settings">
      <dt>Source</dt><dd><a href="${esc(ds.source_url)}" rel="noopener">${esc(ds.source)}</a></dd>
      <dt>Attribution</dt><dd>${esc(ds.attribution)}</dd>
      <dt>License</dt><dd><a href="${esc(ds.license_url)}" rel="noopener">${esc(ds.license)}</a></dd>
      <dt>API URL</dt><dd><code>${esc(ds.api_url)}</code></dd>
      <dt>Response path</dt><dd><code>${esc(ds.response_path || '(none)')}</code></dd>
      <dt>Columns</dt><dd>Renamed from the API’s fields: ${Object.entries(ds.columns).map(([a, b]) => `<code>${esc(a)}</code> → <code>${esc(b)}</code>`).join(', ')}.</dd>
      ${ds.template ? `<dt>QuantumLayers template</dt><dd>${esc(ds.template)}</dd>` : ''}
    </dl>
    <p class="sub" style="margin-top:12px">This page is rebuilt from the API weekly; “data last changed” moves only when the numbers do.</p>
  </section>

  <section class="cta">
    <p class="eyebrow">a snapshot vs. a live dataset</p>
    <h2>Keep this dataset updated automatically.</h2>
    <p>Connect the same API in QuantumLayers${ds.template ? ` (template: ${esc(ds.template)})` : ''} and it re-syncs on a schedule, alongside your own data — with charts, statistics, forecasts and alerts when something changes.</p>
    <a class="btn" href="https://quantumlayers.com/ql-register?${utm('dataset-' + ds.slug, 'cta')}" target="_blank" rel="noopener">Connect it free &rarr;</a>
  </section>

  ${others.length ? `<section class="related"><h2>More from ${esc(ds.source)}</h2><ul>${others.map((d) => `<li><a href="../${d.slug}/">${esc(d.title)}</a></li>`).join('')}</ul></section>` : ''}

  <footer>
    <span>Data: ${esc(ds.attribution)} (${esc(ds.license)})</span><span class="sep">&middot;</span>
    <span>Page: MIT licensed, built by <a href="https://quantumlayers.com/?${utm('dataset-' + ds.slug, 'footer')}" target="_blank" rel="noopener">QuantumLayers</a></span><span class="sep">&middot;</span>
    <a href="../../">all free data tools</a>
  </footer>
</div>
<script src="../chart-hover.js" defer></script>
</body>
</html>
`;
}

function hubPage(entries) {
  const bySource = new Map();
  for (const e of entries) { if (!bySource.has(e.ds.source)) bySource.set(e.ds.source, []); bySource.get(e.ds.source).push(e); }
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'DataCatalog', name: 'QuantumLayers public datasets', url: `${SITE}/datasets/`,
    dataset: entries.map((e) => ({ '@type': 'Dataset', name: e.ds.title, url: `${SITE}/datasets/${e.ds.slug}/` })),
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Free public datasets — economic, weather & climate data as CSV | QuantumLayers</title>
<meta name="description" content="Free public datasets from the World Bank, IMF, NOAA, NASA and Open-Meteo: GDP, inflation, population, life expectancy, weather and solar data — each with a chart, field definitions, the API URL and a CSV download." />
<link rel="canonical" href="${SITE}/datasets/" />
${SHARED_HEAD}
<link rel="stylesheet" href="datasets.css" />
<link rel="stylesheet" href="../ql-theme.css" />
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head>
<body>
${siteHeader('../', 'datasets-hub')}<div class="wrap">
  <nav class="crumbs"><a href="../">Free data tools</a> / Public datasets</nav>
  <header class="hero">
    <h1>Free public datasets</h1>
    <p class="lede">Curated economic, weather and climate datasets from official public APIs, each with a chart, key figures, field definitions, the exact API URL, and a CSV download. Rebuilt from the source every week.</p>
  </header>
  ${[...bySource.entries()].map(([src, list]) => `
  <section class="panel">
    <h2>${esc(src)}</h2>
    <ul class="ds-list">${list.map((e) => `<li><a href="${e.ds.slug}/">${esc(e.ds.title)}</a><span>${e.rows.toLocaleString('en-US')} rows · ${esc(e.coverage)}</span></li>`).join('')}</ul>
  </section>`).join('')}
  <p class="sub">Need a dataset that isn’t here? Test any JSON or XML API with the <a href="../public-api-tester/">public API tester</a>.</p>
  <footer>
    <span>Data from each source under its own license</span><span class="sep">&middot;</span>
    <span>built by <a href="https://quantumlayers.com/?${utm('datasets-hub', 'footer')}" target="_blank" rel="noopener">QuantumLayers</a></span><span class="sep">&middot;</span>
    <a href="../">all free data tools</a>
  </footer>
</div>
</body>
</html>
`;
}

function sitemap(entries) {
  const tools = fs.readdirSync(TOOLS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !['datasets', 'tests'].includes(d.name) && fs.existsSync(path.join(TOOLS, d.name, 'index.html')))
    .map((d) => d.name).sort();
  const urls = [`${SITE}/`].concat(tools.map((t) => `${SITE}/${t}/`), [`${SITE}/datasets/`]);
  const lines = urls.map((u) => `  <url><loc>${u}</loc></url>`)
    .concat(entries.map((e) => `  <url><loc>${SITE}/datasets/${e.ds.slug}/</loc><lastmod>${e.changed}</lastmod></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>\n`;
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------
(async () => {
  const targets = REGISTRY.filter((d) => !ONLY || d.slug === ONLY);
  let ok = 0, failed = 0;
  for (const ds of targets) {
    try {
      const body = await fetchBody(ds);
      const parsed = P.parseApiResponse(body, ds.response_path || '');
      if (!parsed.ok) throw new Error('parse: ' + parsed.error);
      const missingCols = Object.keys(ds.columns).filter((c) => !parsed.headers.includes(c));
      if (missingCols.length) throw new Error('columns not in response: ' + missingCols.join(', ') + ' (got ' + parsed.headers.slice(0, 12).join(', ') + ')');
      const t = shape(ds, parsed);
      if (t.rows.length < 2) throw new Error('only ' + t.rows.length + ' rows');
      const csv = toCSV(t.cols, t.rows);
      const hash = crypto.createHash('sha256').update(csv).digest('hex');
      const prev = manifest[ds.slug];
      const changed = prev && prev.sha256 === hash ? prev.changed : TODAY;
      const sr = seriesOf(ds, t);
      const out = path.join(DIR, ds.slug);
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, ds.slug + '.csv'), csv);
      fs.writeFileSync(path.join(out, 'index.html'), datasetPage(ds, t, sr, { changed }));
      const xs = t.rows.map((r) => r[ds.chart.x]).filter((v) => v !== null).map(String).sort();
      manifest[ds.slug] = { sha256: hash, changed, rows: t.rows.length, coverage: `${xs[0]} – ${xs[xs.length - 1]}` };
      ok++;
      console.log(`ok    ${ds.slug}: ${t.rows.length} rows, format ${parsed.format}${changed === TODAY ? ' (changed)' : ''}`);
    } catch (e) {
      failed++;
      console.error(`FAIL  ${ds.slug}: ${e.message}`);
    }
  }
  // Hub + sitemap list every dataset that has been built at least once.
  const built = REGISTRY.filter((d) => manifest[d.slug] && fs.existsSync(path.join(DIR, d.slug, 'index.html')))
    .map((d) => ({ ds: d, rows: manifest[d.slug].rows, coverage: manifest[d.slug].coverage, changed: manifest[d.slug].changed }));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(DIR, 'index.html'), hubPage(built));
  fs.writeFileSync(path.join(TOOLS, 'sitemap.xml'), sitemap(built));
  console.log(`${ok} built, ${failed} failed, ${built.length} listed`);
  process.exit(ok === 0 && failed > 0 ? 1 : 0);
})();
