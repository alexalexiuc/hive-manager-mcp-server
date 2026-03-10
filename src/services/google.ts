import { google, sheets_v4, drive_v3 } from 'googleapis';
import { GOOGLE_SCOPES } from '../constants';

let cachedServiceAccountJson: string | undefined;
let cachedSheetsClient: sheets_v4.Sheets | undefined;
let cachedDriveClient: drive_v3.Drive | undefined;
let cachedAuth: ReturnType<typeof buildGoogleAuth> | undefined;

function buildGoogleAuth(serviceAccountJson: string) {
  const credentials = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  return new google.auth.GoogleAuth({
    credentials,
    scopes: GOOGLE_SCOPES,
  });
}

function refreshCacheForCredentials(serviceAccountJson: string): void {
  const auth = buildGoogleAuth(serviceAccountJson);
  cachedServiceAccountJson = serviceAccountJson;
  cachedAuth = auth;
  cachedSheetsClient = undefined;
  cachedDriveClient = undefined;
}

function ensureAuthCache(serviceAccountJson: string): void {
  if (
    cachedServiceAccountJson === serviceAccountJson &&
    cachedAuth !== undefined
  ) {
    return;
  }

  refreshCacheForCredentials(serviceAccountJson);
}

export function createGoogleAuth(serviceAccountJson: string) {
  ensureAuthCache(serviceAccountJson);
  return cachedAuth!;
}

export function createSheetsClient(serviceAccountJson: string) {
  ensureAuthCache(serviceAccountJson);
  if (!cachedSheetsClient) {
    cachedSheetsClient = google.sheets({ version: 'v4', auth: cachedAuth! });
  }

  return cachedSheetsClient;
}

export function createDriveClient(serviceAccountJson: string) {
  ensureAuthCache(serviceAccountJson);
  if (!cachedDriveClient) {
    cachedDriveClient = google.drive({ version: 'v3', auth: cachedAuth! });
  }

  return cachedDriveClient;
}
