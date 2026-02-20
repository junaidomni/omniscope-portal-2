/**
 * Admin Hub — Analytics
 * Platform-wide usage analytics overview.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { BarChart3, TrendingUp, Calendar, CheckSquare, UserCircle, Briefcase } from "lucide-react";

export default function AdminHubAnalytics() {
  const { data } = trpc.adminHub.dashboardOverview.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  const stats = data
    ? [
        { label: "Meetings Recorded", value: data.meetings.total, icon: Calendar, color: "#0ea5e9" },
        { label: "Tasks Tracked", value: data.tasks.total, icon: CheckSquare, color: "#10b981" },
        { label: "Contacts in CRM", value: data.contacts.total, icon: UserCircle, color: "#f59e0b" },
        { label: "Companies Tracked", value: data.companies.total, icon: Briefcase, color: "#8b5cf6" },
        { label: "7-Day Activity", value: data.activity.last7Days, icon: TrendingUp, color: accentColor },
      ]
    : [];

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Platform-wide usage metrics and trends.
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-2xl p-6 transition-all duration-200"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${s.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: textMuted }}>
                    {s.label}
                  </span>
                </div>
                <p className="text-3xl font-bold tracking-tight" style={{ color: textPrimary }}>
                  {s.value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Placeholder for future charts */}
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <BarChart3 className="h-12 w-12 mx-auto mb-3" style={{ color: textMuted }} />
          <p className="text-sm font-medium" style={{ color: textSecondary }}>
            Advanced analytics and trend charts coming soon.
          </p>
          <p className="text-xs mt-1" style={{ color: textMuted }}>
            Historical data is being collected. Visualizations will appear here as data accumulates.
          </p>
        </div>
      </div>
    </div>
  );
}
