# What's in this CSV? — instant, plain-language findings from any spreadsheet

> Free, open-source, and runs entirely in your browser. **Your data never leaves your machine — no upload, no server, no account.**

Drop a CSV and get a short, ranked list of what's actually going on inside it — trends, outliers, relationships, and data-quality flags — written in plain English instead of formulas.

**[▶ Try the live demo](https://quantumlayers.github.io/quantumlayers-public/free-tools/whats-in-this-csv/)** &nbsp;·&nbsp; [Report an issue](https://github.com/quantumlayers/quantumlayers-public/issues) &nbsp;·&nbsp; ⭐ it if it saved you a few minutes

<!-- Replace with a 5-second screencast of dropping a file and findings appearing — a gif converts far better than a screenshot. -->
![Dropping a CSV and getting ranked findings](docs/demo.gif)

## What it does

- Reads any CSV **in the browser** and figures out what each column is — number, category, date, boolean, or ID.
- Runs real statistics — trend detection, correlation, IQR outliers, skew, category balance, missing-data and duplicate checks — and **ranks the findings by strength**, so the important stuff is on top.
- Writes each finding as a plain sentence with a tiny inline chart, plus a full column profile you can expand.

No spreadsheet formula tells you *what to look at*. This does.

## Why it's private

Everything runs client-side in a single HTML file. The tool has **no backend** — your file is read with the browser's `FileReader`, analyzed in JavaScript, and never sent anywhere. You can even run it offline.

## Use it

It's one static file with no build step.

```bash
# clone, then just open it
git clone https://github.com/quantumlayers/quantumlayers-public
open quantumlayers-public/free-tools/whats-in-this-csv/index.html
```

Or drop `index.html` on any static host (GitHub Pages, Netlify, an S3 bucket). The only runtime dependency is [PapaParse](https://www.papaparse.com/), loaded from a CDN for robust CSV parsing.

## When you outgrow it

This tool reads **one file, once, in your browser**. When you want the same analysis on your *live* data — and want it to keep watching — that's what [QuantumLayers](https://quantumlayers.com) automates:

| This tool | QuantumLayers |
| --- | --- |
| One CSV, one look | Connects your SQL, APIs, Google Sheets & CSVs and **joins them automatically** — correlate Stripe, GA4 and your CRM together |
| Rule-based sentences | **AI-written** narrative reports from the validated statistics |
| You re-run it manually | **Monitors** your data and emails you when a new pattern appears |
| — | **Scheduled reports** delivered daily, weekly or monthly |

**[Analyze your live data free →](https://quantumlayers.com/ql-register)**

## Contributing

Issues and PRs welcome — new finding types (seasonality, changepoints, Cramér's V for categorical pairs) are especially useful. Keep it dependency-light and client-side; that privacy guarantee is the point.

## License

MIT © [QuantumLayers](https://quantumlayers.com). Fork it, host it, rename the findings — just keep it honest about what the numbers say.

---

<sub>Built by the team at **QuantumLayers** — the no-code AI analytics platform. If this was useful, the [hosted version](https://quantumlayers.com) does it on everything you've got.</sub>
