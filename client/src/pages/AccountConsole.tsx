/**
 * Account Console
 * 
 * The Account Owner's management dashboard. Shows all organizations,
 * team members, billing, and usage across the entire account.
 * Clean, institutional, Tesla/Apple-grade design.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Building2, Users, CreditCard, BarChart3, Settings, ChevronRight,
  Crown, Shield, Globe, ArrowLeft, Plus, UserPlus, Mail, Clock,
  CheckCircle2, AlertCircle, TrendingUp, Layers, FileText, Briefcase
} from "lucide-react";

type TabId = "overview" | "organizations" | "team" | "billing" | "usage" | "settings";

const PLAN_COLORS: Record<string, string> = {
  starter: "#6b7280",
  professional: "#0ea5e9",
  enterprise: "#8b5cf6",
  sovereign: "#d4a017",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
  sovereign: "Sovereign",
};

export default function AccountConsole() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { accentColor, isLightTheme } = useDesign();
  const { user } = useAuth();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const surfaceBg = isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)";

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "Overview", icon: <Layers className="h-4 w-4" /> },
    { id: "organizations", label: "Organizations", icon: <Building2 className="h-4 w-4" /> },
    { id: "team", label: "Team", icon: <Users className="h-4 w-4" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
    { id: "usage", label: "Usage", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: isLightTheme ? "#f8f9fa" : "#0a0a0a" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: cardBorder, background: isLightTheme ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.02)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <button className="p-2 rounded-lg transition-all duration-200 hover:scale-105" style={{ color: textSecondary }}>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: textPrimary }}>
                  Account Console
                </h1>
                <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                  Manage your account, organizations, and team
                </p>
              </div>
            </div>
            {user?.platformOwner && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}>
                <Crown className="h-3.5 w-3.5" style={{ color: "#d4a017" }} />
                <span className="text-xs font-semibold" style={{ color: "#d4a017" }}>Platform Owner</span>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200"
                style={{
                  color: activeTab === tab.id ? accentColor : textSecondary,
                  background: activeTab === tab.id ? cardBg : "transparent",
                  borderBottom: activeTab === tab.id ? `2px solid ${accentColor}` : "2px solid transparent",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "organizations" && <OrganizationsTab />}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "usage" && <UsageTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================
function OverviewTab() {
  const { data, isLoading } = trpc.accountConsole.overview.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: cardBg }} />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const planColor = PLAN_COLORS[data.account.plan] || accentColor;

  return (
    <div className="space-y-6">
      {/* Account Header Card */}
      <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: `${planColor}15`, color: planColor }}>
              {data.account.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: textPrimary }}>{data.account.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${planColor}15`, color: planColor }}>
                  {PLAN_LABELS[data.account.plan] || data.account.plan} Plan
                </span>
                <span className="flex items-center gap-1 text-xs" style={{ color: textMuted }}>
                  <CheckCircle2 className="h-3 w-3" style={{ color: "#10b981" }} />
                  {data.account.status === "active" ? "Active" : data.account.status}
                </span>
              </div>
            </div>
          </div>
          {data.account.healthScore !== null && (
            <div className="text-right">
              <p className="text-xs font-medium" style={{ color: textMuted }}>Health Score</p>
              <p className="text-2xl font-bold font-mono" style={{ color: (data.account.healthScore ?? 0) >= 80 ? "#10b981" : (data.account.healthScore ?? 0) >= 50 ? "#f59e0b" : "#ef4444" }}>
                {data.account.healthScore}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Organizations"
          value={data.totalOrgs.toString()}
          limit={data.limits?.maxOrganizations === -1 ? "Unlimited" : `/ ${data.limits?.maxOrganizations}`}
          color="#0ea5e9"
          isLightTheme={isLightTheme}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Team Members"
          value={data.totalMembers.toString()}
          limit={data.limits?.maxUsersPerOrg === -1 ? "Unlimited" : `/ ${data.limits?.maxUsersPerOrg} per org`}
          color="#8b5cf6"
          isLightTheme={isLightTheme}
        />
        <StatCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Monthly Cost"
          value={data.account.mrrCents ? `$${(data.account.mrrCents / 100).toLocaleString()}` : "Custom"}
          limit="per month"
          color="#10b981"
          isLightTheme={isLightTheme}
        />
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          label="Plan Status"
          value={data.subscription?.status === "active" ? "Active" : "—"}
          limit={data.subscription?.currentPeriodEnd ? `Renews ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}` : ""}
          color={planColor}
          isLightTheme={isLightTheme}
        />
      </div>

      {/* Organizations Quick View */}
      <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>Organizations</h3>
          <Link href="/org/new">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-[1.02]" style={{ background: `${accentColor}15`, color: accentColor }}>
              <Plus className="h-3 w-3" />
              New Organization
            </button>
          </Link>
        </div>
        <div className="space-y-2">
          {data.organizations.map(org => (
            <div
              key={org.id}
              className="flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.002]"
              style={{ background: isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)", border: `1px solid ${cardBorder}` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${accentColor}15`, color: accentColor }}>
                  {org.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: textPrimary }}>{org.name}</p>
                  <p className="text-[11px]" style={{ color: textMuted }}>{org.memberCount} members</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: textMuted }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Organizations Tab
