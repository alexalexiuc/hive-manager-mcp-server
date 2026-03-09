# AGENTS.MD

Guidance for coding agents working in `hive-manager-mcp-server`.

## Scope

- This file applies to the entire repository.
- Prefer small, focused changes that preserve current behavior unless a behavior change is explicitly requested.

## Canonical Product Spec

- `Hive Manager MCP Server.md` is the source of truth for:
  - Spreadsheet schema (sheet names, column order)
  - MCP tool contracts (tool names, inputs, outputs)
- Do not duplicate schema/tool details here. Keep this file implementation-focused.
- When schema or tool contracts change, update `Hive Manager MCP Server.md` in the same PR.

## Implementation Map

- Runtime: Node.js + TypeScript (ESM)
- Entrypoints: `src/index.ts`, `src/server.ts`
- Main domains:
  - `src/tools/`: MCP tool handlers (`setup`, `hives`, `logs`, `harvests`, `todos`, `relocations`)
  - `src/services/`: Google clients and Sheets/Drive operations
  - `src/constants.ts`: canonical sheet headers, event enums, and column index maps
  - `src/types.ts`: shared payload/result types

## Coding Conventions

- Keep TypeScript strictness intact; avoid `any` unless unavoidable.
- Reuse existing constants/types from `src/constants.ts` and `src/types.ts` before creating new ones.
- Keep tool handlers thin and place API/data logic in `src/services/`.
- Validate inputs with `zod` in tool boundaries.
- Return clear, stable response shapes from MCP tools.
- Keep naming aligned with existing tool names prefixed by `apiary_`.

## Error Handling

- Fail with actionable messages (what failed and likely fix).
- Do not leak secrets or full credential payloads in logs/errors.
- Preserve current error behavior unless the task asks for changes.

## Testing Expectations

- Add or update tests for behavior changes.
- Prefer targeted tests close to changed behavior:
  - Unit/service tests under `tests/services/` and `tests/tools/`
  - Integration flows in `tests/e2e/`
- For substantial changes, run:
  - `npm run type-check`
  - `npm run test:e2e`

## Change Checklist

- Keep diffs minimal and easy to review.
- Update docs when behavior changes:
  - `Hive Manager MCP Server.md` for schema/tool contract changes
  - `README.md` for setup/runtime/operational changes
- Update e2e and unit tests for any behavior changes.
- Ensure imports and build output remain ESM-compatible.
- Any new column should be added at the end of the respective sheet to avoid breaking existing column order assumptions.
