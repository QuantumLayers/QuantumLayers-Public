/**
 * api-parse.js — turns a raw API response body into table rows, the same way
 * QuantumLayers does when you connect a REST API as a dataset.
 *
 * This is a line-by-line port of QL's server-side pipeline in
 * quantumlayers.php, so what this tool shows is what QL would import:
 *
 *   ql_parse_api_response_body()        -> parseApiResponse()
 *   ql_convert_sdmx_json_to_rows()      -> sdmxToRows()
 *   ql_resolve_response_path()          -> resolvePath()
 *   ql_convert_period_keyed_map_to_rows -> periodKeyedMapToRows()
 *   ql_detect_json_format()             -> detectJsonFormat()
 *   ql_xml_to_array()                   -> xmlToArray()
 *   ql_flatten_row()                    -> flattenRow()
 *
 * Differences, on purpose:
 *  - Every detection also reports the *path* it used (e.g. "data", "1",
 *    "properties.parameter"), so the tool can suggest the response_path to
 *    paste into QL.
 *  - CSV bodies are accepted (QL's REST connector only reads JSON/XML; the
 *    tool says so when it sees one).
 *  - ENTSO-E TimeSeries XML is recognised but not expanded (QL expands it
 *    server-side into one row per point).
 *
 * No DOM dependency except xmlToArray(), which takes an already-parsed XML
 * Document (DOMParser in the browser). Works under Node for tests.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------
  // PHP-array semantics on top of JSON values
  // ---------------------------------------------------------------------

  function isObj(v) { return v !== null && typeof v === 'object'; }
  function keysOf(v) { return Array.isArray(v) ? v.map(function (_, i) { return i; }) : Object.keys(v); }
  function valuesOf(v) { return Array.isArray(v) ? v : Object.keys(v).map(function (k) { return v[k]; }); }
  function sizeOf(v) { return Array.isArray(v) ? v.length : Object.keys(v).length; }
  /** PHP is_array(): JSON arrays and objects both decode to PHP arrays. */
  function isArr(v) { return isObj(v); }
  /** ql_is_associative_array(): non-empty, and keys aren't exactly 0..n-1. */
  function isAssoc(v) {
    if (!isObj(v) || sizeOf(v) === 0) return false;
    if (Array.isArray(v)) return false;
    var ks = Object.keys(v);
    // json_decode turns {"0":..,"1":..} into a list, so those aren't assoc.
    return !ks.every(function (k, i) { return k === String(i); });
  }
  function isScalar(v) { return v === null || (!isObj(v) && v !== undefined); }
  function first(v) { var vs = valuesOf(v); return vs.length ? vs[0] : undefined; }
  function has(v, k) { return isObj(v) && Object.prototype.hasOwnProperty.call(v, k); }
  /** PHP isset($a[$k]): present and not null. */
  function isset(v, k) { return has(v, k) && v[k] !== null && v[k] !== undefined; }
  /** PHP empty() for arrays. */
  function nonEmptyArr(v) { return isArr(v) && sizeOf(v) > 0; }

  // ---------------------------------------------------------------------
  // Path resolution (dot notation; numeric segments index lists)
  // ---------------------------------------------------------------------

  function resolvePath(data, path) {
    var node = data;
    var segs = String(path).split('.');
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (seg === '') continue;
      if (!isObj(node)) return null;
      if (Array.isArray(node)) {
        if (!/^\d+$/.test(seg) || Number(seg) >= node.length) return null;
        node = node[Number(seg)];
      } else {
        if (!has(node, seg)) return null;
        node = node[seg];
      }
      if (node === null || node === undefined) return null;
    }
    return node;
  }

  function joinPath(a, b) {
    a = String(a == null ? '' : a); b = String(b == null ? '' : b);
    if (a === '') return b;
    return b === '' ? a : a + '.' + b;
  }

  // ---------------------------------------------------------------------
  // SDMX-JSON
  // ---------------------------------------------------------------------

  function normalizeSdmxPeriod(p) {
    p = String(p).trim();
    var m = /^(\d{4})-?M(\d{2})$/i.exec(p);
    if (m) return m[1] + '-' + m[2];
    m = /^(\d{4})-?A1?$/i.exec(p);
    if (m) return m[1];
    return p;
  }

  function sdmxToRows(doc) {
    if (!isObj(doc)) return null;
    var root = isArr(doc.data) ? doc.data : doc;
    if (!isArr(root.dataSets)) return null;
    var dims;
    if (root.structures && root.structures[0] && root.structures[0].dimensions) dims = root.structures[0].dimensions;
    else if (root.structure && root.structure.dimensions) dims = root.structure.dimensions;
    else return null;

    function decodeDims(list) {
      var out = [];
      valuesOf(list || []).forEach(function (dim) {
        var codes = valuesOf((dim && dim.values) || []).map(function (v) {
          var code = v.id != null ? v.id : v.value != null ? v.value : v.name != null ? v.name : '';
          return isScalar(code) ? String(code) : '';
        });
        out.push({ id: String(dim && dim.id != null ? dim.id : 'DIM' + out.length), codes: codes });
      });
      return out;
    }
    var seriesDims = decodeDims(dims.series), obsDims = decodeDims(dims.observation);
    function applyKey(key, list, row) {
      String(key).split(':').forEach(function (idx, pos) {
        if (list[pos]) row[list[pos].id] = list[pos].codes[parseInt(idx, 10)] != null ? list[pos].codes[parseInt(idx, 10)] : idx;
      });
    }
    function obsValue(obs) {
      var v = Array.isArray(obs) ? obs[0] : obs;
      if (v === null || v === undefined || v === '' || (typeof v === 'string' && v.toLowerCase() === 'nan')) return null;
      return v;
    }

    var long = [];
    valuesOf(root.dataSets).forEach(function (ds) {
      if (ds && nonEmptyArr(ds.series)) {
        Object.keys(ds.series).forEach(function (sk) {
          var base = {}; applyKey(sk, seriesDims, base);
          var obs = ds.series[sk].observations || {};
          Object.keys(obs).forEach(function (ok) {
            var row = Object.assign({}, base); applyKey(ok, obsDims, row);
            row.value = obsValue(obs[ok]); long.push(row);
          });
        });
      } else if (ds && nonEmptyArr(ds.observations)) {
        Object.keys(ds.observations).forEach(function (ok) {
          var row = {}; applyKey(ok, obsDims, row);
          row.value = obsValue(ds.observations[ok]); long.push(row);
        });
      }
    });
    if (!long.length) return [];

    var allIds = seriesDims.map(function (d) { return d.id; }).concat(obsDims.map(function (d) { return d.id; }));
    var timeId = allIds.indexOf('TIME_PERIOD') >= 0 ? 'TIME_PERIOD' : (obsDims.length ? obsDims[obsDims.length - 1].id : null);
    long.forEach(function (r) { if (timeId !== null && r[timeId] != null) r[timeId] = normalizeSdmxPeriod(r[timeId]); });

    var varying = [];
    allIds.forEach(function (id) {
      if (id === timeId) return;
      var seen = {}, n = 0;
      for (var i = 0; i < long.length; i++) {
        var k = long[i][id] != null ? long[i][id] : '';
        if (!seen[k]) { seen[k] = 1; n++; }
        if (n > 1) { varying.push(id); break; }
      }
    });

    if (timeId === null || varying.length > 1) {
      var keep = varying.concat(timeId !== null ? [timeId] : [], ['value']);
      return long.map(function (r) { var o = {}; keep.forEach(function (k) { o[k] = r[k] != null ? r[k] : null; }); return o; });
    }
    var pivot = varying.length ? varying[0] : null;
    var cols = [], colSeen = {}, byTime = {};
    long.forEach(function (r) {
      var t = String(r[timeId] != null ? r[timeId] : '');
      var c = pivot !== null ? String(r[pivot]) : 'value';
      if (!colSeen[c]) { colSeen[c] = 1; cols.push(c); }
      (byTime[t] = byTime[t] || {})[c] = r.value;
    });
    return Object.keys(byTime).sort().map(function (t) {
      var row = {}; row[timeId] = t;
      cols.forEach(function (c) { row[c] = byTime[t][c] !== undefined ? byTime[t][c] : null; });
      return row;
    });
  }

  // ---------------------------------------------------------------------
  // Period-keyed maps ({"2020": 1.2} / {"T2M": {"20240101": 5.1}})
  // ---------------------------------------------------------------------

  function normalizePeriodKey(key) {
    key = String(key);
    var m = /^(\d{4})(\d{2})(\d{2})(\d{2})?$/.exec(key);
    if (m) {
      var y = +m[1], mo = +m[2], d = +m[3];
      var dt = new Date(Date.UTC(y, mo - 1, d));
      var valid = mo >= 1 && mo <= 12 && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
      if (valid) {
        var date = m[1] + '-' + m[2] + '-' + m[3];
        if (m[4] !== undefined && m[4] !== '') return +m[4] < 24 ? date + ' ' + m[4] + ':00' : key;
        return date;
      }
    }
    return key;
  }

  function isPeriodMap(map) {
    if (!isAssoc(map)) return false;
    var ks = Object.keys(map);
    for (var i = 0; i < ks.length; i++) {
      if (!/^\d/.test(ks[i]) || !isScalar(map[ks[i]])) return false;
    }
    return true;
  }

  function periodKeyedMapToRows(node) {
    if (!isAssoc(node)) return null;
    if (isPeriodMap(node)) {
      return Object.keys(node).map(function (p) { return { period: normalizePeriodKey(p), value: node[p] }; });
    }
    var names = Object.keys(node);
    for (var i = 0; i < names.length; i++) if (!isPeriodMap(node[names[i]])) return null;
    var byPeriod = {};
    names.forEach(function (name) {
      Object.keys(node[name]).forEach(function (p) {
        if (!byPeriod[p]) byPeriod[p] = { period: normalizePeriodKey(p) };
        byPeriod[p][name] = node[name][p];
      });
    });
    return Object.keys(byPeriod).sort().map(function (p) {
      var row = byPeriod[p];
      names.forEach(function (n) { if (!has(row, n)) row[n] = null; });
      return row;
    });
  }

  // ---------------------------------------------------------------------
  // Generic JSON format detection
  // ---------------------------------------------------------------------

  function isPureColumnar(data) {
    if (!nonEmptyArr(data)) return false;
    var vs = valuesOf(data);
    if (!isArr(vs[0])) return false;
    var len = sizeOf(vs[0]);
    return vs.every(function (v) { return isArr(v) && sizeOf(v) === len; });
  }
  function columnarToRows(data) {
    var cols = Object.keys(data), rows = [];
    var n = sizeOf(data[cols[0]]);
    for (var i = 0; i < n; i++) {
      var row = {};
      cols.forEach(function (c) { row[c] = valuesOf(data[c])[i]; });
      rows.push(row);
    }
    return rows;
  }
  function columnOrientedToRows(columns, data) {
    var names = valuesOf(columns).map(function (c) {
      if (isObj(c)) return String(c.name || c.id || c.label || c.key || 'Array');
      return String(c);
    });
    var rows = [];
    valuesOf(data).forEach(function (rd) {
      if (!isArr(rd)) return;
      var vals = valuesOf(rd), row = {};
      names.forEach(function (n, i) { row[n] = vals[i] !== undefined ? vals[i] : null; });
      rows.push(row);
    });
    return rows;
  }
  /** ql_format_ga4_dimension_value(): compact GA4 date dimensions -> ISO. */
  function formatGa4Dimension(name, v) {
    if (typeof v !== 'string' || !/^\d+$/.test(v)) return v;
    var d = v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6, 8);
    if (name === 'date' && v.length === 8) return d;
    if (name === 'dateHour' && v.length === 10) return d + ' ' + v.slice(8, 10) + ':00';
    if (name === 'dateHourMinute' && v.length === 12) return d + ' ' + v.slice(8, 10) + ':' + v.slice(10, 12);
    if (name === 'yearMonth' && v.length === 6) return v.slice(0, 4) + '-' + v.slice(4, 6);
    return v;
  }
  function ga4ToRows(data) {
    var dn = valuesOf(data.dimensionHeaders || []).map(function (h) { return h && h.name; });
    var mn = valuesOf(data.metricHeaders || []).map(function (h) { return h && h.name; });
    return valuesOf(data.rows).filter(isArr).map(function (r) {
      var flat = {};
      valuesOf(r.dimensionValues || []).forEach(function (c, i) { if (dn[i] != null) flat[dn[i]] = formatGa4Dimension(dn[i], c && has(c, 'value') ? c.value : null); });
      valuesOf(r.metricValues || []).forEach(function (c, i) { if (mn[i] != null) flat[mn[i]] = c && has(c, 'value') ? c.value : null; });
      return flat;
    });
  }
  function looksLikeDataRow(data) {
    if (!isAssoc(data)) return false;
    var simple = 0, complex = 0;
    valuesOf(data).forEach(function (v) {
      if (isScalar(v)) simple++;
      else if (isAssoc(v)) complex++;
    });
    return simple > 0 && simple >= complex * 2;
  }

  var COMMON_DATA_KEYS = ['data', 'results', 'items', 'records', 'rows', 'entries', 'content', 'payload'];
  var PAGINATION_KEYS = ['response', 'result', 'body', 'output'];

  /** Returns { format, rows, subpath } or { error }. subpath is relative to `data`. */
  function detectJsonFormat(data) {
    if (nonEmptyArr(data) && !isAssoc(data)) {
      var f = first(data);
      if (isAssoc(f)) return { format: 'direct_array', rows: valuesOf(data), subpath: '' };
    }
    if (isAssoc(data)) {
      if (nonEmptyArr(data.rows) && (isset(data, 'dimensionHeaders') || isset(data, 'metricHeaders'))) {
        var fr = first(data.rows);
        if (isArr(fr) && (isset(fr, 'dimensionValues') || isset(fr, 'metricValues'))) {
          return { format: 'ga4_report', rows: ga4ToRows(data), subpath: '' };
        }
      }
      for (var i = 0; i < COMMON_DATA_KEYS.length; i++) {
        var key = COMMON_DATA_KEYS[i];
        if (isset(data, key) && nonEmptyArr(data[key]) && !isAssoc(data[key])) {
          if (isAssoc(first(data[key]))) return { format: 'nested_' + key, rows: valuesOf(data[key]), subpath: key };
        }
      }
      if (isset(data, 'columns') && isset(data, 'data') && isArr(data.columns) && isArr(data.data)) {
        return { format: 'column_oriented', rows: columnOrientedToRows(data.columns, data.data), subpath: '' };
      }
      if (isset(data, 'headers') && isset(data, 'rows') && isArr(data.headers) && isArr(data.rows)) {
        return { format: 'headers_rows', rows: columnOrientedToRows(data.headers, data.rows), subpath: '' };
      }
      if (isset(data, 'fields') && isset(data, 'records') && isArr(data.fields) && isArr(data.records)) {
        return { format: 'fields_records', rows: columnOrientedToRows(data.fields, data.records), subpath: '' };
      }
      if (isPureColumnar(data)) return { format: 'pure_columnar', rows: columnarToRows(data), subpath: '' };
      for (var j = 0; j < PAGINATION_KEYS.length; j++) {
        var pk = PAGINATION_KEYS[j];
        if (isset(data, pk) && isArr(data[pk])) {
          var nested = detectJsonFormat(data[pk]);
          if (!nested.error) return { format: 'nested_' + pk + '_' + nested.format, rows: nested.rows, subpath: joinPath(pk, nested.subpath) };
        }
      }
      if (looksLikeDataRow(data)) return { format: 'single_object', rows: [data], subpath: '' };
    }
    return { error: 'Unable to detect tabular format' };
  }

  // ---------------------------------------------------------------------
  // XML
  // ---------------------------------------------------------------------

  function elementChildren(el) {
    var out = [];
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n);
    return out;
  }
  function localName(el) { return el.localName || el.nodeName; }

  /** ql_xml_to_array(): leaves -> strings, repeated names -> lists, attributes -> "@name". */
  function xmlToArray(el) {
    var out = {};
    if (el.attributes) {
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name === 'xmlns' || a.name.indexOf('xmlns:') === 0) continue;
        out['@' + (a.localName || a.name)] = a.value;
      }
    }
    var kids = elementChildren(el);
    if (!kids.length) {
      var text = (el.textContent || '').trim();
      if (!Object.keys(out).length) return text;
      if (text !== '') out.value = text;
      return out;
    }
    var groups = {}, order = [];
    kids.forEach(function (k) {
      var n = localName(k);
      if (!groups[n]) { groups[n] = []; order.push(n); }
      groups[n].push(k);
    });
    order.forEach(function (n) {
      out[n] = groups[n].length === 1 ? xmlToArray(groups[n][0]) : groups[n].map(xmlToArray);
    });
    return out;
  }

  function parseXmlDocument(doc) {
    var root = doc && doc.documentElement;
    if (!root || root.getElementsByTagName('parsererror').length || localName(root) === 'parsererror') {
      return { error: 'Invalid JSON or XML response' };
    }
    var name = localName(root);
    if (name === 'Acknowledgement_MarketDocument') {
      var reasons = [];
      elementChildren(root).forEach(function (c) {
        if (localName(c) === 'Reason') elementChildren(c).forEach(function (t) { if (localName(t) === 'text' && t.textContent.trim()) reasons.push(t.textContent.trim()); });
      });
      return { error: 'ENTSO-E: ' + (reasons.length ? reasons.join(' ') : 'request was rejected') };
    }
    var hasTs = elementChildren(root).some(function (c) {
      return localName(c) === 'TimeSeries' && elementChildren(c).some(function (p) { return localName(p) === 'Period'; });
    });
    if (hasTs) {
      return {
        error: 'This is an ENTSO-E TimeSeries document. QuantumLayers expands it server-side into one row per point ' +
          '(timestamp_utc, position, quantity/price, …); this preview doesn\'t replicate that conversion.',
        entsoe: true,
      };
    }
    var data = {}; data[name] = xmlToArray(root);
    return { data: data };
  }

  // ---------------------------------------------------------------------
  // Flattening + entry point
  // ---------------------------------------------------------------------

  /** ql_flatten_row(): nested objects/lists -> dot-separated keys. */
  function flattenRow(row, prefix) {
    prefix = prefix || '';
    var flat = {};
    keysOf(row).forEach(function (k) {
      var v = row[k];
      var full = prefix !== '' ? prefix + '.' + k : String(k);
      if (isObj(v)) Object.assign(flat, flattenRow(v, full));
      else flat[full] = v === undefined ? null : v;
    });
    return flat;
  }

  /** Column headers in first-seen order across all rows. */
  function headersOf(flatRows) {
    var seen = {}, out = [];
    flatRows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } }); });
    return out;
  }

  /**
   * Parse a response body exactly like QL does.
   *
   * @param {string} body
   * @param {string} responsePath dot-notation path ('' for auto)
   * @param {object} [opts] { parseXml: (string) => Document, parseCsv: (string) => {headers, rows} }
   * @returns {{ok, format, rows, headers, path, pathMissing, kind, error, data}}
   *   rows are flattened (ql_flatten_row); `path` is the full response_path
   *   that selects the rows' node (suggestion to paste into QL); `data` is the
   *   decoded document (for the structure explorer).
   */
  function parseApiResponse(body, responsePath, opts) {
    opts = opts || {};
    body = String(body == null ? '' : body).replace(/^[﻿\s]+/, '');
    responsePath = String(responsePath || '').trim();
    var data, kind = 'json';

    try {
      data = JSON.parse(body);
    } catch (e) {
      if (body.charAt(0) === '<') {
        if (!opts.parseXml) return { ok: false, error: 'XML responses need an XML parser' };
        kind = 'xml';
        var xml = parseXmlDocument(opts.parseXml(body));
        if (xml.error) return { ok: false, kind: kind, error: xml.error, entsoe: !!xml.entsoe };
        data = xml.data;
      } else if (opts.parseCsv && /[,;\t]/.test(body.split(/\r?\n/)[0] || '')) {
        var csv = opts.parseCsv(body);
        if (csv && csv.rows && csv.rows.length) {
          return { ok: true, kind: 'csv', format: 'csv', rows: csv.rows, headers: csv.headers, path: '', pathMissing: false, data: null };
        }
        return { ok: false, kind: 'csv', error: 'Looks like CSV/text, but no rows could be read' };
      } else {
        return { ok: false, error: 'Invalid JSON response' };
      }
    }

    function done(format, rows, path, pathMissing) {
      var flat = rows.filter(isArr).map(function (r) { return flattenRow(r); });
      return { ok: true, kind: kind, format: format, rows: flat, headers: headersOf(flat), path: path, pathMissing: !!pathMissing, data: data };
    }

    if (responsePath === '' && isArr(data)) {
      var sdmx = sdmxToRows(data);
      if (sdmx !== null) {
        if (!sdmx.length) return { ok: false, kind: kind, error: 'SDMX: response contained no observations', data: data };
        return done('sdmx_json', sdmx, '');
      }
    }

    var node = data, pathMissing = false, base = '';
    if (responsePath !== '') {
      var resolved = resolvePath(data, responsePath);
      if (resolved === null) { pathMissing = true; node = data; }
      else { node = resolved; base = responsePath; }
    }

    var keyed = periodKeyedMapToRows(node);
    if (keyed !== null) return done('period_keyed_map', keyed, base, pathMissing);

    var det = detectJsonFormat(node);
    if (det.error) {
      var msg = pathMissing
        ? "Response path '" + responsePath + "' was not found in the API response, and the full response is not tabular"
        : det.error;
      return { ok: false, kind: kind, error: msg, pathMissing: pathMissing, data: data };
    }
    return done(det.format, det.rows, joinPath(base, det.subpath), pathMissing);
  }

  /**
   * Walk the document and list nodes that QL could turn into rows, so the
   * user can click one instead of guessing a response_path. Depth-limited.
   */
  function candidatePaths(data, maxDepth) {
    maxDepth = maxDepth || 5;
    var out = [];
    function walk(node, path, depth) {
      if (!isObj(node) || depth > maxDepth) return;
      var rowsLen = null, how = null;
      if (Array.isArray(node) && node.length && node.slice(0, 50).every(isAssoc)) { rowsLen = node.length; how = 'list of records'; }
      else if (isPeriodMap(node)) { rowsLen = sizeOf(node); how = 'period-keyed values'; }
      else if (isAssoc(node) && Object.keys(node).length && Object.keys(node).every(function (k) { return isPeriodMap(node[k]); })) {
        rowsLen = sizeOf(first(node)); how = 'period-keyed series';
      } else if (isAssoc(node) && isPureColumnar(node) && sizeOf(first(node)) > 1) { rowsLen = sizeOf(first(node)); how = 'columnar arrays'; }
      if (rowsLen !== null && path !== null) out.push({ path: path, rows: rowsLen, how: how });
      if (how === 'list of records') {
        return; // don't descend into each record
      }
      keysOf(node).slice(0, 200).forEach(function (k) {
        walk(node[k], path === null || path === '' ? String(k) : path + '.' + k, depth + 1);
      });
    }
    walk(data, '', 0);
    return out.sort(function (a, b) { return b.rows - a.rows; }).slice(0, 12);
  }

  /**
   * Is the parsed result probably *not* what the user wants? QL's detection
   * is greedy (e.g. World Bank's [paging, rows] list is read as two "rows"),
   * so compare it with the best candidate node and suggest a response_path
   * when a candidate clearly holds more rows, or when the flattened headers
   * show list indexes ("0.date", "1.value") — the tell-tale of a list that
   * should have been the rows.
   */
  function suggestPath(result) {
    if (!result || !result.data) return null;
    var cands = candidatePaths(result.data);
    if (!cands.length) return null;
    var best = cands[0];
    var rows = result.ok ? result.rows.length : 0;
    var indexHeaders = result.ok ? result.headers.filter(function (h) { return /^\d+\./.test(h) || /\.\d+(\.|$)/.test(h); }).length : 0;
    var currentPath = result.ok ? result.path : null;
    if (best.path === currentPath) return null;
    if (!result.ok || best.rows > rows * 2 || (indexHeaders > 3 && best.rows >= rows)) {
      return { path: best.path, rows: best.rows, how: best.how, reason: !result.ok ? 'not-tabular' : indexHeaders > 3 ? 'index-columns' : 'more-rows' };
    }
    return null;
  }

  var api = {
    suggestPath: suggestPath,
    parseApiResponse: parseApiResponse,
    candidatePaths: candidatePaths,
    flattenRow: flattenRow,
    resolvePath: resolvePath,
    detectJsonFormat: detectJsonFormat,
    periodKeyedMapToRows: periodKeyedMapToRows,
    sdmxToRows: sdmxToRows,
    normalizePeriodKey: normalizePeriodKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.QLApiParse = api;
})(typeof window !== 'undefined' ? window : this);
