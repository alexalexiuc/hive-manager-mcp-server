import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriveClient } from '../services/google.js';
import { readFile, writeFile, listFiles } from '../services/drive.js';
import type { Env, HiveProfile } from '../types.js';

export function buildProfileText(profile: HiveProfile): string {
  const sep = '========================================';
  const dash = '----------------------------------------';
  const lines: string[] = [
    `HIVE ${profile.hiveId}`,
    sep,
    `Last checked : ${profile.lastChecked ?? ''}`,
    `Location     : ${profile.location ?? ''}`,
    `Status       : ${profile.status ?? ''}`,
    `Boxes        : ${profile.boxes?.toString() ?? ''}`,
    `Frames       : ${profile.frames?.toString() ?? ''}`,
    `Queen seen   : ${profile.queenSeen ?? ''}`,
    dash,
    'NOTES:',
    profile.notes ?? '',
    '',
    'TODOS:',
    profile.todos ?? '',
    '',
    'BASIC INFO:',
    profile.basicInfo ?? '',
    '',
  ];
  return lines.join('\n');
}

export function parseProfile(content: string, hiveId: string): HiveProfile {
  const profile: HiveProfile = { hiveId };
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.startsWith('Last checked :')) {
      profile.lastChecked = line.replace('Last checked :', '').trim();
    } else if (line.startsWith('Location     :')) {
      profile.location = line.replace('Location     :', '').trim();
    } else if (line.startsWith('Status       :')) {
      profile.status = line.replace('Status       :', '').trim();
    } else if (line.startsWith('Boxes        :')) {
      const val = line.replace('Boxes        :', '').trim();
      if (val) profile.boxes = parseInt(val, 10);
    } else if (line.startsWith('Frames       :')) {
      const val = line.replace('Frames       :', '').trim();
      if (val) profile.frames = parseInt(val, 10);
    } else if (line.startsWith('Queen seen   :')) {
      profile.queenSeen = line.replace('Queen seen   :', '').trim();
    }
  }

  const notesMatch = content.match(/NOTES:\n([\s\S]*?)\n\nTODOS:/);
  if (notesMatch) profile.notes = notesMatch[1].trim();

  const todosMatch = content.match(/TODOS:\n([\s\S]*?)\n\nBASIC INFO:/);
  if (todosMatch) profile.todos = todosMatch[1].trim();

  const basicInfoMatch = content.match(/BASIC INFO:\n([\s\S]*?)$/);
  if (basicInfoMatch) profile.basicInfo = basicInfoMatch[1].trim();

  return profile;
}

const GetProfileSchema = z.object({
  hive_id: z.string().describe('The hive ID to retrieve the profile for'),
});

const UpdateProfileSchema = z.object({
  hive_id: z.string().describe('The hive ID to update'),
  location: z.string().optional().describe('Updated location'),
  status: z.string().optional().describe('Updated status'),
  boxes: z.number().int().positive().optional().describe('Updated box count'),
  frames: z.number().int().positive().optional().describe('Updated frame count'),
  queen_seen: z.string().optional().describe('Updated queen seen status'),
  notes: z.string().optional().describe('Updated notes'),
  todos: z.string().optional().describe('Updated todos'),
  basic_info: z.string().optional().describe('Updated basic info'),
});

type GetProfileInput = z.infer<typeof GetProfileSchema>;
type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export function registerProfileTools(server: McpServer, env: Env) {
  server.tool(
    'hive_get_profile',
    'Read the profile text file for a specific hive from Google Drive.',
    GetProfileSchema.shape,
    async (input: GetProfileInput) => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const profilesFolderId = env.PROFILES_FOLDER_ID;
      if (!profilesFolderId) {
        throw new Error('PROFILES_FOLDER_ID is not set. Run hive_setup first.');
      }

      const { findFile } = await import('../services/drive.js');
      const profileFileId = await findFile(drive, `${input.hive_id}.txt`, profilesFolderId);
      if (!profileFileId) {
        throw new Error(`Profile for hive ${input.hive_id} not found.`);
      }

      const content = await readFile(drive, profileFileId);

      return {
        content: [
          {
            type: 'text' as const,
            text: content,
          },
        ],
      };
    }
  );

  server.tool(
    'hive_update_profile',
    'Update specific fields in a hive profile. Reads existing profile, merges new fields, and writes back.',
    UpdateProfileSchema.shape,
    async (input: UpdateProfileInput) => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const profilesFolderId = env.PROFILES_FOLDER_ID;
      if (!profilesFolderId) {
        throw new Error('PROFILES_FOLDER_ID is not set. Run hive_setup first.');
      }

      const { findFile } = await import('../services/drive.js');
      const profileFileId = await findFile(drive, `${input.hive_id}.txt`, profilesFolderId);
      if (!profileFileId) {
        throw new Error(`Profile for hive ${input.hive_id} not found.`);
      }

      const existingContent = await readFile(drive, profileFileId);
      const existing = parseProfile(existingContent, input.hive_id);

      const updated: HiveProfile = {
        ...existing,
        location: input.location ?? existing.location,
        status: input.status ?? existing.status,
        boxes: input.boxes ?? existing.boxes,
        frames: input.frames ?? existing.frames,
        queenSeen: input.queen_seen ?? existing.queenSeen,
        notes: input.notes ?? existing.notes,
        todos: input.todos ?? existing.todos,
        basicInfo: input.basic_info ?? existing.basicInfo,
      };

      const updatedContent = buildProfileText(updated);
      await writeFile(drive, profileFileId, updatedContent);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Profile for hive ${input.hive_id} updated successfully.`,
            }),
          },
        ],
      };
    }
  );

  server.tool(
    'hive_get_all_profiles',
    'List and read all hive profile files from the profiles/ folder in Google Drive.',
    {},
    async () => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const profilesFolderId = env.PROFILES_FOLDER_ID;
      if (!profilesFolderId) {
        throw new Error('PROFILES_FOLDER_ID is not set. Run hive_setup first.');
      }

      const files = await listFiles(drive, profilesFolderId, 'text/plain');

      const profiles = await Promise.all(
        files.map(async (file) => {
          const content = await readFile(drive, file.id);
          const hive_id = file.name.replace('.txt', '');
          return { hive_id, content };
        })
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: profiles.length,
              profiles,
            }),
          },
        ],
      };
    }
  );
}
