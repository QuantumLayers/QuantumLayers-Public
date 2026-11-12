# QuantumLayers — Public

Developer guides and integration examples for building against
[QuantumLayers](https://quantumlayers.com) as a third-party developer.

This repo does **not** contain the QuantumLayers product itself — its
frontend and backend are closed source. What's here is meant to be copied,
adapted, and shipped in your own application.

## Contents

- **[`docs/`](docs/)** — the Embedded Analytics developer guides: an
  overview, the full HTTP API reference, and the full JavaScript
  Development Kit (JDK) reference.
- **[`examples/`](examples/)** — runnable integration examples:
  - [`browser-jdk-embed/`](examples/browser-jdk-embed/) — render a QL
    chart in a static page using the JDK's `QLAuth` + Chart.js.
  - [`direct-api-fetch/`](examples/direct-api-fetch/) — call the HTTP API
    directly with an API token, no QL JavaScript at all.
  - [`server-to-server-node/`](examples/server-to-server-node/) — drive
    the multi-turn QL-Agent headlessly from a backend job.
  - [`third-party-jwt-signin/`](examples/third-party-jwt-signin/) —
    provision QL "shadow user" accounts for your own users via a
    backend-signed JWT.

- **[`free-tools/`](free-tools/)** — single-page web tools: QL-backed
  demos (sign in to run them on your own datasets) and standalone,
  no-account tools that run entirely in the browser — a public API tester,
  a correlation matrix calculator, an A/B test calculator and a CSV
  findings scanner.

Start with [`docs/embedded-analytics.html`](docs/embedded-analytics.html)
— it explains authentication and the two ways to reach QL (raw API calls
vs. the JDK), then links out to the full API and JDK references.

## License

Example code in this repo is MIT-licensed (see [`LICENSE`](LICENSE)) —
copy it freely into your own project.
