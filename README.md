# hive-manager-mcp-server

An MCP (Model Context Protocol) server for beekeeping log management. It allows an AI assistant (Claude) to manage beekeeping records by reading and writing directly to **Google Sheets** and **Google Drive** via the official `googleapis` Node.js SDK. Deployable to **Cloudflare Workers** for remote/mobile access.

## Architecture

```
Claude (AI) ──► MCP Client ──► POST /mcp ──► hive-manager-mcp-server (Cloudflare Workers)
                                                      │
                              ┌───────────────────────┤
                              │                       │
                     Google Sheets API         Google Drive API
                         (hive_logs)            (profiles/, todos)
```

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the **Google Sheets API** and **Google Drive API**
4. Create a **Service Account** (IAM & Admin → Service Accounts)
5. Create a JSON key for the service account and download it
6. Share your `Hives/` Google Drive folder with the service account email (Editor access)

## Local Development

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your Google Service Account JSON and folder/sheet IDs

# Run in development mode
npm run dev

# Type check
npm run type-check

# Run tests
npm run test

# Run e2e tests (checks spreadsheet access in Hives/e2e)
npm run test:e2e

# Build
npm run build
```

## Deploying to Cloudflare Workers

```bash
# Login to Cloudflare
npx wrangler login

# Set secrets
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put HIVES_FOLDER_ID
npx wrangler secret put PROFILES_FOLDER_ID
npx wrangler secret put LOG_SHEET_ID

# Deploy (same command used by the GitHub Deploy workflow)
npm run deploy
```

## CI E2E Configuration

To run e2e tests in GitHub Actions (on non-`main` branch `push` and `pull_request`), set these repository secrets:

- `GOOGLE_SERVICE_ACCOUNT_JSON`

Set optional repository variable:

- `HIVES_FOLDER_ID`

`HIVES_FOLDER_ID` is optional for CI e2e. If omitted, the test looks up folder `Hives` by name.

The CI e2e job checks spreadsheet access in `Hives/e2e` using `hive_manager` by default.

The deploy workflow runs manually via `workflow_dispatch` (it no longer auto-runs on `main`).

## Adding to Claude as MCP Integration

1. Open Claude → Settings → Integrations
2. Add new integration with URL: `https://your-worker.workers.dev/mcp`
3. Claude can now use all hive management tools

## MCP Tools

### `hive_setup`

Set up the Google Drive/Sheets structure.

**Output:** `{ success, folder_url, sheet_url }`

---

### `hive_log_entry`

Log a hive inspection.

**Input:**

```json
{
  "hive_id": "1",
  "overall_status": "Strong",
  "date": "2024-01-15",
  "location": "Main apiary",
  "boxes": 2,
  "frames": 8,
  "queen_seen": "Yes",
  "notes": "Colony thriving",
  "action_taken": "Added honey super",
  "next_visit": "2024-01-29",
  "todos": "Check varroa levels"
}
```

**Output:** `{ success, message }`

---

### `hive_get_profile`

Get a hive's profile.

**Input:** `{ "hive_id": "1" }`

**Output:** Profile text content

---

### `hive_update_profile`

Update specific fields in a hive profile.

**Input:** `{ "hive_id": "1", "status": "Medium", "notes": "Queen cage removed" }`

**Output:** `{ success, message }`

---

### `hive_get_all_profiles`

Get all hive profiles.

**Output:** `{ count, profiles: [{ hive_id, content }] }`

---

### `hive_get_log_history`

Get inspection log history.

**Input:** `{ "hive_id": "1", "limit": 20 }` (both optional)

**Output:** `{ count, entries: [...] }`

---

### `hive_get_todos`

Get the general apiary todos.

**Output:** Todos file text content

---

### `hive_update_todos`

Update the general apiary todos.

**Input:** `{ "content": "APIARY GENERAL TODOS\n..." }`

**Output:** `{ success, message }`

---

## Environment Variables

| Variable                      | Required    | Description                                               |
| ----------------------------- | ----------- | --------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes         | Full JSON string of the Google Service Account key        |
| `HIVES_FOLDER_ID`             | Recommended | Google Drive folder ID for Hives/ (skip setup lookup)     |
| `HIVES_E2E_FOLDER_NAME`       | No          | E2E subfolder name under `Hives/` (default: `e2e`)        |
| `E2E_SPREADSHEET_NAME`        | No          | Spreadsheet name for e2e lookup (default: `hive_manager`) |
| `PROFILES_FOLDER_ID`          | Recommended | Google Drive folder ID for profiles/ subfolder            |
| `LOG_SHEET_ID`                | Recommended | Google Sheets ID for hive_logs spreadsheet                |
| `PORT`                        | No          | HTTP server port (default: 3000, local dev only)          |
