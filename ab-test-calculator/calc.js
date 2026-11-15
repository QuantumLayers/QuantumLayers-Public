/* =========================================================================
   Shared calculator for /ab-test-calculator, /statistical-significance-
   calculator and /sample-size-calculator. Each page is the same tool with
   its own title, intro and explainer for a different search intent; the
   page picks the opening tab with <body data-default-tab="conv|means|plan">
   and provides an empty <div id="calc"></div> where the UI is rendered.
   Math: ../ql-stats.js (tested against SciPy in free-tools/tests/).
   ========================================================================= */
document.getElementById("calc").innerHTML = `
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="conv" class="on">Conversion rates</button>
      <button role="tab" data-tab="means">Averages (revenue, time…)</button>
      <button role="tab" data-tab="plan">Sample size planner</button>
    </div>

    <!-- conversion -->
    <section data-pane="conv">
      <div class="panel">
        <div class="groups">
          <div class="grp"><h3><b>A</b> · control</h3>
            <div class="f"><label class="lbl" for="cA_n">Visitors</label><input id="cA_n" type="number" min="1" step="1" value="10000" /></div>
            <div class="f"><label class="lbl" for="cA_x">Conversions</label><input id="cA_x" type="number" min="0" step="1" value="500" /></div>
          </div>
          <div class="grp"><h3><b>B</b> · variant</h3>
            <div class="f"><label class="lbl" for="cB_n">Visitors</label><input id="cB_n" type="number" min="1" step="1" value="10000" /></div>
            <div class="f"><label class="lbl" for="cB_x">Conversions</label><input id="cB_x" type="number" min="0" step="1" value="570" /></div>
          </div>
        </div>
        <div class="opts">
          <div class="f"><label class="lbl">Confidence</label><span class="seg" data-conf-group><button data-conf="0.90">90%</button><button data-conf="0.95" class="on">95%</button><button data-conf="0.99">99%</button></span></div>
          <div class="f"><label class="lbl" for="cSplit">Intended split A:B</label><input id="cSplit" type="text" value="50:50" /></div>
          <div class="f"><button type="button" class="btn-ghost" data-act="share">Copy link to these results</button> <span class="hint" id="shareStatus"></span></div>
        </div>
      </div>
      <div id="convOut" aria-live="polite"></div>
    </section>

    <!-- means -->
    <section data-pane="means" hidden>
      <div class="panel">
        <p class="sub">Enter summary statistics, or switch to raw values and paste one number per line (e.g. order values per user) — raw values also get a Mann–Whitney test that doesn’t assume a bell curve.</p>
        <div class="opts" style="margin:0 0 14px"><span class="seg"><button data-minput="summary" class="on">Summary stats</button><button data-minput="raw">Raw values</button></span></div>
        <div class="groups" data-mmode="summary">
          <div class="grp"><h3><b>A</b> · control</h3>
            <div class="f"><label class="lbl" for="mA_m">Mean</label><input id="mA_m" type="number" step="any" value="52.3" /></div>
            <div class="f"><label class="lbl" for="mA_s">Standard deviation</label><input id="mA_s" type="number" step="any" min="0" value="31.0" /></div>
            <div class="f"><label class="lbl" for="mA_n">Sample size</label><input id="mA_n" type="number" step="1" min="2" value="1200" /></div>
          </div>
          <div class="grp"><h3><b>B</b> · variant</h3>
            <div class="f"><label class="lbl" for="mB_m">Mean</label><input id="mB_m" type="number" step="any" value="55.1" /></div>
            <div class="f"><label class="lbl" for="mB_s">Standard deviation</label><input id="mB_s" type="number" step="any" min="0" value="33.4" /></div>
            <div class="f"><label class="lbl" for="mB_n">Sample size</label><input id="mB_n" type="number" step="1" min="2" value="1180" /></div>
          </div>
        </div>
        <div class="groups" data-mmode="raw" hidden>
          <div class="grp"><h3><b>A</b> · control</h3><textarea id="rA" spellcheck="false" placeholder="12.5&#10;40&#10;0&#10;…"></textarea></div>
          <div class="grp"><h3><b>B</b> · variant</h3><textarea id="rB" spellcheck="false" placeholder="15&#10;38.2&#10;…"></textarea></div>
        </div>
        <div class="opts">
          <div class="f"><label class="lbl">Confidence</label><span class="seg" data-conf-group><button data-conf="0.90">90%</button><button data-conf="0.95" class="on">95%</button><button data-conf="0.99">99%</button></span></div>
        </div>
      </div>
      <div id="meansOut" aria-live="polite"></div>
    </section>

    <!-- planner -->
    <section data-pane="plan" hidden>
      <div class="panel">
        <div class="groups">
          <div class="grp"><h3>What you know</h3>
            <div class="f"><label class="lbl" for="pBase">Current conversion rate (%)</label><input id="pBase" type="number" step="any" min="0.01" max="99.9" value="5" /></div>
            <div class="f"><label class="lbl" for="pTraffic">Visitors per day (all variants)</label><input id="pTraffic" type="number" step="1" min="1" value="2000" /></div>
            <div class="f"><label class="lbl" for="pVariants">Variants incl. control</label><input id="pVariants" type="number" step="1" min="2" max="10" value="2" /></div>
          </div>
          <div class="grp"><h3>What you want to detect</h3>
            <div class="f"><label class="lbl" for="pMde">Smallest lift worth detecting (relative %)</label><input id="pMde" type="number" step="any" min="0.1" value="10" /></div>
            <div class="f"><label class="lbl" for="pPower">Power (%)</label><select id="pPower"><option value="0.8" selected>80% (standard)</option><option value="0.9">90%</option><option value="0.95">95%</option></select></div>
            <div class="f"><label class="lbl" for="pAlpha">Confidence</label><select id="pAlpha"><option value="0.1">90%</option><option value="0.05" selected>95%</option><option value="0.01">99%</option></select></div>
          </div>
        </div>
      </div>
      <div id="planOut" aria-live="polite"></div>
    </section>
`;
const S = window.QLStats;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let conf = 0.95;
let meansInput = "summary";

