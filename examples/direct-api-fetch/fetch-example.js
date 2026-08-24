/**
 * Direct API integration — no QL JavaScript at all.
 *
 * Calls the admin-ajax.php endpoint directly with a long-lived API token
 * (Option C — "API Token" — see docs/embedded-analytics.html#authentication).
 * This is the right choice for a frontend built in a framework where you'd
 * rather write your own thin client than load jQuery-based JDK modules, or
 * for any environment (Node, a Cloudflare Worker, another language's HTTP
 * client) that doesn't run browser globals at all.
 *
 * Create a token on the "API Tokens" page in your QuantumLayers account
 * first — it's only shown once at creation time.
 *
 * Run with: QL_API_TOKEN=qlat_xxxx node fetch-example.js
 */

const QL_BASE = 'https://quantumlayers.com/wp-admin/admin-ajax.php';
const API_TOKEN = process.env.QL_API_TOKEN;

async function callQL(action, params = {}) {
  const res = await fetch(QL_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ action, ...params }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.data && json.data.message ? json.data.message : 'QL API error');
  }
  return json.data;
}

async function main() {
  if (!API_TOKEN) {
    console.error('Set QL_API_TOKEN to an API token from the API Tokens page.');
    process.exit(1);
  }

  // List every dataset visible to this token's account.
  const { datasets } = await callQL('ql_get_dashboard_data');
  console.log(`Found ${datasets.length} dataset(s):`);
  for (const ds of datasets) {
    console.log(`  #${ds.id} — ${ds.name} (${ds.row_count} rows)`);
  }

  // Pull summary statistics for the first dataset, if there is one.
  if (datasets.length > 0) {
    const summary = await callQL('ql_get_statistical_summary', { dataset_id: datasets[0].id });
    console.log(`\nStatistical summary for dataset #${datasets[0].id}:`);
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
