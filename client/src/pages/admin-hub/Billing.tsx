/**
 * Admin Hub — Plans & Billing
 * 
 * Super admin view for managing account subscriptions, viewing usage,
 * assigning plans, overriding limits, and monitoring billing status.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CreditCard,
  Building2,
  Users,
  Crown,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from "lucide-react";

// Plan tier colors and icons
const PLAN_CONFIG: Record<string, { color: string; bg: string; icon: typeof Crown; label: string }> = {
  starter: { color: "oklch(0.65 0 0)", bg: "oklch(0.20 0 0)", icon: Zap, label: "Starter" },
  professional: { color: "oklch(0.75 0.15 250)", bg: "oklch(0.20 0.03 250)", icon: TrendingUp, label: "Professional" },
  enterprise: { color: "oklch(0.82 0.12 85)", bg: "oklch(0.20 0.03 85)", icon: Shield, label: "Enterprise" },
  sovereign: { color: "oklch(0.82 0.12 55)", bg: "oklch(0.18 0.04 55)", icon: Crown, label: "Sovereign" },
};

function getPlanStyle(key: string) {
  return PLAN_CONFIG[key] || PLAN_CONFIG.starter;
}

function formatLimit(val: number): string {
  if (val === -1) return "Unlimited";
  return val.toLocaleString();
}

function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
  const isUnlimited = max === -1;
  const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
  const isWarning = !isUnlimited && pct >= 80;
  const isDanger = !isUnlimited && pct >= 95;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "oklch(0.65 0 0)" }}>{label}</span>
        <span style={{ color: isDanger ? "oklch(0.65 0.2 25)" : isWarning ? "oklch(0.75 0.15 85)" : "oklch(0.75 0 0)" }}>
          {current.toLocaleString()} / {formatLimit(max)}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.20 0 0)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: isDanger
                ? "oklch(0.65 0.2 25)"
                : isWarning
                ? "oklch(0.75 0.15 85)"
                : "oklch(0.65 0.15 160)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function PlanBadge({ planKey }: { planKey: string }) {
  const style = getPlanStyle(planKey);
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
      style={{ color: style.color, background: style.bg }}
    >
      <Icon size={12} />
      {style.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { color: string; bg: string }> = {
    active: { color: "oklch(0.75 0.15 160)", bg: "oklch(0.20 0.03 160)" },
    trialing: { color: "oklch(0.75 0.15 250)", bg: "oklch(0.20 0.03 250)" },
    past_due: { color: "oklch(0.75 0.15 55)", bg: "oklch(0.20 0.03 55)" },
    cancelled: { color: "oklch(0.65 0.15 25)", bg: "oklch(0.20 0.03 25)" },
    expired: { color: "oklch(0.55 0 0)", bg: "oklch(0.18 0 0)" },
  };
  const c = colors[status] || colors.expired;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={{ color: c.color, background: c.bg }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function AccountCard({ account, plans, onRefresh }: {
  account: any;
  plans: any[];
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(account.plan?.key || account.plan || "starter");

  const assignPlan = trpc.plans.assignPlan.useMutation({
    onSuccess: (result) => {
      toast.success(`Plan ${result.action} successfully`);
      setEditingPlan(false);
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelSub = trpc.plans.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription cancelled");
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const reactivateSub = trpc.plans.reactivateSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription reactivated");
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const planKey = account.plan?.key || account.plan || "starter";
  const planStyle = getPlanStyle(planKey);
  const subStatus = account.subscription?.status || "none";

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{
        background: "oklch(0.14 0.005 85)",
        border: `1px solid oklch(0.22 0.01 85)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: planStyle.bg }}
          >
            <Building2 size={18} style={{ color: planStyle.color }} />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate" style={{ color: "oklch(0.92 0 0)" }}>
              {account.name}
            </div>
            <div className="text-xs" style={{ color: "oklch(0.55 0 0)" }}>
              Account #{account.id} · {account.orgCount} org{account.orgCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PlanBadge planKey={planKey} />
          {subStatus !== "none" && <StatusBadge status={subStatus} />}
          {expanded ? (
            <ChevronUp size={16} style={{ color: "oklch(0.55 0 0)" }} />
          ) : (
            <ChevronDown size={16} style={{ color: "oklch(0.55 0 0)" }} />
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid oklch(0.20 0.01 85)" }}>
          {/* Plan Assignment */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.55 0 0)" }}>
                Subscription
              </h4>
              {!editingPlan && (
                <button
                  onClick={() => setEditingPlan(true)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                  style={{ color: "oklch(0.82 0.12 85)", background: "oklch(0.18 0.02 85)" }}
                >
                  <Edit3 size={12} /> Change Plan
                </button>
              )}
            </div>

            {editingPlan ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="text-sm rounded-md px-3 py-1.5 border-none outline-none"
                  style={{
                    background: "oklch(0.18 0 0)",
                    color: "oklch(0.92 0 0)",
                  }}
                >
                  {plans.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} — {p.priceMonthly ? `$${p.priceMonthly}/mo` : "Custom"}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    assignPlan.mutate({ accountId: account.id, planKey: selectedPlan });
                  }}
                  disabled={assignPlan.isPending}
                  className="p-1.5 rounded hover:opacity-80 transition-opacity"
                  style={{ color: "oklch(0.75 0.15 160)", background: "oklch(0.20 0.03 160)" }}
                >
                  {assignPlan.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button
                  onClick={() => setEditingPlan(false)}
                  className="p-1.5 rounded hover:opacity-80 transition-opacity"
                  style={{ color: "oklch(0.65 0.15 25)", background: "oklch(0.20 0.03 25)" }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs" style={{ color: "oklch(0.55 0 0)" }}>Plan</span>
                  <div style={{ color: "oklch(0.85 0 0)" }}>{account.plan?.name || capitalize(planKey)}</div>
                </div>
                <div>
                  <span className="text-xs" style={{ color: "oklch(0.55 0 0)" }}>Billing</span>
                  <div style={{ color: "oklch(0.85 0 0)" }}>
                    {account.subscription?.billingCycle || "—"}
                  </div>
                </div>
                <div>
                  <span className="text-xs" style={{ color: "oklch(0.55 0 0)" }}>Status</span>
                  <div>{subStatus !== "none" ? <StatusBadge status={subStatus} /> : <span style={{ color: "oklch(0.55 0 0)" }}>No subscription</span>}</div>
                </div>
                <div>
                  <span className="text-xs" style={{ color: "oklch(0.55 0 0)" }}>Since</span>
                  <div style={{ color: "oklch(0.85 0 0)" }}>
                    {account.subscription?.startDate
                      ? new Date(account.subscription.startDate).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Usage Limits */}
          {account.limits && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.55 0 0)" }}>
                Limits
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: "oklch(0.55 0 0)" }}>Max Contacts</span>
                  <span style={{ color: "oklch(0.85 0 0)" }}>{formatLimit(account.limits.maxContacts)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "oklch(0.55 0 0)" }}>Meetings/mo</span>
                  <span style={{ color: "oklch(0.85 0 0)" }}>{formatLimit(account.limits.maxMeetingsPerMonth)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "oklch(0.55 0 0)" }}>Users/Org</span>
                  <span style={{ color: "oklch(0.85 0 0)" }}>{formatLimit(account.limits.maxUsersPerOrg)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "oklch(0.55 0 0)" }}>Max Orgs</span>
                  <span style={{ color: "oklch(0.85 0 0)" }}>{formatLimit(account.limits.maxOrganizations)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "oklch(0.55 0 0)" }}>Storage</span>
                  <span style={{ color: "oklch(0.85 0 0)" }}>{formatLimit(account.limits.maxStorageGb)} GB</span>
                </div>
              </div>
            </div>
          )}

          {/* Organizations */}
          {account.orgs && account.orgs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.55 0 0)" }}>
                Organizations
              </h4>
              <div className="space-y-1">
                {account.orgs.map((org: any) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md text-sm"
                    style={{ background: "oklch(0.16 0 0)" }}
                  >
                    <span style={{ color: "oklch(0.85 0 0)" }}>{org.name}</span>
                    <span className="text-xs capitalize" style={{ color: "oklch(0.55 0 0)" }}>
                      {org.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid oklch(0.20 0.01 85)" }}>
            {account.subscription && subStatus === "active" && (
              <button
                onClick={() => {
                  if (confirm("Cancel this subscription? The account will lose access to premium features.")) {
                    cancelSub.mutate({ subscriptionId: account.subscription.id });
                  }
                }}
                disabled={cancelSub.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity"
                style={{ color: "oklch(0.65 0.15 25)", background: "oklch(0.18 0.02 25)" }}
              >
                {cancelSub.isPending ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                Cancel Subscription
              </button>
            )}
            {account.subscription && subStatus === "cancelled" && (
              <button
                onClick={() => reactivateSub.mutate({ subscriptionId: account.subscription.id })}
                disabled={reactivateSub.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity"
                style={{ color: "oklch(0.75 0.15 160)", background: "oklch(0.18 0.03 160)" }}
              >
                {reactivateSub.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Reactivate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanOverviewCard({ plan }: { plan: any }) {
  const style = getPlanStyle(plan.key);
  const Icon = style.icon;
  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{
        background: style.bg,
        border: `1px solid ${style.color}20`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: style.color }} />
        <span className="font-semibold text-sm" style={{ color: style.color }}>
          {plan.name}
        </span>
      </div>
      <div className="text-lg font-bold" style={{ color: "oklch(0.92 0 0)" }}>
        {plan.priceMonthly ? `$${plan.priceMonthly}` : "Custom"}
        {plan.priceMonthly && <span className="text-xs font-normal" style={{ color: "oklch(0.55 0 0)" }}>/mo</span>}
      </div>
      <div className="space-y-1 text-xs" style={{ color: "oklch(0.65 0 0)" }}>
        <div>{formatLimit(plan.maxContacts)} contacts</div>
        <div>{formatLimit(plan.maxMeetingsPerMonth)} meetings/mo</div>
        <div>{formatLimit(plan.maxUsersPerOrg)} users/org</div>
        <div>{formatLimit(plan.maxOrganizations)} organizations</div>
        <div>{formatLimit(plan.maxStorageGb)} GB storage</div>
      </div>
      {plan.features && plan.features.length > 0 && (
        <div className="pt-2" style={{ borderTop: `1px solid ${style.color}15` }}>
          <div className="text-xs font-medium mb-1" style={{ color: "oklch(0.55 0 0)" }}>Features</div>
          <div className="flex flex-wrap gap-1">
            {plan.features.map((f: string) => (
              <span
                key={f}
                className="px-1.5 py-0.5 rounded text-[10px] capitalize"
                style={{ background: "oklch(0.16 0 0)", color: "oklch(0.65 0 0)" }}
              >
                {f.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AdminBilling() {
  const { data: plans, isLoading: plansLoading } = trpc.plans.list.useQuery();
  const { data: accounts, isLoading: accountsLoading, refetch } = trpc.plans.listAccounts.useQuery();

  const isLoading = plansLoading || accountsLoading;

  // Stats
  const totalAccounts = accounts?.length || 0;
  const activeSubscriptions = accounts?.filter((a) => a.subscription?.status === "active").length || 0;
  const totalOrgs = accounts?.reduce((sum, a) => sum + a.orgCount, 0) || 0;

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "oklch(0.92 0 0)" }}>
          Plans & Billing
        </h1>
        <p className="text-sm mt-1" style={{ color: "oklch(0.55 0 0)" }}>
          Manage account subscriptions, view usage, and assign plans.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Accounts", value: totalAccounts, icon: Building2 },
          { label: "Active Subscriptions", value: activeSubscriptions, icon: CreditCard },
          { label: "Organizations", value: totalOrgs, icon: Users },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg p-4 flex items-center gap-3"
            style={{ background: "oklch(0.14 0.005 85)", border: "1px solid oklch(0.22 0.01 85)" }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(0.18 0.02 85)" }}
            >
              <stat.icon size={16} style={{ color: "oklch(0.82 0.12 85)" }} />
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: "oklch(0.92 0 0)" }}>
                {isLoading ? "—" : stat.value}
              </div>
              <div className="text-xs" style={{ color: "oklch(0.55 0 0)" }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Tiers */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.75 0 0)" }}>
          Available Plans
        </h2>
        {plansLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin" size={20} style={{ color: "oklch(0.55 0 0)" }} />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {(plans || []).map((plan) => (
              <PlanOverviewCard key={plan.key} plan={plan} />
            ))}
          </div>
        )}
      </div>

      {/* Accounts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: "oklch(0.75 0 0)" }}>
            Account Subscriptions
          </h2>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md hover:opacity-80 transition-opacity"
            style={{ color: "oklch(0.65 0 0)", background: "oklch(0.18 0 0)" }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        {accountsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin" size={20} style={{ color: "oklch(0.55 0 0)" }} />
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                plans={plans || []}
                onRefresh={() => refetch()}
              />
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: "oklch(0.14 0.005 85)", border: "1px solid oklch(0.22 0.01 85)" }}
          >
            <CreditCard size={32} className="mx-auto mb-2" style={{ color: "oklch(0.35 0 0)" }} />
            <p className="text-sm" style={{ color: "oklch(0.55 0 0)" }}>
              No accounts found. Accounts are created automatically when users sign up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
