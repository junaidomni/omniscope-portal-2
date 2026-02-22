/**
 * Admin Hub — Account Detail (Drill-down)
 * Full account view with owner info, organizations, subscription,
 * usage, billing history, and management controls.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import {
  ArrowLeft,
  Crown,
  Shield,
  Zap,
  TrendingUp,
  Building2,
  Users,
  CreditCard,
  Activity,
  Edit3,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Mail,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

const PLAN_CONFIG: Record<string, { color: string; bg: string; icon: typeof Crown; label: string }> = {
  starter: { color: "oklch(0.65 0 0)", bg: "oklch(0.20 0 0)", icon: Zap, label: "Starter" },
  professional: { color: "oklch(0.75 0.15 250)", bg: "oklch(0.20 0.03 250)", icon: TrendingUp, label: "Professional" },
  enterprise: { color: "oklch(0.82 0.12 85)", bg: "oklch(0.20 0.03 85)", icon: Shield, label: "Enterprise" },
  sovereign: { color: "oklch(0.82 0.12 55)", bg: "oklch(0.18 0.04 55)", icon: Crown, label: "Sovereign" },
};

function PlanBadge({ planKey }: { planKey: string }) {
  const config = PLAN_CONFIG[planKey] || PLAN_CONFIG.starter;
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ color: config.color, background: config.bg }}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { color: string; bg: string }> = {
    active: { color: "oklch(0.72 0.19 145)", bg: "oklch(0.20 0.04 145)" },
    suspended: { color: "oklch(0.75 0.18 55)", bg: "oklch(0.20 0.04 55)" },
    cancelled: { color: "oklch(0.65 0.2 25)", bg: "oklch(0.20 0.04 25)" },
  };
  const c = colors[status] || colors.active;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize"
      style={{ color: c.color, background: c.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
      {status}
    </span>
  );
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "oklch(0.72 0.19 145)" : score >= 50 ? "oklch(0.75 0.18 55)" : "oklch(0.65 0.2 25)";
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.20 0 0)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-lg font-bold font-mono" style={{ color }}>{score}</span>
    </div>
  );
}

export default function AdminHubAccountDetail() {
  const params = useParams<{ id: string }>();
  const accountId = parseInt(params.id || "0", 10);
  const { data, isLoading, refetch } = trpc.adminHub.getAccountDetail.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );

  const updateStatus = trpc.adminHub.updateAccountStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Account status updated"); },
    onError: () => toast.error("Failed to update status"),
  });
  const updateHealth = trpc.adminHub.updateAccountHealth.useMutation({
    onSuccess: () => { refetch(); toast.success("Health score updated"); },
    onError: () => toast.error("Failed to update health"),
  });
  const updateMrr = trpc.adminHub.updateAccountMrr.useMutation({
    onSuccess: () => { refetch(); toast.success("MRR updated"); },
    onError: () => toast.error("Failed to update MRR"),
  });

  const { isLightTheme } = useDesign();
  const [editingHealth, setEditingHealth] = useState(false);
  const [healthInput, setHealthInput] = useState("");
  const [editingMrr, setEditingMrr] = useState(false);
  const [mrrInput, setMrrInput] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "orgs" | "usage" | "billing">("overview");

  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const accentGold = "oklch(0.82 0.12 55)";

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: textMuted }} />
      </div>
    );
  }

  const { account, organizations, subscription, plan, billingEvents, usageByOrg } = data;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "orgs" as const, label: `Organizations (${organizations.length})`, icon: Building2 },
    { id: "usage" as const, label: "Usage", icon: TrendingUp },
    { id: "billing" as const, label: "Billing History", icon: CreditCard },
  ];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back + Header */}
        <div>
          <Link href="/admin-hub/accounts">
            <button className="inline-flex items-center gap-1.5 text-sm mb-4 hover:opacity-80 transition-opacity" style={{ color: textMuted }}>
              <ArrowLeft className="w-4 h-4" />
              Back to Accounts
            </button>
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
                {account.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <PlanBadge planKey={account.plan} />
                <StatusBadge status={account.status} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {account.status === "active" && (
                <button
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:opacity-80"
                  style={{ borderColor: "oklch(0.75 0.18 55)", color: "oklch(0.75 0.18 55)" }}
                  onClick={() => updateStatus.mutate({ accountId, status: "suspended" })}
                  disabled={updateStatus.isPending}
                >
                  Suspend
                </button>
              )}
              {account.status === "suspended" && (
                <button
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:opacity-80"
                  style={{ borderColor: "oklch(0.72 0.19 145)", color: "oklch(0.72 0.19 145)" }}
                  onClick={() => updateStatus.mutate({ accountId, status: "active" })}
                  disabled={updateStatus.isPending}
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Owner Info Card */}
        <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
          <div className="flex items-center gap-4">
            {account.ownerAvatar ? (
              <img src={account.ownerAvatar} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: "oklch(0.20 0.04 55)", color: accentGold }}>
                {(account.ownerName || "?")[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="font-medium" style={{ color: textPrimary }}>{account.ownerName || "Unknown"}</div>
              <div className="text-xs flex items-center gap-1 mt-0.5" style={{ color: textMuted }}>
                <Mail className="w-3 h-3" />
                {account.ownerEmail || "—"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: textMuted }}>Account Created</div>
              <div className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary }}>
                <Calendar className="w-3 h-3" />
                {new Date(account.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          {/* MRR */}
          <div className="rounded-xl border p-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="text-xs font-medium" style={{ color: textMuted }}>Monthly Revenue</div>
            <div className="flex items-center gap-2 mt-1">
              {editingMrr ? (
                <div className="flex items-center gap-1">
                  <span style={{ color: textPrimary }}>$</span>
                  <input
                    type="number"
                    value={mrrInput}
                    onChange={(e) => setMrrInput(e.target.value)}
                    className="w-20 px-1 py-0.5 rounded border text-sm outline-none"
                    style={{ background: "transparent", borderColor: cardBorder, color: textPrimary }}
                    autoFocus
                  />
                  <button onClick={() => {
                    updateMrr.mutate({ accountId, mrrCents: Math.round(parseFloat(mrrInput) * 100) });
                    setEditingMrr(false);
                  }}>
                    <Check className="w-3.5 h-3.5" style={{ color: "oklch(0.72 0.19 145)" }} />
                  </button>
                  <button onClick={() => setEditingMrr(false)}>
                    <X className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.2 25)" }} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xl font-bold font-mono" style={{ color: textPrimary }}>
                    ${(account.mrrCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <button onClick={() => { setMrrInput((account.mrrCents / 100).toString()); setEditingMrr(true); }}>
                    <Edit3 className="w-3 h-3" style={{ color: textMuted }} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Health */}
          <div className="rounded-xl border p-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="text-xs font-medium" style={{ color: textMuted }}>Health Score</div>
            <div className="mt-1">
              {editingHealth ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={healthInput}
                    onChange={(e) => setHealthInput(e.target.value)}
                    className="w-16 px-1 py-0.5 rounded border text-sm outline-none"
                    style={{ background: "transparent", borderColor: cardBorder, color: textPrimary }}
                    autoFocus
                  />
                  <button onClick={() => {
                    updateHealth.mutate({ accountId, healthScore: parseInt(healthInput) });
                    setEditingHealth(false);
                  }}>
                    <Check className="w-3.5 h-3.5" style={{ color: "oklch(0.72 0.19 145)" }} />
                  </button>
                  <button onClick={() => setEditingHealth(false)}>
                    <X className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.2 25)" }} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <HealthGauge score={account.healthScore} />
                  <button onClick={() => { setHealthInput(account.healthScore.toString()); setEditingHealth(true); }}>
                    <Edit3 className="w-3 h-3" style={{ color: textMuted }} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Organizations */}
          <div className="rounded-xl border p-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="text-xs font-medium" style={{ color: textMuted }}>Organizations</div>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-5 h-5" style={{ color: accentGold }} />
              <span className="text-xl font-bold" style={{ color: textPrimary }}>{organizations.length}</span>
              <span className="text-xs" style={{ color: textMuted }}>/ {account.maxOrganizations}</span>
            </div>
          </div>

          {/* Billing Email */}
          <div className="rounded-xl border p-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="text-xs font-medium" style={{ color: textMuted }}>Billing Email</div>
            <div className="text-sm mt-1 truncate" style={{ color: textPrimary }}>
              {account.billingEmail || "Not set"}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b" style={{ borderColor: cardBorder }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors -mb-px"
                style={{
                  borderColor: isActive ? accentGold : "transparent",
                  color: isActive ? textPrimary : textMuted,
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Subscription */}
            <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>Subscription</h3>
              {subscription && plan ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs" style={{ color: textMuted }}>Plan</div>
                    <div className="mt-1"><PlanBadge planKey={plan.key} /></div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: textMuted }}>Billing Cycle</div>
                    <div className="text-sm mt-1 capitalize" style={{ color: textPrimary }}>{subscription.billingCycle}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: textMuted }}>Status</div>
                    <div className="text-sm mt-1 capitalize" style={{ color: textPrimary }}>{subscription.status}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm" style={{ color: textMuted }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: "oklch(0.75 0.18 55)" }} />
                  No active subscription
                </div>
              )}
            </div>

            {/* Plan Limits */}
            {plan && (
              <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>Plan Limits</h3>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { label: "Max Orgs", value: plan.maxOrganizations === -1 ? "Unlimited" : plan.maxOrganizations },
                    { label: "Users/Org", value: plan.maxUsersPerOrg === -1 ? "Unlimited" : plan.maxUsersPerOrg },
                    { label: "Contacts", value: plan.maxContacts === -1 ? "Unlimited" : plan.maxContacts },
                    { label: "Meetings/Mo", value: plan.maxMeetingsPerMonth === -1 ? "Unlimited" : plan.maxMeetingsPerMonth },
                    { label: "Storage (GB)", value: plan.maxStorageGb === -1 ? "Unlimited" : plan.maxStorageGb },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="text-xs" style={{ color: textMuted }}>{item.label}</div>
                      <div className="text-sm font-medium mt-0.5" style={{ color: textPrimary }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "orgs" && (
          <div className="space-y-3">
            {organizations.map((org) => (
              <Link key={org.id} href={`/admin-hub/org/${org.id}`}>
                <div
                  className="rounded-xl border p-4 cursor-pointer transition-colors hover:opacity-90"
                  style={{ background: cardBg, borderColor: cardBorder }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.20 0.04 55)", color: accentGold }}>
                          <Building2 className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium" style={{ color: textPrimary }}>{org.name}</div>
                        <div className="text-xs" style={{ color: textMuted }}>{org.slug} · {org.industry || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={org.status} />
                      <div className="flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                        <Users className="w-3 h-3" />
                        {org.memberCount} members
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {organizations.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: textMuted }}>
                No organizations under this account.
              </div>
            )}
          </div>
        )}

        {activeTab === "usage" && (
          <div className="space-y-4">
            {usageByOrg.map((orgUsage) => (
              <div key={orgUsage.orgId} className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>{orgUsage.orgName}</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Contacts", value: orgUsage.contacts },
                    { label: "Meetings", value: orgUsage.meetings },
                    { label: "Tasks", value: orgUsage.tasks },
                    { label: "Members", value: orgUsage.members },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="text-xs" style={{ color: textMuted }}>{item.label}</div>
                      <div className="text-lg font-bold mt-0.5" style={{ color: textPrimary }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {usageByOrg.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: textMuted }}>
                No usage data available.
              </div>
            )}
          </div>
        )}

        {activeTab === "billing" && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: cardBorder }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)" }}>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: textMuted }}>Date</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: textMuted }}>Type</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: textMuted }}>Description</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: textMuted }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {billingEvents.map((evt) => (
                  <tr key={evt.id} className="border-t" style={{ borderColor: cardBorder }}>
                    <td className="px-4 py-3 text-xs" style={{ color: textMuted }}>
                      {new Date(evt.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full" style={{
                        background: isLightTheme ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                        color: textSecondary,
                      }}>
                        {evt.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: textSecondary }}>
                      {evt.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs" style={{
                      color: evt.amountCents < 0 ? "oklch(0.65 0.2 25)" : textPrimary,
                    }}>
                      {evt.amountCents < 0 ? "-" : ""}${Math.abs(evt.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {billingEvents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm" style={{ color: textMuted }}>
                      No billing events recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
