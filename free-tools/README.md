# free-tools

Single-purpose, embeddable web tools that are live demos of the
[QuantumLayers](https://quantumlayers.com) analytics engine. Each tool is
one `index.html` + the shared [`ql-client.js`](./ql-client.js), no build
step, hosted on GitHub Pages, calling QL as its backend.

Every tool works two ways behind one UI:

- **Anonymous visitors** (arrived from search, no account) drive the tool
  against a curated public QL dataset — no sign-in required, no token in
  the page.
- **Signed-in QuantumLayers users** run the identical tool against their
  own datasets, after a "Run this on your own data →" invite.

Live demo powered by QuantumLayers. Sign in to run it on your own data.

> **Exception:** [`whats-in-this-csv`](./whats-in-this-csv/) is fully
> client-side by design — it never calls QL at all, and its own "your data
> never leaves your machine" promise is the point of the tool. It predates
> the QL-backed foundation above and doesn't follow the dual-source pattern.
> Every tool added after it does — see `CONVENTIONS.md`.

## Before building a tool

Read, in this order:

1. [`QL-INTEGRATION.md`](./QL-INTEGRATION.md) — what QL's backend exposes,
   what's callable unauthenticated vs. what requires sign-in, and why
   `ql-client.js` is shaped the way it is.
2. [`CONVENTIONS.md`](./CONVENTIONS.md) — the dual-source UI pattern,
   visual tokens, charting rules, SEO requirements, and the per-tool
   README structure.
3. [`DEPLOYMENT.md`](./DEPLOYMENT.md) — **prerequisites on the QL side
   that are not yet confirmed done** (CORS, a registered auth provider,
   curated public datasets). A tool built against this foundation will not
   work end-to-end until these are checked off.

## Tools

| Tool | Live demo | What it does |
|---|---|---|
| [`whats-in-this-csv`](./whats-in-this-csv/) | [quantumlayers.github.io/quantumlayers-public/free-tools/whats-in-this-csv/](https://quantumlayers.github.io/quantumlayers-public/free-tools/whats-in-this-csv/) | Drops a CSV, profiles its columns, and ranks plain-language findings (trends, correlations, outliers, data-quality flags) — entirely client-side, no upload. |
| [`csv-outlier-detector`](./csv-outlier-detector/) | [quantumlayers.github.io/quantumlayers-public/free-tools/csv-outlier-detector/](https://quantumlayers.github.io/quantumlayers-public/free-tools/csv-outlier-detector/) | QL-backed: scans a dataset's numeric columns for outliers, one box-plot chart per column with an adjustable sensitivity control. No public demo dataset configured yet (see `DEPLOYMENT.md`) — anonymous visitors currently land on the sign-up panel; sign in to run it on your own data. |
| [`instant-chart-maker`](./instant-chart-maker/) | [quantumlayers.github.io/quantumlayers-public/free-tools/instant-chart-maker/](https://quantumlayers.github.io/quantumlayers-public/free-tools/instant-chart-maker/) | QL-backed: pick a dataset and columns, get QL's real Chart.js output — including its auto-recommended default — in seconds. No public demo dataset configured yet (see `DEPLOYMENT.md`) — anonymous visitors currently land on the sign-up panel; sign in to chart your own data. |
| [`csv-data-profiler`](./csv-data-profiler/) | [quantumlayers.github.io/quantumlayers-public/free-tools/csv-data-profiler/](https://quantumlayers.github.io/quantumlayers-public/free-tools/csv-data-profiler/) | QL-backed: an exhaustive, every-column profile — histograms, top values, data-quality flags — exportable as a CSV/Markdown data dictionary. Sign-in only by design (see its own README); no anonymous public-demo mode. |

_(Live demo links assume GitHub Pages is enabled for this repo and
serving from its default branch — unconfirmed as of this writing. If a
link 404s, that's the prerequisite to check, not a bug in the tool.)_

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
