/**
 * Headless integration with the QL-Agent — the same multi-turn AI agent
 * used in the QuantumLayers dashboard, driven entirely server-side.
 *
 * Useful for backend automation: a Slack bot, a support tool, a scheduled
 * job that asks the agent a question and does something with the answer.
 * Each call to ql_run_agent is one turn; pass back the returned `messages`
 * array as `history` to keep the conversation going.
 *
 * See docs/embedded-analytics-api.html#ql-agent-endpoint for the full
 * request/response reference.
 *
 * Run with: QL_API_TOKEN=qlat_xxxx node agent-chat.js
 */

const QL_AJAX = 'https://quantumlayers.com/wp-admin/admin-ajax.php';
const API_TOKEN = process.env.QL_API_TOKEN;

let history = [];

async function chat(userMessage) {
  const res = await fetch(QL_AJAX, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      action: 'ql_run_agent',
      message: userMessage,
      history: JSON.stringify(history),
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.data && json.data.message);

  history = json.data.messages; // carry context into the next turn
  return json.data.final_text;
}

async function main() {
  if (!API_TOKEN) {
    console.error('Set QL_API_TOKEN to an API token from the API Tokens page.');
    process.exit(1);
  }

  console.log(await chat('List my datasets'));
  // Context from the first turn (which datasets exist) carries into this one.
  console.log(await chat('Which one has the most rows, and what does its schema look like?'));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
