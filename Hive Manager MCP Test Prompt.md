# Hive Manager MCP — Test Prompt

You are testing a beekeeping management MCP server. Your job is to act as a real beekeeper's assistant and exercise every tool through realistic, natural-language scenarios. You are evaluating whether the tools work correctly — not just whether they return a response, but whether the data is stored, updated, and retrieved accurately.

---

## Before You Begin

Call `apiary_setup` first. It is idempotent and ensures all sheets exist. If it fails, report the error and stop — the server is not ready.

---

## How to Test

For each scenario below:

1. Execute the tool call(s) described
2. Verify the result by reading back the data with the appropriate read tool
3. Report what you expected, what you got, and whether they match
4. Note the number of tool calls required
5. Flag any friction — confusing parameters, missing fields, unexpected behavior

Use the scoring format at the end of each scenario.

---

## Test Scenarios

---

### T01 — Register a new hive (minimal)

> "I just set up hive 1. It's a vertical Dadant with 10 bodies."

**Expected behavior:** Hive row created with `hive="1"`, `hive_type="vertical"`, `units=10`. All other fields empty.

**Verify with:** `apiary_get_hive_status(hive="1")`

**Check:**

- [ ] Hive row exists
- [ ] `hive_type` and `units` stored correctly
- [ ] No other fields populated
- [ ] Call count: 1 write + 1 read = 2 total

---

### T02 — Register a second hive with more detail

> "Hive 2 is a horizontal with 20 frames. Carniolan queen, born 2024, came from hive 1."

**Expected behavior:** Hive row with `hive_type="horizontal"`, `units=20`, `queen_race="Carniolan"`, `queen_birth_year=2024`, `origin_hive="1"`.

**Verify with:** `apiary_get_hive_status(hive="2")`

**Check:**

- [ ] All fields stored correctly
- [ ] `queen_birth_year` is a number, not a string
- [ ] Call count: 1 write + 1 read = 2 total

---

### T03 — Log a standard inspection

> "Checked hive 1 today. Queen seen, brood looks healthy, food is medium. Added one frame. Check again in 7 days."

**Expected behavior:**

- Log entry created with `event_type="inspection"`, `summary` capturing the visit narrative
- Hive 1 profile updated: `queen_status="seen"`, `brood_status="healthy"`, `food_status="medium"`, `last_action` updated, `last_check` = today, `next_check` = today + 7 days

**Verify with:** `apiary_get_hive_status(hive="1")` and `apiary_get_log_history(hive="1", limit=1)`

**Check:**

- [ ] Log entry exists with correct `event_type`
- [ ] `summary` reflects the visit narrative
- [ ] Hive profile observation fields updated
- [ ] `last_check` and `next_check` correct
- [ ] `last_action` updated
- [ ] Observation fields NOT duplicated in log row
- [ ] Call count: 1 write + 2 reads = 3 total

---

### T04 — Log an inspection with an unusual queen observation

> "Hive 2 — found the queen but no eggs yet. She might be a virgin. Previous brood still hatching."

**Expected behavior:** `queen_status` stores the free-text observation verbatim (not forced into an enum). `summary` captures the full narrative.

**Verify with:** `apiary_get_hive_status(hive="2")`

**Check:**

- [ ] `queen_status` contains a descriptive free-text string, not a truncated enum value
- [ ] `brood_status` reflects the unusual observation
- [ ] Call count: 1 write + 1 read = 2 total

---

### T05 — Get current status of a hive

> "What's going on with hive 1?"

**Expected behavior:** Single call returns the full hive row including `last_action`, `last_check`, `next_check`, all observation fields. No need to also query logs.

**Check:**

- [ ] All fields present in one response
- [ ] `last_action` reflects the most recent inspection from T03
- [ ] Call count: 1

---

### T06 — List all active hives

> "Show me all my hives."

**Expected behavior:** Returns hive 1 and hive 2. Both active.

**Check:**

- [ ] Both hives returned
- [ ] `active_only` default behavior excludes nothing (no inactive hives yet)
- [ ] Call count: 1

---

### T07 — Due for inspection planning

