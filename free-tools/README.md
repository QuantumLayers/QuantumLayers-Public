# free-tools

Single-purpose, embeddable web tools that are live demos of the
[QuantumLayers](https://quantumlayers.com) analytics engine. Each tool is
one `index.html` + the shared [`ql-client.js`](./ql-client.js), no build
step, hosted on GitHub Pages, calling QL as its backend.

Every tool follows the same sign-in-first pattern:

- **Anonymous visitors** (arrived from search, no account) see the tool's
  explanation and a register/sign-in form immediately — never computed QL
  output. There is no anonymous public-dataset mode for any tool here.
- **Signed-in QuantumLayers users** pick one of their own datasets and the
  tool runs against it — that's the only way to see it run at all.

Live demo powered by QuantumLayers. Sign in to run it on your own data.

> **Second family: standalone client-side tools.** [`whats-in-this-csv`](./whats-in-this-csv/),
> [`public-api-tester`](./public-api-tester/), [`correlation-matrix`](./correlation-matrix/)
> and [`ab-test-calculator`](./ab-test-calculator/) never call QL and need
> no account — they run entirely in the visitor's browser, and "your data
> never leaves your machine" is part of the point. Where QL computes the same
> thing server-side, they reuse ports of QL's own logic (shared in
> [`ql-stats.js`](./ql-stats.js)) so results line up. See `CONVENTIONS.md`'s
> "Standalone client-side tools" section for the rules that differ.

## Before building a tool

Read, in this order:

1. [`QL-INTEGRATION.md`](./QL-INTEGRATION.md) — what QL's backend exposes,
   which endpoints require sign-in (all of them, for practical purposes —
   see its "Design implications" section), and why `ql-client.js` is
   shaped the way it is.
2. [`CONVENTIONS.md`](./CONVENTIONS.md) — the sign-in-first UI pattern,
   visual tokens, charting rules, SEO requirements, and the per-tool
   README structure.
3. [`DEPLOYMENT.md`](./DEPLOYMENT.md) — the one remaining conditional
   prerequisite (a registered third-party auth provider, only if a tool
   grows its own signer). CORS and a curated public dataset are **not**
   prerequisites — see that file for why.

## Tools

