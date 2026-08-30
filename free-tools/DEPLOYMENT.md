# Deployment prerequisites — read before building or shipping a tool

⚠️ This file previously listed three unconfirmed prerequisites — CORS, a
registered third-party auth provider, and a curated public demo dataset
per tool. Two of those are now resolved or moot, per direction from QL's
operator (recorded here on 2026-08-30):

- **CORS is not a blocker.** Sign-in works cross-origin without it, and
  every other authenticated call only needs a valid `Authorization:
  Bearer <token>` header. See `QL-INTEGRATION.md`'s "Design implications"
  section. Don't reintroduce CORS as a caveat in new copy.
- **No tool needs a public demo dataset.** This repo doesn't build
  anonymous-facing QL views at all — every tool requires sign-in before
  showing any QL output (see `CONVENTIONS.md`'s "sign-in-first pattern").
  There's nothing to curate, set to public visibility, or record an ID
  for.

What's left is (b) below, which stays genuinely conditional — most tools
will never need it.

## (a) CORS — resolved, not a blocker

~~Every `free-tools/` page is served from a GitHub Pages origin, not
quantumlayers.com, so cross-origin fetch() calls would normally need CORS
headers from QL's server.~~ Per QL's operator, this isn't actually a gate
for this API: sign-in works cross-origin without it, and authenticated
calls only need a valid Bearer token. If a tool's `fetch()` calls fail,
look for an actual connectivity problem or a missing/invalid/expired
token first — not CORS.

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

## (c) A curated public demo dataset per tool — retired, not applicable

No longer needed by any tool in this collection. `csv-outlier-detector`
and `instant-chart-maker` previously had a `PUBLIC_DEMO` config block
gated on a dataset like this existing; that scaffolding has been removed
from both, and every tool now goes straight from "signed out" to a
register/sign-in prompt (see `CONVENTIONS.md`). If a future tool
genuinely needs a public dataset for some other reason, reopen this
section rather than reusing this retired version of it.

## Failing gracefully

Every tool must degrade to a clear, honest message rather than a blank
page or a confusing generic error:

- A `NETWORK`-coded error from `ql-client.js` should be shown as
  something like: *"Can't reach QuantumLayers right now — try again
  shortly."* — a real connectivity problem, not a CORS issue (see (a)
  above) — not a raw stack trace, not a silently empty area.
- Sign-in failures (`AUTH_REQUIRED`, or an `API_ERROR` from
  `ql_user_signin`/`ql_user_signup`) should surface QL's own message where
  one exists (`err.message` from `ql-client.js`), since those are usually
  actionable ("that email is already registered", "invalid password") —
  don't swallow them into a generic "something went wrong."

## Checklist before calling any tool "launched"

- [ ] (b) only if the tool uses `thirdPartySignin()` — provider registered.
- [ ] The tool was actually loaded from its real GitHub Pages URL (not
      `file://` or `localhost`) and the sign-in/register form works
      end-to-end against a real QL account.
- [ ] Sign-in → dataset picker → results (states a/b/c in
      `CONVENTIONS.md`) was exercised against a real QL account with at
      least one real dataset.
