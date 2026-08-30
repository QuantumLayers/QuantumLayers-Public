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

**⚠️ Load-bearing detail for this whole `free-tools/` architecture:**
`ql_get_chart_data` is the *only* analytics endpoint that uses
`ql_try_auth()`. Every other endpoint we care about —
`ql_get_dataset_detail`, `ql_get_statistical_summary`,
`ql_get_correlation_matrix`, `ql_get_distribution_analysis`,
`ql_get_pca_analysis`, `ql_get_anova_analysis`, `ql_get_insights`,
`ql_get_recommended_charts`, `ql_get_dashboard_data` (dataset listing) —
uses `ql_verify_auth()` and requires a token *even when the dataset is
public*. So an anonymous visitor on the curated public dataset can render
charts (`ql_get_chart_data`), full stop — not stats, not AI insights, not
even the dataset's own column schema (`ql_get_dataset_detail`). Any tool
that wants to show summary stats or insights to an anonymous visitor either
needs those numbers baked in ahead of time (e.g. committed alongside the
public dataset's ID in `DEPLOYMENT.md`) or has to gate that section behind
sign-in. Design tools around this rather than assuming it'll work and
finding out from a `success: false` in production.

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

### Chart types (`ql_get_chart_data`'s `chart_type`)

`histogram`, `bar` / `horizontal_bar`, `pie` / `doughnut`, `scatter`,
`bubble`, `box_plot` / `violin`, `heatmap`, `time_series` / `stacked_area`,
`regression`, `line`, `area`. Each has its own required params
(`x_column`/`y_column`, `category_column`/`value_columns[]`, etc.) — see
the "Type-specific params" and "Chart Type Quick Reference" tables in
`docs/embedded-analytics-api.html`. All chart endpoints accept the common
filter params `filter_category_column`/`filter_category_value` and
`filter_date_column`/`filter_date_from`/`filter_date_to`.

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
risk an anonymous visitor's zero-click demo silently bouncing to
quantumlayers.com. So `ql-client.js` re-implements only the specific,
documented request/response shapes it needs (`getSessionToken`/
`setSessionToken`, login, register, `thirdPartySignin`, chart/stats/insight
calls) as plain `fetch()` calls — exactly the "Direct API / AJAX Calls"
path the dev guide itself describes as the right choice for "a frontend
built in a framework where you'd rather write your own thin API client
than depend on jQuery-based modules." No jQuery dependency, no coupling to
QL's own DOM conventions, and anonymous visitors never touch a script that
might redirect them off the page.

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

1. **Anonymous / public-dataset mode is chart-only.** Don't build a "stats"
   or "insights" panel that anonymous visitors see live-populated from QL —
   it can't be, per the auth table above. Either omit that panel for
   anonymous visitors, show static/precomputed numbers, or label it as
   something that unlocks after sign-in.
2. **CORS is unconfirmed.** Nothing in any of the three source docs
   mentions CORS headers on `admin-ajax.php`. Every fetch from a
   `github.io` origin will fail outright (a generic, unreadable
   "Failed to fetch" in the browser) until QL's operator allows the
   GitHub Pages origin. See `DEPLOYMENT.md` — treat this as unverified
   until someone confirms it against the real endpoint.
3. **Public dataset IDs are operational data, not code.** Which dataset(s)
   are curated + public, and their numeric IDs, must be recorded in
   `DEPLOYMENT.md` before a tool can hardcode them.
4. **One transport, one place.** All of the above — token storage, the
   `fetch()` wrapper, the normalized error shape, chart/stat/insight calls,
   login/register/thirdPartySignin — live in `ql-client.js`. Tools import
   it and never hand-roll their own `fetch()` to `admin-ajax.php`.
