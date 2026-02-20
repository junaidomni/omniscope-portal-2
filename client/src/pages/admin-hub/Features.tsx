/**
 * Admin Hub — Feature Flags
 * Toggle features across all organizations.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { ToggleLeft, ToggleRight, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminHubFeatures() {
  const { data: features, isLoading, refetch } = trpc.adminHub.listAllFeatureToggles.useQuery();
  const toggleMutation = trpc.adminHub.toggleFeature.useMutation({
    onSuccess: () => { refetch(); toast.success("Feature flag updated"); },
    onError: () => toast.error("Failed to update feature flag"),
  });
  const { accentColor, isLightTheme } = useDesign();
  const [search, setSearch] = useState("");

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const inputBg = isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)";

  const filtered = (features ?? []).filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = (features ?? []).filter((f) => f.enabled).length;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Feature Flags
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Toggle features across the entire platform. Changes apply to all organizations.
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ToggleRight className="h-4 w-4" style={{ color: "#10b981" }} />
            <span className="text-sm" style={{ color: textPrimary }}>
              {enabledCount} enabled
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ToggleLeft className="h-4 w-4" style={{ color: "#64748b" }} />
            <span className="text-sm" style={{ color: textSecondary }}>
              {(features ?? []).length - enabledCount} disabled
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: textMuted }} />
          <input
            type="text"
            placeholder="Search features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
            onFocus={(e) => { e.currentTarget.style.borderColor = `${accentColor}44`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
          />
        </div>

        {/* Feature List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((feature) => (
              <div
                key={feature.id}
                className="rounded-2xl p-4 transition-all duration-200 flex items-center gap-4"
                style={{
                  background: cardBg,
                  border: `1px solid ${feature.enabled ? `${accentColor}22` : cardBorder}`,
                }}
              >
                {/* Icon */}
                {feature.iconUrl ? (
                  <img src={feature.iconUrl} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: feature.enabled ? `${accentColor}15` : `${textMuted}15`,
                    }}
                  >
                    {feature.enabled ? (
                      <ToggleRight className="h-4 w-4" style={{ color: accentColor }} />
                    ) : (
                      <ToggleLeft className="h-4 w-4" style={{ color: textMuted }} />
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: textPrimary }}>
                    {feature.name}
                  </p>
                  {feature.description && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: textMuted }}>
                      {feature.description}
                    </p>
                  )}
                </div>

                {/* Category */}
                {feature.category && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                    style={{ background: `${accentColor}10`, color: textSecondary }}
                  >
                    {feature.category}
                  </span>
                )}

                {/* Toggle */}
                <button
                  onClick={() => toggleMutation.mutate({ id: feature.id, enabled: !feature.enabled })}
                  disabled={toggleMutation.isPending}
                  className="relative w-11 h-6 rounded-full transition-all duration-300 shrink-0"
                  style={{
                    background: feature.enabled ? accentColor : isLightTheme ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)",
                  }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 shadow-sm"
                    style={{
                      left: feature.enabled ? "22px" : "2px",
                      background: isLightTheme ? "#fff" : "#1a1a1a",
                    }}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
