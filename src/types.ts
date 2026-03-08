export interface HiveLogEntry {
  timestamp: string;
  hive: string;
  event_type: string;
  queen_seen?: string;
  brood_status?: string;
  food_status?: string;
  action_taken?: string;
  notes?: string;
  next_check?: string;
  tags?: string;
}

export interface HiveProfile {
  hive: string;
  last_check?: string;
  strength?: string;
  queen_status?: string;
  brood_status?: string;
  food_status?: string;
  notes?: string;
  todos?: string;
  updated_at?: string;
  origin_hive?: string;
  queen_race?: string;
  queen_birth_year?: string;
}

export interface HiveRelocation {
  timestamp: string;
  hives: string;
  location: string;
  notes?: string;
}

export interface ApiaryTodo {
  todo: string;
  priority?: string;
  status?: string;
  due_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  REQUEST_SPREADSHEET_ID?: string;
  PORT?: string;
}
