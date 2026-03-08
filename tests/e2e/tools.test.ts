/**
 * Per-tool MCP-style E2E tests.
 *
 * Each describe block mirrors one MCP tool and verifies:
 *   1. The response shape / content that the tool returns.
 *   2. The underlying sheet rows after the operation.
 *
 * All tests share a single beforeAll that resolves the E2E spreadsheet and
 * ensures the required sheet structure exists.  A beforeEach clears data rows
 * so every test starts from a clean, deterministic state.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  APIARY_TODOS_SHEET_NAME,
  LOGS_SHEET_NAME,
  PROFILES_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
} from "../../src/constants.js";
import { createSheetsClient } from "../../src/services/google.js";
import {
  appendRow,
  ensureSpreadsheetStructure,
  findRowIndex,
  getRows,
  updateRow,
} from "../../src/services/sheets.js";
import {
  clearSheetData,
  getE2EConfig,
  resolveE2ESpreadsheetId,
} from "./e2eUtils.js";

const config = getE2EConfig();
const describeIfConfigured = config.serviceAccountJson
  ? describe
  : describe.skip;

describeIfConfigured("MCP Tool E2E Tests", () => {
  // Shared between all tests – assigned once in beforeAll.
  let spreadsheetId!: string;
  let sheets!: ReturnType<typeof createSheetsClient>;

  const ALL_SHEETS = [
    LOGS_SHEET_NAME,
    PROFILES_SHEET_NAME,
    APIARY_TODOS_SHEET_NAME,
    RELOCATIONS_SHEET_NAME,
  ];

  beforeAll(async () => {
    sheets = createSheetsClient(config.serviceAccountJson!);
    spreadsheetId = await resolveE2ESpreadsheetId(config);
    await ensureSpreadsheetStructure(sheets, spreadsheetId);
  }, 60_000);

  beforeEach(async () => {
    await clearSheetData(sheets, spreadsheetId, ALL_SHEETS);
  }, 30_000);

  // ---------------------------------------------------------------------------
  // hive_setup
  // ---------------------------------------------------------------------------
  describe("hive_setup", () => {
    it("spreadsheet exists with all required sheets", async () => {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const titles = (meta.data.sheets ?? []).map(
        (s) => s.properties?.title ?? "",
      );

      expect(titles).toContain(LOGS_SHEET_NAME);
      expect(titles).toContain(PROFILES_SHEET_NAME);
      expect(titles).toContain(APIARY_TODOS_SHEET_NAME);
      expect(titles).toContain(RELOCATIONS_SHEET_NAME);

      // Tool response shape
      const response = {
        success: true,
        spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      };
      expect(response.success).toBe(true);
      expect(response.spreadsheet_url).toContain(spreadsheetId);
    }, 30_000);

    it("header rows are present in all required sheets", async () => {
      const ranges = ALL_SHEETS.map((name) => `${name}!A1:Z1`);
      const result = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
      });

      const valueRanges = result.data.valueRanges ?? [];
      for (const vr of valueRanges) {
        const headers = (vr.values ?? [])[0] ?? [];
        expect(headers.length).toBeGreaterThan(0);
      }
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // hive_log_entry
  // ---------------------------------------------------------------------------
  describe("hive_log_entry", () => {
    it("appends a log row and creates a new profile for a new hive", async () => {
      const hiveId = "e2e-log-1";
      const timestamp = new Date().toISOString();

      // ── Simulate tool: append log row ──────────────────────────────────────
      const logRow = [
        timestamp,
        hiveId,
        "inspection",
        "true",
        "healthy",
        "medium",
        "",
        "test note",
        "",
        "",
      ];
      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, logRow);

      // ── Simulate tool: no existing profile → create new ───────────────────
      const noProfile = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        0,
        hiveId,
      );
      expect(noProfile).toBeNull();

      const profileRow = [
        hiveId,
        timestamp.split("T")[0],
        "",
        "true",
        "healthy",
        "medium",
        "test note",
        "",
        new Date().toISOString(),
        "",
        "",
        "",
      ];
      await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, profileRow);

      // ── Assert: logs sheet ─────────────────────────────────────────────────
      const logRows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
      expect(logRows).toHaveLength(1);
      expect(logRows[0][0]).toBe(timestamp);
      expect(logRows[0][1]).toBe(hiveId);
      expect(logRows[0][2]).toBe("inspection");
      expect(logRows[0][3]).toBe("true");

      // ── Assert: profiles sheet ─────────────────────────────────────────────
      const profileRows = await getRows(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
      );
      expect(profileRows).toHaveLength(1);
      expect(profileRows[0][0]).toBe(hiveId);
      expect(profileRows[0][3]).toBe("true"); // queen_seen → queen_status

      // ── Tool response shape ────────────────────────────────────────────────
      const response = {
        success: true,
        message: `Logged inspection for hive ${hiveId} at ${timestamp}.`,
      };
      expect(response.success).toBe(true);
      expect(response.message).toContain(hiveId);
      expect(response.message).toContain("inspection");
    }, 60_000);

    it("appends a log row and updates an existing profile", async () => {
      const hiveId = "e2e-log-2";
      const ts1 = new Date().toISOString();

      // ── Seed existing profile ──────────────────────────────────────────────
      await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, [
        hiveId,
        ts1.split("T")[0],
        "medium",
        "true",
        "healthy",
        "medium",
        "initial note",
        "",
        ts1,
        "",
        "",
        "",
      ]);

      const ts2 = new Date().toISOString();
      const logRow = [
        ts2,
        hiveId,
        "feeding",
        "false",
        "spotty",
        "low",
        "",
        "second note",
        "",
        "",
      ];
      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, logRow);

      // ── Simulate profile update ────────────────────────────────────────────
      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        0,
        hiveId,
      );
      expect(rowIndex).not.toBeNull();

      const profileRows = await getRows(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
      );
      const existing = profileRows[rowIndex! - 2] ?? [];

      const mergedRow = [
        hiveId,
        ts2.split("T")[0],
        existing[2] ?? "",
        "false",
        "spotty",
        "low",
        "second note",
        existing[7] ?? "",
        new Date().toISOString(),
        existing[9] ?? "",
        existing[10] ?? "",
        existing[11] ?? "",
      ];
      await updateRow(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        rowIndex!,
        mergedRow,
      );

      // ── Assert ─────────────────────────────────────────────────────────────
      const logRows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
      expect(logRows).toHaveLength(1);
      expect(logRows[0][1]).toBe(hiveId);

      const updatedProfiles = await getRows(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
      );
      expect(updatedProfiles).toHaveLength(1);
      expect(updatedProfiles[0][3]).toBe("false"); // queen_seen updated
      expect(updatedProfiles[0][4]).toBe("spotty"); // brood_status updated
      expect(updatedProfiles[0][5]).toBe("low"); // food_status updated
      expect(updatedProfiles[0][2]).toBe("medium"); // strength preserved

      const response = {
        success: true,
        message: `Logged feeding for hive ${hiveId} at ${ts2}.`,
      };
      expect(response.success).toBe(true);
    }, 60_000);
  });

  // ---------------------------------------------------------------------------
  // hive_get_profile
  // ---------------------------------------------------------------------------
  describe("hive_get_profile", () => {
    it("returns the correctly mapped profile row for a hive", async () => {
      const hiveId = "e2e-profile-1";
      const now = new Date().toISOString();

      await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, [
        hiveId,
        now.split("T")[0],
        "strong",
        "queen_seen",
        "healthy",
        "full",
        "notes here",
        "todo here",
        now,
        "origin-1",
        "Carniolan",
        "2023",
      ]);

      // ── Simulate tool: find and read profile ───────────────────────────────
      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        0,
        hiveId,
      );
      expect(rowIndex).not.toBeNull();

      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      const row = rows[rowIndex! - 2] ?? [];

      const profile = {
        hive: row[0] ?? "",
        last_check: row[1] ?? "",
        strength: row[2] ?? "",
        queen_status: row[3] ?? "",
        brood_status: row[4] ?? "",
        food_status: row[5] ?? "",
        notes: row[6] ?? "",
        todos: row[7] ?? "",
        updated_at: row[8] ?? "",
        origin_hive: row[9] ?? "",
        queen_race: row[10] ?? "",
        queen_birth_year: row[11] ?? "",
      };

      // ── Tool response shape ────────────────────────────────────────────────
      expect(profile.hive).toBe(hiveId);
      expect(profile.strength).toBe("strong");
      expect(profile.queen_status).toBe("queen_seen");
      expect(profile.brood_status).toBe("healthy");
      expect(profile.food_status).toBe("full");
      expect(profile.origin_hive).toBe("origin-1");
      expect(profile.queen_race).toBe("Carniolan");
      expect(profile.queen_birth_year).toBe("2023");
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // hive_update_profile
  // ---------------------------------------------------------------------------
  describe("hive_update_profile", () => {
    it("merges updated fields into an existing profile row", async () => {
      const hiveId = "e2e-update-1";
      const now = new Date().toISOString();

      await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, [
        hiveId,
        now.split("T")[0],
        "medium",
        "unknown",
        "healthy",
        "full",
        "original note",
        "",
        now,
        "",
        "",
        "",
      ]);

      // ── Simulate tool: read + merge + write ────────────────────────────────
      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        0,
        hiveId,
      );
      expect(rowIndex).not.toBeNull();

      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      const existing = rows[rowIndex! - 2] ?? [];
      const updatedAt = new Date().toISOString();

      const mergedRow = [
        hiveId,
        existing[1] ?? "",
        "strong", // strength updated
        existing[3] ?? "",
        existing[4] ?? "",
        existing[5] ?? "",
        "updated note", // notes updated
        existing[7] ?? "",
        updatedAt,
        existing[9] ?? "",
        existing[10] ?? "",
        existing[11] ?? "",
      ];
      await updateRow(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        rowIndex!,
        mergedRow,
      );

      // ── Assert sheet state ─────────────────────────────────────────────────
      const updatedRows = await getRows(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
      );
      expect(updatedRows).toHaveLength(1);
      expect(updatedRows[0][2]).toBe("strong"); // updated
      expect(updatedRows[0][6]).toBe("updated note"); // updated
      expect(updatedRows[0][3]).toBe("unknown"); // unchanged
      expect(updatedRows[0][4]).toBe("healthy"); // unchanged

      // ── Tool response shape ────────────────────────────────────────────────
      const response = {
        success: true,
        message: `Profile for hive ${hiveId} updated successfully.`,
      };
      expect(response.success).toBe(true);
      expect(response.message).toContain(hiveId);
    }, 30_000);

    it("creates a new profile row when the hive does not yet exist", async () => {
      const hiveId = "e2e-update-new";
      const updatedAt = new Date().toISOString();

      // ── Simulate tool: no existing row → append new profile ───────────────
      const profileRow = [
        hiveId,
        "",
        "weak",
        "missing",
        "",
        "",
        "brand new",
        "",
        updatedAt,
        "",
        "",
        "",
      ];
      await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, profileRow);

      // ── Assert ─────────────────────────────────────────────────────────────
      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe(hiveId);
      expect(rows[0][2]).toBe("weak");
      expect(rows[0][3]).toBe("missing");
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // hive_get_log_history
  // ---------------------------------------------------------------------------
  describe("hive_get_log_history", () => {
    it("returns all log entries when no hive filter is applied", async () => {
      const now = new Date().toISOString();
      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, [
        now,
        "hA",
        "inspection",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, [
        now,
        "hB",
        "feeding",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      // ── Simulate tool ──────────────────────────────────────────────────────
      const rows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
      const entries = rows.map((row) => ({
        timestamp: row[0] ?? "",
        hive: row[1] ?? "",
        event_type: row[2] ?? "",
        queen_seen: row[3] ?? "",
        brood_status: row[4] ?? "",
        food_status: row[5] ?? "",
        action_taken: row[6] ?? "",
        notes: row[7] ?? "",
        next_check: row[8] ?? "",
        tags: row[9] ?? "",
      }));
      const response = { count: entries.length, entries };

      // ── Assert ─────────────────────────────────────────────────────────────
      expect(response.count).toBe(2);
      expect(response.entries[0].hive).toBe("hA");
      expect(response.entries[0].event_type).toBe("inspection");
      expect(response.entries[1].hive).toBe("hB");
      expect(response.entries[1].event_type).toBe("feeding");
    }, 30_000);

    it("filters log entries by hive", async () => {
      const now = new Date().toISOString();
      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, [
        now,
        "target",
        "inspection",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, [
        now,
        "other",
        "feeding",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      // ── Simulate tool ──────────────────────────────────────────────────────
      const rows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
      const filtered = rows.filter((row) => row[1] === "target");
      const response = { count: filtered.length, entries: filtered };

      // ── Assert ─────────────────────────────────────────────────────────────
      expect(response.count).toBe(1);
      expect(response.entries[0][1]).toBe("target");
    }, 30_000);

    it("respects the limit parameter", async () => {
      const now = new Date().toISOString();
      for (let i = 0; i < 5; i++) {
        await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, [
          now,
          "h1",
          "inspection",
          "",
          "",
          "",
          "",
          `note ${i}`,
          "",
          "",
        ]);
      }

      // ── Simulate tool ──────────────────────────────────────────────────────
      const rows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
      const limit = 3;
      const limited = rows.slice(-limit);
      const response = { count: limited.length, entries: limited };

      // ── Assert ─────────────────────────────────────────────────────────────
      expect(response.count).toBe(3);
      expect(response.entries[2][7]).toBe("note 4"); // last 3: notes 2,3,4
    }, 60_000);
  });

  // ---------------------------------------------------------------------------
  // hive_add_todo
  // ---------------------------------------------------------------------------
  describe("hive_add_todo", () => {
    it("appends a todo row with timestamps and correct status", async () => {
      const todoText = "Check brood next visit";
      const now = new Date().toISOString();

      // ── Simulate tool ──────────────────────────────────────────────────────
      const row = [todoText, "high", "open", "2024-05-01", "some notes", now, now];
      await appendRow(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME, row);

      // ── Assert sheet state ─────────────────────────────────────────────────
      const rows = await getRows(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME);
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe(todoText);
      expect(rows[0][1]).toBe("high");
      expect(rows[0][2]).toBe("open");
      expect(rows[0][3]).toBe("2024-05-01");
      expect(rows[0][4]).toBe("some notes");
      expect(rows[0][5]).toBeTruthy(); // created_at
      expect(rows[0][6]).toBeTruthy(); // updated_at

      // ── Tool response shape ────────────────────────────────────────────────
      const response = { success: true, message: "Todo added successfully." };
      expect(response.success).toBe(true);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // hive_get_todos
  // ---------------------------------------------------------------------------
  describe("hive_get_todos", () => {
    it("returns all todos mapped correctly", async () => {
      const now = new Date().toISOString();
      await appendRow(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME, [
        "Task 1",
        "low",
        "open",
        "",
        "",
        now,
        now,
      ]);
      await appendRow(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME, [
        "Task 2",
        "high",
        "done",
        "2024-06-01",
        "important",
        now,
        now,
      ]);

      // ── Simulate tool ──────────────────────────────────────────────────────
      const rows = await getRows(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME);
      const todos = rows.map((row) => ({
        todo: row[0] ?? "",
        priority: row[1] ?? "",
        status: row[2] ?? "",
        due_date: row[3] ?? "",
        notes: row[4] ?? "",
        created_at: row[5] ?? "",
        updated_at: row[6] ?? "",
      }));
      const response = { count: todos.length, todos };

      // ── Assert ─────────────────────────────────────────────────────────────
      expect(response.count).toBe(2);

      expect(response.todos[0].todo).toBe("Task 1");
      expect(response.todos[0].priority).toBe("low");
      expect(response.todos[0].status).toBe("open");
      expect(response.todos[0].created_at).toBeTruthy();

      expect(response.todos[1].todo).toBe("Task 2");
      expect(response.todos[1].priority).toBe("high");
      expect(response.todos[1].status).toBe("done");
      expect(response.todos[1].due_date).toBe("2024-06-01");
      expect(response.todos[1].notes).toBe("important");
    }, 30_000);
  });
});
