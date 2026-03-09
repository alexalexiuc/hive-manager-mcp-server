import { describe, it } from 'vitest';

describe('apiary_log_event', () => {
  it.todo('appends row to logs sheet with correct columns (log_id, timestamp, hive, event_type, summary, ...)');
  it.todo('auto-creates hive row in hives sheet when hive does not exist');
  it.todo('updates existing hive row on inspection event (strength, queen_status, brood_status, food_status, last_check, next_check)');
  it.todo('updates last_action on all event types');
  it.todo('updates last_check on inspection, feeding, treatment, harvest events but not note');
  it.todo('updates last_treatment on treatment events');
  it.todo('validates required fields (hive, event_type)');
  it.todo('uses current ISO timestamp as default when timestamp not provided');
  it.todo('generates a ULID log_id for each entry');
  it.todo('returns { log_id, hive, timestamp, event_type }');
  it.todo('throws error when x-spreadsheet-id header missing');
});
