# Deployment prerequisites — read before building or shipping a tool

⚠️ **None of the items below are confirmed done.** Nothing in
`docs/embedded-analytics.html`, `docs/embedded-analytics-api.html`, or
`docs/embedded-analytics-jdk.html` mentions CORS, third-party provider
registration for a GitHub Pages origin, or a curated public demo dataset.
Do not assume any of this is configured on the QL side just because
`ql-client.js` and the tools built on it *assume* it will be. Verify each
item against the real `admin-ajax.php` endpoint (or with whoever operates
quantumlayers.com) before treating a tool as launch-ready — and if a tool
is live and one of these turns out not to be true, that's a production
incident, not a documentation gap.

## (a) CORS on `admin-ajax.php`

Every `free-tools/` page is served from a GitHub Pages origin (typically
`https://<org>.github.io`), not `quantumlayers.com`. A cross-origin
`fetch()` from that page to `https://quantumlayers.com/wp-admin/admin-ajax.php`
needs QL's server to respond with CORS headers that allow it —
minimally `Access-Control-Allow-Origin` covering the GitHub Pages origin
(or `*`, though an explicit origin is safer given the `Authorization`
header these requests carry), and `Access-Control-Allow-Headers` including
`Authorization, Content-Type`.

**Without this, every call fails before it reaches QL's own auth checks.**
The browser blocks the response client-side, and `ql-client.js` reports it
as a generic `NETWORK` error (see `QL-INTEGRATION.md`) — there is no QL
error message to read because the request never completed from the
browser's point of view. If a tool is "just showing a network error for
everything," this is the first thing to check, not a bug in the tool.

**Status: unconfirmed.** Record here once verified:

- [ ] Origin(s) allowed: `_____________________`
- [ ] Verified against the live endpoint on: `_____________________`
- [ ] Verified by: `_____________________`

## (b) A registered third-party auth provider (Option B)

Only needed if/when a tool (or a signer sitting in front of one) uses
`QL.thirdPartySignin()`. Per `QL-INTEGRATION.md`, this is **not** the
default sign-in path for a static free-tool — `QL.login()`/`QL.register()`
against the native `ql_user_signin`/`ql_user_signup` endpoints is — so
this section only applies if a specific tool grows a JWT-signing backend
of its own.

If/when that happens, QL's operator needs to register a row in
`ql_auth_providers` with:

- `id` — a slug, becomes the JWT's `kid` header.
- `name` — human-readable label.
- `jwt_secret` — a shared HS256 secret, held only by the signer's backend,
  never in this repo or any tool's client-side code.

**Status: not requested; not applicable until a tool needs it.**

- [ ] Provider id: `_____________________`
- [ ] Secret stored (where, by whom — not in this file, not in git):
      `_____________________`

## (c) A curated public demo dataset per tool

Each tool needs at least one QL dataset that is:

1. Real enough to make the demo interesting (not a toy 5-row CSV).
2. Set to **public** visibility — QL's `visibility` field must be
   `public` (or the legacy `is_public = 1`) for `ql_get_chart_data`'s
   `ql_try_auth()` check to allow unauthenticated access at all (see
   `QL-INTEGRATION.md`). A private dataset here means anonymous visitors
   see nothing.
3. Small enough to load quickly given `ql_get_chart_data` loads raw rows
   up to the plan's row limit on every chart request.

Record each tool's dataset ID(s) here as they're created — tools should
read the ID from this table (or a config baked in at deploy time), never
guess or hardcode a number that isn't recorded.

| Tool | Dataset name | Dataset ID | Visibility confirmed | Notes |
|---|---|---|---|---|
| `csv-outlier-detector` | _(not created)_ | _(not created)_ | ❌ | Needs: ≥1 numeric column with genuine outliers, ≥1 low-cardinality (2–15 distinct values) category column to group the box plot by. Once created, fill in `PUBLIC_DEMO` (`datasetId`, `datasetLabel`, `numericColumns`, `categoryColumn`) at the top of `free-tools/csv-outlier-detector/index.html`'s script — anonymous zero-click mode turns on automatically, no other code changes needed. Until then that tool leads anonymous visitors straight to its sign-up panel instead of a broken demo. |

**Status: no public datasets created yet.**

## Failing gracefully until all three are done

Every tool must degrade to a clear, honest message rather than a blank
page or a confusing generic error when any prerequisite above isn't met:

- A `NETWORK`-coded error from `ql-client.js` on the very first call a
  tool makes (loading the public dataset's chart) should be shown as
  something like: *"Can't reach the QuantumLayers demo backend right now
  — this is usually a temporary configuration issue, not something wrong
  with your data. Try again shortly."* — not a raw stack trace, not a
  silently empty chart area.
- If `DEPLOYMENT.md`'s dataset table has no entry for a tool yet, that
  tool is not done — don't wire a placeholder ID into it "for now" and
  ship it; a fabricated dataset ID fails exactly like a real
  misconfiguration, just less honestly.
- Sign-in failures (`AUTH_REQUIRED`, or an `API_ERROR` from
  `ql_user_signin`/`ql_user_signup`) should surface QL's own message where
  one exists (`err.message` from `ql-client.js`), since those are usually
  actionable ("that email is already registered", "invalid password") —
  don't swallow them into a generic "something went wrong."

## Checklist before calling any tool "launched"

- [ ] (a) CORS confirmed for this tool's deployed origin.
- [ ] (c) This tool's public dataset exists, is public, and its ID is
      recorded above.
- [ ] (b) only if the tool uses `thirdPartySignin()` — provider registered.
- [ ] The tool was actually loaded from its real GitHub Pages URL (not
      `file://` or `localhost`, which sidestep CORS entirely and will give
      a false "it works") and shows real output with zero clicks.
- [ ] Sign-in → dataset picker → results (states b/c/d in
      `CONVENTIONS.md`) was exercised against a real QL account, not just
      state (a).
