# Third-party JWT sign-in (shadow users)

For cross-origin embeds where *your* backend should transparently
provision a QuantumLayers account for each of your own users, without
sending them through an interactive QL login page.

The QL operator registers your application once in `ql_auth_providers`
with an `id`, a `name`, and a shared HMAC secret. Your backend then mints
an HS256 JWT for whichever of your users is currently logged in, and
exchanges it for a QL session token via `ql_third_party_signin`. QL finds
or creates a "shadow user" keyed on `provider_id + sub`, keeping the
email/name in sync on every sign-in.

Two equivalent implementations are included: [`mint-jwt.php`](mint-jwt.php)
(PHP, `firebase/php-jwt`) and [`mint-jwt.js`](mint-jwt.js) (Node,
`jsonwebtoken`).

## Try it

You'll need a `provider_id` and `jwt_secret` registered with QL ahead of
time — contact QuantumLayers to set that up. Then:

```bash
# PHP
composer require firebase/php-jwt
QL_PROVIDER_ID=acme-corp QL_JWT_SECRET=your-shared-secret php mint-jwt.php

# Node
npm install jsonwebtoken
QL_PROVIDER_ID=acme-corp QL_JWT_SECRET=your-shared-secret node mint-jwt.js
```

Both print the resulting `session_token` — use it as the `Authorization:
Bearer` value on subsequent requests, exactly like an API token. See
[`../../docs/embedded-analytics.html`](../../docs/embedded-analytics.html)
(Option B) for the full JWT header/payload spec.
