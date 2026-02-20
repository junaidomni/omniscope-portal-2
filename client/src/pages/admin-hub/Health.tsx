/**
 * Admin Hub — Platform Health
 * System status, integration health, entity counts.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { Activity, CheckCircle2, XCircle, AlertTriangle, Database, RefreshCw } from "lucide-react";
import { useState } from "react";

export default function AdminHubHealth() {
  const { data, isLoading, refetch } = trpc.adminHub.platformHealth.useQuery();
  const { accentColor, isLightTheme } = useDesign();
  const [refreshing, setRefreshing] = useState(false);

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  const statusColor = (status: string) => {
    if (status === "connected") return "#10b981";
    if (status === "error") return "#ef4444";
    return "#64748b";
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "connected") return <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />;
    if (status === "error") return <AlertTriangle className="h-4 w-4" style={{ color: "#ef4444" }} />;
    return <XCircle className="h-4 w-4" style={{ color: "#64748b" }} />;
  };

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
              Platform Health
            </h1>
            <p className="text-sm mt-1" style={{ color: textSecondary }}>
              System status and integration health monitoring.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200"
            style={{ background: `${accentColor}10`, color: accentColor, border: `1px solid ${accentColor}20` }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Overall Status */}
            <div
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{
                background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}15)`,
                border: `1px solid ${accentColor}20`,
              }}
            >
              <Activity className="h-8 w-8" style={{ color: accentColor }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                  System Operational
                </p>
                <p className="text-xs" style={{ color: textMuted }}>
                  Last checked: {new Date(data.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Entity Counts */}
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <Database className="h-4 w-4" style={{ color: accentColor }} />
                Data Entities
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(data.entities).map(([key, val]) => (
                  <div
                    key={key}
                    className="rounded-xl p-4"
                    style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                  >
                    <p className="text-xl font-bold" style={{ color: textPrimary }}>
                      {(val as number).toLocaleString()}
                    </p>
                    <p className="text-xs capitalize mt-0.5" style={{ color: textMuted }}>
                      {key}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Integration Health */}
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                Integration Health
              </h2>
              {data.integrations.length === 0 ? (
                <p className="text-sm" style={{ color: textMuted }}>No enabled integrations.</p>
              ) : (
                <div className="space-y-2">
                  {data.integrations.map((int, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3 flex items-center gap-3"
                      style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                    >
                      {int.iconUrl ? (
                        <img src={int.iconUrl} alt="" className="w-8 h-8 rounded-lg object-contain" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: `${statusColor(int.status)}15` }}
                        >
                          <StatusIcon status={int.status} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: textPrimary }}>
                          {int.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={int.status} />
                        <span className="text-xs capitalize" style={{ color: statusColor(int.status) }}>
                          {int.status}
                        </span>
                      </div>
                      {int.lastSyncAt && (
                        <span className="text-[10px]" style={{ color: textMuted }}>
                          {new Date(int.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
