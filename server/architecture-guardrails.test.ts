import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROUTERS_DIR = path.join(__dirname, "routers");

// These routers are platform-level and correctly use protectedProcedure.
// communications.ts is included because DMs/channels can span across orgs
// (e.g., cross-org DMs, platform-wide presence) and legitimately use protectedProcedure.
const PLATFORM_ROUTERS = new Set([
  "admin.ts",
  "admin-hub.ts",
  "account-console.ts",
  "communications.ts",
  "digest.ts",
  "organizations.ts",
  "plans.ts",
  "profile.ts",
  "users.ts",
]);

function getRouterFiles(): string[] {
  return fs
    .readdirSync(ROUTERS_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
}

function readRouterContent(filename: string): string {
  return fs.readFileSync(path.join(ROUTERS_DIR, filename), "utf-8");
}

/**
 * Collect look-ahead lines from the current procedure body only.
 * Stops at the next .query(async or .mutation(async boundary
 * to avoid false positives from adjacent procedures.
 */
function getBoundedLookAhead(lines: string[], startIdx: number, maxLines = 30): string {
  const lookAheadLines = lines.slice(startIdx + 1, startIdx + 1 + maxLines);
  const bounded: string[] = [];
  for (const la of lookAheadLines) {
    // Stop if we hit the next procedure callback
    if (/\.(query|mutation)\(\s*async/.test(la)) break;
    bounded.push(la);
  }
  return bounded.join("\n");
}

describe("Architecture Guardrails", () => {
  describe("ctx destructuring — no broken procedure callbacks", () => {
    it("should not have async callbacks that reference ctx without destructuring it", () => {
      const violations: string[] = [];

      for (const file of getRouterFiles()) {
        const content = readRouterContent(file);
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Match patterns like .query(async () => or .mutation(async () =>
          // These are procedure callbacks that should destructure ctx if they use it
          if (
            /\.(query|mutation)\(\s*async\s*\(\s*\)\s*=>/.test(line)
          ) {
            const lookAhead = getBoundedLookAhead(lines, i);
            if (/\bctx\./.test(lookAhead)) {
              violations.push(
                `${file}:${i + 1} — async () => references ctx without destructuring`
              );
            }
          }
          // Also check async ({ input }) => that uses ctx
          if (
            /\.(query|mutation)\(\s*async\s*\(\{\s*input\s*\}\)\s*=>/.test(line)
          ) {
            const lookAhead = getBoundedLookAhead(lines, i);
            if (/\bctx\./.test(lookAhead)) {
              violations.push(
                `${file}:${i + 1} — async ({ input }) => references ctx without destructuring`
              );
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe("org scoping — entity routers must use orgScopedProcedure", () => {
    it("entity-scoped routers should not use protectedProcedure for data operations", () => {
      const violations: string[] = [];

      for (const file of getRouterFiles()) {
        if (PLATFORM_ROUTERS.has(file)) continue;

        const content = readRouterContent(file);
        // Check if protectedProcedure is used in actual procedure definitions (not imports)
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("import")) continue;
          if (line.includes("const") && line.includes("protectedProcedure.use")) continue;
          if (/protectedProcedure\.(query|mutation|input)/.test(line)) {
            violations.push(
              `${file}:${i + 1} — uses protectedProcedure instead of orgScopedProcedure`
            );
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe("import hygiene — no unused procedure imports", () => {
    it("should not import protectedProcedure in entity-scoped routers that don't use it", () => {
      const violations: string[] = [];

      for (const file of getRouterFiles()) {
        if (PLATFORM_ROUTERS.has(file)) continue;

        const content = readRouterContent(file);
        const lines = content.split("\n");

        // Check if protectedProcedure is imported
        const hasImport = lines.some(
          (l) => l.includes("import") && l.includes("protectedProcedure")
        );
        if (!hasImport) continue;

        // Check if it's actually used outside of imports
        const usedOutsideImport = lines.some(
          (l) =>
            !l.includes("import") &&
            l.includes("protectedProcedure")
        );

        if (!usedOutsideImport) {
          violations.push(
            `${file} — imports protectedProcedure but doesn't use it`
          );
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe("helper module org threading", () => {
    it("analytics helper functions should accept orgId parameter", () => {
      const analyticsPath = path.join(__dirname, "analytics.ts");
      const content = fs.readFileSync(analyticsPath, "utf-8");

      // All main export functions should accept orgId
      const exportFunctions = [
        "getDashboardMetrics",
        "getDailySummary",
        "getWeeklySummary",
      ];

      for (const fn of exportFunctions) {
        const fnRegex = new RegExp(
          `export\\s+async\\s+function\\s+${fn}\\([^)]*orgId`
        );
        expect(content).toMatch(fnRegex);
      }
    });

    it("askOmniScope helper functions should accept orgId parameter", () => {
      const askPath = path.join(__dirname, "askOmniScope.ts");
      const content = fs.readFileSync(askPath, "utf-8");

      const exportFunctions = [
        "askOmniScope",
        "chat",
        "findMeetingsByParticipant",
        "findMeetingsByOrganization",
      ];

      for (const fn of exportFunctions) {
        const fnRegex = new RegExp(
          `export\\s+async\\s+function\\s+${fn}\\([^)]*orgId`
        );
        expect(content).toMatch(fnRegex);
      }
    });

    it("reportExporter helper functions should accept orgId parameter", () => {
      const exporterPath = path.join(__dirname, "reportExporter.ts");
      const content = fs.readFileSync(exporterPath, "utf-8");

      const exportFunctions = [
        "exportDailySummaryMarkdown",
        "exportWeeklySummaryMarkdown",
        "exportCustomRangeMarkdown",
      ];

      for (const fn of exportFunctions) {
        const fnRegex = new RegExp(
          `export\\s+async\\s+function\\s+${fn}\\([^)]*orgId`
        );
        expect(content).toMatch(fnRegex);
      }
    });
  });

  describe("router file inventory", () => {
    it("should have all expected router files", () => {
      const files = getRouterFiles();
      const expectedMinimum = [
        "meetings.ts",
        "contacts.ts",
        "tasks.ts",
        "companies.ts",
        "triage.ts",
        "analytics.ts",
        "ask.ts",
      ];

      for (const expected of expectedMinimum) {
        expect(files).toContain(expected);
      }
    });
  });
});
