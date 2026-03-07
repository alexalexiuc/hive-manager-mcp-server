import { OverallStatus } from './constants.js';

export interface HiveLogEntry {
  date: string;
  hiveId: string;
  location?: string;
  overallStatus: OverallStatus;
  boxes?: number;
  frames?: number;
  queenSeen?: string;
  notes?: string;
  actionTaken?: string;
  nextVisit?: string;
}

export interface HiveProfile {
  hiveId: string;
  lastChecked?: string;
  location?: string;
  status?: string;
  boxes?: number;
  frames?: number;
  queenSeen?: string;
  notes?: string;
  actionTaken?: string;
  todos?: string;
  basicInfo?: string;
}

export interface SetupResult {
  success: boolean;
  folder_url: string;
  sheet_url: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
}

export interface ProfileEntry {
  hive_id: string;
  content: string;
}

export interface AllProfilesResult {
  count: number;
  profiles: ProfileEntry[];
}

export interface LogHistoryResult {
  count: number;
  entries: HiveLogEntry[];
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  HIVES_FOLDER_ID?: string;
  PROFILES_FOLDER_ID?: string;
  LOG_SHEET_ID?: string;
  PORT?: string;
}
