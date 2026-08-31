# Find Outliers in Your Data

Free, QL-backed live demo. One job: surface the values in a dataset that
don't belong.

**[▶ Try the live demo](https://quantumlayers.github.io/QuantumLayers-Public/free-tools/csv-outlier-detector/)** &nbsp;·&nbsp; [Report an issue](https://github.com/quantumlayers/quantumlayers-public/issues)

<!-- Replace with a short screencast: the box plot loading, sensitivity toggled, sign-in → own dataset. -->
![demo](./demo.gif)

## What it does

- Scans every numeric column in a dataset and renders QL's own box-plot
  chart for each one, with outlier points highlighted in amber.
- Underneath each chart: a plain-language summary ("N of M values fall
  outside the typical range"), an adjustable sensitivity control (Loose /
  Standard / Strict, i.e. 3×/1.5×/1×IQR), and a table of the flagged
  values with which category group each one showed up in.
- When signed in, cross-checks against QL's own authenticated
  `ql_get_distribution_analysis` call — its official outlier count,
  percentage, and distribution shape (skew/kurtosis-derived normality
  classification) — labeled "QL verified" and kept visibly separate from
  the client-recomputed sensitivity slider above it.

## How it works

This tool doesn't run a public demo dataset — **sign in to use it.** Per
this collection's sign-in-first pattern (see `CONVENTIONS.md`), anonymous
visitors see a "create a free account" panel, not a preloaded demo; there
is no anonymous mode for any tool here. Once signed in (native QL
email/password, right on the page), pick one of your own datasets and the
per-column outlier cards run against it, including the QL-verified
`ql_get_distribution_analysis` cross-check.

## Why the sensitivity control works the way it does

`ql_get_distribution_analysis` computes outliers at a fixed 1.5×IQR fence
— it doesn't take a sensitivity parameter, and its response caps the
returned outlier list at 50 values. So the sensitivity slider here doesn't
call QL again per click: it recomputes locally, at any multiplier, from
the *full* raw per-row values QL already returned in the box-plot chart
response (`ql_get_chart_data` with `chart_type: box_plot` returns every
row's value grouped by category, not just the outliers) — same IQR method,
just applied client-side to QL's own numbers. The "QL verified" line stays
pinned to QL's own 1.5× read so the two never get confused for each other.

## When you outgrow it

| This tool | QuantumLayers |
|---|---|
| Finds outliers once, when you load the page | Monitors your live data and emails you when a *new* one appears |
| Up to 6 numeric columns, picked automatically | Every column, with saved views and scheduled reports |
| One dataset at a time | Correlates outliers across joined sources (Stripe, GA4, your CRM…) |
| A number flagged as unusual | AI explains *why* it's unusual |

**[Get outlier alerts on your data free →](https://quantumlayers.com/ql-register)**

## Contributing

Issues and PRs welcome — see [`../CONVENTIONS.md`](../CONVENTIONS.md)
before changing the shared visual system or auth flow.

## License

MIT © [QuantumLayers](https://quantumlayers.com).

---

<sub>Built by the team at **QuantumLayers** — the no-code AI analytics platform.</sub>
