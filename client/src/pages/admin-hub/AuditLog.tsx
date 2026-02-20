/**
 * Admin Hub — Audit Log
 * Cross-org activity trail with filtering.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { ScrollText, User, Clock, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";

export default function AdminHubAuditLog() {
  const [offset, setOffset] = useState(0);
  const limit = 30;
  const stableInput = useMemo(() => ({ limit, offset }), [offset]);
  const { data, isLoading } = trpc.adminHub.getAuditLog.useQuery(stableInput);
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const actionColors: Record<string, string> = {
    create: "#10b981",
    update: "#0ea5e9",
    delete: "#ef4444",
    login: "#6366f1",
    import: "#f59e0b",
    sync: "#8b5cf6",
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
              Audit Log
            </h1>
            <p className="text-sm mt-1" style={{ color: textSecondary }}>
              Platform-wide activity trail. {total.toLocaleString()} total events.
            </p>
          </div>
        </div>

        {/* Log List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText className="h-12 w-12 mx-auto mb-3" style={{ color: textMuted }} />
            <p className="text-sm" style={{ color: textSecondary }}>No activity recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const actionColor = Object.entries(actionColors).find(([k]) =>
                log.action.toLowerCase().includes(k)
              )?.[1] || textMuted;

              return (
                <div
                  key={log.id}
                  className="rounded-xl px-4 py-3 transition-all duration-200 flex items-center gap-4"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                >
                  {/* Action badge */}
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-medium shrink-0 min-w-[80px] text-center"
                    style={{ background: `${actionColor}15`, color: actionColor }}
                  >
                    {log.action}
                  </div>

                  {/* Entity */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: textPrimary }}>
                      {log.entityName || `${log.entityType} #${log.entityId}`}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: textMuted }}>
                      {log.entityType}
                      {log.details ? ` — ${typeof log.details === "string" ? log.details : JSON.stringify(log.details).slice(0, 80)}` : ""}
                    </p>
                  </div>

                  {/* User */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <User className="h-3 w-3" style={{ color: textMuted }} />
                    <span className="text-xs" style={{ color: textSecondary }}>
                      {log.userName || `User #${log.userId}`}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" style={{ color: textMuted }} />
                    <span className="text-[11px] font-mono" style={{ color: textMuted }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
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
            <span className="text-xs" style={{ color: textMuted }}>
              Page {currentPage} of {totalPages}
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
