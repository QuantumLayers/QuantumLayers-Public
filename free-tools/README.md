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
| [`whats-in-this-csv`](./whats-in-this-csv/) | _not yet deployed_ | Planned — profiles a CSV/dataset (column types, stats, quick charts) as this collection's first tool. Not built in this PR; only the shared foundation (`ql-client.js`, conventions, deployment prerequisites) lands here. |

_(Table starts empty of live demos on purpose — see `DEPLOYMENT.md`
before adding a row here that links to something not actually reachable.)_

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
