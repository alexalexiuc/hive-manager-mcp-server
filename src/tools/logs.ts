import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  appendRow,
  findRowIndex,
  getRows,
  updateRow,
} from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import {
  EventType,
  HIVE_COL,
  HIVES_SHEET_NAME,
  LOG_COL,
  LOGS_SHEET_NAME,
  DEFAULT_LOG_LIMIT,
  MAX_LOG_LIMIT,
} from '../constants.js';
import { isoTimestampSchema, yyyyMmDdDateSchema } from '../shared/validation.js';
import { generateUlid } from '../shared/ulid.js';
import { toolResponse } from './toolResponse.js';
import { rowToHive, hiveToRow } from './hives.js';
import type { Env, LogEntry } from '../types.js';

function rowToLogEntry(row: string[]): LogEntry {
  return {
    log_id: row[LOG_COL.log_id] ?? '',
    timestamp: row[LOG_COL.timestamp] ?? '',
    hive: row[LOG_COL.hive] ?? '',
    event_type: row[LOG_COL.event_type] ?? '',
    summary: row[LOG_COL.summary] ?? '',
    next_check: row[LOG_COL.next_check] ?? '',
    treatment_product: row[LOG_COL.treatment_product] ?? '',
    treatment_dose: row[LOG_COL.treatment_dose] ?? '',
    treatment_duration: row[LOG_COL.treatment_duration] ?? '',
    tags: row[LOG_COL.tags] ?? '',
  };
}

const LogEventSchema = z.object({
  hive: z.string().describe('Hive identifier, e.g. "5" or "north-1"'),
  event_type: z
    .nativeEnum(EventType)
    .describe(
      'Type of event: "inspection" | "feeding" | "treatment" | "harvest" | "note"',
    ),
  summary: z
    .string()
    .optional()
    .describe(
      'Full narrative of the visit — what was observed and what was done. Stored in the log.',
    ),
  queen_status: z
    .string()
    .optional()
    .describe(
      'Updates the hive row on inspection events. Any descriptive string, e.g. "seen", "missing", "eggs_only".',
    ),
  brood_status: z
    .string()
    .optional()
    .describe(
      'Updates the hive row on inspection events. Any descriptive string, e.g. "healthy", "spotty".',
    ),
  food_status: z
    .string()
    .optional()
    .describe(
      'Updates the hive row on inspection events. Any descriptive string, e.g. "full", "medium", "low".',
    ),
  strength: z
    .string()
    .optional()
    .describe(
      'Updates the hive row on inspection events. Any descriptive string, e.g. "strong", "medium", "weak".',
    ),
  next_check: yyyyMmDdDateSchema
    .optional()
    .describe(
      'Recommended next inspection date (YYYY-MM-DD). Updates the hive row and stored in the log.',
    ),
  treatment_product: z
    .string()
    .optional()
    .describe('Treatment name (treatment events only), e.g. "Oxalic Acid"'),
  treatment_dose: z
    .string()
    .optional()
    .describe('Dose applied (treatment events only), e.g. "2.5ml"'),
  treatment_duration: z
    .string()
    .optional()
    .describe('Duration (treatment events only), e.g. "42 days"'),
  tags: z
    .string()
    .optional()
    .describe('Comma-separated labels, e.g. "swarm-risk,requeen"'),
  timestamp: isoTimestampSchema
    .optional()
    .describe('ISO datetime of the event. Defaults to now.'),
});

