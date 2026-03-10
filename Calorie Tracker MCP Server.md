# Calorie Tracker MCP Server - Schema and Tool Reference

This file is the source of truth for spreadsheet schema and MCP tool contracts.
It is aligned with:

- `src/calories/constants.ts` for sheet names, headers, enums, and limits
- `src/calories/tools/*.ts` for tool names, input schema, and response payloads

## Endpoint

`POST /calories/:spreadsheetId`

Same OAuth 2.0 authentication as the hive manager server.

## Spreadsheet

- Required sheets:
  - `meals`
  - `profile`

### `meals` columns

1. `meal_id`
2. `date`
3. `meal_type`
4. `description`
5. `calories`
6. `protein_g`
7. `carbs_g`
8. `fat_g`
9. `notes`
10. `created_at`

### `profile` columns

Single data row (row 2). Each column stores one field of the user's body profile.

1. `name`
2. `age`
3. `height_cm`
4. `weight_kg`
5. `sex`
6. `activity_level`
7. `goal_calories_override`
8. `neck_cm`
9. `waist_cm`
10. `hips_cm`
11. `notes`
12. `updated_at`

## Shared Constraints

- `meal_type` values:
  - `breakfast`
  - `lunch`
  - `dinner`
  - `snack`
- `sex` values:
  - `male`
  - `female`
- `activity_level` values:
  - `sedentary` — desk job, little or no exercise (×1.2)
  - `lightly_active` — light exercise 1–3 days/week (×1.375)
  - `moderately_active` — moderate exercise 3–5 days/week (×1.55)
  - `very_active` — hard exercise 6–7 days/week (×1.725)
  - `extra_active` — very hard exercise or physical job (×1.9)
- Date fields use `YYYY-MM-DD`
- Timestamp fields use ISO-8601 datetime strings
- Meal IDs are ULIDs (lexicographically sortable)
- Meal history limits:
  - default `limit`: `50`
  - max `limit`: `500`

## BMR / TDEE Calculation

Uses the **Mifflin-St Jeor** equation:

- Male: `BMR = 10 × weight_kg + 6.25 × height_cm − 5 × age + 5`
- Female: `BMR = 10 × weight_kg + 6.25 × height_cm − 5 × age − 161`
- `TDEE = BMR × activity_multiplier`
- `daily_calories = goal_calories_override` if set, otherwise `TDEE`

Meal type calorie budget fractions (used by `calories_get_remaining`):

| meal_type   | fraction |
|-------------|----------|
| `breakfast` | 25 %     |
| `lunch`     | 35 %     |
| `dinner`    | 30 %     |
| `snack`     | 10 %     |

## Tools

All tools are prefixed with `calories_`.

### `calories_setup`

- Description: ensure `meals` and `profile` sheets exist with correct headers. Idempotent — safe to call at any time.
- Input: none
- Output: `{ spreadsheet_url, sheets_created }`

### `calories_update_profile`

- Description: save or update body measurements and health profile. Only provided fields are updated; omitted fields retain current values.
- Input:
  - `name` (string, optional)
  - `age` (positive integer, optional)
  - `height_cm` (positive number, optional)
  - `weight_kg` (positive number, optional)
  - `sex` (`male|female`, optional)
  - `activity_level` (`sedentary|lightly_active|moderately_active|very_active|extra_active`, optional)
  - `goal_calories_override` (positive integer, optional — overrides calculated TDEE)
  - `neck_cm` (positive number, optional)
  - `waist_cm` (positive number, optional)
  - `hips_cm` (positive number, optional)
  - `notes` (string, optional)
- Output: `{ profile, calculated: { bmr, tdee, daily_calories } }`

### `calories_get_profile`

- Description: retrieve the stored body profile with calculated BMR, TDEE, and daily calorie target.
- Input: none
- Output: `{ profile, calculated: { bmr, tdee, daily_calories, activity_description } }`

### `calories_log_meal`

- Description: log a meal with its estimated calorie content. If the user shares a photo, the model should estimate calories before calling this tool. `meal_type` is auto-inferred from the time of day if omitted.
- Input:
  - `description` (string, required — what was eaten)
  - `calories` (positive integer, required — estimated kcal)
  - `meal_type` (`breakfast|lunch|dinner|snack`, optional)
  - `date` (YYYY-MM-DD, optional, defaults to today)
  - `protein_g` (positive number, optional)
  - `carbs_g` (positive number, optional)
  - `fat_g` (positive number, optional)
  - `notes` (string, optional)
- Output: `{ meal_id, date, meal_type, description, calories, protein_g, carbs_g, fat_g }`

### `calories_get_meals`

- Description: retrieve logged meal entries with optional filters.
- Input:
  - `date` (YYYY-MM-DD, optional)
  - `meal_type` (`breakfast|lunch|dinner|snack`, optional)
  - `limit` (positive integer <= 500, optional, default `50`)
  - `offset` (integer >= 0, optional, default `0`)
- Output: `{ entries, total_count, has_more, next_offset }`

### `calories_delete_meal`

- Description: remove a logged meal by `meal_id`. Use to correct a logging mistake.
- Input:
  - `meal_id` (string, required)
- Output: `{ deleted: true, meal_id }`

### `calories_get_daily_summary`

- Description: full calorie and macro breakdown for a given day, including per-meal list and progress against the daily target.
- Input:
  - `date` (YYYY-MM-DD, optional, defaults to today)
- Output:
  ```json
  {
    "date": "YYYY-MM-DD",
    "meals": [...],
    "totals": { "calories", "protein_g", "carbs_g", "fat_g", "meal_count" },
    "daily_target": 2000,
    "remaining_calories": 800,
    "goal_met": false
  }
  ```

### `calories_get_weekly_summary`

- Description: day-by-day calorie totals for the Mon–Sun week that contains the given date. Returns weekly total, average, and remaining vs weekly target.
- Input:
  - `date` (YYYY-MM-DD, optional — any date within the target week, defaults to today)
- Output:
  ```json
  {
    "week": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
    "days": [{ "date", "calories", "protein_g", "carbs_g", "fat_g", "meal_count" }, ...],
    "weekly_total_calories": 12500,
    "weekly_average_calories": 1786,
    "daily_target": 2000,
    "weekly_target": 14000,
    "weekly_remaining": 1500
  }
  ```

### `calories_get_remaining`

- Description: remaining calories for the day based on what has been logged vs the daily target. Optionally shows a suggested budget for a specific upcoming meal.
- Input:
  - `date` (YYYY-MM-DD, optional, defaults to today)
  - `meal_type` (`breakfast|lunch|dinner|snack`, optional)
- Output:
  ```json
  {
    "date": "YYYY-MM-DD",
    "calories_consumed": 1200,
    "daily_target": 2000,
    "remaining_calories": 800,
    "over_budget": false,
    "meal_type": "dinner",
    "suggested_meal_budget": 600
  }
  ```

## Behavior Notes

- Tools assume required sheets exist. Run `calories_setup` first for a new or reset spreadsheet.
- If a required sheet is missing during a tool operation, the server returns an actionable error instructing to run `calories_setup`.
- `calories_delete_meal` clears the row in the sheet (does not physically remove the row) — empty rows are automatically skipped by all query tools.
- Calorie and macro values are stored as plain numbers in the sheet (no units suffix).
- `daily_calories` in summary tools is `null` when the profile is missing required fields (age, height, weight, sex).
- Week boundaries follow ISO 8601: Monday is the first day of the week.
