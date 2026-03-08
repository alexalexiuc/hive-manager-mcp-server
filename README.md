# hive-manager-mcp-server

MCP server for beekeeping data, backed by Google Sheets and Google Drive.

## Overview

- Runtime: Node.js + TypeScript (ESM)
- Entry points: `src/index.ts`, `src/server.ts`
- Storage:
  - Google Spreadsheet `hive_manager`
  - Sheets: `logs`, `profiles`, `apiary_todos`, `relocations`

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
npx wrangler secret put AUTH_API_KEY

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
Use hive_setup before the first read/write operation if spreadsheet structure may be missing.
```

## GitHub Actions

- CI workflow: runs on `pull_request`.
- Deploy workflow: runs on `push` to `main` and can also be run manually (`workflow_dispatch`).

For CI e2e:

- Required repository secret: `GOOGLE_SERVICE_ACCOUNT_JSON`
- Required repository variable/secret: `E2E_SPREADSHEET_ID`

## MCP Tools

### `hive_setup`

- Description: Set up a Google Spreadsheet for hive data. Requires `x-spreadsheet-id` and ensures required sheets exist.
- Input: none
- Output: `{ success, spreadsheet_url }`

### `hive_log_entry`

- Description: Log a hive event in `logs` and create or update the corresponding profile row in `profiles`.
- Input:
  - required: `hive`, `event_type` (`inspection|feeding|treatment|harvest`)
  - optional: `timestamp`, `queen_seen`, `brood_status`, `food_status`, `action_taken`, `notes`, `next_check`, `tags`, `strength`, `todos`, `origin_hive`, `queen_race`, `queen_birth_year`
- Output: `{ success, message }`

### `hive_get_profile`

- Description: Read the current profile for a specific hive from the `profiles` sheet.
- Input: `{ hive }`
- Output: profile JSON row

### `hive_update_profile`

- Description: Update specific fields in a hive profile row in the `profiles` sheet.
- Input: `{ hive, strength?, queen_status?, brood_status?, food_status?, notes?, todos?, origin_hive?, queen_race?, queen_birth_year? }`
- Output: `{ success, message }`

### `hive_get_all_profiles`

- Description: List all hive profiles from the `profiles` sheet.
- Input: none
- Output: `{ count, profiles }`

### `hive_get_log_history`

- Description: Retrieve event log history from `logs`, with optional hive filtering and result limits.
- Input: `{ hive?, limit? }`
- Output: `{ count, entries }`

### `hive_get_todos`

- Description: Read all general apiary todos from the `apiary_todos` sheet.
- Input: none
- Output: `{ count, todos }`

### `hive_add_todo`

- Description: Add a new general apiary todo entry to `apiary_todos`.
- Input: `{ todo, priority?, status?, due_date?, notes? }`
- Output: `{ success, message }`

### `hive_update_todo`

- Description: Update fields in an existing apiary todo identified by `created_at`.
- Input: `{ created_at, todo?, priority?, status?, due_date?, notes? }`
- Output: `{ success, message, created_at }`

### `hive_mark_todo_done`

- Description: Mark an existing apiary todo as `done`, identified by `created_at`.
- Input: `{ created_at, notes? }`
- Output: `{ success, message, created_at }`

### `hive_log_relocation`

- Description: Record relocation of one or more hives to a new location in `relocations`.
- Input: `{ hives, location, timestamp?, notes? }`
- Output: `{ success, message }`

### `hive_get_relocations`

- Description: Retrieve relocation history from `relocations`, optionally filtered by hive.
- Input: `{ hive?, limit? }`
- Output: `{ count, entries }`

### `hive_get_current_location`

- Description: Get the most recent recorded location for a hive based on `relocations`.
- Input: `{ hive }`
- Output: `{ hive, current_location, since?, notes?, message? }`

## Environment Variables

| Variable                      | Required  | Description                            |
| ----------------------------- | --------- | -------------------------------------- |
| `E2E_SPREADSHEET_ID`          | Yes (e2e) | Spreadsheet id used for e2e test runs  |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes       | Full service-account JSON string       |
| `AUTH_API_KEY`                | Yes       | Bearer token required for all requests |
| `PORT`                        | No        | Local/server port (default: `3000`)    |
