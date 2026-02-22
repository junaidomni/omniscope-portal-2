/**
 * Platform Audit Log Service
 * 
 * Logs every significant action across the platform for compliance,
 * security monitoring, and platform owner visibility.
 */
import { platformAuditLog } from "../drizzle/schema";
import { desc, eq, and, gte, lte, like, sql, or } from "drizzle-orm";
import { getDb } from "./db";

// ============================================================================
// Types
// ============================================================================

export type AuditAction =
  | "create" | "update" | "delete" | "bulk_delete" | "bulk_update"
  | "login" | "logout"
  | "plan_change" | "account_create" | "account_suspend" | "account_activate"
  | "role_change" | "member_invite" | "member_remove"
  | "org_create" | "org_archive"
  | "platform_owner_grant" | "platform_owner_revoke"
  | "account_switch" | "export" | "import";

export type AuditEntityType =
  | "contact" | "meeting" | "task" | "employee" | "payroll"
  | "document" | "tag" | "company"
  | "user" | "organization" | "account" | "membership"
  | "signing_envelope" | "signing_provider"
  | "system";

export interface AuditLogContext {
  userId?: number;
  userName?: string;
  userEmail?: string;
  accountId?: number;
  accountName?: string;
  orgId?: number;
  orgName?: string;
  ipAddress?: string;
}

export interface AuditLogEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Core Logging Function
// ============================================================================

/**
 * Log an action to the platform audit log.
 * This is fire-and-forget — it should never block the main operation.
 */
export async function logAuditEvent(
  ctx: AuditLogContext,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const database = await getDb();
    await database.insert(platformAuditLog).values({
      userId: ctx.userId ?? null,
      userName: ctx.userName ?? null,
      userEmail: ctx.userEmail ?? null,
      accountId: ctx.accountId ?? null,
      accountName: ctx.accountName ?? null,
      orgId: ctx.orgId ?? null,
      orgName: ctx.orgName ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ipAddress: ctx.ipAddress ?? null,
    });
  } catch (err) {
    // Never let audit logging break the main operation
    console.error("[AuditLog] Failed to log event:", err);
  }
}

// ============================================================================
// Query Functions
// ============================================================================

export interface AuditLogFilters {
  userId?: number;
  accountId?: number;
  orgId?: number;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query audit log entries with filters.
 * Only accessible to platform owners.
 */
export async function queryAuditLog(filters: AuditLogFilters) {
  const conditions = [];

  if (filters.userId) {
    conditions.push(eq(platformAuditLog.userId, filters.userId));
  }
  if (filters.accountId) {
    conditions.push(eq(platformAuditLog.accountId, filters.accountId));
  }
  if (filters.orgId) {
    conditions.push(eq(platformAuditLog.orgId, filters.orgId));
  }
  if (filters.action) {
    conditions.push(eq(platformAuditLog.action, filters.action));
  }
  if (filters.entityType) {
    conditions.push(eq(platformAuditLog.entityType, filters.entityType));
  }
  if (filters.startDate) {
    conditions.push(gte(platformAuditLog.timestamp, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(platformAuditLog.timestamp, filters.endDate));
  }
  if (filters.search) {
    conditions.push(
      or(
        like(platformAuditLog.userName, `%${filters.search}%`),
        like(platformAuditLog.userEmail, `%${filters.search}%`),
        like(platformAuditLog.orgName, `%${filters.search}%`),
        like(platformAuditLog.accountName, `%${filters.search}%`),
        like(platformAuditLog.details, `%${filters.search}%`)
      )
    );
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const database = await getDb();
  const [entries, countResult] = await Promise.all([
    database
      .select()
      .from(platformAuditLog)
      .where(whereClause)
      .orderBy(desc(platformAuditLog.timestamp))
      .limit(limit)
      .offset(offset),
    database
      .select({ count: sql<number>`count(*)` })
      .from(platformAuditLog)
      .where(whereClause),
  ]);

  return {
    entries,
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

/**
 * Get audit log summary stats for the platform overview.
 */
export async function getAuditLogStats() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const database = await getDb();
  const [totalResult, dayResult, weekResult, actionBreakdown] = await Promise.all([
    database.select({ count: sql<number>`count(*)` }).from(platformAuditLog),
    database.select({ count: sql<number>`count(*)` }).from(platformAuditLog)
      .where(gte(platformAuditLog.timestamp, oneDayAgo)),
    database.select({ count: sql<number>`count(*)` }).from(platformAuditLog)
      .where(gte(platformAuditLog.timestamp, oneWeekAgo)),
    database.select({
      action: platformAuditLog.action,
      count: sql<number>`count(*)`,
    })
      .from(platformAuditLog)
      .where(gte(platformAuditLog.timestamp, oneWeekAgo))
      .groupBy(platformAuditLog.action)
      .orderBy(desc(sql`count(*)`))      .limit(10),
  ]);;

  return {
    totalEvents: totalResult[0]?.count ?? 0,
    eventsLast24h: dayResult[0]?.count ?? 0,
    eventsLast7d: weekResult[0]?.count ?? 0,
    topActions: actionBreakdown,
  };
}

/**
 * Export audit log entries as CSV string.
 */
export async function exportAuditLogCSV(filters: AuditLogFilters): Promise<string> {
  const result = await queryAuditLog({ ...filters, limit: 10000, offset: 0 });
  
  const headers = [
    "Timestamp", "User", "Email", "Account", "Organization",
    "Action", "Entity Type", "Entity ID", "Details", "IP Address"
  ];
  
  const rows = result.entries.map(entry => [
    entry.timestamp?.toISOString() ?? "",
    entry.userName ?? "",
    entry.userEmail ?? "",
    entry.accountName ?? "",
    entry.orgName ?? "",
    entry.action,
    entry.entityType ?? "",
    entry.entityId?.toString() ?? "",
    entry.details ?? "",
    entry.ipAddress ?? "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

  return [headers.join(","), ...rows].join("\n");
}
