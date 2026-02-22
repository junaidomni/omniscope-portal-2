/**
 * Admin Hub — Platform Audit Log
 * Comprehensive cross-org activity trail with filtering, search, stats, and export.
 * Only visible to Platform Owners.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import {
  ScrollText, User, Clock, Filter, ChevronLeft, ChevronRight,
  Search, Download, Shield, Activity, BarChart3, X, AlertTriangle
} from "lucide-react";
import { useState, useMemo } from "react";

const ACTION_COLORS: Record<string, string> = {
  create: "#10b981",
  update: "#0ea5e9",
  delete: "#ef4444",
  bulk_delete: "#ef4444",
  bulk_update: "#f59e0b",
  login: "#6366f1",
  logout: "#8b5cf6",
  plan_change: "#f59e0b",
  account_create: "#10b981",
  account_suspend: "#ef4444",
  account_activate: "#10b981",
  role_change: "#f59e0b",
  member_invite: "#6366f1",
  member_remove: "#ef4444",
  org_create: "#10b981",
  org_archive: "#ef4444",
  platform_owner_grant: "#f59e0b",
  platform_owner_revoke: "#ef4444",
  account_switch: "#8b5cf6",
  export: "#0ea5e9",
  import: "#f59e0b",
  sync: "#8b5cf6",
};

const ENTITY_TYPES = [
  "contact", "meeting", "task", "employee", "payroll",
  "document", "company", "user", "organization", "account",
  "membership", "system",
];

const ACTION_TYPES = [
  "create", "update", "delete", "bulk_delete", "bulk_update",
  "login", "logout", "plan_change", "account_create",
  "role_change", "member_invite", "member_remove",
  "org_create", "platform_owner_grant", "platform_owner_revoke",
  "account_switch", "export", "import",
];

export default function AdminHubAuditLog() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const limit = 30;

  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const inputBg = isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)";

  const stableInput = useMemo(() => ({
    limit,
    offset,
    search: search || undefined,
    action: actionFilter || undefined,
    entityType: entityFilter || undefined,
  }), [offset, search, actionFilter, entityFilter]);

  const { data, isLoading } = trpc.admin.auditLog.useQuery(stableInput);
  const { data: stats } = trpc.admin.auditLogStats.useQuery();

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const hasFilters = search || actionFilter || entityFilter;

  const clearFilters = () => {
    setSearch("");
    setActionFilter("");
    setEntityFilter("");
    setOffset(0);
  };

  const handleExport = async () => {
    // Trigger CSV download
    const csvData = entries.map(e => [
      e.timestamp ? new Date(e.timestamp).toISOString() : "",
      e.userName ?? "",
      e.userEmail ?? "",
      e.accountName ?? "",
      e.orgName ?? "",
      e.action,
      e.entityType ?? "",
      e.entityId?.toString() ?? "",
      e.details ?? "",
    ].join(",")).join("\n");
    
    const headers = "Timestamp,User,Email,Account,Organization,Action,Entity Type,Entity ID,Details";
    const blob = new Blob([headers + "\n" + csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ background: `${accentColor}15` }}>
                <Shield className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
                  Platform Audit Log
                </h1>
                <p className="text-sm mt-0.5" style={{ color: textSecondary }}>
                  Cross-organization security and compliance trail
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
            style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4" style={{ color: "#10b981" }} />
                <span className="text-xs font-medium" style={{ color: textSecondary }}>Last 24 Hours</span>
              </div>
              <p className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
                {stats.eventsLast24h.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4" style={{ color: "#0ea5e9" }} />
                <span className="text-xs font-medium" style={{ color: textSecondary }}>Last 7 Days</span>
              </div>
              <p className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
                {stats.eventsLast7d.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-2 mb-2">
                <ScrollText className="h-4 w-4" style={{ color: accentColor }} />
                <span className="text-xs font-medium" style={{ color: textSecondary }}>Total Events</span>
              </div>
              <p className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
                {stats.totalEvents.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: textMuted }} />
              <input
                type="text"
                placeholder="Search by user, email, org, account, or details..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
              />
            </div>
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
              style={{
                background: showFilters ? `${accentColor}15` : inputBg,
                border: `1px solid ${showFilters ? accentColor : cardBorder}`,
                color: showFilters ? accentColor : textSecondary,
              }}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasFilters && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: accentColor, color: "#000" }}>
                  {[actionFilter, entityFilter].filter(Boolean).length}
                </span>
              )}
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
                style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          {showFilters && (
            <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: inputBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex-1">
                <label className="text-[11px] font-medium mb-1 block" style={{ color: textMuted }}>Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
                >
                  <option value="">All Actions</option>
                  {ACTION_TYPES.map(a => (
                    <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-medium mb-1 block" style={{ color: textMuted }}>Entity Type</label>
                <select
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setOffset(0); }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
                >
                  <option value="">All Entities</option>
                  {ENTITY_TYPES.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Log List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText className="h-12 w-12 mx-auto mb-3" style={{ color: textMuted }} />
            <p className="text-sm" style={{ color: textSecondary }}>
              {hasFilters ? "No events match your filters." : "No activity recorded yet."}
            </p>
            <p className="text-xs mt-1" style={{ color: textMuted }}>
              {hasFilters ? "Try adjusting your search or filters." : "Events will appear here as users interact with the platform."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => {
              const actionColor = Object.entries(ACTION_COLORS).find(([k]) =>
                entry.action.toLowerCase().includes(k)
              )?.[1] || textMuted;

              let parsedDetails: Record<string, unknown> | null = null;
              try {
                if (entry.details) {
                  parsedDetails = typeof entry.details === "string" ? JSON.parse(entry.details) : entry.details;
                }
              } catch { /* ignore */ }

              return (
                <div
                  key={entry.id}
                  className="rounded-xl px-4 py-3 transition-all duration-200 flex items-center gap-4 hover:scale-[1.002]"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                >
                  {/* Action badge */}
                  <div
                    className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold shrink-0 min-w-[100px] text-center uppercase tracking-wider"
                    style={{ background: `${actionColor}15`, color: actionColor }}
                  >
                    {entry.action.replace(/_/g, " ")}
                  </div>

                  {/* Entity & Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: textPrimary }}>
                      {entry.entityType ? (
                        <span>
                          <span className="font-medium capitalize">{entry.entityType}</span>
                          {entry.entityId ? <span className="font-mono text-xs" style={{ color: textMuted }}> #{entry.entityId}</span> : null}
                        </span>
                      ) : "System Event"}
                    </p>
                    {parsedDetails && (
                      <p className="text-[11px] truncate mt-0.5" style={{ color: textMuted }}>
                        {Object.entries(parsedDetails).map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 120)}
                      </p>
                    )}
                  </div>

                  {/* Org */}
                  {entry.orgName && (
                    <div className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: `${accentColor}10`, color: accentColor }}>
                      {entry.orgName}
                    </div>
                  )}

                  {/* User */}
                  <div className="flex items-center gap-1.5 shrink-0 min-w-[120px]">
                    <User className="h-3 w-3" style={{ color: textMuted }} />
                    <span className="text-xs truncate" style={{ color: textSecondary }}>
                      {entry.userName || entry.userEmail || `User #${entry.userId}`}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" style={{ color: textMuted }} />
                    <span className="text-[11px] font-mono" style={{ color: textMuted }}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-mono" style={{ color: textMuted }}>
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()} events
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="p-1.5 rounded-lg transition-all duration-200 disabled:opacity-30"
                style={{ color: textSecondary, border: `1px solid ${cardBorder}` }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono px-2" style={{ color: textSecondary }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="p-1.5 rounded-lg transition-all duration-200 disabled:opacity-30"
                style={{ color: textSecondary, border: `1px solid ${cardBorder}` }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
