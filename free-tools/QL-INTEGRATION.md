# QL Integration Notes

Working notes on QuantumLayers' (QL) embedded-analytics surface, distilled
from the three developer-guide pages for anyone building a tool in
`free-tools/`. This is a summary for quick reference while building —
the source of truth is always the live docs:

- https://quantumlayers.com/embedded-analytics-developer-guide
- https://quantumlayers.com/embedded-analytics-api
- https://quantumlayers.com/embedded-analytics-jdk

(This repo also mirrors those three pages at `docs/embedded-analytics.html`,
`docs/embedded-analytics-api.html`, and `docs/embedded-analytics-jdk.html` —
that's what this note was actually written from.)

## The shape of the API

One URL for everything: `POST https://quantumlayers.com/wp-admin/admin-ajax.php`,
with the operation selected by an `action` POST field (e.g.
`action=ql_get_chart_data`). Every response is the standard WordPress AJAX
envelope: `{ "success": true, "data": {...} }` or
`{ "success": false, "data": { "message" | "error": "..." } }`. There is no
REST or GraphQL layer — `action` names are the entire surface.

Every request must carry `Authorization: Bearer <token>` *except* where
noted below. A `nonce` field is also expected for requests made from a
browser session on the QL site itself, but the docs are explicit that the
nonce is "only meaningful for same-origin requests and is not required for
cross-origin/API use" — so free-tools pages never need to source or send one.

## Auth: which gate an endpoint sits behind

Every endpoint is guarded by one of two PHP checks, and the docs state
plainly which one each endpoint uses:

- **`ql_try_auth()`** — token is optional. If a valid Bearer token is
  present it's used (so a private dataset the token can read still works);
  if absent, the request is allowed through **only if the dataset itself is
  public**.
- **`ql_verify_auth()`** — a valid Bearer token is required, full stop. No
  token → the request is rejected regardless of the dataset's visibility.

**Historical note, not current design guidance:** `ql_get_chart_data` is
the *only* analytics endpoint that uses `ql_try_auth()` — every other
endpoint listed below (`ql_get_dataset_detail`, `ql_get_statistical_summary`,
`ql_get_correlation_matrix`, `ql_get_distribution_analysis`,
`ql_get_pca_analysis`, `ql_get_anova_analysis`, `ql_get_insights`,
`ql_get_recommended_charts`, `ql_get_dashboard_data`) uses
`ql_verify_auth()` and requires a token even when the dataset is public.
This is still factually accurate about the API, but it stopped being a
design driver once this repo dropped anonymous-facing QL views entirely
(see `CONVENTIONS.md`'s "sign-in-first pattern" and the "Design
implications" section below) — every tool here always requires a Bearer
token before showing any QL output, so the `ql_try_auth`/`ql_verify_auth`
distinction no longer changes what a tool can build.

## Endpoints tools in this repo actually use

All via POST to `admin-ajax.php`:

| action | Auth | Notes |
|---|---|---|
| `ql_get_chart_data` | `ql_try_auth` | The one public-friendly endpoint. Routes on `chart_type`, returns a ready-to-use Chart.js config (`type`+`data`+`options`). See "Chart types" below. |
| `ql_get_recommended_charts` | `ql_verify_auth` | Runs the rule-based insight pipeline and returns the top-N chart candidates, each with `chart_data`, `insight_score` (0–100), and a plain-English `reason`. Good for an auto-populated "here's what's interesting" view once a user is signed in. |
| `ql_get_dataset_detail` | `ql_verify_auth` | Column schema + pre-computed per-column stats (min/max/mean/stddev/distinct/null counts). Cheapest way to know what's in a dataset. |
| `ql_get_statistical_summary` | `ql_verify_auth` | Per-numeric-column summary: count/missing/min/max/mean/std/median/q1/q3/skewness/kurtosis. |
| `ql_get_correlation_matrix` | `ql_verify_auth` | Full Pearson-r matrix over continuous numeric columns. Cached 1h server-side per dataset. |
| `ql_get_distribution_analysis` | `ql_verify_auth` | Percentiles, skew/kurtosis, IQR-fence outliers for one column. |
| `ql_get_pca_analysis` | `ql_verify_auth` | PCA via power iteration; needs ≥2 numeric columns and ≥10 rows. |
| `ql_get_anova_analysis` | `ql_verify_auth` | One-way ANOVA over every (categorical × numeric) column pair. |
| `ql_get_insights` | `ql_verify_auth` | Two-stage: rule-based insights always run; an AI holistic summary is prepended if an LLM key + token budget allow it. |
| `ql_get_dashboard_data` | `ql_verify_auth` | Lists the authenticated user's own datasets — the entry point for the "run this on your own data" flow once signed in. |
| `ql_third_party_signin` | none (issues the token) | Exchanges a third-party-signed JWT for a QL `session_token`. See Option B below. |
| `ql_user_signin` / `ql_user_signup` | none (issue the token) | Native QL email/password login and registration. Not gated behind a Bearer token for the same chicken-and-egg reason as signin; nonce is optional cross-origin (see above). |
| `ql_check_auth` | token optional | Verifies whatever token is stored is still valid; returns the user object if so. |

Full parameter lists for every endpoint above are in
`docs/embedded-analytics-api.html` — `ql-client.js` mirrors them, but check
there before adding a new call.

### `box_plot`'s response shape — CORRECTED against a live call

⚠️ **This section previously said `box_plot` returns raw per-row values.
That was wrong** — it was inferred from the API docs' prose ("arrays of
raw values per group... from which the library computes quartiles") and
never checked against a real response. A live `ql_get_chart_data` call
with `chart_type: box_plot` actually returns **pre-aggregated per-group
statistics**, shaped like `@sgratzl/chartjs-chart-boxplot`'s other
supported input format:

```json
{
  "data": {
    "labels": ["Group A", "Group B"],
    "datasets": [{ "data": [
      { "min": 1, "q1": 2, "median": 3, "q3": 4, "max": 5, "mean": 3, "outliers": [9, 10] },
      { "min": 2, "q1": 3, "median": 4, "q3": 5, "max": 6, "mean": 4, "outliers": [] }
    ]}]
  }
}
```

QL computed the box-and-whisker stats (and its own outlier detection)
server-side; there is no raw per-row value array to recompute from. This
has the same practical limitation as `ql_get_distribution_analysis`
(fixed 1.5×IQR fence, no configurable sensitivity) — a tool wanting an
adjustable outlier sensitivity can only ever *narrow* QL's own `outliers`
list per group (re-filter it against a stricter fence built from that
group's own `q1`/`q3`), never find outliers QL didn't already flag, since
the underlying raw distribution was never returned.
`free-tools/csv-outlier-detector/` was rewritten around this real shape
after the bug was caught by a live API check — its sensitivity control
only offers "QL's default" and "a stricter subset of QL's default" for
exactly this reason.

### `ql_get_recommended_charts`'s response envelope key — CORRECTED

⚠️ Also previously documented wrong: the response's chart-candidates array
is under the key **`candidates`**, not `charts`. Confirmed against a live
call — `{ "candidates": [{ "chart_type", "params", "insight_score",
"reason", "metadata", "dataset_id" }], "columns": [...], "analysis_summary": {...} }`.
Each candidate does **not** include a ready-to-render `chart_data` field
(also previously assumed) — fetch it separately via `ql_get_chart_data`
with the candidate's own `chart_type`/`params`. `free-tools/instant-chart-maker/`
had this reversed originally, which meant its entire auto-recommendation
feature silently never fired (it always read `undefined` and fell back to
a manual default) until this was caught.

### `aggregation: "count"` doesn't do what the docs' prose suggests

Confirmed against a live call: sending `chart_type: "bar"` with
`aggregation: "count"` does **not** count rows — the response comes back
titled "Sum of X by Y" and the values are sums, not counts (the parameter
appears to be silently ignored server-side for bar/horizontal_bar).
Separately, `value_columns` must always be a **numeric** column for
bar/horizontal_bar, even when you only want a count — passing a
categorical column as `value_columns` (the natural move if you don't have
a spare numeric column) fails outright with `"Column must be numeric"`.

The confirmed, correct way to get real per-category row counts is
**`pie`/`doughnut` with `value_column` omitted entirely** — the docs'
"omit for counts" note (easy to miss) is accurate and is the actual
mechanism, not a `count` aggregation value on any chart type. It also
comes pre-sorted descending and trimmed to `limit`, with the remainder
bucketed into an `"Other"` slice. Also confirmed: the correct aggregation
keyword where one is genuinely needed is **`"average"`, not `"avg"`**
(both the `get_chart_data` tool's own param schema and a live
recommended-charts response used "average").

### Numeric-looking JSON fields are often strings, not numbers

Confirmed on `ql_get_dataset_detail`: `row_count`, `distinct_count`,
`null_count`, `col_index`, and — for numeric columns — `min_val`,
`max_val`, `mean_val`, `stddev_val` all come back as JSON **strings**
(`"distinct_count": "13"`, not `13`). `ql_get_statistical_summary` is a
mix: `count`/`missing`/`min`/`max` are strings, but `mean`/`std`/`median`/
`q1`/`q3`/`skewness`/`kurtosis` are real numbers (or `null` when QL
couldn't compute them, e.g. too few non-null values). This is consistent
with a PHP/MySQL backend returning `$wpdb` query results (which are
strings by default) directly into `json_encode()` without casting —
expect it on any endpoint backed by a raw column value, and don't expect
it on endpoint-computed statistics (means, correlations, p-values, scores)
which come back as real numbers.

This silently breaks two very common patterns if you don't coerce:
- **Strict equality** (`===`) against a literal number — e.g. checking
  `distinct_count === 1` to flag a constant column, or comparing
  `distinct_count === row_count` to detect a fully-unique column, is
  `"1" === 1` / `"226" === "226"` — the second happens to still work
  because both sides are strings from the same API, but the first is
  reliably false forever. `free-tools/csv-data-profiler/`'s "constant
  columns" detector had exactly this bug.
- **`.toLocaleString()`** for thousands-grouping — `String.prototype.toLocaleString()`
  is not `Number.prototype.toLocaleString()`; it does not add separators
  or apply `maximumFractionDigits`, so a raw string field just prints
  unchanged (or, worse, with excessive untruncated decimal places for
  something like a `stddev_val`).

Coerce with `Number(...)` — but only for genuinely numeric columns. A
date column's `min_val`/`max_val` are real date strings
(`"2025-12-06 22:46:41"`), and a text/category column's are the
alphabetic min/max value (`"Apple AirPods"`) — coercing those to `Number()`
produces `NaN`, not a bug fix. Coerce based on the column's own
`inferred_type`, once, at classification time.

### The sign-in-issuing endpoints' response envelope is inconsistent — CORRECTED against a live call

⚠️ This repo previously assumed every endpoint nests its payload under
`data`, per "The shape of the API" above (`{ success, data: {...} }`).
That's confirmed correct for the analytics/dataset endpoints and for
`ql_check_auth`, but **`ql_user_signin` does not follow it** — confirmed
2026-08-31 against a real login response:

```json
{
  "success": true,
  "message": "Login successful",
  "session_token": "<redacted — a real, live 64-char hex session token>",
  "user": { "id": "1323", "email": "<redacted>", "first_name": "…", "last_name": "…", "role": "viewer" }
}
```

`session_token` and `user` are top-level keys, not `data.session_token`.
`ql-client.js`'s original `login()` read `data.session_token` (where
`data` was already `json.data`), so `data` was `undefined` and the call
crashed with an uncaught `Cannot read properties of undefined (reading
'session_token')` instead of failing cleanly.

This is genuinely inconsistent across the endpoint *family*, not just
"nesting is wrong everywhere" — `ql_third_party_signin`'s response **is**
nested (`res.data.session_token`), per QL's own "Complete Code Example" in
`embedded-analytics-api.html`, and `ql_check_auth`'s is nested too
(`response.data.logged_in`, `response.data.user`) per the JDK guide.
`ql_user_signup`'s shape isn't confirmed either way by the docs or by a
live call yet.

**Fix applied:** `login()`/`register()`/`thirdPartySignin()` now call
`call()` with `{ raw: true }` (resolving to the whole envelope, not
`json.data`) and share one `applySessionResponse()` helper that checks the
flat top-level shape first, then falls back to `.data` — correct for both
confirmed shapes, and for whichever one `ql_user_signup` turns out to use.
The same inconsistency likely applies to the *error* message on a failed
sign-in (`message`/`error` probably also flat on `ql_user_signin`, not
`data.message`) — `call()`'s generic error-path now checks both spots too.
If you add a new sign-in-issuing endpoint, don't assume either shape —
verify against a live call first.

### Chart types (`ql_get_chart_data`'s `chart_type`)

`histogram`, `bar` / `horizontal_bar`, `pie` / `doughnut`, `scatter`,
`bubble`, `box_plot` / `violin`, `heatmap`, `time_series` / `stacked_area`,
`regression`, `line`, `area`. Each has its own required params
(`x_column`/`y_column`, `category_column`/`value_columns[]`, etc.) — see
the "Type-specific params" and "Chart Type Quick Reference" tables in
`docs/embedded-analytics-api.html`. All chart endpoints accept the common
filter params `filter_category_column`/`filter_category_value` and
`filter_date_column`/`filter_date_from`/`filter_date_to`.

**⚠️ Those two tables disagree with each other for `bar`/`horizontal_bar`,
`box_plot`/`violin`, `heatmap`, and `time_series`/`stacked_area`** — e.g.
the "Type-specific params" table names `bar`'s params `category_column` +
`value_columns[]`, while the separate "Chart Type Quick Reference" table
names the same chart type's params `x_column`/`y_column`. `free-tools/instant-chart-maker/`
resolved this by trusting the *prose* description of each chart type's
server-side behavior over either table where they conflict — e.g. the
prose explicitly says `box_plot` "groups raw `y_column` values by the
categories in `x_column`" and `heatmap` "aggregates `z_column` for every
unique `(x_column, y_column)` coordinate pair," which settles those two
in favor of the first table's naming. `line` and `area` aren't described
in prose at all (only in the quick-reference table), so for those two
specifically the quick-reference table's `x_column`/`y_column`/`aggregation`
is the only source and what's used. If you hit a `success: false` from
one of these four chart types, the param names are the first thing to
double-check against the live API before assuming something else is wrong.

**`bar`/`horizontal_bar`'s result order isn't documented, and a count-style
"top values" bar doesn't actually work — see the `aggregation: "count"`
section below.** Only `pie`/`doughnut`'s docs explicitly promise "sorts
descending, trims to `limit` categories," which turns out to be accurate
and is why `free-tools/csv-data-profiler/`'s per-column "top values" cards
use a doughnut rather than a bar — not a stylistic choice, a correctness
one.

## Rendering: Chart.js 4.4.0 + 3 plugins

`ql_get_chart_data`'s response is a complete Chart.js config — pass it
straight to `new Chart(ctx, response.data)`. Load these four CDN scripts,
in this order, before any code that renders a chart:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@sgratzl/chartjs-chart-boxplot@4.2.5/build/index.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@2.0.1/dist/chartjs-chart-matrix.min.js"></script>
```

The boxplot/date-adapter/matrix plugins are only strictly needed for
`box_plot`/`violin`, time-based, and `heatmap` charts respectively, but
loading all four unconditionally is simpler and is what the dev guide
itself recommends for anything that might render any chart type. This
matches our CDN allowlist (jsdelivr) and needs no build step.

## The JDK (`https://quantumlayers.com/jdk/*.js`)

Standalone `<script>`-tag modules, no bundler required:

```
jdk/auth.js               // QLAuth        — session token storage, login/register/logout, thirdPartySignin()
jdk/upload.js              // QLUpload      — CSV upload / dataset editing
jdk/dashboard.js           // QLDashboard   — dataset inventory, lifecycle actions
jdk/dataset-detail.js      // QLDatasetDetail
jdk/analytics.js           // QLAnalytics   — chart rendering, stats, saved charts
jdk/insights.js            // QLInsights    — AI-powered dataset insights
jdk/merge-datasets.js      // QLMergeDatasets
jdk/report-scheduler.js    // QLReportScheduler
jdk/organizations.js       // QLOrganizations
jdk/agent.js               // QLAgent       — multi-turn AI agent
```

`auth.js` has no dependency on any other module, but every other module
calls `QLAuth.getSessionToken()` to build its own Bearer header — so if you
load it at all, it must be first, and jQuery must be loaded before it.

**Why `ql-client.js` (in this repo) does *not* load `jdk/auth.js`:** the
JDK modules are built for QL's own page templates, not as a generic
importable library. `auth.js` expects a global `qlAuth = { ajaxurl, nonce }`
object to already exist, and its `init()` auto-binds to specific DOM IDs
(`#ql-login-form`, `#ql-register-form`, `.ql-logout-btn`, …) and calls
`checkAuth()` on load — and the docs are internally inconsistent about
whether that `checkAuth()` redirects an anonymous visitor to
`/ql-login` or leaves the page alone (compare the `checkAuth()`
description under QLAuth to its own "Success" line). We are not willing to
risk a visitor being silently bounced to quantumlayers.com by a script we
don't fully control. So `ql-client.js` re-implements only the specific,
documented request/response shapes it needs (`getSessionToken`/
`setSessionToken`, login, register, `thirdPartySignin`, chart/stats/insight
calls) as plain `fetch()` calls — exactly the "Direct API / AJAX Calls"
path the dev guide itself describes as the right choice for "a frontend
built in a framework where you'd rather write your own thin API client
than depend on jQuery-based modules." No jQuery dependency, no coupling to
QL's own DOM conventions, and no script running on the page that might
redirect a visitor off it unexpectedly.

If a future tool genuinely needs a JDK module we haven't wrapped (agent
chat, merge-datasets, report scheduling), it's fine to load that one module
directly per its own "How to Include" section — just don't reach for
`auth.js` for the reasons above.

## Auth options, and which ones a *static* free-tool can actually use

The dev guide documents three ways to obtain the Bearer token:

- **Option A — QL session token (same-origin).** Reads
  `localStorage['ql_session_token']` on `quantumlayers.com` itself. **Not
  usable at all from a `github.io` origin** — `localStorage` is
  per-origin, so a token set while the visitor was signed in on QL's own
  site is invisible to our page.
- **Option B — Third-party JWT (`QLAuth.thirdPartySignin()` /
  `ql_third_party_signin`).** QL registers your app in `ql_auth_providers`
  with an `id` + HMAC secret; *your backend* mints an HS256 JWT (`kid` =
  your provider id) and this gets exchanged for a session token. See
  `examples/third-party-jwt-signin/` for two working JWT minters (PHP,
  Node) — note both are **server-side** scripts, because minting the JWT
  requires the shared secret, which must never reach a browser.
  **`free-tools/` pages are static GitHub Pages sites with no backend of
  their own**, so nothing in this repo can mint that JWT itself. `ql-client.js`
  still exposes `QL.thirdPartySignin(jwt)` — a thin wrapper around POSTing
  a pre-signed JWT to `ql_third_party_signin` — for the case where *you*
  stand up your own small signer (a Worker, a Lambda, anything holding the
  secret) in front of a tool, e.g. to single-sign-on your own users into
  QL. It is not how a visitor's "sign in with my existing QuantumLayers
  account" button works.
- **Option C — API token.** A long-lived token from the account's *API
  Tokens* page, used directly as the Bearer value. Simplest for
  server-to-server, and explicitly **never to be embedded in client-side
  code** — a token pasted into a public GitHub Pages bundle is a token
  anyone in the world can read and use as that account, with whatever
  quota/billing consequences that implies. `free-tools/` must never do this.

**What a static tool actually uses, then:** for the "run this on your own
data" conversion path, `ql-client.js` calls the native, unauthenticated
login/registration endpoints directly —
`ql_user_signin` (email + password) and `ql_user_signup` — the same calls
QL's own login/register forms make. These are not gated behind a Bearer
token (there's nothing to bear yet) and the dev guide states the
same-origin `nonce` they normally send is not required for cross-origin
callers. That gives every free-tool a real "sign in with your QuantumLayers
account" / "create a free account" flow with zero backend infrastructure of
its own. `QL.thirdPartySignin()` stays available in `ql-client.js` for
anyone who *does* control a signer, but it is not the default UI path —
see `CONVENTIONS.md`.

**Never put an Option C API token in client-side code, in this repo, in any
tool built on top of it, or in any example someone copies from here.**

## Design implications for `ql-client.js` and every tool

1. **No anonymous mode, for any tool.** ⚠️ Per direction from QL's
   operator, this repo doesn't build anonymous-facing QL views at all —
   not even chart-only ones. Every tool requires sign-in before it shows
   any QL-computed output; an anonymous visitor sees the tool's
   explanation and a register/sign-in form, nothing else. The anonymous-
   ceiling analysis above (what `ql_try_auth` vs. `ql_verify_auth` allow
   unauthenticated) is still factually accurate about the API and worth
   knowing, but it's not a constraint this repo designs around — there is
   no public-dataset demo mode to fit it into. See `CONVENTIONS.md`'s
   "sign-in-first pattern."
2. **CORS is not a blocker.** ⚠️ Corrected per direction from QL's
   operator (this repo previously treated it as unconfirmed and warned
   every tool to expect a generic network failure because of it — that
   was wrong): sign-in works cross-origin without needing CORS, and every
   other authenticated call only requires a valid `Authorization: Bearer
   <token>` header. Don't reintroduce "this is probably a CORS issue" as
   the default explanation for a network error in new copy — if a fetch
   genuinely fails, look for an actual connectivity problem or a missing/
   invalid token first.
3. **One transport, one place.** All of the above — token storage, the
   `fetch()` wrapper, the normalized error shape, chart/stat/insight calls,
   login/register/thirdPartySignin — live in `ql-client.js`. Tools import
   it and never hand-roll their own `fetch()` to `admin-ajax.php`.
