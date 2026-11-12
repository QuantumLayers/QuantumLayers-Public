# A/B test significance calculator

**Live demo:** [quantumlayers.com/tools/ab-test-calculator/](https://quantumlayers.com/tools/ab-test-calculator/)

<!-- Replace with a short screencast: conversion numbers edited live, SRM warning, planner tab. -->
![demo](./demo.gif)

## What it does

Three tabs:

- **Conversion rates** — visitors and conversions for A and B → verdict,
  two-sided p-value, relative lift with a confidence interval (drawn
  against zero), observed power, and a **sample-ratio-mismatch** check
  against the split you intended.
- **Averages** — mean/SD/n per group (Welch's t-test, Cohen's d), or raw
  values pasted one per line (adds a Mann–Whitney U test and medians, which
  matter for skewed metrics like revenue).
- **Sample size planner** — baseline rate, smallest lift worth detecting,
  power, confidence, variants and daily traffic → visitors per variant and
  test duration, with a lift/duration trade-off table.

The same calculator is published as three pages, one per search intent,
each with its own title, intro and explainer:
[`ab-test-calculator`](https://quantumlayers.com/tools/ab-test-calculator/),
[`statistical-significance-calculator`](https://quantumlayers.com/tools/statistical-significance-calculator/)
and [`sample-size-calculator`](https://quantumlayers.com/tools/sample-size-calculator/)
(opens on the planner tab). The UI and logic live once, in
[`calc.js`](./calc.js) and [`calc.css`](./calc.css); each page sets its
opening tab with `<body data-default-tab="…">`.

Results update as you type and can be shared as a link (inputs in the URL
hash — no data is stored anywhere).

## How it works

Fully client-side and independent of any QuantumLayers account — no
sign-in, no QL call. Maths in [`../ql-stats.js`](../ql-stats.js), checked
against SciPy (`node free-tools/tests/ql-stats.test.js`):

- Proportions: pooled two-proportion z-test (= 2×2 chi-square without
  Yates), Wald CI for the difference, delta-method CI for the relative lift.
- Means: Welch's t-test with Welch–Satterthwaite df; Mann–Whitney U with tie
  and continuity correction (SciPy's `method='asymptotic'`).
- SRM: chi-square goodness of fit, flagged at p < 0.001.
- Sample size: normal approximation for two proportions (5% → 5.5% at
  80%/95% gives 31,234 per variant, matching standard calculators);
  Bonferroni-adjusted when comparing more than one variant to control.

## When you outgrow it

| This tool | QuantumLayers |
|---|---|
| Numbers typed in by hand | Pulled from your database, GA4 or spreadsheet directly |
| One comparison at a time | Significance tests across every segment (ANOVA over category × metric) |
| You check when you remember | Monitors that email you when a metric statistically shifts |

## Contributing

Issues and PRs welcome on [this repo](https://github.com/quantumlayers/quantumlayers-public).

## License

MIT — see the root [`LICENSE`](../../LICENSE).

## Powered by

Built by [QuantumLayers](https://quantumlayers.com).
