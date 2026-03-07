# AGENTS.MD

Guidance for coding agents working in `hive-mcp-server`.

## Scope

- This file applies to the entire repository.
- Prefer small, focused changes that preserve current behavior unless a behavior change is explicitly requested.

## Project Summary

- Runtime: Node.js + TypeScript (ESM).
- Main purpose: MCP server for beekeeping data stored in Google Sheets and Google Drive.
- Entry points: `src/index.ts` and `src/server.ts`.
- Core domains:
  - `src/services/`: Google API integration (`google.ts`, `drive.ts`, `sheets.ts`)
  - `src/tools/`: MCP tool handlers (`setup`, `log`, `profile`, `history`, `todos`)

## Local Commands

- Install deps: `npm install`
- Dev run: `npm run dev`
- Type check: `npm run type-check`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm run test`
- E2E tests (Windows-safe): `vitest run tests/e2e`

## Coding Conventions

- Keep TypeScript strictness intact; avoid `any` unless unavoidable.
- Reuse existing constants/types from `src/constants.ts` and `src/types.ts` before creating new ones.
- Keep tool handlers thin and place API/data logic in `src/services/`.
- Validate inputs with `zod` in tool boundaries.
- Return clear, stable response shapes from MCP tools.
- Keep naming aligned with existing tool names prefixed by `hive_`.

## Error Handling

- Fail with actionable messages (what failed and likely fix).
- Do not leak secrets or full credential payloads in logs/errors.
- Preserve current error behavior unless the task asks for changes.

## Environment and Secrets

- Required runtime secret: `GOOGLE_SERVICE_ACCOUNT_JSON`.
- Common IDs: `HIVES_FOLDER_ID`, `PROFILES_FOLDER_ID`, `LOG_SHEET_ID`.
- Never commit real credentials, service-account JSON, or private IDs.
- Use `.env`/Cloudflare secrets for sensitive values.

## Testing Expectations

- Add or update tests for behavior changes.
- Prefer targeted unit tests under `tests/services/` and `tests/tools/`.
- For integration flows, use `tests/e2e/`.
- Before handing off substantial changes, run: `npm run test` and `npm run type-check`.

## Change Checklist

- Keep diffs minimal and easy to review.
- Update docs (`README.md`) when commands, env vars, or behavior changes.
- Ensure imports and build output remain ESM-compatible.
