# AGENTS.MD

Guidance for coding agents working in `hive-manager-mcp-server`.

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
- E2E tests: `npm run test:e2e`
- Deploy (local): `npm run deploy`
- Vitest config split:
  - Unit: `vitest.config.ts`
  - E2E (serial): `vitest.e2e.config.ts`
  - Shared defaults: `vitest.shared.ts`

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
- Optional runtime var: `SPREADSHEET_ID`.
- E2E lookup vars: `HIVES_FOLDER_NAME`, `HIVES_FOLDER_ID`, `HIVES_E2E_FOLDER_NAME`, `E2E_SPREADSHEET_NAME`.
- Never commit real credentials, service-account JSON, or private IDs.
- Use `.env`/Cloudflare secrets for sensitive values.

## CI/CD Notes

- CI workflow runs on `pull_request`.
- Deploy workflow runs on `push` to `main` and `workflow_dispatch`.
- GitHub Actions e2e requires secret `GOOGLE_SERVICE_ACCOUNT_JSON`; `HIVES_FOLDER_ID` can be a repository variable (optional).

## Testing Expectations

- Add or update tests for behavior changes.
- Prefer targeted unit tests under `tests/services/` and `tests/tools/`.
- For integration flows, use `tests/e2e/`.
- Before handing off substantial changes, run: `npm run test` and `npm run type-check`.

## Change Checklist

- Keep diffs minimal and easy to review.
- Update docs (`README.md`) when commands, env vars, or behavior changes.
- Update e2e and unit tests for any behavior changes.
- Ensure imports and build output remain ESM-compatible.