const GetLogHistorySchema = z.object({
  hive: z
    .string()
    .optional()
    .describe('Filter to one hive; omit for all hives'),
  event_type: z
    .nativeEnum(EventType)
    .optional()
    .describe('Filter by event type, e.g. "treatment", "inspection"'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_LOG_LIMIT)
    .default(DEFAULT_LOG_LIMIT)
    .optional()
    .describe(
      `Max entries to return (default: ${DEFAULT_LOG_LIMIT}, max: ${MAX_LOG_LIMIT})`,
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe('Pagination offset. Defaults to 0.'),
});

type LogEventInput = z.infer<typeof LogEventSchema>;
type GetLogHistoryInput = z.infer<typeof GetLogHistorySchema>;

export function registerLogTools(server: McpServer, env: Env) {
  server.registerTool(
    'apiary_log_event',
    {
      description:
        'Log any hive event — inspection, feeding, treatment, harvest, or quick note. Appends a row to the logs sheet and atomically updates the hives sheet. For harvest events that need yield weight and season data, prefer apiary_log_harvest.',
      inputSchema: LogEventSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: LogEventInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const timestamp = input.timestamp ?? new Date().toISOString();
      const date = timestamp.split('T')[0];
      const logId = generateUlid();

      // Append to logs sheet
      const logRow = [
        logId,
        timestamp,
        input.hive,
        input.event_type,
        input.summary ?? '',
        input.next_check ?? '',
        input.treatment_product ?? '',
        input.treatment_dose ?? '',
        input.treatment_duration ?? '',
        input.tags ?? '',
      ];

      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, logRow);

      // Update hives sheet
      const updatedAt = new Date().toISOString();
      const treatmentSummary =
        input.event_type === EventType.TREATMENT && input.treatment_product
          ? `${input.treatment_product} ${date}`
          : '';

      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        HIVES_SHEET_NAME,
        HIVE_COL.hive,
        input.hive,
      );

      if (rowIndex === null) {
        // Auto-create minimal hive row
        const newHiveRow = [
          input.hive,
          '', // hive_type
          '', // units
          input.event_type !== EventType.NOTE ? date : '',
          input.next_check ?? '',
          input.event_type === EventType.INSPECTION ? (input.strength ?? '') : '',
          input.event_type === EventType.INSPECTION ? (input.queen_status ?? '') : '',
          input.event_type === EventType.INSPECTION ? (input.brood_status ?? '') : '',
          input.event_type === EventType.INSPECTION ? (input.food_status ?? '') : '',
          input.summary ?? '', // last_action
          treatmentSummary,
          '', // notes
          '', // queen_race
          '', // queen_birth_year
          '', // origin_hive
          '', // location
          'true', // active
          updatedAt,
        ];
        await appendRow(sheets, spreadsheetId, HIVES_SHEET_NAME, newHiveRow);
      } else {
        const allRows = await getRows(sheets, spreadsheetId, HIVES_SHEET_NAME);
        const existing = allRows[rowIndex - 2] ?? [];
        const current = rowToHive(existing);

        // Apply update rules based on event type
        const isInspection = input.event_type === EventType.INSPECTION;
        const isNote = input.event_type === EventType.NOTE;
        const isTreatment = input.event_type === EventType.TREATMENT;

        const updated = {
          ...current,
          last_action: input.summary ?? current.last_action ?? '',
          updated_at: updatedAt,
        };

        if (!isNote) {
          updated.last_check = date;
        }

        if (isInspection) {
          if (input.next_check) updated.next_check = input.next_check;
          if (input.strength) updated.strength = input.strength;
          if (input.queen_status) updated.queen_status = input.queen_status;
          if (input.brood_status) updated.brood_status = input.brood_status;
          if (input.food_status) updated.food_status = input.food_status;
        }

        if (isTreatment && treatmentSummary) {
          updated.last_treatment = treatmentSummary;
        }

        await updateRow(
          sheets,
          spreadsheetId,
          HIVES_SHEET_NAME,
          rowIndex,
          hiveToRow(updated),
        );
      }

      return toolResponse({ log_id: logId, hive: input.hive, timestamp, event_type: input.event_type });
    },
  );

  server.registerTool(
    'apiary_get_log_history',
    {
      description:
        'Retrieve the event history for a hive or the whole apiary. Supports filtering by event type and pagination.',
      inputSchema: GetLogHistorySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetLogHistoryInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
      let filtered = rows;

      if (input.hive) {
        filtered = filtered.filter((r) => r[LOG_COL.hive] === input.hive);
      }

      if (input.event_type) {
        filtered = filtered.filter(
          (r) => r[LOG_COL.event_type] === input.event_type,
        );
      }

      const total_count = filtered.length;
      const limit = input.limit ?? DEFAULT_LOG_LIMIT;
      const offset = input.offset ?? 0;

      const page = filtered.slice(offset, offset + limit);
      const entries = page.map(rowToLogEntry);
      const has_more = offset + limit < total_count;
      const next_offset = has_more ? offset + limit : null;

      return toolResponse({ entries, total_count, has_more, next_offset });
    },
  );
}
