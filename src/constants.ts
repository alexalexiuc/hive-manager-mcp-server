export const HIVES_FOLDER_NAME = 'Hives';
export const PROFILES_FOLDER_NAME = 'profiles';
export const LOG_SHEET_NAME = 'hive_logs';
export const TODOS_FILENAME = 'todos_general.txt';

export const LOG_SHEET_HEADERS = [
  'Date',
  'Hive ID',
  'Location',
  'Overall Status',
  'Boxes',
  'Frames',
  'Queen Seen',
  'Notes',
  'Action Taken',
  'Next Visit',
] as const;

export enum OverallStatus {
  STRONG = 'Strong',
  MEDIUM = 'Medium',
  WEAK = 'Weak',
  CRITICAL = 'Critical',
  UNKNOWN = 'Unknown',
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

export const DEFAULT_LOG_LIMIT = 50;
export const MAX_LOG_LIMIT = 500;

export function getDefaultTodosContent(date?: string): string {
  const today = date ?? new Date().toISOString().split('T')[0];
  return `APIARY GENERAL TODOS
Updated: ${today}
========================================

URGENT:
- 

THIS WEEK:
- 

GENERAL / ONGOING:
- 

NOTES:
- 
`;
}
