/**
 * ql-stats.js — small, dependency-free statistics library for the
 * client-side tools in free-tools/ (correlation-matrix, ab-test-calculator).
 *
 * Pure math only: no DOM, no network, no QuantumLayers calls. Loaded with a
 * plain <script> tag in the browser (exposes window.QLStats) and require()-able
 * from Node, which is how it's unit-tested against SciPy (see
 * free-tools/tests/).
 *
 * Where QuantumLayers computes the same thing server-side, this follows QL's
 * own definitions so results line up:
 *  - pearson(): pairwise deletion — a row counts for a pair only when both
 *    values are numeric — same as QL_Analytics::pearsonCorrelationMatrix().
 *  - inferType(): a port of QL's ql_infer_type() (quantumlayers.php), the
 *    rule QL applies to every uploaded or API-sourced column.
 */
(function (global) {
  'use strict';

  // -------------------------------------------------------------------
  // Special functions
  // -------------------------------------------------------------------

  // Lanczos approximation (g=7, n=9), accurate to ~1e-15 for x > 0.
  var LANCZOS = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    var a = LANCZOS[0];
    var t = x + 7.5;
    for (var i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  // Continued fraction for the incomplete beta (Numerical Recipes betacf,
  // modified Lentz).
  function betacf(x, a, b) {
    var MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1;
    var c = 1, d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m;
      var aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  /** Regularized incomplete beta I_x(a, b). */
  function betainc(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a;
    return 1 - (bt * betacf(1 - x, b, a)) / b;
  }

  /** Regularized upper incomplete gamma Q(a, x). */
  function gammaincc(a, x) {
    if (x <= 0) return 1;
    var gln = lgamma(a);
    if (x < a + 1) {
      // series for P, return 1 - P
      var ap = a, sum = 1 / a, del = sum;
      for (var n = 0; n < 500; n++) {
        ap += 1; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
      }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
    }
    // continued fraction for Q
    var b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (var i = 1; i < 500; i++) {
      var an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      var del2 = d * c;
      h *= del2;
      if (Math.abs(del2 - 1) < 1e-16) break;
    }
    return Math.exp(-x + a * Math.log(x) - gln) * h;
  }

  // erfc with ~1.2e-7 relative accuracy everywhere is not enough for tiny
  // p-values, so use the incomplete gamma identity instead:
  //   erfc(x) = Q(1/2, x^2) for x >= 0.
  function erfc(x) {
    if (x < 0) return 2 - erfc(-x);
    return gammaincc(0.5, x * x);
  }

  /** Standard normal CDF. */
  function normCdf(z) { return 0.5 * erfc(-z / Math.SQRT2); }
  /** Standard normal survival function, 1 - CDF, accurate in the tail. */
  function normSf(z) { return 0.5 * erfc(z / Math.SQRT2); }

  /** Inverse standard normal CDF (Acklam, refined with one Halley step). */
  function normInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    var a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
    var b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    var c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    var pl = 0.02425, q, r, x;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pl) {
      q = p - 0.5; r = q * q;
      x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    var e = normCdf(x) - p;
    var u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    return x - u / (1 + (x * u) / 2);
  }

  /** Two-sided p-value for a Student t statistic with df degrees of freedom. */
  function tTwoSidedP(t, df) {
    if (!Number.isFinite(t)) return 0;
    return betainc(df / (df + t * t), df / 2, 0.5);
  }

  /** Student t CDF. */
  function tCdf(t, df) {
    var tail = 0.5 * betainc(df / (df + t * t), df / 2, 0.5);
    return t > 0 ? 1 - tail : tail;
  }

  /** Inverse Student t CDF by bisection on tCdf (plenty fast for UI use). */
  function tInv(p, df) {
    if (df > 1e6) return normInv(p);
    var lo = -1e3, hi = 1e3;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      if (tCdf(mid, df) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** Chi-square survival function P(X > x). */
  function chi2Sf(x, k) { return gammaincc(k / 2, x / 2); }

  // -------------------------------------------------------------------
  // Descriptives
  // -------------------------------------------------------------------

  function finiteOnly(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) if (typeof arr[i] === 'number' && Number.isFinite(arr[i])) out.push(arr[i]);
    return out;
  }

  function mean(xs) { var s = 0; for (var i = 0; i < xs.length; i++) s += xs[i]; return xs.length ? s / xs.length : NaN; }

  /** Sample variance (n - 1). */
  function variance(xs) {
    var n = xs.length; if (n < 2) return NaN;
    var m = mean(xs), s = 0;
    for (var i = 0; i < n; i++) s += (xs[i] - m) * (xs[i] - m);
    return s / (n - 1);
  }

  function quantile(sorted, p) {
    if (!sorted.length) return NaN;
    var i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  function describe(values) {
    var xs = finiteOnly(values);
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var v = variance(xs);
    return {
      n: xs.length, mean: mean(xs), sd: Math.sqrt(v), variance: v,
      min: s[0], q1: quantile(s, 0.25), median: quantile(s, 0.5), q3: quantile(s, 0.75), max: s[s.length - 1],
    };
  }

  // -------------------------------------------------------------------
  // Correlation
  // -------------------------------------------------------------------

  function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

  /** Rows where both a[i] and b[i] are finite numbers (pairwise deletion). */
  function pairwise(a, b) {
    var xs = [], ys = [];
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) if (isNum(a[i]) && isNum(b[i])) { xs.push(a[i]); ys.push(b[i]); }
    return { xs: xs, ys: ys };
  }

  function pearsonRaw(xs, ys) {
    var n = xs.length; if (n < 3) return NaN;
    var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++) {
      var dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx === 0 || syy === 0) return NaN;
    var r = sxy / Math.sqrt(sxx * syy);
    return Math.max(-1, Math.min(1, r));
  }

  /** Average ranks (ties share the mean of their positions), 1-based. */
  function rank(xs) {
    var idx = xs.map(function (v, i) { return i; }).sort(function (i, j) { return xs[i] - xs[j]; });
    var ranks = new Array(xs.length);
    var k = 0;
    while (k < idx.length) {
      var j = k;
      while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[k]]) j++;
      var r = (k + j) / 2 + 1;
      for (var m = k; m <= j; m++) ranks[idx[m]] = r;
      k = j + 1;
    }
    return ranks;
  }

  /** p-value for H0: rho = 0, using the t approximation (as SciPy does). */
  function corrPValue(r, n) {
    if (!Number.isFinite(r) || n < 3) return NaN;
    if (Math.abs(r) >= 1) return 0;
    var df = n - 2;
    var t = r * Math.sqrt(df / (1 - r * r));
    return tTwoSidedP(t, df);
  }

  /** 95% (or 1-alpha) confidence interval for r via Fisher's z. */
  function corrCI(r, n, alpha) {
    if (!Number.isFinite(r) || n < 4) return [NaN, NaN];
    alpha = alpha || 0.05;
    var z = Math.atanh(Math.max(-0.999999999, Math.min(0.999999999, r)));
    var se = 1 / Math.sqrt(n - 3), zc = normInv(1 - alpha / 2);
    return [Math.tanh(z - zc * se), Math.tanh(z + zc * se)];
  }

  /**
   * Correlation between two columns with pairwise deletion.
   * method: 'pearson' | 'spearman'. Returns { r, n, p, ci }.
   */
  function correlate(a, b, method) {
    var pw = pairwise(a, b);
    var n = pw.xs.length;
    var r = method === 'spearman' ? pearsonRaw(rank(pw.xs), rank(pw.ys)) : pearsonRaw(pw.xs, pw.ys);
    return { r: r, n: n, p: corrPValue(r, n), ci: corrCI(r, n) };
  }

  /** Holm–Bonferroni adjusted p-values (same order as input; NaN kept). */
  function holm(ps) {
    var items = [];
    ps.forEach(function (p, i) { if (Number.isFinite(p)) items.push({ p: p, i: i }); });
    items.sort(function (x, y) { return x.p - y.p; });
    var m = items.length, out = ps.map(function () { return NaN; }), running = 0;
    items.forEach(function (it, k) {
      running = Math.max(running, Math.min(1, (m - k) * it.p));
      out[it.i] = running;
    });
    return out;
  }

  /** Least-squares line y = intercept + slope * x. */
  function linearFit(xs, ys) {
    var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0;
    for (var i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    var slope = sxx === 0 ? NaN : sxy / sxx;
    return { slope: slope, intercept: my - slope * mx };
  }

  // -------------------------------------------------------------------
  // Hypothesis tests used by the A/B calculator
  // -------------------------------------------------------------------

  /**
   * Two-proportion test, A = control, B = variant.
   * p-value: pooled z-test (equivalent to a 2x2 chi-square without Yates'
   * correction). Intervals: unpooled Wald for the absolute difference, and
   * the delta method on log(pB/pA) for the relative lift.
   */
  function twoProportion(nA, xA, nB, xB, alpha) {
    alpha = alpha || 0.05;
    var pA = xA / nA, pB = xB / nB;
    var pool = (xA + xB) / (nA + nB);
    var sePool = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
    var z = sePool > 0 ? (pB - pA) / sePool : 0;
    var p = 2 * normSf(Math.abs(z));
    var zc = normInv(1 - alpha / 2);
    var seDiff = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
    var diff = pB - pA;
    var rel = pA > 0 ? pB / pA - 1 : NaN;
    var relCI = [NaN, NaN];
    if (xA > 0 && xB > 0) {
      var seLog = Math.sqrt((1 - pA) / xA + (1 - pB) / xB);
      var lr = Math.log(pB / pA);
      relCI = [Math.exp(lr - zc * seLog) - 1, Math.exp(lr + zc * seLog) - 1];
    }
    // post-hoc power to detect the observed difference at this alpha
    var power = seDiff > 0 ? normCdf(Math.abs(diff) / seDiff - zc) + normCdf(-Math.abs(diff) / seDiff - zc) : NaN;
    return {
      pA: pA, pB: pB, diff: diff, diffCI: [diff - zc * seDiff, diff + zc * seDiff],
      rel: rel, relCI: relCI, z: z, p: p, power: power,
    };
  }

  /**
   * Per-group sample size to detect pA -> pB with a two-sided test
   * (normal approximation with pooled variance under H0, as in most
   * online calculators and G*Power's "z test, two proportions").
   */
  function sampleSizeTwoProportion(pA, pB, alpha, power, ratio) {
    alpha = alpha || 0.05; power = power || 0.8; ratio = ratio || 1; // nB = ratio * nA
    var za = normInv(1 - alpha / 2), zb = normInv(power);
    var pbar = (pA + ratio * pB) / (1 + ratio);
    var d = Math.abs(pB - pA);
    if (d === 0) return Infinity;
    var num = za * Math.sqrt(pbar * (1 - pbar) * (1 + 1 / ratio)) + zb * Math.sqrt(pA * (1 - pA) + (pB * (1 - pB)) / ratio);
    return Math.ceil((num * num) / (d * d));
  }

  /** Welch's t-test from summary statistics. */
  function welch(m1, s1, n1, m2, s2, n2, alpha) {
    alpha = alpha || 0.05;
    var v1 = (s1 * s1) / n1, v2 = (s2 * s2) / n2;
    var se = Math.sqrt(v1 + v2);
    var df = ((v1 + v2) * (v1 + v2)) / ((v1 * v1) / (n1 - 1) + (v2 * v2) / (n2 - 1));
    var diff = m2 - m1;
    var t = se > 0 ? diff / se : 0;
    var p = tTwoSidedP(t, df);
    var tc = tInv(1 - alpha / 2, df);
    var sp = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2));
    return {
      diff: diff, se: se, t: t, df: df, p: p, ci: [diff - tc * se, diff + tc * se],
      rel: m1 !== 0 ? diff / Math.abs(m1) : NaN, d: sp > 0 ? diff / sp : NaN,
    };
  }

  /**
   * Mann–Whitney U (two-sided), normal approximation with tie correction
   * and continuity correction — SciPy's mannwhitneyu(method='asymptotic').
   */
  function mannWhitney(a, b) {
    var x = finiteOnly(a), y = finiteOnly(b);
    var n1 = x.length, n2 = y.length;
    var all = x.concat(y), r = rank(all);
    var r1 = 0; for (var i = 0; i < n1; i++) r1 += r[i];
    var u1 = r1 - (n1 * (n1 + 1)) / 2;
    var n = n1 + n2;
    var counts = {};
    all.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var tie = 0; Object.keys(counts).forEach(function (k) { var t = counts[k]; tie += t * t * t - t; });
    var mu = (n1 * n2) / 2;
    var sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - tie / (n * (n - 1))));
    var u = Math.max(u1, n1 * n2 - u1);
    var z = sigma > 0 ? (u - mu - 0.5) / sigma : 0;
    var p = Math.min(1, 2 * normSf(z));
    return { u: u1, z: z, p: p, probSuperiority: u1 / (n1 * n2) };
  }

  /** Chi-square goodness of fit of observed counts to expected proportions. */
  function chiSquareGof(observed, expectedShares) {
    var total = observed.reduce(function (s, v) { return s + v; }, 0);
    var shareSum = expectedShares.reduce(function (s, v) { return s + v; }, 0);
    var stat = 0;
    observed.forEach(function (o, i) {
      var e = (total * expectedShares[i]) / shareSum;
      stat += e > 0 ? ((o - e) * (o - e)) / e : 0;
    });
    var df = observed.length - 1;
    return { chi2: stat, df: df, p: chi2Sf(stat, df) };
  }

  // -------------------------------------------------------------------
  // QuantumLayers column typing (port of ql_infer_type in quantumlayers.php)
  // -------------------------------------------------------------------

  /** PHP is_numeric() for strings/numbers. */
  function phpIsNumeric(v) {
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v !== 'string') return false;
    return /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/.test(v);
  }
  /** PHP's (string) cast of a scalar. */
  function phpString(v) {
    if (v === null || v === undefined) return '';
    if (v === true) return '1';
    if (v === false) return '';
    if (typeof v === 'number') {
      if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
      return String(Number(v.toPrecision(14))); // PHP precision=14
    }
    return String(v);
  }

  function nameSuggestsDate(name) {
    var spaced = String(name).replace(/([a-z])([A-Z])/g, '$1 $2');
    var tokens = spaced.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return tokens.some(function (t) {
      return ['yr', 'fy', 'dt', 'yyyy', 'time', 'timestamp'].indexOf(t) >= 0 || /(date|dates|year|years|period)$/.test(t);
    });
  }

  var ENTITIES = 'user|customer|client|order|product|item|account|acct|member|employee|store|session|transaction|' +
    'invoice|vendor|supplier|patient|student|event|record|device|ticket|serial|reference|ref|policy|' +
    'case|tracking|part|document|doc|receipt|shipment|batch|lot';
  var CODE_TOKENS = ['id', 'ids', 'uuid', 'guid', 'code', 'zip', 'zipcode', 'postcode', 'postalcode', 'postal',
    'sku', 'ean', 'upc', 'gtin', 'isbn', 'fips', 'ssn', 'iban', 'phone', 'tel', 'telephone', 'msisdn'];
  function nameSuggestsIdentifier(name) {
    var raw = String(name).trim().toLowerCase();
    if (raw === '' || raw === '#' || /^(unnamed:?\s*\d+|x\d*|\.\.\.\d+|index|idx|row|rownum|row_?(no|num|number|id|index))$/.test(raw)) return true;
    var tokens = String(name).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    var entRe = new RegExp('^(' + ENTITIES + ')id$'), entOnly = new RegExp('^(' + ENTITIES + ')$');
    for (var i = 0; i < tokens.length; i++) {
      if (CODE_TOKENS.indexOf(tokens[i]) >= 0 || entRe.test(tokens[i])) return true;
      if (['no', 'nr', 'num', 'number'].indexOf(tokens[i]) >= 0 && i > 0 && entOnly.test(tokens[i - 1])) return true;
    }
    return false;
  }

  /**
   * QL's column type for a list of raw values: 'integer' | 'float' | 'date' |
   * 'datetime' | 'string'. `values` should be the column's non-empty values
   * in row order (QL drops empties before calling ql_infer_type for uploads).
   */
  function inferType(values, colName) {
    if (!values.length) return 'string';
    var sample = values.slice(0, 100);
    var intC = 0, floatC = 0, dateC = 0, dtC = 0, yearC = 0;
    var nameIsDate = colName != null && colName !== '' && nameSuggestsDate(colName);
    sample.forEach(function (val) {
      if (val === null || val === '' || val === undefined) return;
      var isStr = typeof val === 'string';
      if (isStr && /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}/.test(val)) { dtC++; return; }
      if (isStr && /^\d{4}-\d{2}-\d{2}$/.test(val)) { dateC++; return; }
      if (isStr && /^[12]\d{3}(?:[-/]|-?M)(0[1-9]|1[0-2])$|^[12]\d{3}-?Q[1-4]$/i.test(val)) { dateC++; return; }
      if (nameIsDate && /^[12]\d{3}$/.test(phpString(val))) { yearC++; return; }
      if (phpIsNumeric(val)) {
        var s = phpString(val);
        var asInt = parseInt(s, 10);
        if (String(asInt) === s) intC++; else floatC++;
      }
    });
    var total = sample.length;
    if (dtC / total > 0.8) return 'datetime';
    if ((dateC + yearC) / total > 0.8) return 'date';
    if ((intC + floatC) / total > 0.8) {
      var digits = 0, leadingZero = 0;
      sample.forEach(function (val) {
        if (val === null || val === '' || val === undefined) return;
        var str = phpString(val);
        if (/^\d+$/.test(str)) { digits++; if (str.length > 1 && str[0] === '0') leadingZero++; }
      });
      var allDigits = digits === intC + floatC;
      if ((allDigits && colName != null && nameSuggestsIdentifier(colName)) || (leadingZero > 0 && digits / total > 0.8)) return 'string';
    }
    if (intC / total > 0.8) return 'integer';
    if ((intC + floatC) / total > 0.8) return 'float';
    return 'string';
  }

  var QLStats = {
    lgamma: lgamma, betainc: betainc, gammaincc: gammaincc, erfc: erfc,
    normCdf: normCdf, normSf: normSf, normInv: normInv,
    tCdf: tCdf, tInv: tInv, tTwoSidedP: tTwoSidedP, chi2Sf: chi2Sf,
    mean: mean, variance: variance, quantile: quantile, describe: describe,
    pairwise: pairwise, rank: rank, correlate: correlate, corrPValue: corrPValue, corrCI: corrCI,
    holm: holm, linearFit: linearFit,
    twoProportion: twoProportion, sampleSizeTwoProportion: sampleSizeTwoProportion,
    welch: welch, mannWhitney: mannWhitney, chiSquareGof: chiSquareGof,
    phpIsNumeric: phpIsNumeric, phpString: phpString,
    nameSuggestsDate: nameSuggestsDate, nameSuggestsIdentifier: nameSuggestsIdentifier, inferType: inferType,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = QLStats;
  else global.QLStats = QLStats;
})(typeof window !== 'undefined' ? window : this);