> "Which hives should I inspect today?"

**Expected behavior:** Returns hives whose `next_check` has passed or who haven't been checked in 7+ days. After T03 and T04, hive 1 has `next_check` in 7 days (not due), hive 2 depends on when T04 was run.

**Check:**

- [ ] Results sorted by most overdue first
- [ ] Hive 1 not shown if next_check is in the future
- [ ] Call count: 1

---

### T08 — Log a feeding event

> "Fed hive 2 today with 1kg of syrup."

**Expected behavior:** Log entry with `event_type="feeding"`. Hive 2 `last_action` and `last_check` updated. Observation fields (`queen_status` etc.) NOT modified.

**Verify with:** `apiary_get_hive_status(hive="2")`

**Check:**

- [ ] Log entry exists with `event_type="feeding"`
- [ ] `last_action` updated to reflect feeding
- [ ] `queen_status`, `brood_status`, `food_status` unchanged from T04
- [ ] Call count: 1 write + 1 read = 2 total

---

### T09 — Log a treatment

> "Treated hive 1 with oxalic acid today. 2.5ml dose, treatment runs 42 days."

**Expected behavior:** Log entry with `event_type="treatment"`, `treatment_product="Oxalic Acid"`, `treatment_dose="2.5ml"`, `treatment_duration="42 days"`. Hive 1 `last_treatment` updated to include product and date.

**Verify with:** `apiary_get_hive_status(hive="1")`

**Check:**

- [ ] Log entry has all three treatment fields
- [ ] `last_treatment` on hive row updated
- [ ] `last_check` updated
- [ ] Observation fields unchanged
- [ ] Call count: 1 write + 1 read = 2 total

---

### T10 — Log a harvest

> "Pulled 2 supers from hive 1 today. Got 18kg. Acacia harvest."

**Expected behavior:** Entry written to `harvests` sheet AND a `"harvest"` entry appended to `logs` sheet. Year defaults to current year.

**Verify with:** `apiary_get_harvest_summary(year=2026)` and `apiary_get_log_history(hive="1", limit=1)`

**Check:**

- [ ] `harvests` entry exists with `weight_kg=18`, `season="acacia"`, `year=2026`
- [ ] `units_extracted=2` stored
- [ ] A matching `"harvest"` entry also exists in `logs`
- [ ] `apiary_get_harvest_summary` returns correct totals
- [ ] Call count: 1 write + 2 reads = 3 total

---

### T11 — Log a second harvest and verify summary aggregation

> "Hive 2 also gave 12kg this acacia season."

After logging, call `apiary_get_harvest_summary(year=2026)`.

**Check:**

- [ ] `total_kg` = 30.0 (18 + 12)
- [ ] `by_hive` shows both hive 1 and hive 2
- [ ] `by_season` shows acacia with total 30kg
- [ ] Call count: 1 write + 1 read = 2 total

---

### T12 — Season filter on harvest summary

> "How much acacia honey did I collect across all years?"

`apiary_get_harvest_summary(season="acacia")`

**Check:**

- [ ] Returns entries matching "acacia" (partial match)
- [ ] Correct totals
- [ ] Call count: 1

---

### T13 — Add a hive-specific todo

> "Remind me to check queen cells in hive 2 on the next visit."

**Expected behavior:** Todo created with `hive="2"`, scoped correctly.

**Verify with:** `apiary_list_todos(hive="2")`

**Check:**

- [ ] Todo appears in hive 2's list
- [ ] `status="open"`
- [ ] `todo_id` is a ULID (26-char string), not an integer
- [ ] Call count: 1 write + 1 read = 2 total

---

### T14 — Add an apiary-level todo

> "Order new frames before summer."

**Expected behavior:** Todo created with no `hive` field (or empty), representing an apiary-level task.

**Verify with:** `apiary_list_todos()` (no hive filter)

**Check:**

- [ ] Todo appears in the general list
- [ ] `hive` field is empty
- [ ] Does NOT appear when calling `apiary_list_todos(hive="2", include_apiary=false)`
- [ ] Call count: 1 write + 1 read = 2 total

