import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getRows, appendRow, updateRow } from '../../services/sheets.js';
import { requireSpreadsheetContext } from '../../services/spreadsheet.js';
import {
  PROFILE_SHEET_NAME,
  PROFILE_COL,
  ActivityLevel,
  Sex,
  ACTIVITY_MULTIPLIERS,
} from '../constants.js';
import { toCaloriesSheetOperationError } from '../services/sheets.js';
import { toolResponse } from '../../tools/toolResponse.js';
import type { Env } from '../../types.js';
import type { BodyProfile } from '../types.js';

function rowToProfile(row: string[]): BodyProfile {
  return {
    name: row[PROFILE_COL.name] ?? '',
    age: row[PROFILE_COL.age] ?? '',
    height_cm: row[PROFILE_COL.height_cm] ?? '',
    weight_kg: row[PROFILE_COL.weight_kg] ?? '',
    sex: row[PROFILE_COL.sex] ?? '',
    activity_level: row[PROFILE_COL.activity_level] ?? '',
    goal_calories_override: row[PROFILE_COL.goal_calories_override] ?? '',
    neck_cm: row[PROFILE_COL.neck_cm] ?? '',
    waist_cm: row[PROFILE_COL.waist_cm] ?? '',
    hips_cm: row[PROFILE_COL.hips_cm] ?? '',
    notes: row[PROFILE_COL.notes] ?? '',
    updated_at: row[PROFILE_COL.updated_at] ?? '',
  };
}

function profileToRow(profile: BodyProfile): (string | number | undefined)[] {
  return [
    profile.name,
    profile.age,
    profile.height_cm,
    profile.weight_kg,
    profile.sex,
    profile.activity_level,
    profile.goal_calories_override,
    profile.neck_cm,
    profile.waist_cm,
    profile.hips_cm,
    profile.notes,
    profile.updated_at,
  ];
}

export function calculateTDEE(profile: BodyProfile): {
  bmr: number | null;
  tdee: number | null;
  daily_calories: number | null;
} {
  const age = Number(profile.age);
  const height = Number(profile.height_cm);
  const weight = Number(profile.weight_kg);
  const sex = profile.sex as Sex;
  const activity = profile.activity_level as ActivityLevel;

  if (!age || !height || !weight || !sex) {
    return { bmr: null, tdee: null, daily_calories: null };
  }

  // Mifflin-St Jeor equation
  let bmr: number;
  if (sex === Sex.MALE) {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[activity] ?? ACTIVITY_MULTIPLIERS[ActivityLevel.SEDENTARY];
  const tdee = Math.round(bmr * multiplier);
  bmr = Math.round(bmr);

  // Use override if set, otherwise use TDEE
  const override = Number(profile.goal_calories_override);
  const daily_calories = override > 0 ? override : tdee;

  return { bmr, tdee, daily_calories };
}

const UpdateProfileSchema = z.object({
  name: z.string().optional().describe('Your name'),
  age: z.number().int().positive().optional().describe('Age in years'),
  height_cm: z.number().positive().optional().describe('Height in centimeters'),
  weight_kg: z.number().positive().optional().describe('Weight in kilograms'),
  sex: z
    .nativeEnum(Sex)
    .optional()
    .describe('Biological sex for BMR calculation: "male" | "female"'),
  activity_level: z
    .nativeEnum(ActivityLevel)
    .optional()
    .describe(
      'Activity level for TDEE: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"',
    ),
  goal_calories_override: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Manual daily calorie target override. If not set, calculated TDEE is used.',
    ),
  neck_cm: z.number().positive().optional().describe('Neck circumference in cm'),
  waist_cm: z.number().positive().optional().describe('Waist circumference in cm'),
  hips_cm: z
    .number()
    .positive()
    .optional()
    .describe('Hips circumference in cm (relevant for female body fat estimation)'),
  notes: z.string().optional().describe('Additional notes about your health goals'),
});

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export function registerProfileTools(server: McpServer, env: Env) {
  server.registerTool(
    'calories_update_profile',
    {
      description:
        'Save or update body measurements and health profile. Used to compute your BMR (Basal Metabolic Rate) and TDEE (Total Daily Energy Expenditure) via the Mifflin-St Jeor equation. Only provided fields are updated — omitted fields retain their current values.',
      inputSchema: UpdateProfileSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: UpdateProfileInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      let existing: BodyProfile = {};

      try {
        const rows = await getRows(sheets, spreadsheetId, PROFILE_SHEET_NAME);
        if (rows.length > 0 && rows[0]) {
          existing = rowToProfile(rows[0]);
        }
      } catch (error: unknown) {
        throw toCaloriesSheetOperationError(error, PROFILE_SHEET_NAME);
      }

      const updated: BodyProfile = {
        ...existing,
        name: input.name !== undefined ? input.name : existing.name,
        age: input.age !== undefined ? String(input.age) : existing.age,
        height_cm: input.height_cm !== undefined ? String(input.height_cm) : existing.height_cm,
        weight_kg: input.weight_kg !== undefined ? String(input.weight_kg) : existing.weight_kg,
        sex: input.sex !== undefined ? input.sex : existing.sex,
        activity_level: input.activity_level !== undefined ? input.activity_level : existing.activity_level,
        goal_calories_override:
          input.goal_calories_override !== undefined
            ? String(input.goal_calories_override)
            : existing.goal_calories_override,
        neck_cm: input.neck_cm !== undefined ? String(input.neck_cm) : existing.neck_cm,
        waist_cm: input.waist_cm !== undefined ? String(input.waist_cm) : existing.waist_cm,
        hips_cm: input.hips_cm !== undefined ? String(input.hips_cm) : existing.hips_cm,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updated_at: new Date().toISOString(),
      };

      try {
        const rows = await getRows(sheets, spreadsheetId, PROFILE_SHEET_NAME);
        if (rows.length > 0) {
          await updateRow(sheets, spreadsheetId, PROFILE_SHEET_NAME, 2, profileToRow(updated));
        } else {
          await appendRow(sheets, spreadsheetId, PROFILE_SHEET_NAME, profileToRow(updated));
        }
      } catch (error: unknown) {
        throw toCaloriesSheetOperationError(error, PROFILE_SHEET_NAME);
      }

      const { bmr, tdee, daily_calories } = calculateTDEE(updated);

      return toolResponse({
        profile: updated,
        calculated: { bmr, tdee, daily_calories },
      });
    },
  );

  server.registerTool(
    'calories_get_profile',
    {
      description:
        'Get the stored body profile including calculated BMR, TDEE, and daily calorie target.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      let profile: BodyProfile = {};

      try {
        const rows = await getRows(sheets, spreadsheetId, PROFILE_SHEET_NAME);
        if (rows.length > 0 && rows[0]) {
          profile = rowToProfile(rows[0]);
        }
      } catch (error: unknown) {
        throw toCaloriesSheetOperationError(error, PROFILE_SHEET_NAME);
      }

      const { bmr, tdee, daily_calories } = calculateTDEE(profile);

      const activityDescriptions: Record<string, string> = {
        sedentary: 'Desk job, little or no exercise',
        lightly_active: 'Light exercise 1–3 days/week',
        moderately_active: 'Moderate exercise 3–5 days/week',
        very_active: 'Hard exercise 6–7 days/week',
        extra_active: 'Very hard exercise or physical job',
      };

      return toolResponse({
        profile,
        calculated: {
          bmr,
          tdee,
          daily_calories,
          activity_description: profile.activity_level
            ? (activityDescriptions[profile.activity_level] ?? null)
            : null,
        },
      });
    },
  );
}
