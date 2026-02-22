/**
 * Admin Hub — Accounts Management
 * Master list of all accounts with plan, MRR, health, owner, and drill-down.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import {
  Search,
  Crown,
  Shield,
  Zap,
  TrendingUp,
  Building2,
  Users,
  ChevronRight,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";

// Plan styling
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

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "oklch(0.72 0.19 145)",
    suspended: "oklch(0.75 0.18 55)",
    cancelled: "oklch(0.65 0.2 25)",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="w-2 h-2 rounded-full" style={{ background: colors[status] || colors.active }} />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "oklch(0.72 0.19 145)" : score >= 50 ? "oklch(0.75 0.18 55)" : "oklch(0.65 0.2 25)";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.20 0 0)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{score}</span>
    </div>
  );
}

type SortField = "name" | "plan" | "mrr" | "health" | "orgs" | "created";
type SortDir = "asc" | "desc";

export default function AdminHubAccounts() {
  const { data: accounts, isLoading } = trpc.adminHub.listAccounts.useQuery();
  const { isLightTheme } = useDesign();

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const inputBg = isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)";
  const hoverBg = isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)";

  const planOrder: Record<string, number> = { starter: 0, professional: 1, enterprise: 2, sovereign: 3 };

  const filtered = useMemo(() => {
    if (!accounts) return [];
    let list = [...accounts];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.ownerName || "").toLowerCase().includes(q) ||
          (a.ownerEmail || "").toLowerCase().includes(q) ||
          (a.billingEmail || "").toLowerCase().includes(q)
      );
    }

    // Plan filter
    if (planFilter !== "all") {
      list = list.filter((a) => a.resolvedPlan === planFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "plan":
          cmp = (planOrder[a.resolvedPlan] ?? 0) - (planOrder[b.resolvedPlan] ?? 0);
          break;
        case "mrr":
          cmp = a.mrrCents - b.mrrCents;
          break;
        case "health":
          cmp = a.healthScore - b.healthScore;
          break;
        case "orgs":
          cmp = a.orgCount - b.orgCount;
          break;
        case "created":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [accounts, search, planFilter, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Summary stats
  const totalMrr = (accounts ?? []).reduce((sum, a) => sum + a.mrrCents, 0);
  const activeCount = (accounts ?? []).filter((a) => a.status === "active").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: textMuted }} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Accounts
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Manage all accounts across the platform. Click an account to drill down.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Accounts", value: accounts?.length ?? 0 },
            { label: "Active", value: activeCount },
            { label: "Total MRR", value: `$${(totalMrr / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { label: "Avg MRR", value: accounts?.length ? `$${(totalMrr / accounts.length / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "$0.00" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl p-4 border"
              style={{ background: cardBg, borderColor: cardBorder }}
            >
              <div className="text-xs font-medium" style={{ color: textMuted }}>{card.label}</div>
              <div className="text-xl font-bold mt-1 tracking-tight" style={{ color: textPrimary }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
              style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
          >
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
            <option value="sovereign">Sovereign</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="text-xs" style={{ color: textMuted }}>
            {filtered.length} account{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: cardBorder }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)" }}>
                {[
                  { field: "name" as SortField, label: "Account" },
                  { field: "plan" as SortField, label: "Plan" },
                  { field: "mrr" as SortField, label: "MRR" },
                  { field: "health" as SortField, label: "Health" },
                  { field: "orgs" as SortField, label: "Orgs" },
                  { field: "created" as SortField, label: "Created" },
                ].map((col) => (
                  <th
                    key={col.field}
                    className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                    style={{ color: textMuted }}
                    onClick={() => toggleSort(col.field)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="w-3 h-3" style={{ opacity: sortField === col.field ? 1 : 0.3 }} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium" style={{ color: textMuted }}>Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((acct) => (
                <Link key={acct.id} href={`/admin-hub/account/${acct.id}`}>
                  <tr
                    className="border-t cursor-pointer transition-colors"
                    style={{ borderColor: cardBorder }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium" style={{ color: textPrimary }}>{acct.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: textMuted }}>
                          {acct.ownerName || acct.ownerEmail || "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge planKey={acct.resolvedPlan} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: textPrimary }}>
                      ${(acct.mrrCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <HealthBar score={acct.healthScore} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                        <Building2 className="w-3 h-3" />
                        {acct.orgCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: textMuted }}>
                      {new Date(acct.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusDot status={acct.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4" style={{ color: textMuted }} />
                    </td>
                  </tr>
                </Link>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: textMuted }}>
                    No accounts found.
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
