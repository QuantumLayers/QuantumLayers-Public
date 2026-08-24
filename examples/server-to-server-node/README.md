# Server-to-server: the QL-Agent, headless

Drives the multi-turn `ql_run_agent` endpoint from a plain Node script —
no browser, no chat UI. Good starting point for a Slack bot, an internal
tool, or a scheduled job that needs a natural-language answer about your
data ("which dataset grew fastest this month?") without reimplementing
querying/charting logic yourself.

## Try it

1. Create a token on the **API Tokens** page of your QuantumLayers account.
2. `QL_API_TOKEN=qlat_xxxx node agent-chat.js`

Each call is one turn of the conversation; the script threads the
`messages` array returned by one call into the `history` param of the
next, so follow-up questions keep context. See
[`../../docs/embedded-analytics-api.html`](../../docs/embedded-analytics-api.html)
(QL-Agent Endpoint section) for the full request/response shape.
