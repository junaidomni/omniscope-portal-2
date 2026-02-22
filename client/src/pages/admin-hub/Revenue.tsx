/**
 * Admin Hub — Revenue Dashboard
 * MRR breakdown by plan, ARR projection, billing events, subscription status.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import {
  TrendingUp,
  DollarSign,
  Crown,
  Shield,
  Zap,
  CreditCard,
  BarChart3,
  Loader2,
  ArrowUpRight,
  Users,
} from "lucide-react";
import { useMemo } from "react";

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
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: config.color, background: config.bg }}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function MrrBar({ mrr, maxMrr, plan }: { mrr: number; maxMrr: number; plan: string }) {
  const config = PLAN_CONFIG[plan] || PLAN_CONFIG.starter;
  const pct = maxMrr > 0 ? (mrr / maxMrr) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "oklch(0.15 0 0)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: config.color }}
        />
      </div>
      <span className="text-xs font-mono w-24 text-right" style={{ color: config.color }}>
        ${(mrr / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

export default function AdminHubRevenue() {
  const { data, isLoading } = trpc.adminHub.revenueOverview.useQuery();
  const { isLightTheme } = useDesign();

  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const accentGold = "oklch(0.82 0.12 55)";

  const maxPlanMrr = useMemo(() => {
    if (!data?.byPlan) return 0;
    return Math.max(...data.byPlan.map((p) => p.mrr), 1);
  }, [data?.byPlan]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: textMuted }} />
      </div>
    );
  }

  const eventTypeColors: Record<string, string> = {
    payment: "oklch(0.72 0.19 145)",
    plan_change: "oklch(0.75 0.15 250)",
    refund: "oklch(0.65 0.2 25)",
    credit: "oklch(0.75 0.18 55)",
    trial_start: "oklch(0.70 0.12 200)",
    trial_end: "oklch(0.60 0.08 200)",
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Revenue
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Platform-wide revenue metrics, MRR breakdown, and billing activity.
          </p>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4" style={{ color: accentGold }} />
              <span className="text-xs font-medium" style={{ color: textMuted }}>Monthly Recurring Revenue</span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
              ${(data.totalMrr / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.72 0.19 145)" }} />
              <span className="text-xs font-medium" style={{ color: textMuted }}>Annual Run Rate</span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
              ${(data.totalArr / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" style={{ color: "oklch(0.75 0.15 250)" }} />
              <span className="text-xs font-medium" style={{ color: textMuted }}>Active Accounts</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: textPrimary }}>
              {data.activeAccounts}
              <span className="text-sm font-normal ml-1" style={{ color: textMuted }}>/ {data.totalAccounts}</span>
            </div>
          </div>

          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4" style={{ color: "oklch(0.75 0.18 55)" }} />
              <span className="text-xs font-medium" style={{ color: textMuted }}>Avg Revenue / Account</span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
              ${data.activeAccounts > 0 ? (data.totalMrr / data.activeAccounts / 100).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
            </div>
          </div>
        </div>

        {/* MRR by Plan */}
        <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>MRR by Plan</h3>
          <div className="space-y-4">
            {["sovereign", "enterprise", "professional", "starter"]
              .filter((p) => data.byPlan.some((bp) => bp.plan === p))
              .map((planKey) => {
                const planData = data.byPlan.find((bp) => bp.plan === planKey);
                if (!planData) return null;
                const config = PLAN_CONFIG[planKey] || PLAN_CONFIG.starter;
                return (
                  <div key={planKey}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <PlanBadge planKey={planKey} />
                        <span className="text-xs" style={{ color: textMuted }}>
                          {planData.count} account{planData.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-xs font-medium" style={{ color: textSecondary }}>
                        {data.totalMrr > 0 ? Math.round((planData.mrr / data.totalMrr) * 100) : 0}% of total
                      </span>
                    </div>
                    <MrrBar mrr={planData.mrr} maxMrr={maxPlanMrr} plan={planKey} />
                  </div>
                );
              })}
          </div>
        </div>

        {/* Subscription & Billing Cycle Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>Subscription Status</h3>
            <div className="space-y-2">
              {Object.entries(data.subscriptionStatus).map(([status, count]) => {
                const statusColors: Record<string, string> = {
                  active: "oklch(0.72 0.19 145)",
                  trialing: "oklch(0.75 0.15 250)",
                  past_due: "oklch(0.75 0.18 55)",
                  cancelled: "oklch(0.65 0.2 25)",
                  expired: "oklch(0.50 0.1 0)",
                };
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: statusColors[status] || textMuted }} />
                      <span className="text-sm capitalize" style={{ color: textSecondary }}>{status.replace("_", " ")}</span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: textPrimary }}>{count}</span>
                  </div>
                );
              })}
              {Object.keys(data.subscriptionStatus).length === 0 && (
                <div className="text-sm" style={{ color: textMuted }}>No subscriptions</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>Billing Cycles</h3>
            <div className="space-y-2">
              {Object.entries(data.billingCycles).map(([cycle, count]) => (
                <div key={cycle} className="flex items-center justify-between">
                  <span className="text-sm capitalize" style={{ color: textSecondary }}>{cycle}</span>
                  <span className="text-sm font-medium" style={{ color: textPrimary }}>{count}</span>
                </div>
              ))}
              {Object.keys(data.billingCycles).length === 0 && (
                <div className="text-sm" style={{ color: textMuted }}>No billing cycles</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Billing Events */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: cardBorder }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: cardBorder }}>
            <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>Recent Billing Events</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)" }}>
                <th className="px-4 py-2.5 text-left font-medium" style={{ color: textMuted }}>Date</th>
                <th className="px-4 py-2.5 text-left font-medium" style={{ color: textMuted }}>Account</th>
                <th className="px-4 py-2.5 text-left font-medium" style={{ color: textMuted }}>Type</th>
                <th className="px-4 py-2.5 text-left font-medium" style={{ color: textMuted }}>Details</th>
                <th className="px-4 py-2.5 text-right font-medium" style={{ color: textMuted }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEvents.map((evt) => (
                <tr key={evt.id} className="border-t" style={{ borderColor: cardBorder }}>
                  <td className="px-4 py-2.5 text-xs" style={{ color: textMuted }}>
                    {new Date(evt.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium" style={{ color: textPrimary }}>
                    {evt.accountName}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{
                        color: eventTypeColors[evt.type] || textSecondary,
                        background: isLightTheme ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                      }}
                    >
                      {evt.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: textSecondary }}>
                    {evt.description || (evt.fromPlan && evt.toPlan ? `${evt.fromPlan} → ${evt.toPlan}` : "—")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs" style={{
                    color: evt.amountCents < 0 ? "oklch(0.65 0.2 25)" : evt.amountCents > 0 ? "oklch(0.72 0.19 145)" : textMuted,
                  }}>
                    {evt.amountCents !== 0 && (
                      <>
                        {evt.amountCents < 0 ? "-" : "+"}${Math.abs(evt.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </>
                    )}
                    {evt.amountCents === 0 && "—"}
                  </td>
                </tr>
              ))}
              {data.recentEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: textMuted }}>
                    No billing events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
