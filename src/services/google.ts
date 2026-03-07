import { google } from 'googleapis';
import { GOOGLE_SCOPES } from '../constants.js';

export function createGoogleAuth(serviceAccountJson: string) {
  const credentials = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: GOOGLE_SCOPES,
  });

  return auth;
}

export function createSheetsClient(serviceAccountJson: string) {
  const auth = createGoogleAuth(serviceAccountJson);
  return google.sheets({ version: 'v4', auth });
}

export function createDriveClient(serviceAccountJson: string) {
  const auth = createGoogleAuth(serviceAccountJson);
  return google.drive({ version: 'v3', auth });
}
