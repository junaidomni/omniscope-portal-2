import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Shield, Filter, ChevronLeft, ChevronRight, User, Building2, Lightbulb, GitMerge, CheckCircle2, XCircle, Users } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  approve_contact: { label: "Approved Contact", color: "text-emerald-400", icon: CheckCircle2 },
  reject_contact: { label: "Rejected Contact", color: "text-red-400", icon: XCircle },
  merge_contacts: { label: "Merged Contacts", color: "text-blue-400", icon: GitMerge },
  bulk_approve_contacts: { label: "Bulk Approved Contacts", color: "text-emerald-400", icon: Users },
  bulk_reject_contacts: { label: "Bulk Rejected Contacts", color: "text-red-400", icon: Users },
  approve_company: { label: "Approved Company", color: "text-emerald-400", icon: Building2 },
  reject_company: { label: "Rejected Company", color: "text-red-400", icon: Building2 },
  bulk_approve_companies: { label: "Bulk Approved Companies", color: "text-emerald-400", icon: Building2 },
  bulk_reject_companies: { label: "Bulk Rejected Companies", color: "text-red-400", icon: Building2 },
  approve_suggestion: { label: "Approved Suggestion", color: "text-emerald-400", icon: Lightbulb },
  reject_suggestion: { label: "Dismissed Suggestion", color: "text-amber-400", icon: Lightbulb },
  bulk_approve_suggestions: { label: "Bulk Approved Suggestions", color: "text-emerald-400", icon: Lightbulb },
  bulk_reject_suggestions: { label: "Bulk Dismissed Suggestions", color: "text-amber-400", icon: Lightbulb },
  dedup_merge: { label: "Dedup Merge", color: "text-blue-400", icon: GitMerge },
  dedup_dismiss: { label: "Dedup Dismissed", color: "text-zinc-400", icon: XCircle },
};

const ENTITY_ICONS: Record<string, any> = {
  contact: User,
  company: Building2,
  suggestion: Lightbulb,
};

export default function ActivityLog() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>();
  const limit = 25;

  const { data, isLoading } = trpc.activityLog.list.useQuery({
    limit,
    offset: page * limit,
    action: actionFilter,
    entityType: entityTypeFilter,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
            <p className="text-sm text-muted-foreground">Compliance audit trail for all CRM actions</p>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {total} total entries
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={actionFilter || ""}
            onChange={(e) => { setActionFilter(e.target.value || undefined); setPage(0); }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={entityTypeFilter || ""}
            onChange={(e) => { setEntityTypeFilter(e.target.value || undefined); setPage(0); }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            <option value="">All Types</option>
            <option value="contact">Contacts</option>
            <option value="company">Companies</option>
            <option value="suggestion">Suggestions</option>
          </select>
          {(actionFilter || entityTypeFilter) && (
            <button
              onClick={() => { setActionFilter(undefined); setEntityTypeFilter(undefined); setPage(0); }}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-1/3" />
                  <div className="h-3 bg-zinc-800/50 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No activity recorded yet</p>
            <p className="text-sm mt-1">Actions will appear here as you approve, reject, or merge items.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />

            <div className="space-y-1">
              {logs.map((log: any, idx: number) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "text-zinc-400", icon: Shield };
                const Icon = actionInfo.icon;
                const EntityIcon = ENTITY_ICONS[log.entityType] || Shield;
                const date = new Date(log.createdAt);
                const isNewDay = idx === 0 || new Date(logs[idx - 1].createdAt).toDateString() !== date.toDateString();

                return (
                  <div key={log.id}>
                    {isNewDay && (
                      <div className="flex items-center gap-3 py-3 pl-12">
                        <div className="text-xs font-medium text-amber-500/70 uppercase tracking-wider">
                          {date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        <div className="flex-1 h-px bg-zinc-800/50" />
                      </div>
                    )}
                    <div className="flex items-start gap-4 py-3 px-3 rounded-lg hover:bg-zinc-900/50 transition-colors group relative">
                      {/* Icon */}
                      <div className="relative z-10 w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-zinc-700 transition-colors">
                        <Icon className={`w-4 h-4 ${actionInfo.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                          {log.entityName && (
                            <>
                              <span className="text-zinc-600">—</span>
                              <span className="text-sm text-foreground flex items-center gap-1">
                                <EntityIcon className="w-3 h-3 text-muted-foreground" />
                                {log.entityName}
                              </span>
                            </>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
