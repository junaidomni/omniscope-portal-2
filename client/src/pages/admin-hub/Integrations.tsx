/**
 * Admin Hub — Integrations & API Keys
 * Cross-org integration status matrix.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { Plug, CheckCircle2, XCircle, AlertTriangle, Clock, ExternalLink } from "lucide-react";

export default function AdminHubIntegrations() {
  const { data: integrations, isLoading } = trpc.adminHub.listAllIntegrations.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    connected: { icon: CheckCircle2, color: "#10b981", label: "Connected" },
    disconnected: { icon: XCircle, color: "#64748b", label: "Disconnected" },
    error: { icon: AlertTriangle, color: "#ef4444", label: "Error" },
    pending: { icon: Clock, color: "#f59e0b", label: "Pending" },
  };

  const connected = (integrations ?? []).filter((i) => i.status === "connected");
  const other = (integrations ?? []).filter((i) => i.status !== "connected");

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Integrations & API Keys
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Platform-wide integration status and configuration.
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
            <span className="text-sm" style={{ color: textPrimary }}>
              {connected.length} connected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" style={{ color: "#64748b" }} />
            <span className="text-sm" style={{ color: textSecondary }}>
              {other.length} inactive
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        ) : (
          <>
            {/* Connected */}
            {connected.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                  Active Integrations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {connected.map((integration) => {
                    const sc = statusConfig[integration.status] || statusConfig.disconnected;
                    const StatusIcon = sc.icon;
                    return (
                      <div
                        key={integration.id}
                        className="rounded-2xl p-4 transition-all duration-200"
                        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${sc.color}33`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
                      >
                        <div className="flex items-center gap-3">
                          {integration.iconUrl ? (
                            <img src={integration.iconUrl} alt="" className="w-10 h-10 rounded-xl object-contain" />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ background: `${accentColor}15` }}
                            >
                              <Plug className="h-5 w-5" style={{ color: accentColor }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: textPrimary }}>
                              {integration.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <StatusIcon className="h-3 w-3" style={{ color: sc.color }} />
                              <span className="text-[11px]" style={{ color: sc.color }}>
                                {sc.label}
                              </span>
                              {integration.lastSyncAt && (
                                <span className="text-[10px]" style={{ color: textMuted }}>
                                  Last sync: {new Date(integration.lastSyncAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inactive */}
            {other.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                  Available Integrations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {other.map((integration) => {
                    const sc = statusConfig[integration.status] || statusConfig.disconnected;
                    const StatusIcon = sc.icon;
                    return (
                      <div
                        key={integration.id}
                        className="rounded-2xl p-4 transition-all duration-200 opacity-70"
                        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                      >
                        <div className="flex items-center gap-3">
                          {integration.iconUrl ? (
                            <img src={integration.iconUrl} alt="" className="w-10 h-10 rounded-xl object-contain grayscale" />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ background: `${accentColor}08` }}
                            >
                              <Plug className="h-5 w-5" style={{ color: textMuted }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: textSecondary }}>
                              {integration.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <StatusIcon className="h-3 w-3" style={{ color: sc.color }} />
                              <span className="text-[11px]" style={{ color: sc.color }}>
                                {sc.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
