# free-tools/ conventions

Rules every tool in this collection follows. If you're adding a new tool,
read this end to end before writing HTML.

> **Note on the reference tool:** earlier drafts of this doc pointed at
> `free-tools/whats-in-this-csv/` as an existing, fully-client-side tool to
> copy the visual system from. That tool doesn't exist in this repo yet —
> it's the first tool planned on top of this foundation (see
> `free-tools/README.md`), not something already built. The visual tokens
> below are the design system this repo is committing to; when
> `whats-in-this-csv/` (or any tool) is actually built, it should conform
> to this doc, not the other way around. If an actual reference
> implementation shows up later with different values, reconcile this file
> with it rather than silently drifting.

## The dual-source pattern

Every tool has exactly one UI, fed by two possible data sources:

- **Anonymous visitor** (arrived from search, no account) — drives the
  tool against a curated **public** QL dataset, via QL's unauthenticated
  public-dataset chart endpoint (`ql_try_auth`, see `QL-INTEGRATION.md`).
  No token anywhere in the page. This is the default state and it must
  work with **zero clicks** — see "SEO" below.
- **Logged-in QL user** — signs in cross-origin (`QL.login()` /
  `QL.register()` / `QL.thirdPartySignin()` from `ql-client.js`) and runs
  the identical tool against **their own** datasets.

The conversion moment is inviting the anonymous visitor to create a free
account and run the tool on their own data — never a wall in front of the
tool itself. If a visitor can't see the tool working before they've signed
up for anything, that's a bug.

### Standard UI state model

Every tool moves through the same four states, in this order, and a tool
should make it obvious which one it's in:

1. **(a) Anonymous on public dataset** — the tool loads the curated public
   dataset immediately and renders real output. Remember the anonymous
   ceiling from `QL-INTEGRATION.md`: only chart data (`QL.chart()`) is
   callable unauthenticated. Don't build a stats/insights panel here that
   silently fails for anonymous visitors — either it's chart-only in this
   state, or it shows numbers baked in at build/deploy time (recorded in
   `DEPLOYMENT.md`), or it's visibly gated to "sign in to see this."
2. **(b) The invite** — a visible, un-missable "Run this on your own
   data →" call to action, present the whole time the tool is in state (a),
   not just at the end. See "Exactly one CTA path" below.
3. **(c) Logged-in dataset picker** — once `QL.login()`/`QL.register()`
   resolves, call `QL.myDatasets()` and let the user pick which of their
   own datasets to run the tool against.
4. **(d) Results** — the same rendering code as state (a), just fed from
   the user's own dataset instead of the public one. This is the whole
   point of building the tool this way: states (a) and (d) should share
   essentially all of their rendering code, differing only in
   `dataset_id` and (once signed in) which stats/insights calls are legal.

### Privacy copy

The old client-side-only framing ("nothing leaves your browser", "100%
private", etc.) is now **wrong** — every tool is a live client of a QL
backend, cross-origin. Replace it everywhere with:

> Live demo powered by QuantumLayers. Sign in to run it on your own data.

Don't imply local-only processing anywhere in copy, meta descriptions, or
README text.

## Visual tokens

Space Grotesk for display/headings, IBM Plex Sans for body copy, IBM Plex
Mono for anything data-shaped (column names, numbers, code, the KIND tag).
All three from Google Fonts (on the CDN allowlist).

```css
:root {
  /* type */
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-body: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;

  /* ground */
  --bg: #0b0d10;
  --bg-raised: #14171c;
  --bg-inset: #0e1013;
  --border: #262b32;

  /* text */
  --text: #e8eaed;
  --text-dim: #9aa1ab;
  --text-faint: #5b6270;

  /* brand / accent */
  --accent: #9b87f5; /* QL violet — matches the QL dev-guide accent */
  --accent-dim: #7dd3fc; /* links */

  /* the amber strength-meter signature */
  --meter-empty: #262b32;
  --meter-1: #7a5a1e;
  --meter-2: #96701f;
  --meter-3: #b28620;
  --meter-4: #cf9c21;
  --meter-5: #eab308;
  --meter-6: #ffcc33;

  /* state */
  --ok: #4ade80;
  --warn: #eab308;
  --danger: #f87171;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #fafafa;
    --bg-raised: #ffffff;
    --bg-inset: #f2f2f4;
    --border: #e2e4e8;
    --text: #14171c;
    --text-dim: #565c66;
    --text-faint: #9aa1ab;
  }
}
```

### The KIND tag + 6-segment amber strength meter

Every tool's primary result view carries a small mono-font "KIND" tag —
uppercase, letter-spaced, boxed — labeling what's being shown (e.g.
`KIND · PUBLIC DATASET`, `KIND · YOUR DATA`, `KIND · CORRELATION`), paired
with a 6-segment horizontal meter (amber gradient, `--meter-1`…`--meter-6`)
used anywhere a strength/confidence/quality signal needs a glanceable
read — e.g. how strong a correlation is, how confidently a chart type was
recommended, how many of a dataset's columns a report actually used. Empty
segments use `--meter-empty`.

