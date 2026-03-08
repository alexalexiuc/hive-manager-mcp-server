# hive-manager-mcp-server

MCP server for beekeeping data, backed by Google Sheets and Google Drive.

## Overview

- Runtime: Node.js + TypeScript (ESM)
- Entry points: `src/index.ts`, `src/server.ts`
- Storage:
  - Google Spreadsheet `hive_manager`
  - Sheets: `logs`, `profiles`, `apiary_todos`

## Google Setup

1. Create a Google Cloud project.
2. Enable Google Sheets API and Google Drive API.
3. Create a service account and download its JSON key.
4. Share your Drive folder (for example `Hives/`) with the service-account email.

## Local Development

```bash
npm install

# create local env file
cp .env.example .env

# run locally
npm run dev

# checks
npm run type-check
npm run test
npm run test:e2e
npm run build
```

## Deploy (Cloudflare Workers)

```bash
# authenticate once
npx wrangler login

# required secret
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON

# deploy
npm run deploy
```

Notes:
- `npm run deploy` runs `npm run build && wrangler deploy`.
- Spreadsheet selection is request-scoped via `x-spreadsheet-id` header only.

## Request Spreadsheet Header (Important)

Pass spreadsheet id per request using header:

- Required header: `x-spreadsheet-id: <GOOGLE_SPREADSHEET_ID>`

This enables each requestor/client to target its own sheet without a shared authorization key layer.

## Suggested Project Instructions (for chat clients using this MCP)

Copy/paste this into your Project/Instructions:

```text
When using the hive-manager MCP server, always include:
x-spreadsheet-id: <GOOGLE_SPREADSHEET_ID>

Do not call MCP tools without this header.
Use hive_setup before first write operation if spreadsheet structure may be missing.
```

## GitHub Actions

- CI workflow: runs on `pull_request`.
- Deploy workflow: runs on `push` to `main` and can also be run manually (`workflow_dispatch`).

For CI e2e:
- Required repository secret: `GOOGLE_SERVICE_ACCOUNT_JSON`
- Required repository variable/secret: `E2E_SPREADSHEET_ID`

## MCP Tools

### `hive_setup`
- Input: none
- Output: `{ success, spreadsheet_url }`

### `hive_log_entry`
- Input:
  - required: `hive`, `event_type` (`inspection|feeding|treatment|harvest`)
  - optional: `timestamp`, `queen_seen`, `brood_status`, `food_status`, `action_taken`, `notes`, `next_check`, `tags`, `strength`, `todos`
- Output: `{ success, message }`

### `hive_get_profile`
- Input: `{ hive }`
- Output: profile JSON row

### `hive_update_profile`
- Input: `{ hive, strength?, queen_status?, brood_status?, food_status?, notes?, todos? }`
- Output: `{ success, message }`

### `hive_get_all_profiles`
- Input: none
- Output: `{ count, profiles }`

### `hive_get_log_history`
- Input: `{ hive?, limit? }`
- Output: `{ count, entries }`

### `hive_get_todos`
- Input: none
- Output: `{ count, todos }`

### `hive_add_todo`
- Input: `{ todo, priority?, status?, due_date?, notes? }`
- Output: `{ success, message }`

## Environment Variables

| Variable                      | Required | Description |
| --- | --- | --- |
| `E2E_SPREADSHEET_ID`          | Yes (e2e) | Spreadsheet id used by e2e tests and request header |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes | Full service-account JSON string |
| `PORT`                        | No | Local/server port (default: `3000`) |