---

### T15 — List todos with apiary todos included alongside hive todos

`apiary_list_todos(hive="2", include_apiary=true)`

**Expected behavior:** Returns hive 2's todo (T13) AND the apiary-level todo (T14).

**Check:**

- [ ] Both todos returned
- [ ] Hive-scoped todo has `hive="2"`
- [ ] Apiary todo has empty `hive`
- [ ] Call count: 1

---

### T16 — Complete a todo

Mark the hive 2 queen cell todo (from T13) as done.

**Expected behavior:** Fetch the `todo_id` from the list, then complete it. Todo status changes to `"done"`.

**Verify with:** `apiary_list_todos(hive="2", status="open")`

**Check:**

- [ ] Todo no longer appears in open list
- [ ] Completion requires at most 2 calls (list + complete) if `todo_id` not already in context
- [ ] `todo_id` used is a ULID, not a timestamp
- [ ] Call count: 1 read + 1 write = 2 total

---

### T17 — Log a relocation

> "Moved hives 1 and 2 to the orchard for acacia season."

**Expected behavior:** Relocation record created. Both hive rows updated with `location="orchard"`.

**Verify with:** `apiary_get_hive_status(hive="1")` and `apiary_get_hive_status(hive="2")`

**Check:**

- [ ] Relocation entry exists in relocations sheet
- [ ] Both hive rows now show `location="orchard"`
- [ ] Call count: 1 write + 2 reads = 3 total

---

### T18 — Relocation history

> "Where has hive 1 been moved over time?"

`apiary_get_relocations(hive="1")`

**Check:**

- [ ] Returns the relocation from T17
- [ ] Correct location and timestamp
- [ ] Call count: 1

---

### T19 — Filter hives by location

> "Which hives are at the orchard right now?"

`apiary_list_hives(location="orchard")`

**Check:**

- [ ] Returns hive 1 and hive 2
- [ ] Call count: 1

---

### T20 — Deactivate a hive

> "Hive 1 didn't survive winter. Mark it as inactive."

`apiary_update_hive_profile(hive="1", active=false)`

Then call `apiary_list_hives()` (active_only defaults to true).

**Check:**

- [ ] Hive 1 no longer appears in the default active list
- [ ] Hive 1 still appears when calling `apiary_list_hives(active_only=false)`
- [ ] History and logs for hive 1 remain intact
- [ ] Call count: 1 write + 2 reads = 3 total

---

### T21 — Log history filtering by event type

> "Show me all treatments logged for hive 1."

`apiary_get_log_history(hive="1", event_type="treatment")`

**Check:**

- [ ] Returns only the treatment entry from T09
- [ ] No inspection or feeding entries included
- [ ] Call count: 1

---

### T22 — Edge case: quick note (no inspection)

> "Noticed some beard forming on hive 2, nothing urgent."

`apiary_log_event(hive="2", event_type="note", summary="Beard forming on front of hive, not alarming.")`

**Verify with:** `apiary_get_hive_status(hive="2")`

**Check:**

- [ ] Log entry exists with `event_type="note"`
- [ ] `last_action` updated on hive row
- [ ] `last_check` NOT updated (notes don't count as inspections)
- [ ] Observation fields unchanged
- [ ] Call count: 1 write + 1 read = 2 total

---

## Scoring

After completing all scenarios, report a summary table:

| Test | Pass  | Tool Count | Notes |
| ---- | ----- | ---------- | ----- |
| T01  | ✅/❌ | N          |       |
| T02  | ✅/❌ | N          |       |
| ...  |       |            |       |

Then answer:

1. **Were there any tools that failed to execute?** List them with the error.
2. **Were there any scenarios that required more calls than expected?** Which ones and why.
3. **Were there any fields that didn't save or return correctly?** Specify the tool, field, and what was expected vs. received.
4. **Did the hive profile update atomically on every write?** Confirm `last_action`, `last_check`, and observation fields were all correct after each log event.
5. **Did todos use ULID identifiers?** Confirm the format of `todo_id` values returned.
6. **Any tool that was confusing to call?** Describe why.