```css
.kind-tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  display: inline-block;
}

.strength-meter {
  display: inline-flex;
  gap: 3px;
}
.strength-meter span {
  width: 14px;
  height: 6px;
  border-radius: 1px;
  background: var(--meter-empty);
}
.strength-meter span.filled:nth-child(1) { background: var(--meter-1); }
.strength-meter span.filled:nth-child(2) { background: var(--meter-2); }
.strength-meter span.filled:nth-child(3) { background: var(--meter-3); }
.strength-meter span.filled:nth-child(4) { background: var(--meter-4); }
.strength-meter span.filled:nth-child(5) { background: var(--meter-5); }
.strength-meter span.filled:nth-child(6) { background: var(--meter-6); }
```

Render 6 `<span>`s, add `.filled` to the leading N of them based on a 0–6
score (round a 0–1 or 0–100 QL score to the nearest sixth). Keep this
exact signature — the tag + meter pairing — consistent across every tool
so the collection reads as one family.

## Charting

Tools render QL's real Chart.js configs, not a homegrown chart layer.
Chart.js 4.4.0 plus the three plugins QL's own dev guide specifies, exactly
as listed in `QL-INTEGRATION.md`'s "Rendering" section — same versions,
same CDN (jsdelivr), same load order (Chart.js core, then the plugins,
then your own code). Never substitute a different charting library for
data QL returned as a Chart.js config; you'd be re-deriving what QL already
computed.

## Exactly one CTA path

One conversion path per tool: **register / sign in**, surfaced as the
"Run this on your own data →" invite from state (b) above. One subtle
GitHub link in the header pointing at this repo. Nothing else — no
newsletter modal, no second product plug, no exit-intent popup, no
"share this tool" nag. If you think a tool needs a second call to action,
it doesn't; cut it instead.

## SEO

- One primary keyword per tool, consistently in `<title>`, the meta
  description, and the page's single `<h1>`.
- All substantive text is real, indexable HTML in the main document —
  never inside an `<iframe>`. If a tool embeds anything cross-origin, the
  explanatory copy around it still lives in the parent document.
- The live-demo state (state (a), anonymous on the public dataset) must
  render with **zero clicks** — no "click to load the demo" gate, no
  interaction required before a crawler (or a human) sees real output.

## No build step

Each tool is exactly one `index.html` plus the shared `ql-client.js`
(imported via `<script src="../ql-client.js"></script>` or a pinned raw
GitHub URL if the tool is deployed from its own repo). All other
dependencies come from the CDN allowlist below — no npm, no bundler, no
transpile step, nothing to run before `index.html` is servable as-is from
GitHub Pages.

CDN sources in use across this collection:

- `https://fonts.googleapis.com` (+ `fonts.gstatic.com` for the font
  files) — Space Grotesk, IBM Plex Sans, IBM Plex Mono.
- `https://cdn.jsdelivr.net/npm/` — Chart.js 4.4.0 and its three plugins
  (see `QL-INTEGRATION.md`).

## README structure

Every tool's own `README.md` follows this shape:

1. **Title** — the tool's primary keyword, matching its `<title>`/`<h1>`.
2. **Live demo** — a link to the tool's GitHub Pages URL.
3. **GIF placeholder** — `![demo](./demo.gif)` — record and drop in once
   the tool is built; don't ship without at least the placeholder line so
   it's obvious one is expected.
4. **What it does** — 2–4 sentences, no marketing fluff.
5. **How the modes work** — explain the demo (public dataset) vs.
   your-own-data (signed-in) modes concretely: what changes, what stays
   the same, what's public-dataset-only per `QL-INTEGRATION.md`'s
   anonymous-ceiling note.
6. **"When you outgrow it" table** — 2–4 rows mapping a limitation of the
   free tool to the QuantumLayers feature that removes it, e.g.:

   | This tool | QuantumLayers |
   |---|---|
   | One chart type at a time | Auto-ranked chart recommendations across your whole dataset |
   | Public demo dataset only | Your own CSV/SQL/API/SFTP/Google Sheets sources |
   | No saved history | Saved charts, scheduled reports |

7. **Contributing** — one line, point at this repo's issues/PRs.
8. **License** — MIT.
9. **Powered by** — a line crediting QuantumLayers with a link to
   `https://quantumlayers.com`.

## Commit convention

- One branch per tool: `tools/<name>` (e.g. `tools/whats-in-this-csv`).
- [Conventional Commits](https://www.conventionalcommits.org/) messages
  (`feat:`, `fix:`, `docs:`, `chore:`, …).
- MIT license (this repo's root `LICENSE` already covers it — no
  per-tool license file needed unless a tool is split into its own repo).
- Open a PR per tool; don't push straight to the collection's default
  branch.