| Tool | Live demo | What it does |
|---|---|---|
| [`whats-in-this-csv`](./whats-in-this-csv/) | [quantumlayers.com/tools/whats-in-this-csv/](https://quantumlayers.com/tools/whats-in-this-csv/) | Drops a CSV, profiles its columns, and ranks plain-language findings (trends, correlations, outliers, data-quality flags) — entirely client-side, no upload. |
| [`csv-outlier-detector`](./csv-outlier-detector/) | [quantumlayers.com/tools/csv-outlier-detector/](https://quantumlayers.com/tools/csv-outlier-detector/) | QL-backed: scans a dataset's numeric columns for outliers, one box-plot chart per column with an adjustable sensitivity control. Sign-in only by design (see its own README); no anonymous public-demo mode. |
| [`instant-chart-maker`](./instant-chart-maker/) | [quantumlayers.com/tools/instant-chart-maker/](https://quantumlayers.com/tools/instant-chart-maker/) | QL-backed: pick a dataset and columns, get QL's real Chart.js output — including its auto-recommended default — in seconds. Sign-in only by design (see its own README); no anonymous public-demo mode. |
| [`csv-data-profiler`](./csv-data-profiler/) | [quantumlayers.com/tools/csv-data-profiler/](https://quantumlayers.com/tools/csv-data-profiler/) | QL-backed: an exhaustive, every-column profile — histograms, top values, data-quality flags — exportable as a CSV/Markdown data dictionary. Sign-in only by design (see its own README); no anonymous public-demo mode. |
| [`public-api-tester`](./public-api-tester/) | [quantumlayers.com/tools/public-api-tester/](https://quantumlayers.com/tools/public-api-tester/) | Client-side, no account: fetches any JSON/XML API (or a pasted body), finds the rows with a port of QL's REST-connector parser, types the columns QL's way, flags data-quality and pagination issues, suggests the response path, exports CSV. Presets for keyless World Bank, IMF, Open-Meteo, NASA POWER and NOAA datasets. |
| [`correlation-matrix`](./correlation-matrix/) | [quantumlayers.com/tools/correlation-matrix/](https://quantumlayers.com/tools/correlation-matrix/) | Client-side, no account: Pearson/Spearman correlation matrix heatmap from a CSV with p-values, confidence intervals, Holm correction and per-pair scatter plots. |
| [`ab-test-calculator`](./ab-test-calculator/) | [quantumlayers.com/tools/ab-test-calculator/](https://quantumlayers.com/tools/ab-test-calculator/) | Client-side, no account: A/B significance for conversion rates (with sample-ratio-mismatch check) and averages (Welch + Mann–Whitney), plus a sample size planner. |
| [`statistical-significance-calculator`](./statistical-significance-calculator/) | [quantumlayers.com/tools/statistical-significance-calculator/](https://quantumlayers.com/tools/statistical-significance-calculator/) | Same calculator as `ab-test-calculator`, framed for "is this difference significant?" searches (rates or averages). Shares `ab-test-calculator/calc.js` + `calc.css`. |
| [`sample-size-calculator`](./sample-size-calculator/) | [quantumlayers.com/tools/sample-size-calculator/](https://quantumlayers.com/tools/sample-size-calculator/) | Same calculator, opening on the sample size planner, framed for "how many visitors do I need?" searches. |
| [`datasets`](./datasets/) | [quantumlayers.com/tools/datasets/](https://quantumlayers.com/tools/datasets/) | Generated static pages for curated public datasets (World Bank, IMF, NOAA, NASA POWER, Open-Meteo): chart, key figures, fields, API URL, CSV download, `schema.org/Dataset` markup. Rebuilt weekly by a GitHub Action — see [`datasets/README.md`](./datasets/README.md). |

The hub page listing all of them is [`index.html`](./index.html), served at
[quantumlayers.com/tools/](https://quantumlayers.com/tools/).

## Hosting

The source lives here; the public copy is served from **quantumlayers.com/tools/**:

- A deploy hook on the quantumlayers.com host publishes this `free-tools/`
  directory as `/tools/` on every push to `main` (`free-tools/x/` →
  `quantumlayers.com/tools/x/`). Relative links between tools (`../ql-stats.js`,
  `../datasets/`) rely on that one-to-one mapping. `tests/` and
  `datasets/build.js` are harmless if deployed but aren't needed.
- Every page carries `<link rel="canonical" href="https://quantumlayers.com/tools/<name>/">`,
  so any other copy (GitHub Pages, a fork) doesn't compete with it in search.
- [`sitemap.xml`](./sitemap.xml) (regenerated by the dataset build) lists every
  tool and dataset page at its quantumlayers.com URL — submit
  `https://quantumlayers.com/tools/sitemap.xml` in Search Console.
- Cross-links: each tool's footer links to this repo and to the hub; each
  README's live link points at quantumlayers.com.

## Tests

No build step, but the shared maths and the API parser have plain-Node tests:

```sh
node free-tools/tests/ql-stats.test.js   # ql-stats.js vs SciPy reference values
node free-tools/tests/api-parse.test.js  # api-parse.js vs API response fixtures
```

`python3 free-tools/tests/gen-stats-reference.py` regenerates the SciPy
reference values (needs numpy + scipy).

## Contributing a tool

1. Branch from this repo's default branch: `tools/<name>`.
2. Build `free-tools/<name>/index.html` + `free-tools/<name>/README.md`
   following `CONVENTIONS.md`, importing the shared `../ql-client.js`.
3. Add your tool's public dataset to the table in `DEPLOYMENT.md` once
   it's created.
4. Add a row to the table above once the tool is actually deployed and
   reachable.
5. Open a PR (conventional commits, see `CONVENTIONS.md`).

## License

MIT — see this repo's root [`LICENSE`](../LICENSE).
