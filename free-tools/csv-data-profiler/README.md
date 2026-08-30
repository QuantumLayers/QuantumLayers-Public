# Dataset Profiler

Free, QL-backed live demo. One job: an exhaustive, reference-style profile
of a dataset — every column, fully profiled — with an exportable data
dictionary as the star feature.

**[▶ Try the live demo](https://quantumlayers.github.io/quantumlayers-public/free-tools/csv-data-profiler/)** &nbsp;·&nbsp; [Report an issue](https://github.com/quantumlayers/quantumlayers-public/issues)

<!-- Replace with a short screencast: sign in, pick a dataset, the profile and dictionary loading, exporting Markdown. -->
![demo](./demo.gif)

## What it does

- Reads QuantumLayers' own ingestion-time per-column statistics for a
  dataset — type, missing count, distinct count, and (for numeric
  columns) min/max/mean/stddev — and, where available, the full
  five-number summary (min/q1/median/q3/max) from a second, richer
  endpoint.
- Renders every numeric column as a real QL histogram, every category
  column as a real QL "top values" bar chart, and every date column's
  range plus an estimated granularity.
- A data-quality panel flags missing data, constant columns,
  high-cardinality text columns, and columns that share identical
  statistics with each other (see "What 'duplicates' means here" below).
- **Exports the whole profile as a data dictionary — CSV or Markdown** —
  the shareable artifact this tool is actually for.

Different from [`whats-in-this-csv`](../whats-in-this-csv/): that tool
gives a short, ranked narrative of what stands out. This one is
inventory-style — every column, fully profiled, none skipped.

## How the modes work

This tool doesn't run a public demo dataset — **sign in to use it.**
Unlike this collection's other tools, anonymous visitors here go straight
to a "create a free account" panel rather than a preloaded public-dataset
demo: a real per-column profile needs `ql_get_dataset_detail` (the column
schema and stats this tool is built around), and that endpoint always
requires a session, even on a public dataset, per `QL-INTEGRATION.md`'s
anonymous ceiling — so there's no meaningful zero-click version of this
specific tool to build. Once signed in, pick any of your own datasets and
the full profile — quality panel, histograms, top-values charts, and the
exportable dictionary — runs against it.

## What "duplicates" means here

This tool never sees raw rows — only QuantumLayers' own per-column
aggregates. That means it can't detect duplicate *rows* the way a tool
with raw row access could (see [`whats-in-this-csv`](../whats-in-this-csv/),
which does have raw rows and does check for that). What it *can* flag is
columns whose statistics — type, distinct count, missing count, min, max,
mean — are identical to another column's, which is a reasonable "these
two might be the same data twice" signal, just a softer one. The
data-quality panel is explicit about this distinction rather than
implying row-level duplicate detection it can't actually do.

## When you outgrow it

| This tool | QuantumLayers |
|---|---|
| One profile, one point in time | Re-profiles automatically as your live source changes |
| Charts the first 8 numeric + 8 category columns in detail | Every column, however many there are |
| A CSV/Markdown snapshot | A living data dictionary that stays current |
| Flags data-quality issues when you run it | Flags them the moment they appear |

**[Keep your data dictionary current free →](https://quantumlayers.com/ql-register)**

## Contributing

Issues and PRs welcome — see [`../CONVENTIONS.md`](../CONVENTIONS.md)
before changing the shared visual system or auth flow.

## License

MIT © [QuantumLayers](https://quantumlayers.com).

---

<sub>Built by the team at **QuantumLayers** — the no-code AI analytics platform.</sub>
