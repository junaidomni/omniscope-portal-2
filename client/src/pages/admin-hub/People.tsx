/**
 * Admin Hub — People / Team Members
 * Cross-org view of all users with their memberships.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import { Users, Search, Mail, Building2, Shield, UserCircle } from "lucide-react";
import { useState } from "react";

export default function AdminHubPeople() {
  const { data: users, isLoading } = trpc.adminHub.listAllUsers.useQuery();
  const { accentColor, isLightTheme } = useDesign();
  const [search, setSearch] = useState("");

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const inputBg = isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)";

  const filtered = (users ?? []).filter((u) =>
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    admin: "#ef4444",
    super_admin: accentColor,
    account_owner: accentColor,
    org_admin: "#6366f1",
    member: "#10b981",
    viewer: "#64748b",
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Team Members
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            All users across every organization.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: textMuted }} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
            onFocus={(e) => { e.currentTarget.style.borderColor = `${accentColor}44`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-sm font-medium" style={{ color: textPrimary }}>
              {(users ?? []).length} total users
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: "#6366f1" }} />
            <span className="text-sm" style={{ color: textSecondary }}>
              {(users ?? []).filter((u) => u.role === "admin").length} admins
            </span>
          </div>
        </div>

        {/* User List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: cardBg }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <UserCircle className="h-12 w-12 mx-auto mb-3" style={{ color: textMuted }} />
            <p className="text-sm" style={{ color: textSecondary }}>No users found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl p-4 transition-all duration-200"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accentColor}22`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  {user.profilePhotoUrl ? (
                    <img
                      src={user.profilePhotoUrl}
                      alt={user.name || "User"}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ background: `${accentColor}20`, color: accentColor }}
                    >
                      {(user.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: textPrimary }}>
                        {user.name || "Unnamed User"}
                      </p>
                      <div
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          background: `${roleColors[user.role] || "#64748b"}15`,
                          color: roleColors[user.role] || "#64748b",
                        }}
                      >
                        {user.role}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs flex items-center gap-1 truncate" style={{ color: textMuted }}>
                        <Mail className="h-3 w-3 shrink-0" /> {user.email || "No email"}
                      </span>
                    </div>
                  </div>

                  {/* Org Memberships */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {user.memberships.slice(0, 3).map((m, i) => (
                      <div
                        key={i}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1"
                        style={{
                          background: `${accentColor}10`,
                          color: textSecondary,
                          border: `1px solid ${accentColor}15`,
                        }}
                        title={`${m.orgName} — ${m.role}`}
                      >
                        <Building2 className="h-3 w-3" style={{ color: accentColor }} />
                        {m.orgName}
                      </div>
                    ))}
                    {user.memberships.length > 3 && (
                      <span className="text-[10px]" style={{ color: textMuted }}>
                        +{user.memberships.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
