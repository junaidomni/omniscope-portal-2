/**
 * Admin Hub — Organizations Management
 * List all orgs with status, member count, and management actions.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { Building2, Plus, Search, MoreHorizontal, Users, Globe, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useOrg } from "@/contexts/OrgContext";

export default function AdminHubOrganizations() {
  const { data: orgs, isLoading, refetch } = trpc.adminHub.listOrganizations.useQuery();
  const updateStatus = trpc.adminHub.updateOrgStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Organization status updated"); },
    onError: () => toast.error("Failed to update status"),
  });
  const { switchOrg } = useOrg();
  const { accentColor, isLightTheme } = useDesign();
  const [search, setSearch] = useState("");
  const [expandedOrg, setExpandedOrg] = useState<number | null>(null);

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const inputBg = isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)";

  const filtered = (orgs ?? []).filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
              Organizations
            </h1>
            <p className="text-sm mt-1" style={{ color: textSecondary }}>
              Manage all workspaces across the platform.
            </p>
          </div>
          <Link href="/org/new">
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{ background: accentColor, color: isLightTheme ? "#fff" : "#000" }}
            >
              <Plus className="h-4 w-4" />
              New Organization
            </button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: textMuted }} />
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              background: inputBg,
              border: `1px solid ${cardBorder}`,
              color: textPrimary,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = `${accentColor}44`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
          />
        </div>

        {/* Org List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 mx-auto mb-3" style={{ color: textMuted }} />
            <p className="text-sm" style={{ color: textSecondary }}>
              {search ? "No organizations match your search." : "No organizations yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((org) => (
              <div key={org.id}>
                <div
                  className="rounded-2xl p-5 transition-all duration-200"
                  style={{ background: cardBg, border: `1px solid ${expandedOrg === org.id ? `${accentColor}33` : cardBorder}` }}
                >
                  <div className="flex items-center gap-4">
                    {/* Org Icon */}
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0"
                        style={{
                          background: `${org.accentColor || accentColor}20`,
                          color: org.accentColor || accentColor,
                        }}
                      >
                        {org.name.split(/[\s-]+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                          {org.name}
                        </p>
                        <div
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                          style={{
                            background: org.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                            color: org.status === "active" ? "#10b981" : "#ef4444",
                          }}
                        >
                          {org.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs flex items-center gap-1" style={{ color: textMuted }}>
                          <Globe className="h-3 w-3" /> {org.slug}
                        </span>
                        <span className="text-xs flex items-center gap-1" style={{ color: textMuted }}>
                          <Users className="h-3 w-3" /> {org.memberCount} members
                        </span>
                        {org.industry && (
                          <span className="text-xs" style={{ color: textMuted }}>
                            {org.industry}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          switchOrg(org.id);
                          window.location.href = "/";
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                        style={{
                          background: `${accentColor}10`,
                          color: accentColor,
                          border: `1px solid ${accentColor}20`,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${accentColor}20`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = `${accentColor}10`; }}
                      >
                        Enter Workspace
                      </button>
                      <button
                        onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                        className="p-1.5 rounded-lg transition-all duration-200"
                        style={{ color: textMuted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = textPrimary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Actions */}
                  {expandedOrg === org.id && (
                    <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      {org.status === "active" ? (
                        <button
                          onClick={() => updateStatus.mutate({ orgId: org.id, status: "suspended" })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          Suspend Organization
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus.mutate({ orgId: org.id, status: "active" })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                          style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}
                        >
                          Activate Organization
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus.mutate({ orgId: org.id, status: "archived" })}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                        style={{ background: inputBg, color: textSecondary, border: `1px solid ${cardBorder}` }}
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
