# Public API tester

**Live demo:** [quantumlayers.com/tools/public-api-tester/](https://quantumlayers.com/tools/public-api-tester/)

<!-- Replace with a short screencast: preset clicked, table + findings, path suggestion applied, CSV downloaded. -->
![demo](./demo.gif)

## What it does

Paste a JSON or XML API URL (or a saved response body) and see it as a
table: which node of the response holds the rows, every column's type, a
data-quality checklist, a readiness score, a CSV/JSON export, and the
exact URL + response path to connect it as a live REST dataset. Eleven
presets cover the keyless public datasets in QuantumLayers' built-in
templates (World Bank, IMF SDMX, Open-Meteo, NASA POWER, NOAA), plus two
that need a free key (FRED, OpenWeather).

## How it works

Fully client-side and independent of any QuantumLayers account — there's
no sign-in and no QL call. The browser fetches the URL directly, then:

- **Row detection** — [`api-parse.js`](./api-parse.js) is a line-by-line
  port of QuantumLayers' server-side REST parser
  (`ql_parse_api_response_body()` and friends): SDMX-JSON, period-keyed
  maps (NASA POWER, IMF DataMapper), GA4 reports, `{data|results|items…}`
  wrappers, `columns`+`data`, pure columnar arrays (Open-Meteo), nested
  `response.data`, generic XML. Rows are flattened with dots exactly like
  `ql_flatten_row()`. It was checked for identical output against QL's own
  PHP on every fixture in [`../tests/fixtures/api-responses.json`](../tests/fixtures/api-responses.json).
- **Path suggestion** — QL's detection is greedy (World Bank's
  `[paging, rows]` list is read as two junk rows without a path), so the
  tool also walks the document for candidate nodes and suggests a
  response path when a deeper node clearly holds the real rows.
- **Typing** — `inferType()` in [`../ql-stats.js`](../ql-stats.js), a
  port of `ql_infer_type()` (same results on the test cases), so ID/code
  columns are text and bare years only count as dates in a year-named column.
- **Checks** — patchy/empty/constant columns, sentinel values (`-999`),
  numbers sent as strings, list indexes flattened into columns, pagination
  (World Bank paging block, `total`/`next` fields, `Link` header).

If the API sends no CORS headers the browser can't read it; the tool says
so and offers a paste-the-body fallback. Server-side connectors (including
QuantumLayers) aren't affected by CORS. API keys in the URL never leave
the browser: the address-bar state and share links drop or redact them.

Tests: `node free-tools/tests/api-parse.test.js`.

## When you outgrow it

| This tool | QuantumLayers |
|---|---|
| One fetch, then it's stale | Scheduled re-syncs of the same URL + response path |
| Browser-only, blocked by APIs without CORS | Fetched server-side — CORS doesn't apply |
| ENTSO-E XML recognised but not expanded | Full ENTSO-E TimeSeries → one row per point |
| A table and a CSV | Charts, statistics, monitor alerts and AI insights on the live dataset |

## Contributing

Issues and PRs welcome on [this repo](https://github.com/quantumlayers/quantumlayers-public).

## License

MIT — see the root [`LICENSE`](../../LICENSE).

## Powered by

Built by [QuantumLayers](https://quantumlayers.com).
