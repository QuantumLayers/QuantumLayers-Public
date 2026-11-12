# Public datasets

**Live:** [quantumlayers.com/tools/datasets/](https://quantumlayers.com/tools/datasets/)

Static pages for a curated set of public datasets (World Bank, IMF, NOAA,
NASA POWER, Open-Meteo). Each page has a chart, key figures, a data
preview, field definitions, the exact API URL and response path, a CSV
download, and `schema.org/Dataset` markup so the page is eligible for
Google Dataset Search.

## How this differs from the "Analyze This!" posts

The posts and these pages cover overlapping data but answer different searches:

| | Analyze This! post | Dataset page |
|---|---|---|
| Searcher wants | "what does the data say?" | "get me the data" (CSV, API, by year/country) |
| Content | narrative, findings, forecasts | table, chart, CSV, fields, API URL, license |
| Interpretation | yes | **never** — key figures are facts (first, latest, min, max) |

Rules that keep them from competing:

1. A dataset page never explains *why* something happened.
2. When a post exists, its `analysis` entry in `datasets.json` links the page
   to it ("What does this data show?"). Set `analysis.published` to `true`
   once the post is live; drafts aren't linked.
3. The post should link back with a short "Get the data" line instead of
   repeating the source and field details, which live on the dataset page.
4. Keep the list curated. Add a dataset when there's search demand for it,
   not every indicator × country combination.

## Adding a dataset

Add an entry to [`datasets.json`](./datasets.json):

| Key | Meaning |
|---|---|
| `slug` | URL segment and CSV file name |
| `title`, `description`, `keywords` | page title/H1, lede + meta description, Dataset keywords |
| `source`, `source_url`, `license`, `license_url`, `attribution` | provenance shown on the page and in the Dataset markup |
| `api_url`, `response_path` | fetched and parsed exactly as QuantumLayers' REST connector would |
| `template` | the matching QuantumLayers API template, if any |
| `columns` | `{ "api.field": "csv_column" }` — only these columns are kept, in this order |
| `fields` | column descriptions (`"*"` = default for all value columns) |
| `missing_values` | sentinel codes to treat as empty (e.g. `[-999]` for NASA POWER) |
| `sort` | CSV sort keys |
| `chart` | `x`; `y` (column, or list of columns for wide data); `series` (long data) with optional `show`/`hide`; `labels`; `unit`; `aggregate` (`month`/`year` for daily data); `x_from`; `mark_today` (projection marker) |
| `note` | one factual caveat (e.g. "values after … are projections") |
| `analysis` | `{ title, url, published }` — the matching Analyze This! post |

Check it with the [public API tester](../public-api-tester/) first: it shows
the response path and column names the build will see.

## Building

```sh
NODE_USE_ENV_PROXY=1 node free-tools/datasets/build.js        # all (proxy env var only behind an HTTPS proxy)
node free-tools/datasets/build.js --only world-bank-gdp       # one
node free-tools/datasets/build.js --fixtures path/to/dir      # offline: reads <dir>/<slug>.json
```

Output, all committed: `<slug>/index.html`, `<slug>/<slug>.csv`, `index.html`
(hub), `manifest.json` (hash + last-changed date per dataset) and
`../sitemap.xml`. A dataset whose fetch fails keeps its previous page.

The [`refresh-datasets`](../../.github/workflows/refresh-datasets.yml)
workflow runs the build weekly, on demand, and when the registry or build
code changes on `main`, and commits the result. Never commit pages built
from `--fixtures` data.

## License

Page code: MIT. Data: each source's own license, shown on every page.