// ============================================================================
function OrganizationsTab() {
  const { data, isLoading } = trpc.accountConsole.organizations.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: cardBg }} />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: textPrimary }}>Your Organizations</h3>
        <Link href="/org/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02]" style={{ background: accentColor, color: "#000" }}>
            <Plus className="h-4 w-4" />
            New Organization
          </button>
        </Link>
      </div>

      {data?.map(org => (
        <div key={org.id} className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: `${accentColor}15`, color: accentColor }}>
                {org.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-semibold" style={{ color: textPrimary }}>{org.name}</h4>
                <p className="text-[11px]" style={{ color: textMuted }}>
                  {org.slug} · {org.industry || "No industry set"} · {org.memberCount} members
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
              background: org.status === "active" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
              color: org.status === "active" ? "#10b981" : "#f59e0b",
            }}>
              {org.status}
            </span>
          </div>

          {/* Members */}
          <div className="space-y-1.5">
            {org.members.slice(0, 5).map(m => (
              <div key={m.userId} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${accentColor}15`, color: accentColor }}>
                    {(m.userName || "?").charAt(0)}
                  </div>
                  <span className="text-xs" style={{ color: textPrimary }}>{m.userName || m.userEmail}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: `${accentColor}10`, color: accentColor }}>
                  {m.role.replace(/_/g, " ")}
                </span>
              </div>
            ))}
            {org.members.length > 5 && (
              <p className="text-[11px] text-center py-1" style={{ color: textMuted }}>
                +{org.members.length - 5} more members
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Team Tab
// ============================================================================
function TeamTab() {
  const { data, isLoading } = trpc.accountConsole.teamMembers.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: cardBg }} />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: textPrimary }}>Team Members</h3>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>{data?.length || 0} members across all organizations</p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3" style={{ background: isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)" }}>
          <div className="col-span-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Member</div>
          <div className="col-span-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Email</div>
          <div className="col-span-5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Organizations & Roles</div>
        </div>

        {/* Table Body */}
        {data?.map((member, idx) => (
          <div
            key={member.userId}
            className="grid grid-cols-12 gap-4 px-4 py-3 items-center transition-all duration-200"
            style={{
              background: idx % 2 === 0 ? cardBg : "transparent",
              borderTop: `1px solid ${cardBorder}`,
            }}
          >
            <div className="col-span-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${accentColor}15`, color: accentColor }}>
                {(member.userName || "?").charAt(0)}
              </div>
              <span className="text-sm font-medium truncate" style={{ color: textPrimary }}>
                {member.userName || "Unnamed User"}
              </span>
            </div>
            <div className="col-span-3">
              <span className="text-xs truncate" style={{ color: textSecondary }}>{member.userEmail}</span>
            </div>
            <div className="col-span-5 flex flex-wrap gap-1.5">
              {member.roles.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: `${accentColor}10`, color: accentColor }}>
                  {r.orgName} · {r.role.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Billing Tab
// ============================================================================
function BillingTab() {
  const { data, isLoading } = trpc.accountConsole.billingHistory.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: cardBg }} />)}</div>;
  }

  const planColor = PLAN_COLORS[data?.currentPlan || "starter"] || accentColor;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: textMuted }}>Current Plan</p>
            <p className="text-2xl font-bold mt-1" style={{ color: planColor }}>
              {PLAN_LABELS[data?.currentPlan || "starter"] || data?.currentPlan}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium" style={{ color: textMuted }}>Monthly Cost</p>
            <p className="text-2xl font-bold font-mono mt-1" style={{ color: textPrimary }}>
              {data?.mrrCents ? `$${(data.mrrCents / 100).toLocaleString()}` : "Custom"}
            </p>
          </div>
        </div>
        {data?.billingEmail && (
          <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <Mail className="h-3.5 w-3.5" style={{ color: textMuted }} />
            <span className="text-xs" style={{ color: textSecondary }}>Billing email: {data.billingEmail}</span>
          </div>
        )}
      </div>

      {/* Billing History */}
      <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>Billing History</h3>
        {data?.events && data.events.length > 0 ? (
          <div className="space-y-2">
            {data.events.map(event => (
              <div key={event.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{ background: isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4" style={{ color: textMuted }} />
                  <div>
                    <p className="text-sm" style={{ color: textPrimary }}>{event.type}</p>
                    <p className="text-[11px]" style={{ color: textMuted }}>
                      {event.createdAt ? new Date(event.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-mono font-medium" style={{ color: textPrimary }}>
                  ${((event.amountCents ?? 0) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="h-8 w-8 mx-auto mb-2" style={{ color: textMuted }} />
            <p className="text-sm" style={{ color: textSecondary }}>No billing events yet</p>
            <p className="text-xs mt-1" style={{ color: textMuted }}>Billing history will appear here once charges are recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Usage Tab
// ============================================================================
function UsageTab() {
  const { data, isLoading } = trpc.accountConsole.usage.useQuery();
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  if (isLoading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: cardBg }} />)}</div>;
  }

  if (!data) return null;

  const usageItems = [
    { label: "Contacts", value: data.totals.contacts, limit: data.limits?.maxContacts, color: "#0ea5e9" },
    { label: "Meetings", value: data.totals.meetings, limit: data.limits?.maxMeetingsPerMonth, color: "#8b5cf6" },
    { label: "Tasks", value: data.totals.tasks, limit: -1, color: "#10b981" },
    { label: "Employees", value: data.totals.employees, limit: -1, color: "#f59e0b" },
    { label: "Documents", value: data.totals.documents, limit: -1, color: "#ef4444" },
    { label: "Organizations", value: data.totals.organizations, limit: data.limits?.maxOrganizations, color: "#6366f1" },
  ];

  return (
    <div className="space-y-6">
      {/* Usage Overview */}
      <div className="grid grid-cols-3 gap-4">
        {usageItems.map(item => {
          const isUnlimited = item.limit === -1 || item.limit === undefined;
          const percentage = isUnlimited ? 0 : Math.min(100, (item.value / (item.limit || 1)) * 100);

          return (
            <div key={item.label} className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: textSecondary }}>{item.label}</span>
                <span className="text-xs font-mono" style={{ color: textMuted }}>
                  {isUnlimited ? "Unlimited" : `${item.value} / ${item.limit}`}
                </span>
              </div>
              <p className="text-xl font-bold font-mono" style={{ color: item.color }}>{item.value.toLocaleString()}</p>
              {!isUnlimited && (
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: `${item.color}15` }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, background: item.color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage by Organization */}
      <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>Usage by Organization</h3>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
          {/* Table Header */}
          <div className="grid grid-cols-7 gap-2 px-4 py-2.5" style={{ background: isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)" }}>
            <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Organization</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: textMuted }}>Contacts</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: textMuted }}>Meetings</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: textMuted }}>Tasks</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: textMuted }}>Employees</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: textMuted }}>Documents</div>
          </div>
          {data.byOrg.map((org, idx) => (
            <div key={org.orgId} className="grid grid-cols-7 gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${cardBorder}`, background: idx % 2 === 0 ? cardBg : "transparent" }}>
              <div className="col-span-2 text-sm font-medium truncate" style={{ color: textPrimary }}>{org.orgName}</div>
              <div className="text-sm font-mono text-right" style={{ color: textSecondary }}>{org.contacts}</div>
              <div className="text-sm font-mono text-right" style={{ color: textSecondary }}>{org.meetings}</div>
              <div className="text-sm font-mono text-right" style={{ color: textSecondary }}>{org.tasks}</div>
              <div className="text-sm font-mono text-right" style={{ color: textSecondary }}>{org.employees}</div>
              <div className="text-sm font-mono text-right" style={{ color: textSecondary }}>{org.documents}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Settings Tab
// ============================================================================
function SettingsTab() {
  const { data } = trpc.accountConsole.overview.useQuery();
  const updateSettings = trpc.accountConsole.updateSettings.useMutation();
  const { accentColor, isLightTheme } = useDesign();
  const [billingEmail, setBillingEmail] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saved, setSaved] = useState(false);

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const inputBg = isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)";

  // Initialize form values
  useMemo(() => {
    if (data?.account) {
      if (!billingEmail && data.account.billingEmail) setBillingEmail(data.account.billingEmail);
      if (!accountName && data.account.name) setAccountName(data.account.name);
    }
  }, [data]);

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      billingEmail: billingEmail || undefined,
      name: accountName || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>Account Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Billing Email</label>
            <input
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
            style={{ background: accentColor, color: "#000" }}
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </>
            ) : updateSettings.isPending ? (
              "Saving..."
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================
function StatCard({ icon, label, value, limit, color, isLightTheme }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  limit: string;
  color: string;
  isLightTheme: boolean;
}) {
  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  return (
    <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-xs font-medium" style={{ color: textMuted }}>{label}</span>
      </div>
      <p className="text-xl font-bold font-mono" style={{ color: textPrimary }}>{value}</p>
      {limit && <p className="text-[10px] mt-1" style={{ color: textMuted }}>{limit}</p>}
    </div>
  );
}
