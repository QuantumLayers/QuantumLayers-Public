// Run: node free-tools/tests/api-parse.test.js
const P = require('../public-api-tester/api-parse.js');
const F = require('./fixtures/api-responses.json');
let fail = 0;
for (const [name, f] of Object.entries(F)) {
  const r = P.parseApiResponse(JSON.stringify(f.body), f.path);
  const errs = [];
  if (f.expectError) { if (r.ok) errs.push('expected error, got ' + r.format); }
  else {
    if (!r.ok) errs.push('error: ' + r.error);
    if (f.expectFormat && r.format !== f.expectFormat) errs.push('format ' + r.format);
    if (f.expectRows != null && (r.rows || []).length !== f.expectRows) errs.push('rows ' + (r.rows || []).length);
    if (f.expectPath != null && r.path !== f.expectPath) errs.push('path ' + r.path);
    if (f.expectHeaders && JSON.stringify(r.headers) !== JSON.stringify(f.expectHeaders)) errs.push('headers ' + JSON.stringify(r.headers));
    if (f.expectPathMissing && !r.pathMissing) errs.push('pathMissing not set');
  }
  const sug = P.suggestPath(r);
  if (f.expectSuggest !== undefined && (!sug || sug.path !== f.expectSuggest)) errs.push('suggest ' + JSON.stringify(sug));
  if (f.expectSuggest === undefined && sug) errs.push('unexpected suggestion ' + JSON.stringify(sug));
  if (errs.length) fail++;
  console.log((errs.length ? 'FAIL ' : 'ok   ') + name + (errs.length ? ' — ' + errs.join('; ') : ' (' + r.format + ', ' + (r.rows||[]).length + ' rows, path "' + (r.path||'') + '")'));
}
// candidate paths
const om = P.candidatePaths(F.openmeteo_nopath.body);
console.log('candidates (open-meteo, no path):', JSON.stringify(om));
if (!om.some(c => c.path === 'daily')) { fail++; console.log('FAIL candidatePaths did not find "daily"'); }
const wb = P.candidatePaths(F.worldbank.body);
if (!wb.some(c => c.path === '1')) { fail++; console.log('FAIL candidatePaths did not find "1"'); }
console.log(fail ? fail + ' FAILED' : 'ALL OK');
process.exit(fail ? 1 : 0);
