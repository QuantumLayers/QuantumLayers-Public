# Browser embed (JDK + Chart.js)

A single static page that signs in with the QL JDK's `QLAuth` module,
fetches a chart config from `ql_get_chart_data`, and renders it with
Chart.js — no build step required.

## Try it

Serve `index.html` from any static host (or open it directly) while
signed in to QuantumLayers in the same browser, then edit `DATASET_ID`,
`CHART_TYPE`, and `CHART_PARAMS` at the top of the `<script>` block to
point at a dataset and chart shape you have access to.

See [`../../docs/embedded-analytics.html`](../../docs/embedded-analytics.html)
for the three authentication options and
[`../../docs/embedded-analytics-api.html`](../../docs/embedded-analytics-api.html)
for the full `ql_get_chart_data` parameter reference (chart types, required
columns per type, response shape).
