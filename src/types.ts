export interface Hive {
  hive: string;
  hive_type?: string;
  units?: string;
  last_check?: string;
  next_check?: string;
  strength?: string;
  queen_status?: string;
  brood_status?: string;
  food_status?: string;
  last_action?: string;
  last_treatment?: string;
  notes?: string;
  queen_race?: string;
  queen_birth_year?: string;
  origin_hive?: string;
  location?: string;
  active?: string;
  updated_at?: string;
}

export interface LogEntry {
  log_id: string;
  timestamp: string;
  hive: string;
  event_type: string;
  summary?: string;
  treatment_product?: string;
  treatment_dose?: string;
  treatment_duration?: string;
  tags?: string;
}

export interface Harvest {
  harvest_id: string;
  timestamp: string;
  hive: string;
  year: string;
  weight_kg: string;
  season?: string;
  units_extracted?: string;
  notes?: string;
}

export interface Todo {
  todo_id: string;
  hive?: string;
  todo: string;
  priority?: string;
  status?: string;
  due_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HiveRelocation {
  timestamp: string;
  hives: string;
  location: string;
  notes?: string;
}

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  REQUEST_SPREADSHEET_ID?: string;
  PORT?: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
}
