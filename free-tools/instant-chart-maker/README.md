# Data Chart Maker

Free, QL-backed live demo. One job: pick a dataset and a couple of
columns, get a clean chart in seconds.

**[▶ Try the live demo](https://quantumlayers.github.io/quantumlayers-public/free-tools/instant-chart-maker/)** &nbsp;·&nbsp; [Report an issue](https://github.com/quantumlayers/quantumlayers-public/issues)

<!-- Replace with a short screencast: default chart loading, chart-type swap, export. -->
![demo](./demo.gif)

## What it does

- Loads a dataset, gets QL's own auto-recommended chart for it, and
  renders QL's real Chart.js config directly — every chart on this page
  is QL's own output (chart type, aggregation, colors before theming),
  never a local reimplementation of QL's charting logic.
- A picker lets you swap the chart type and its columns; each chart type
  shows only the fields QL's endpoint actually needs for it (a pie only
  asks for a category and a value column, a scatter asks for X/Y and
  optional size/color columns, and so on).
- When signed in, QL's top few chart recommendations are shown as
  clickable chips, each with its own strength meter (QL's `insight_score`)
  and QL's plain-English reason for suggesting it.
- Export the current chart as PNG, copy it to the clipboard, or export it
  as SVG (see the note on what that third one actually is, below).

## How it works

This tool doesn't run a public demo dataset — **sign in to use it.** Per
this collection's sign-in-first pattern (see `CONVENTIONS.md`), anonymous
visitors see a "create a free account" panel, not a preloaded demo; there
is no anonymous mode for any tool here. Once signed in, pick one of your
own datasets and this tool calls the real `ql_get_recommended_charts`
endpoint and shows its top pick immediately, plus the next few as chips.
Changing the chart type or columns calls `ql_get_chart_data` directly with
whatever you picked.

## Why "Export SVG" isn't a vector file

Chart.js renders every chart to an HTML `<canvas>` — a raster surface.
There's no vector path data underneath a Chart.js chart to export. The
"Export SVG" button here produces a real, valid `.svg` file (it opens
fine anywhere), but it does so by embedding the same PNG raster inside an
`<svg>` wrapper — it will not scale crisply like a true vector chart
would. "Export PNG" and "Copy image" are the two genuinely raster-native
options; "Export SVG" exists for tools/workflows that specifically expect
an `.svg` extension, not for vector-quality output.

## When you outgrow it

| This tool | QuantumLayers |
|---|---|
| One chart, one dataset, picked by hand | Auto-recommends the most informative charts across *all* your joined sources |
| A ranked list of up to 5 suggestions | The full rule-based + AI insight pipeline, with a written narrative |
| PNG/SVG export, one chart at a time | Saved charts, dashboards, and scheduled report delivery |
| Re-pick columns every visit | Remembers your chart, re-runs it on fresh data automatically |

**[Auto-chart your live data free →](https://quantumlayers.com/ql-register)**

## Contributing

Issues and PRs welcome — see [`../CONVENTIONS.md`](../CONVENTIONS.md)
before changing the shared visual system or auth flow.

## License

MIT © [QuantumLayers](https://quantumlayers.com).

---

<sub>Built by the team at **QuantumLayers** — the no-code AI analytics platform.</sub>
