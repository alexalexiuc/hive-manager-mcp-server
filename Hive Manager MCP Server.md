# Hive Manager MCP Server - Schema and Tool Reference

This file is the source of truth for spreadsheet schema and MCP tool contracts.
It is aligned with:

- `src/constants.ts` for sheet names, headers, enums, and limits
- `src/tools/*.ts` for tool names, input schema, and response payloads

## Spreadsheet

- Spreadsheet name: `hive_manager`
- Required sheets:
  - `hives`
  - `logs`
  - `harvests`
  - `todos`
  - `relocations`

### `hives` columns

1. `hive`
2. `hive_type`
3. `units`
4. `last_check`
5. `next_check`
6. `strength`
7. `queen_status`
8. `brood_status`
9. `food_status`
10. `last_action`
11. `last_treatment`
12. `notes`
13. `queen_race`
14. `queen_birth_year`
15. `origin_hive`
16. `location`
17. `active`
18. `updated_at`

### `logs` columns

1. `log_id`
2. `timestamp`
3. `hive`
4. `event_type`
5. `summary`
6. `treatment_product`
7. `treatment_dose`
8. `treatment_duration`
9. `tags`

### `harvests` columns

1. `harvest_id`
2. `timestamp`
3. `hive`
4. `year`
5. `weight_kg`
6. `season`
7. `units_extracted`
8. `notes`

### `todos` columns

1. `todo_id`
2. `hive`
3. `todo`
4. `priority`
5. `status`
6. `due_date`
7. `notes`
8. `created_at`
9. `updated_at`

### `relocations` columns

1. `timestamp`
2. `hives`
3. `location`
4. `notes`

## Shared Constraints

- `event_type` values:
  - `inspection`
  - `feeding`
  - `treatment`
  - `harvest`
  - `note`
- Log history limits:
  - default `limit`: `20`
  - max `limit`: `200`
- Date fields use `YYYY-MM-DD`
- Timestamp fields use ISO-8601 datetime strings

## Tools

All tools are prefixed with `apiary_`.

### `apiary_setup`

- Description: ensure required sheets and headers exist in the target spreadsheet.
- Input: none
- Output: `{ spreadsheet_url }`

### `apiary_get_hive_status`

- Description: return the full current state for a single hive from the `hives` sheet.
- Input:
  - `hive` (string, required)
- Output: full hive object from `hives` sheet

### `apiary_list_hives`

- Description: list hives with optional filters (active, location, queen status, strength).
- Input:
  - `active_only` (boolean, optional, default `true`)
  - `location` (string, optional)
  - `queen_status` (string, optional)
  - `strength` (string, optional)
- Output: `{ hives, count }`

### `apiary_list_due_for_check`

- Description: return active hives overdue for inspection by `next_check` or fallback days threshold.
- Input:
  - `days` (positive integer, optional, default `7`)
  - `location` (string, optional)
- Output: `{ hives, count }`

### `apiary_update_hive_profile`

- Description: create or update standing hive metadata not tied to a specific event log.
- Input:
  - `hive` (string, required)
  - `queen_race` (string, optional)
  - `queen_birth_year` (string, optional)
  - `origin_hive` (string, optional)
  - `hive_type` (string, optional)
  - `units` (number, optional)
  - `location` (string, optional)
  - `active` (boolean, optional)
  - `notes` (string, optional)
  - `next_check` (YYYY-MM-DD, optional)
- Output: updated hive object

### `apiary_log_event`

- Description: append an event to `logs` and update the target hive snapshot in `hives`.
- Input:
  - `hive` (string, required)
  - `event_type` (`inspection|feeding|treatment|harvest|note`, required)
  - `summary` (string, optional)
  - `queen_status` (string, optional)
  - `brood_status` (string, optional)
  - `food_status` (string, optional)
  - `strength` (string, optional)
  - `next_check` (YYYY-MM-DD, optional)
  - `treatment_product` (string, optional)
  - `treatment_dose` (string, optional)
  - `treatment_duration` (string, optional)
  - `tags` (string, optional)
  - `timestamp` (ISO datetime, optional)
- Output: `{ log_id, hive, timestamp, event_type }`

### `apiary_get_log_history`

- Description: return log entries with optional hive/event filters and pagination.
- Input:
  - `hive` (string, optional)
  - `event_type` (`inspection|feeding|treatment|harvest|note`, optional)
  - `limit` (positive integer <= 200, optional, default `20`)
  - `offset` (integer >= 0, optional, default `0`)
- Output: `{ entries, total_count, has_more, next_offset }`

### `apiary_log_harvest`

- Description: record harvest data in `harvests`, add a harvest event to `logs`, and update hive last action/check.
- Input:
  - `hive` (string, required)
  - `weight_kg` (positive number, required)
  - `year` (integer, optional, defaults to current year)
  - `season` (string, optional)
  - `units_extracted` (integer, optional)
  - `notes` (string, optional)
  - `timestamp` (ISO datetime, optional)
- Output: `{ harvest_id, hive, year, weight_kg, season, timestamp }`

### `apiary_get_harvest_summary`

- Description: aggregate harvest totals and breakdowns by hive, year, and season.
- Input:
  - `hive` (string, optional)
  - `year` (integer, optional)
  - `season` (string, optional, partial match)
- Output: `{ total_kg, by_hive, by_year, by_season, entries }`

### `apiary_add_todo`

- Description: create a new todo (hive-specific or apiary-level).
- Input:
  - `todo` (string, required)
  - `hive` (string, optional)
  - `priority` (`low|medium|high`, optional, default `medium`)
  - `due_date` (YYYY-MM-DD, optional)
  - `notes` (string, optional)
- Output: `{ todo_id, hive, todo, priority, due_date, created_at }`

### `apiary_list_todos`

- Description: list todos with filters by hive scope, status, and priority.
- Input:
  - `hive` (string, optional)
  - `include_apiary` (boolean, optional, default `true`)
  - `status` (`open|done|all`, optional, default `open`)
  - `priority` (`low|medium|high`, optional)
- Output: `{ todos, count }`

### `apiary_complete_todo`

- Description: mark a todo item as done by `todo_id`.
- Input:
  - `todo_id` (string, required)
  - `notes` (string, optional)
- Output: `{ todo_id, status: "done", updated_at }`

### `apiary_log_relocation`

- Description: append relocation history and update current location on affected hive rows.
- Input:
  - `hives` (string, required; comma-separated hive ids, example: `"3,5,7"`)
  - `location` (string, required)
  - `timestamp` (ISO datetime, optional)
  - `notes` (string, optional)
- Output: `{ timestamp, hives, location }`

### `apiary_get_relocation_history`

- Description: return relocation entries, optionally filtered to a hive.
- Input:
  - `hive` (string, optional)
  - `limit` (positive integer <= 500, optional, default `50`)
- Output: `{ count, entries }`

## Behavior Notes

- Tools assume required sheets exist. Run `apiary_setup` first for a new or reset spreadsheet.
- If a required sheet is missing during a tool operation, the server returns an actionable error instructing to run `apiary_setup`.
- `next_check` is stored on the hive profile (`hives.next_check`), not in `logs`.
