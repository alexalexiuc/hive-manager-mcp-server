import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriveClient, createSheetsClient } from '../services/google.js';
import { appendRow } from '../services/sheets.js';
import { findFile, createTextFile, readFile, writeFile } from '../services/drive.js';
import { OverallStatus, LOG_SHEET_NAME } from '../constants.js';
import { buildProfileText, parseProfile } from './profile.js';
import type { Env, HiveProfile } from '../types.js';

const LogEntrySchema = z.object({
  hive_id: z.string().describe('Unique identifier for the hive (e.g. "1", "5", "north-apiary-1")'),
  overall_status: z.nativeEnum(OverallStatus).describe('Overall hive health status'),
  date: z.string().optional().describe('Inspection date in YYYY-MM-DD format. Defaults to today.'),
  location: z.string().optional().describe('Physical location of the hive'),
  boxes: z.number().int().positive().optional().describe('Number of boxes/supers on the hive'),
  frames: z.number().int().positive().optional().describe('Number of frames with brood/bees'),
  queen_seen: z.string().optional().describe('Was the queen seen? (Yes/No/Eggs only)'),
  notes: z.string().optional().describe('Inspection notes and observations'),
  action_taken: z.string().optional().describe('Actions taken during the inspection'),
  next_visit: z.string().optional().describe('Date or notes for next planned visit'),
  todos: z.string().optional().describe('New todos to add to the hive profile'),
});

type LogEntryInput = z.infer<typeof LogEntrySchema>;

export function registerLogTool(server: McpServer, env: Env) {
  server.tool(
    'hive_log_entry',
    'Log a hive inspection entry. Appends a row to the hive_logs Google Sheet and auto-creates or updates the hive profile file in Drive.',
    LogEntrySchema.shape,
    async (input: LogEntryInput) => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const date = input.date ?? new Date().toISOString().split('T')[0];

      const sheetId = env.LOG_SHEET_ID;
      if (!sheetId) {
        throw new Error('LOG_SHEET_ID is not set. Run hive_setup first.');
      }

      const row = [
        date,
        input.hive_id,
        input.location ?? '',
        input.overall_status,
        input.boxes?.toString() ?? '',
        input.frames?.toString() ?? '',
        input.queen_seen ?? '',
        input.notes ?? '',
        input.action_taken ?? '',
        input.next_visit ?? '',
      ];

      await appendRow(sheets, sheetId, LOG_SHEET_NAME, row);

      const profilesFolderId = env.PROFILES_FOLDER_ID;
      if (!profilesFolderId) {
        throw new Error('PROFILES_FOLDER_ID is not set. Run hive_setup first.');
      }

      const profileFileName = `${input.hive_id}.txt`;
      const profileFileId = await findFile(drive, profileFileName, profilesFolderId);

      const profileData: HiveProfile = {
        hiveId: input.hive_id,
        lastChecked: date,
        location: input.location,
        status: input.overall_status,
        boxes: input.boxes,
        frames: input.frames,
        queenSeen: input.queen_seen,
        notes: input.notes,
        actionTaken: input.action_taken,
        todos: input.todos,
      };

      if (!profileFileId) {
        const content = buildProfileText(profileData);
        await createTextFile(drive, profileFileName, content, profilesFolderId);
      } else {
        const existingContent = await readFile(drive, profileFileId);
        const existing = parseProfile(existingContent, input.hive_id);
        const merged: HiveProfile = {
          ...existing,
          lastChecked: date,
          location: input.location ?? existing.location,
          status: input.overall_status,
          boxes: input.boxes ?? existing.boxes,
          frames: input.frames ?? existing.frames,
          queenSeen: input.queen_seen ?? existing.queenSeen,
          notes: input.notes ?? existing.notes,
          todos: input.todos ?? existing.todos,
        };
        const updatedContent = buildProfileText(merged);
        await writeFile(drive, profileFileId, updatedContent);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Logged inspection for hive ${input.hive_id} on ${date}.`,
            }),
          },
        ],
      };
    }
  );
}
