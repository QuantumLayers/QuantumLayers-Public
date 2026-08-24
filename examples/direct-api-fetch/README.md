# Direct API calls (no JDK)

Calls `admin-ajax.php` directly with a long-lived API token — no jQuery,
no QL JavaScript at all. This is the leanest integration path: any HTTP
client in any language works the same way.

## Try it

1. Create a token on the **API Tokens** page of your QuantumLayers account.
2. `QL_API_TOKEN=qlat_xxxx node fetch-example.js`

The script lists your datasets via `ql_get_dashboard_data`, then pulls
`ql_get_statistical_summary` for the first one. Swap in any other `action`
from [`../../docs/embedded-analytics-api.html`](../../docs/embedded-analytics-api.html)
— the request/response shape is the same for all of them.

Equivalent with `curl`:

```bash
curl -s -X POST https://quantumlayers.com/wp-admin/admin-ajax.php \
     -H "Authorization: Bearer $QL_API_TOKEN" \
     -d "action=ql_get_dashboard_data"
```