const pct = (x, d = 2) => (Number.isFinite(x) ? (x * 100).toFixed(d) + "%" : "—");
const spct = (x, d = 1) => (Number.isFinite(x) ? (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x * 100).toFixed(d) + "%" : "—");
const num = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString(undefined, { maximumFractionDigits: d }) : "—");
const snum = (x, d = 2) => (Number.isFinite(x) ? (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toLocaleString(undefined, { maximumFractionDigits: d }) : "—");
function fmtP(p) { return !Number.isFinite(p) ? "—" : p < 0.0001 ? "< 0.0001" : p < 0.01 ? p.toFixed(4) : p.toFixed(3); }
function meterHTML(frac) {
  const on = Math.max(0, Math.min(6, Math.round(frac * 6)));
  let s = '<span class="strength-meter" aria-hidden="true">';
  for (let i = 0; i < 6; i++) s += `<span class="${i < on ? "filled" : ""}"></span>`;
  return s + "</span>";
}
// Meter = how much evidence: maps p from 0.5 → 0 segments to 1e-6 → 6.
const evidence = (p) => (Number.isFinite(p) ? Math.max(0, Math.min(1, -Math.log10(Math.max(p, 1e-6)) / 6)) : 0);
const val = (id) => { const v = $("#" + id).value; return v === "" ? NaN : Number(v); };

/** Horizontal CI chart: interval vs. zero line. */
function ciSVG(lo, hi, point, fmt, label) {
  if (![lo, hi, point].every(Number.isFinite)) return "";
  const W = 600, H = 64, L = 20, R = 20;
  let a = Math.min(lo, 0), b = Math.max(hi, 0);
  const pad = (b - a) * 0.15 || 1; a -= pad; b += pad;
  const x = (v) => L + ((v - a) / (b - a)) * (W - L - R);
  const color = lo > 0 ? "var(--ok)" : hi < 0 ? "var(--danger)" : "var(--meter-6)";
  return `<div class="ci"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}: ${esc(fmt(lo))} to ${esc(fmt(hi))}">
    <line x1="${x(0)}" x2="${x(0)}" y1="18" y2="${H - 18}" stroke="var(--text-faint)" stroke-dasharray="3 3"/>
    <text x="${x(0)}" y="${H - 4}" text-anchor="middle">0</text>
    <line x1="${x(lo)}" x2="${x(hi)}" y1="32" y2="32" stroke="${color}" stroke-width="6" stroke-linecap="round" opacity=".55"/>
    <circle cx="${x(point)}" cy="32" r="6" fill="${color}"/>
    <text x="${x(lo)}" y="12" text-anchor="middle">${esc(fmt(lo))}</text>
    <text x="${x(hi)}" y="12" text-anchor="middle">${esc(fmt(hi))}</text>
  </svg></div>`;
}

function parseSplit(s) {
  const parts = String(s).split(/[:/,\s]+/).map(Number).filter((v) => Number.isFinite(v) && v > 0);
  return parts.length === 2 ? parts : [1, 1];
}

// ---------------------------------------------------------------------
// conversion
// ---------------------------------------------------------------------
function renderConv() {
  const nA = val("cA_n"), xA = val("cA_x"), nB = val("cB_n"), xB = val("cB_x");
  const out = $("#convOut");
  const bad = [nA, xA, nB, xB].some((v) => !Number.isFinite(v) || v < 0 || !Number.isInteger(v));
  if (bad || nA < 1 || nB < 1) { out.innerHTML = `<p class="err">Enter whole numbers for visitors and conversions.</p>`; return; }
  if (xA > nA || xB > nB) { out.innerHTML = `<p class="err">Conversions can’t exceed visitors.</p>`; return; }
  if (xA + xB === 0) { out.innerHTML = `<p class="err">No conversions in either group yet — nothing to compare.</p>`; return; }
  const alpha = 1 - conf;
  const r = S.twoProportion(nA, xA, nB, xB, alpha);
  const split = parseSplit($("#cSplit").value);
  const srm = S.chiSquareGof([nA, nB], split);
  const sig = r.p < alpha;
  const up = r.diff > 0;
  const vClass = !sig ? "flat" : up ? "win" : "lose";
  const vText = !sig ? "No significant difference" : up ? "B is significantly better" : "B is significantly worse";
  const notes = [];
  if (srm.p < 0.001) notes.push(["bad", `<b>Sample ratio mismatch.</b> You intended ${split.join(":")} but got ${num(nA, 0)} vs ${num(nB, 0)} visitors (χ² p = ${fmtP(srm.p)}). Assignment or tracking is likely broken — fix that before trusting this result.`]);
  else notes.push(["good", `Traffic split looks as intended (${split.join(":")}; χ² p = ${fmtP(srm.p)}).`]);
  const minCount = Math.min(xA, xB, nA - xA, nB - xB);
  if (minCount < 10) notes.push(["warn", "Very few conversions (or non-conversions) in one group — the normal approximation behind this test is rough below ~10. Collect more data."]);
  if (!sig) {
    const need = S.sampleSizeTwoProportion(r.pA, r.pA * (1 + Math.max(Math.abs(r.rel), 0.0001) * (up ? 1 : -1)), alpha, 0.8);
    if (Number.isFinite(need) && need > Math.min(nA, nB)) notes.push(["", `If the true lift really is ${spct(r.rel)}, you’d need about <b>${num(need, 0)}</b> visitors per group to detect it 80% of the time (you have ${num(Math.min(nA, nB), 0)}). Current power: ${pct(r.power, 0)}.`]);
    notes.push(["", "“Not significant” isn’t proof of no effect — check the interval below for the range of lifts still consistent with your data."]);
  } else if (r.power < 0.5) {
    notes.push(["warn", `Significant, but the test was under-powered (${pct(r.power, 0)}). Effects found by small tests tend to be overestimated — expect the real lift to be smaller.`]);
  }
  out.innerHTML = `
    <section class="panel">
      <div class="verdict"><span class="kind-tag">KIND · A/B TEST</span>${meterHTML(evidence(r.p))}<span class="v ${vClass}">${vText}</span></div>
      <p class="summary">B converted at <b>${pct(r.pB)}</b> vs <b>${pct(r.pA)}</b> for A — a relative change of <b>${spct(r.rel)}</b> (${spct(r.diff, 2).replace("%", " pts")} absolute). ${sig ? `At ${Math.round(conf * 100)}% confidence this is unlikely to be chance (p = ${fmtP(r.p)}).` : `At ${Math.round(conf * 100)}% confidence this could easily be chance (p = ${fmtP(r.p)}).`}</p>
      <div class="tiles">
        <div class="tile"><span class="n">${pct(r.pA)}</span><span class="l">A conversion</span><span class="d">${num(xA, 0)} / ${num(nA, 0)}</span></div>
        <div class="tile"><span class="n">${pct(r.pB)}</span><span class="l">B conversion</span><span class="d">${num(xB, 0)} / ${num(nB, 0)}</span></div>
        <div class="tile"><span class="n">${spct(r.rel)}</span><span class="l">relative lift</span><span class="d">${Math.round(conf * 100)}% CI ${spct(r.relCI[0])} to ${spct(r.relCI[1])}</span></div>
        <div class="tile"><span class="n">${fmtP(r.p)}</span><span class="l">p-value (two-sided)</span><span class="d">z = ${num(r.z, 3)}</span></div>
      </div>
      <p class="hint" style="margin:0 0 4px">${Math.round(conf * 100)}% confidence interval for the relative lift</p>
      ${ciSVG(r.relCI[0], r.relCI[1], r.rel, (v) => spct(v), "Relative lift interval")}
      <ul class="notes">${notes.map(([k, t]) => `<li class="${k}">${t}</li>`).join("")}</ul>
    </section>`;
}

// ---------------------------------------------------------------------
// means
// ---------------------------------------------------------------------
function parseValues(text) {
  return String(text).split(/[\s,;]+/).map((s) => s.trim().replace(/[$£€]/g, "")).filter(Boolean).map(Number).filter(Number.isFinite);
}
function renderMeans() {
  const out = $("#meansOut");
  const alpha = 1 - conf;
  let A, B, mw = null;
  if (meansInput === "raw") {
    const a = parseValues($("#rA").value), b = parseValues($("#rB").value);
    if (a.length < 2 || b.length < 2) { out.innerHTML = `<p class="err">Paste at least 2 numbers in each box (one per line, or separated by commas).</p>`; return; }
    const da = S.describe(a), db = S.describe(b);
    A = { m: da.mean, s: da.sd, n: da.n, med: da.median }; B = { m: db.mean, s: db.sd, n: db.n, med: db.median };
    mw = S.mannWhitney(a, b);
  } else {
    A = { m: val("mA_m"), s: val("mA_s"), n: val("mA_n") }; B = { m: val("mB_m"), s: val("mB_s"), n: val("mB_n") };
    if ([A.m, A.s, A.n, B.m, B.s, B.n].some((v) => !Number.isFinite(v)) || A.n < 2 || B.n < 2 || A.s < 0 || B.s < 0) {
      out.innerHTML = `<p class="err">Enter a mean, a non-negative standard deviation and a sample size of at least 2 for both groups.</p>`; return;
    }
  }
  if (A.s === 0 && B.s === 0) { out.innerHTML = `<p class="err">Both groups have zero spread — every value is identical, so there’s nothing to test.</p>`; return; }
  const w = S.welch(A.m, A.s, A.n, B.m, B.s, B.n, alpha);
  const sig = w.p < alpha, up = w.diff > 0;
  const vClass = !sig ? "flat" : up ? "win" : "lose";
  const vText = !sig ? "No significant difference" : up ? "B’s average is significantly higher" : "B’s average is significantly lower";
  const dAbs = Math.abs(w.d);
  const dWord = dAbs < 0.2 ? "negligible" : dAbs < 0.5 ? "small" : dAbs < 0.8 ? "medium" : "large";
  const notes = [];
  notes.push(["", `Effect size (Cohen’s d) is <b>${num(w.d, 3)}</b> — ${dWord}. With big samples even trivial differences become “significant”; d tells you whether it’s large enough to matter.`]);
  if (mw) {
    const agree = (mw.p < alpha) === sig;
    notes.push([agree ? "good" : "warn", `Mann–Whitney U (no normality assumption): p = ${fmtP(mw.p)}. A random B value beats a random A value ${pct(1 - mw.probSuperiority, 0)} of the time.${agree ? "" : " It disagrees with the t-test — skewed data or outliers (common with revenue) are driving the means; trust the medians and this test more."}`]);
    notes.push(["", `Medians: A ${num(A.med)} · B ${num(B.med)}.`]);
  }
  const skewHint = (g) => g.m > 0 && g.s > 1.5 * g.m;
  if (!mw && (skewHint(A) || skewHint(B))) notes.push(["warn", "The standard deviation is much larger than the mean, which usually means a long right tail (a few big spenders). Means are fragile there — paste raw values to also get a rank-based test."]);
  if (Math.min(A.n, B.n) < 30) notes.push(["warn", "Small samples: the t-test relies on roughly bell-shaped data below ~30 per group."]);
  out.innerHTML = `
    <section class="panel">
      <div class="verdict"><span class="kind-tag">KIND · A/B TEST</span>${meterHTML(evidence(w.p))}<span class="v ${vClass}">${vText}</span></div>
      <p class="summary">B averaged <b>${num(B.m)}</b> vs <b>${num(A.m)}</b> for A — a difference of <b>${snum(w.diff)}</b> (${spct(w.rel)}). ${sig ? `At ${Math.round(conf * 100)}% confidence that’s unlikely to be chance (p = ${fmtP(w.p)}).` : `At ${Math.round(conf * 100)}% confidence that could be chance (p = ${fmtP(w.p)}).`}</p>
      <div class="tiles">
        <div class="tile"><span class="n">${num(A.m)}</span><span class="l">A mean</span><span class="d">sd ${num(A.s)} · n ${num(A.n, 0)}</span></div>
        <div class="tile"><span class="n">${num(B.m)}</span><span class="l">B mean</span><span class="d">sd ${num(B.s)} · n ${num(B.n, 0)}</span></div>
        <div class="tile"><span class="n">${snum(w.diff)}</span><span class="l">difference B − A</span><span class="d">${Math.round(conf * 100)}% CI ${snum(w.ci[0])} to ${snum(w.ci[1])}</span></div>
        <div class="tile"><span class="n">${fmtP(w.p)}</span><span class="l">p-value (Welch)</span><span class="d">t = ${num(w.t, 3)} · df ${num(w.df, 1)}</span></div>
      </div>
      <p class="hint" style="margin:0 0 4px">${Math.round(conf * 100)}% confidence interval for the difference</p>
      ${ciSVG(w.ci[0], w.ci[1], w.diff, (v) => snum(v), "Difference interval")}
      <ul class="notes">${notes.map(([k, t]) => `<li class="${k}">${t}</li>`).join("")}</ul>
    </section>`;
}

// ---------------------------------------------------------------------
// planner
// ---------------------------------------------------------------------
function renderPlan() {
  const out = $("#planOut");
  const base = val("pBase") / 100, mde = val("pMde") / 100, traffic = val("pTraffic"), k = Math.round(val("pVariants"));
  const power = Number($("#pPower").value), alpha = Number($("#pAlpha").value);
  if (!(base > 0 && base < 1) || !(mde > 0) || !(traffic > 0) || !(k >= 2)) { out.innerHTML = `<p class="err">Enter a conversion rate between 0 and 100%, a positive lift, daily traffic and at least 2 variants.</p>`; return; }
  const target = base * (1 + mde);
  if (target >= 1) { out.innerHTML = `<p class="err">A ${pct(mde, 0)} lift on ${pct(base, 1)} would exceed 100%.</p>`; return; }
  // Bonferroni across (k-1) comparisons against control when k > 2.
  const a = k > 2 ? alpha / (k - 1) : alpha;
  const n = S.sampleSizeTwoProportion(base, target, a, power);
  const total = n * k;
  const days = Math.ceil(total / traffic);
  const weeks = Math.ceil(days / 7);
  const rows = [0.05, 0.1, 0.15, 0.2, 0.3].map((m) => {
    const t = base * (1 + m);
    if (t >= 1) return "";
    const nn = S.sampleSizeTwoProportion(base, t, a, power);
    return `<tr><td>${spct(m, 0)}</td><td>${pct(t)}</td><td>${num(nn, 0)}</td><td>${num(Math.ceil((nn * k) / traffic), 0)} days</td></tr>`;
  }).join("");
  out.innerHTML = `
    <section class="panel">
      <div class="verdict"><span class="kind-tag">KIND · SAMPLE SIZE</span><span class="v flat">${num(n, 0)} visitors per variant</span></div>
      <p class="summary">To detect a lift from <b>${pct(base)}</b> to <b>${pct(target)}</b> (${spct(mde, 0)} relative) with ${Math.round(power * 100)}% power at ${Math.round((1 - alpha) * 100)}% confidence${k > 2 ? ` (Bonferroni-adjusted for ${k - 1} comparisons against control)` : ""}, you need <b>${num(total, 0)}</b> visitors in total — about <b>${num(days, 0)} days</b> at ${num(traffic, 0)}/day.</p>
      <div class="tiles">
        <div class="tile"><span class="n">${num(n, 0)}</span><span class="l">per variant</span></div>
        <div class="tile"><span class="n">${num(total, 0)}</span><span class="l">total visitors</span></div>
        <div class="tile"><span class="n">${num(days, 0)}</span><span class="l">days</span><span class="d">round up to ${weeks} full week${weeks === 1 ? "" : "s"}</span></div>
      </div>
      <p class="hint" style="margin:0 0 6px">How the requirement changes with the lift you want to catch:</p>
      <div style="overflow-x:auto"><table style="border-collapse:collapse;font-family:var(--font-mono);font-size:12.5px;width:100%">
        <thead><tr style="color:var(--text-faint);text-align:left"><th style="padding:6px 8px">relative lift</th><th style="padding:6px 8px">target rate</th><th style="padding:6px 8px">per variant</th><th style="padding:6px 8px">duration</th></tr></thead>
        <tbody>${rows.replace(/<td>/g, '<td style="padding:6px 8px;border-top:1px solid var(--border)">')}</tbody>
      </table></div>
      <ul class="notes">
        <li>Run whole weeks so weekday and weekend behaviour are both represented, and don’t stop early when the numbers look good.</li>
        ${days > 56 ? `<li class="warn">That’s over two months. Consider testing a bolder change (bigger expected lift), a higher-traffic page, or a metric closer to the change (e.g. click-through instead of purchase).</li>` : ""}
      </ul>
    </section>`;
}

// ---------------------------------------------------------------------
// wiring + shareable state
// ---------------------------------------------------------------------
const FIELDS = ["cA_n", "cA_x", "cB_n", "cB_x", "cSplit", "mA_m", "mA_s", "mA_n", "mB_m", "mB_s", "mB_n", "pBase", "pTraffic", "pVariants", "pMde", "pPower", "pAlpha"];
let tab = "conv";
function renderAll() { if (tab === "conv") renderConv(); else if (tab === "means") renderMeans(); else renderPlan(); }
function setTab(t) {
  tab = t;
  document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  document.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== t; });
  renderAll();
}
function setConf(c) {
  conf = c;
  document.querySelectorAll("[data-conf]").forEach((b) => b.classList.toggle("on", Number(b.dataset.conf) === c));
  renderAll();
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]"); if (t) { setTab(t.dataset.tab); return; }
  const c = e.target.closest("[data-conf]"); if (c) { setConf(Number(c.dataset.conf)); return; }
  const m = e.target.closest("[data-minput]");
  if (m) {
    meansInput = m.dataset.minput;
    document.querySelectorAll("[data-minput]").forEach((b) => b.classList.toggle("on", b === m));
    document.querySelectorAll("[data-mmode]").forEach((g) => { g.hidden = g.dataset.mmode !== meansInput; });
    renderMeans(); return;
  }
  if (e.target.closest('[data-act="share"]')) {
    const p = new URLSearchParams({ tab, conf: String(conf) });
    FIELDS.forEach((id) => p.set(id, $("#" + id).value));
    const url = location.href.split("#")[0] + "#" + p.toString();
    const st = $("#shareStatus");
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { st.textContent = "Copied."; }, () => { history.replaceState(null, "", url); st.textContent = "Link is in the address bar."; });
    setTimeout(() => (st.textContent = ""), 2500);
  }
});
document.addEventListener("input", (e) => { if (e.target.matches("input, textarea, select")) renderAll(); });
document.addEventListener("change", (e) => { if (e.target.matches("select")) renderAll(); });

(function boot() {
  const h = new URLSearchParams(location.hash.slice(1));
  FIELDS.forEach((id) => { if (h.has(id)) $("#" + id).value = h.get(id); });
  if (h.has("conf")) conf = Number(h.get("conf")) || 0.95;
  document.querySelectorAll("[data-conf]").forEach((b) => b.classList.toggle("on", Number(b.dataset.conf) === conf));
  const def = document.body.dataset.defaultTab || "conv";
  setTab(["conv", "means", "plan"].includes(h.get("tab")) ? h.get("tab") : def);
})();
