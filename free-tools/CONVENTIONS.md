# free-tools/ conventions

Rules every tool in this collection follows. If you're adding a new tool,
read this end to end before writing HTML.

> **Note on the reference tool:** [`free-tools/whats-in-this-csv/`](./whats-in-this-csv/)
> is an intentional exception to the pattern below, not an oversight —
> it's fully client-side, never calls QL, and its own README's "your data
> never leaves your machine" promise is the point of the tool. It predates
> this repo's QL-backed foundation and is kept that way deliberately. The
> visual tokens below are still the design system this repo commits to
> going forward; every tool built *after* `whats-in-this-csv` follows the
> QL-backed sign-in-first pattern (`ql-client.js`, the states in the next
> section) rather than `whats-in-this-csv`'s client-only shape.

## The sign-in-first pattern

⚠️ **Per direction from QL's operator, there is no anonymous public-dataset
mode.** An earlier version of this doc specified a "dual-source" pattern
— an anonymous visitor driving the tool against a curated public dataset,
with a logged-in visitor as the upsell path. That's been retired for the
whole collection: **every tool always requires signing in.** An anonymous
visitor never sees computed QL output of any kind — they see the tool's
explanation and a register/sign-in prompt, full stop. There is no public
demo dataset to curate, and `DEPLOYMENT.md`'s prerequisite for one no
longer applies to any tool in this collection.

Every tool has exactly one UI, with exactly one data source: **the signed-
in user's own QuantumLayers datasets.** The conversion moment is the
register/sign-in step itself — not a wall in front of a working demo (there
is no demo to wall off), but the honest, only way to see the tool run at
all. Also per direction: **login is cross-origin without any CORS
requirement**, and every other authenticated call only needs a valid
`Authorization: Bearer <token>` header — see `QL-INTEGRATION.md`'s
"Auth: which gate an endpoint sits behind" section and `DEPLOYMENT.md`'s
CORS item, both updated accordingly. Don't reintroduce CORS as a caveat in
new copy; it isn't one.

### Standard UI state model

Every tool moves through the same three states, and should make it
obvious which one it's in:

1. **(a) Signed out** — the tool's explanation, its primary keyword in a
   real `<h1>`, and a register/sign-in form are all visible immediately,
   with zero clicks. This is the entire anonymous experience; there is
   nothing else to gate or reveal.
2. **(b) Dataset picker** — once `QL.login()`/`QL.register()` resolves,
   call `QL.myDatasets()` and let the user pick which of their own
   datasets to run the tool against.
3. **(c) Results** — the tool's actual output, fed from the chosen
   dataset. This is the only state that ever computes or displays QL data.

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

One conversion path per tool: **register / sign in**, which is state (a)
above, not a secondary upsell bolted onto a working demo. One subtle
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
- State (a) — the tool's explanation and its register/sign-in form —
  renders with **zero clicks**: no interaction required before a crawler
  (or a human) sees the real `<h1>`, the explanatory copy, and a working
  form. There is no anonymous data demo to gate or reveal; "zero clicks"
  here means the explanation and the sign-in path itself are never hidden
  behind an interaction, not that computed QL output is shown pre-sign-in.

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
5. **How it works** — explain concretely what happens after signing in:
   the dataset picker, then what the tool computes and shows. State
   plainly that there's no anonymous demo mode — sign-in is required to
   see the tool run at all — rather than leaving it implicit.
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
