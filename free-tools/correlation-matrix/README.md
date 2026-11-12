# Correlation matrix calculator

**Live demo:** [quantumlayers.github.io/QuantumLayers-Public/free-tools/correlation-matrix/](https://quantumlayers.github.io/QuantumLayers-Public/free-tools/correlation-matrix/)

<!-- Replace with a short screencast: sample loaded, Pearson→Spearman toggle, cell clicked → scatter. -->
![demo](./demo.gif)

## What it does

Drop (or paste) a CSV and get a Pearson or Spearman correlation matrix as
a heatmap, with p-values, Fisher-z 95% confidence intervals, a Holm
multiple-testing correction, a ranked list of the strongest pairs, and a
scatter plot with a fitted line behind every cell. Exports the matrix and
a long-format table (r, p, Holm p, n, CI) as CSV.

## How it works

Fully client-side and independent of any QuantumLayers account — no
sign-in, no upload, no QL call. The file is parsed with PapaParse and all
maths runs in [`../ql-stats.js`](../ql-stats.js), which is unit-tested
against SciPy (`node free-tools/tests/ql-stats.test.js`).

- Pearson uses **pairwise deletion**, the same as QuantumLayers'
  `ql_get_correlation_matrix`, so the r values match what QL shows for the
  same data; `n` is reported per pair.
- Columns QL would treat as labels are left out and listed: ID/code-named
  columns (QL's own identifier rule), row counters, constant and two-value
  columns. Up to 40 numeric columns.
- When Pearson and Spearman differ by ≥ 0.25 the pair is flagged — usually
  outliers or a curved relationship.

## When you outgrow it

| This tool | QuantumLayers |
|---|---|
| One CSV, one snapshot | Correlations recomputed on live SQL/API/Sheets sources |
| Pairwise correlation only | PCA, ANOVA, regression and AI-written insights |
| You re-run it to notice change | Monitor alerts when a relationship shifts |

## Contributing

Issues and PRs welcome on [this repo](https://github.com/quantumlayers/quantumlayers-public).

## License

MIT — see the root [`LICENSE`](../../LICENSE).

## Powered by

Built by [QuantumLayers](https://quantumlayers.com).
