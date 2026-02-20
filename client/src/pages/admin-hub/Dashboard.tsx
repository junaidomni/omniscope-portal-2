/**
 * Super Admin Dashboard — Cross-org overview with aggregated metrics.
 * Apple/Tesla design: generous whitespace, confident typography,
 * minimal borders, soft shadows, data-forward layout.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import {
  Building2,
  Users,
  Calendar,
  CheckSquare,
  UserCircle,
  Briefcase,
  Plug,
  ToggleLeft,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Shield,
} from "lucide-react";
import { Link } from "wouter";

export default function AdminHubDashboard() {
  const { data, isLoading } = trpc.adminHub.dashboardOverview.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header skeleton */}
          <div className="space-y-2">
            <div className="h-8 w-64 rounded-lg animate-pulse" style={{ background: cardBg }} />
            <div className="h-4 w-96 rounded-lg animate-pulse" style={{ background: cardBg }} />
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const d = data!;

  // Metric cards data
  const metrics = [
    {
      label: "Organizations",
      value: d.organizations.total,
      sub: `${d.organizations.active} active`,
      icon: Building2,
      href: "/admin-hub/organizations",
      color: accentColor,
    },
    {
      label: "Team Members",
      value: d.users.total,
      sub: "across all orgs",
      icon: Users,
      href: "/admin-hub/people",
      color: "#6366f1",
    },
    {
      label: "Meetings",
      value: d.meetings.total,
      sub: "total recorded",
      icon: Calendar,
      href: null,
      color: "#0ea5e9",
    },
    {
      label: "Tasks",
      value: d.tasks.total,
      sub: "total tracked",
      icon: CheckSquare,
      href: null,
      color: "#10b981",
    },
    {
      label: "Contacts",
      value: d.contacts.total,
      sub: "in CRM",
      icon: UserCircle,
      href: null,
      color: "#f59e0b",
    },
    {
      label: "Companies",
      value: d.companies.total,
      sub: "tracked",
      icon: Briefcase,
      href: null,
      color: "#8b5cf6",
    },
    {
      label: "Integrations",
      value: d.integrations.connected,
      sub: `${d.integrations.total} configured`,
      icon: Plug,
      href: "/admin-hub/integrations",
      color: "#ec4899",
    },
    {
      label: "Feature Flags",
      value: d.features.enabled,
      sub: `of ${d.features.total} total`,
      icon: ToggleLeft,
      href: "/admin-hub/features",
      color: "#14b8a6",
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ─── Header ─── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
                  border: `1px solid ${accentColor}33`,
                }}
              >
                <Shield className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
                Platform Overview
              </h1>
            </div>
            <p className="text-sm mt-1" style={{ color: textSecondary }}>
              Cross-organization metrics and platform health at a glance.
            </p>
          </div>
          {d.account && (
            <div
              className="px-4 py-2 rounded-xl text-xs font-medium"
              style={{
                background: `${accentColor}15`,
                color: accentColor,
                border: `1px solid ${accentColor}25`,
              }}
            >
              {d.account.plan.charAt(0).toUpperCase() + d.account.plan.slice(1)} Plan
            </div>
          )}
        </div>

        {/* ─── Activity Banner ─── */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}15)`,
            border: `1px solid ${accentColor}20`,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}20` }}
            >
              <Activity className="h-6 w-6" style={{ color: accentColor }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: textPrimary }}>
                {d.activity.last7Days.toLocaleString()} actions in the last 7 days
              </p>
              <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
                Platform activity across all organizations and users
              </p>
            </div>
          </div>
          <Link href="/admin-hub/audit">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                color: accentColor,
                background: `${accentColor}10`,
                border: `1px solid ${accentColor}20`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${accentColor}20`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${accentColor}10`; }}
            >
              View Audit Log
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </Link>
        </div>

        {/* ─── Metrics Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            const content = (
              <div
                className="rounded-2xl p-5 transition-all duration-200 group cursor-pointer"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${m.color}33`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = `0 8px 24px ${m.color}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = cardBorder;
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${m.color}15`,
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: m.color }} />
                  </div>
                  {m.href && (
                    <ArrowUpRight
                      className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ color: textMuted }}
                    />
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
                  {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
                </p>
                <p className="text-xs mt-1" style={{ color: textMuted }}>
                  {m.label}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                  {m.sub}
                </p>
              </div>
            );

            if (m.href) {
              return (
                <Link key={m.label} href={m.href}>
                  {content}
                </Link>
              );
            }
            return <div key={m.label}>{content}</div>;
          })}
        </div>

        {/* ─── Organizations List ─── */}
        {d.organizations.list.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight" style={{ color: textPrimary }}>
                Organizations
              </h2>
              <Link href="/admin-hub/organizations">
                <button
                  className="text-xs font-medium flex items-center gap-1 transition-colors duration-200"
                  style={{ color: accentColor }}
                >
                  View All <ArrowUpRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {d.organizations.list.slice(0, 6).map((org) => (
                <div
                  key={org.id}
                  className="rounded-2xl p-5 transition-all duration-200"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${accentColor}33`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = cardBorder;
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                        style={{
                          background: `${org.accentColor || accentColor}20`,
                          color: org.accentColor || accentColor,
                        }}
                      >
                        {org.name
                          .split(/[\s-]+/)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: textPrimary }}>
                        {org.name}
                      </p>
                      <p className="text-[11px]" style={{ color: textMuted }}>
                        {org.industry || org.slug}
                      </p>
                    </div>
                    <div
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        background:
                          org.status === "active"
                            ? isLightTheme
                              ? "rgba(16,185,129,0.1)"
                              : "rgba(16,185,129,0.15)"
                            : isLightTheme
                            ? "rgba(239,68,68,0.1)"
                            : "rgba(239,68,68,0.15)",
                        color: org.status === "active" ? "#10b981" : "#ef4444",
                      }}
                    >
                      {org.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Quick Actions ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Manage Integrations",
              desc: "Configure API keys and third-party connections",
              icon: Plug,
              href: "/admin-hub/integrations",
            },
            {
              title: "Feature Flags",
              desc: "Toggle features across all organizations",
              icon: ToggleLeft,
              href: "/admin-hub/features",
            },
            {
              title: "Platform Health",
              desc: "Monitor system status and integration health",
              icon: Activity,
              href: "/admin-hub/health",
            },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href}>
                <div
                  className="rounded-2xl p-5 transition-all duration-200 cursor-pointer group"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${accentColor}33`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = cardBorder;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${accentColor}15` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: accentColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: textPrimary }}>
                        {action.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                        {action.desc}
                      </p>
                    </div>
                    <ArrowUpRight
                      className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0"
                      style={{ color: textMuted }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
