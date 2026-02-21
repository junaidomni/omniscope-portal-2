/**
 * Roles & Permissions — Admin Hub
 * Shows the complete role hierarchy, permission matrix, and who has what access.
 * Platform Owner (Junaid) can see all users across all orgs and their roles.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Crown,
  Building2,
  Users,
  Eye,
  UserCog,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  X,
  Info,
  Lock,
  Unlock,
} from "lucide-react";

/* ─── Role Hierarchy Definition ─── */
const ROLE_HIERARCHY = [
  {
    key: "platform_owner",
    label: "Platform Owner",
    icon: Crown,
    color: "oklch(0.75 0.15 85)", // gold
    bgColor: "oklch(0.75 0.15 85 / 0.1)",
    borderColor: "oklch(0.75 0.15 85 / 0.3)",
    description: "God-mode access. Can view and manage all accounts, organizations, and users across the entire platform. Reserved for OmniScope founders and authorized executives.",
    permissions: {
      "View all organizations": true,
      "Switch to any org": true,
      "View all user data": true,
      "Manage platform settings": true,
      "Grant/revoke platform owner": true,
      "View all billing": true,
      "Access audit logs": true,
      "Manage feature flags": true,
      "View analytics": true,
      "Create organizations": true,
      "Manage org members": true,
      "View meetings & intelligence": true,
      "Manage contacts & companies": true,
      "Manage tasks & pipeline": true,
      "Access AI features": true,
      "Access integrations": true,
      "HR & payroll access": true,
      "Export data": true,
    },
  },
  {
    key: "account_owner",
    label: "Account Owner",
    icon: UserCog,
    color: "oklch(0.65 0.12 250)", // blue
    bgColor: "oklch(0.65 0.12 250 / 0.1)",
    borderColor: "oklch(0.65 0.12 250 / 0.3)",
    description: "Owns the billing account. Can create and manage multiple organizations under their account. Has full admin access to all their orgs. Cannot see other accounts' data.",
    permissions: {
      "View all organizations": false,
      "Switch to any org": false,
      "View all user data": false,
      "Manage platform settings": false,
      "Grant/revoke platform owner": false,
      "View all billing": false,
      "Access audit logs": true,
      "Manage feature flags": false,
      "View analytics": true,
      "Create organizations": true,
      "Manage org members": true,
      "View meetings & intelligence": true,
      "Manage contacts & companies": true,
      "Manage tasks & pipeline": true,
      "Access AI features": true,
      "Access integrations": true,
      "HR & payroll access": true,
      "Export data": true,
    },
  },
  {
    key: "org_admin",
    label: "Organization Admin",
    icon: Shield,
    color: "oklch(0.65 0.15 150)", // green
    bgColor: "oklch(0.65 0.15 150 / 0.1)",
    borderColor: "oklch(0.65 0.15 150 / 0.3)",
    description: "Full admin access within a specific organization. Can invite users, manage settings, and access all features within their org. Cannot create new organizations or access other orgs.",
    permissions: {
      "View all organizations": false,
      "Switch to any org": false,
      "View all user data": false,
      "Manage platform settings": false,
      "Grant/revoke platform owner": false,
      "View all billing": false,
      "Access audit logs": true,
      "Manage feature flags": false,
      "View analytics": true,
      "Create organizations": false,
      "Manage org members": true,
      "View meetings & intelligence": true,
      "Manage contacts & companies": true,
      "Manage tasks & pipeline": true,
      "Access AI features": true,
      "Access integrations": true,
      "HR & payroll access": true,
      "Export data": true,
    },
  },
  {
    key: "manager",
    label: "Manager",
    icon: Users,
    color: "oklch(0.65 0.12 60)", // orange
    bgColor: "oklch(0.65 0.12 60 / 0.1)",
    borderColor: "oklch(0.65 0.12 60 / 0.3)",
    description: "Can manage team members and access most features within their org. Cannot change org settings or manage integrations.",
    permissions: {
      "View all organizations": false,
      "Switch to any org": false,
      "View all user data": false,
      "Manage platform settings": false,
      "Grant/revoke platform owner": false,
      "View all billing": false,
      "Access audit logs": false,
      "Manage feature flags": false,
      "View analytics": true,
      "Create organizations": false,
      "Manage org members": true,
      "View meetings & intelligence": true,
      "Manage contacts & companies": true,
      "Manage tasks & pipeline": true,
      "Access AI features": true,
      "Access integrations": false,
      "HR & payroll access": false,
      "Export data": true,
    },
  },
  {
    key: "member",
    label: "Member",
    icon: Users,
    color: "oklch(0.60 0.05 250)", // muted blue
    bgColor: "oklch(0.60 0.05 250 / 0.1)",
    borderColor: "oklch(0.60 0.05 250 / 0.3)",
    description: "Standard access within their organization. Can view and manage their own data, participate in meetings, and use core features. Cannot manage other users or org settings.",
    permissions: {
      "View all organizations": false,
      "Switch to any org": false,
      "View all user data": false,
      "Manage platform settings": false,
      "Grant/revoke platform owner": false,
      "View all billing": false,
      "Access audit logs": false,
      "Manage feature flags": false,
      "View analytics": false,
      "Create organizations": false,
      "Manage org members": false,
      "View meetings & intelligence": true,
      "Manage contacts & companies": true,
      "Manage tasks & pipeline": true,
      "Access AI features": true,
      "Access integrations": false,
      "HR & payroll access": false,
      "Export data": false,
    },
  },
  {
    key: "viewer",
    label: "Viewer",
    icon: Eye,
    color: "oklch(0.55 0 0)", // gray
    bgColor: "oklch(0.55 0 0 / 0.1)",
    borderColor: "oklch(0.55 0 0 / 0.3)",
    description: "Read-only access. Can view meetings, contacts, and intelligence reports but cannot create, edit, or delete anything. Ideal for stakeholders who need visibility without modification rights.",
    permissions: {
      "View all organizations": false,
      "Switch to any org": false,
      "View all user data": false,
      "Manage platform settings": false,
      "Grant/revoke platform owner": false,
      "View all billing": false,
      "Access audit logs": false,
      "Manage feature flags": false,
      "View analytics": false,
      "Create organizations": false,
      "Manage org members": false,
      "View meetings & intelligence": true,
      "Manage contacts & companies": false,
      "Manage tasks & pipeline": false,
      "Access AI features": false,
      "Access integrations": false,
      "HR & payroll access": false,
      "Export data": false,
    },
  },
];

const PERMISSION_CATEGORIES = [
  {
    label: "Platform",
    permissions: [
      "View all organizations",
      "Switch to any org",
      "View all user data",
      "Manage platform settings",
      "Grant/revoke platform owner",
      "View all billing",
    ],
  },
  {
    label: "Governance",
    permissions: [
      "Access audit logs",
      "Manage feature flags",
      "View analytics",
    ],
  },
  {
    label: "Organization",
    permissions: [
      "Create organizations",
      "Manage org members",
    ],
  },
  {
    label: "Workspace",
    permissions: [
      "View meetings & intelligence",
      "Manage contacts & companies",
      "Manage tasks & pipeline",
      "Access AI features",
      "Access integrations",
      "HR & payroll access",
      "Export data",
    ],
  },
];

export default function RolesAndPermissions() {
  const { user } = useAuth();
  const isPlatformOwner = user?.platformOwner;
  const [expandedRole, setExpandedRole] = useState<string | null>("platform_owner");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"hierarchy" | "matrix" | "users">("hierarchy");

  // Fetch all users with their org memberships (platform owner only)
  const { data: allOrgs } = trpc.admin.listAllOrganizations.useQuery(undefined, {
    enabled: !!isPlatformOwner,
  });

  const { data: platformOverview } = trpc.admin.platformOverview.useQuery(undefined, {
    enabled: !!isPlatformOwner,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Understand the access hierarchy, permission matrix, and who has what level of control across the platform.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 w-fit">
        {[
          { key: "hierarchy" as const, label: "Role Hierarchy", icon: Shield },
          { key: "matrix" as const, label: "Permission Matrix", icon: Lock },
          { key: "users" as const, label: "Active Users", icon: Users },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "hierarchy" && <RoleHierarchyView expandedRole={expandedRole} setExpandedRole={setExpandedRole} />}
      {activeTab === "matrix" && <PermissionMatrixView />}
      {activeTab === "users" && <ActiveUsersView allOrgs={allOrgs} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isPlatformOwner={isPlatformOwner} />}
    </div>
  );
}

/* ─── Role Hierarchy View ─── */
function RoleHierarchyView({ expandedRole, setExpandedRole }: { expandedRole: string | null; setExpandedRole: (r: string | null) => void }) {
  return (
    <div className="space-y-3">
      {/* Visual hierarchy flow */}
      <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Access Hierarchy (Top → Bottom)</span>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {ROLE_HIERARCHY.map((role, i) => (
            <div key={role.key} className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: role.bgColor, border: `1px solid ${role.borderColor}`, color: role.color }}
              >
                <role.icon className="h-3.5 w-3.5" />
                {role.label}
              </div>
              {i < ROLE_HIERARCHY.length - 1 && (
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Role cards */}
      {ROLE_HIERARCHY.map(role => {
        const isExpanded = expandedRole === role.key;
        const Icon = role.icon;
        const grantedCount = Object.values(role.permissions).filter(Boolean).length;
        const totalCount = Object.keys(role.permissions).length;

        return (
          <div
            key={role.key}
            className="rounded-lg border transition-all"
            style={{
              background: isExpanded ? role.bgColor : "oklch(0.13 0 0)",
              borderColor: isExpanded ? role.borderColor : "oklch(0.20 0.01 85)",
            }}
          >
            <button
              onClick={() => setExpandedRole(isExpanded ? null : role.key)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: role.bgColor, border: `1px solid ${role.borderColor}` }}
                >
                  <Icon className="h-5 w-5" style={{ color: role.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{role.label}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{grantedCount} of {totalCount} permissions granted</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: role.borderColor, color: role.color }}
                >
                  {Math.round((grantedCount / totalCount) * 100)}% access
                </Badge>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-4">
                <Separator className="bg-zinc-800" />
                <p className="text-sm text-zinc-400 leading-relaxed">{role.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(role.permissions).map(([perm, granted]) => (
                    <div
                      key={perm}
                      className="flex items-center gap-2 px-3 py-2 rounded-md"
                      style={{ background: granted ? "oklch(0.65 0.15 150 / 0.05)" : "oklch(0.40 0 0 / 0.2)" }}
                    >
                      {granted ? (
                        <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "oklch(0.65 0.15 150)" }} />
                      ) : (
                        <X className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
                      )}
                      <span className={`text-xs ${granted ? "text-zinc-300" : "text-zinc-600"}`}>{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Permission Matrix View ─── */
function PermissionMatrixView() {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-900">
              <th className="text-left p-3 text-zinc-500 font-semibold uppercase tracking-wider min-w-[200px] sticky left-0 bg-zinc-900 z-10">
                Permission
              </th>
              {ROLE_HIERARCHY.map(role => (
                <th key={role.key} className="text-center p-3 min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <role.icon className="h-4 w-4" style={{ color: role.color }} />
                    <span className="text-zinc-400 font-semibold text-[10px] uppercase tracking-wider">{role.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_CATEGORIES.map(category => (
              <>
                <tr key={`cat-${category.label}`}>
                  <td
                    colSpan={ROLE_HIERARCHY.length + 1}
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-zinc-900/50 border-t border-zinc-800"
                  >
                    {category.label}
                  </td>
                </tr>
                {category.permissions.map(perm => (
                  <tr key={perm} className="border-t border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                    <td className="p-3 text-zinc-400 sticky left-0 bg-black/50 backdrop-blur-sm z-10">
                      {perm}
                    </td>
                    {ROLE_HIERARCHY.map(role => {
                      const granted = role.permissions[perm as keyof typeof role.permissions];
                      return (
                        <td key={role.key} className="text-center p-3">
                          {granted ? (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ background: "oklch(0.65 0.15 150 / 0.15)" }}>
                              <Check className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.15 150)" }} />
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800/50">
                              <X className="h-3 w-3 text-zinc-600" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Active Users View ─── */
function ActiveUsersView({
  allOrgs,
  searchTerm,
  setSearchTerm,
  isPlatformOwner,
}: {
  allOrgs: any;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  isPlatformOwner: boolean | undefined;
}) {
  // Fetch team members
  const { data: teamMembers } = trpc.admin.listAllOrganizations.useQuery(undefined, {
    enabled: !!isPlatformOwner,
  });

  // For now, show org-level data
  const orgs = allOrgs || [];

  const filteredOrgs = useMemo(() => {
    if (!searchTerm) return orgs;
    const lower = searchTerm.toLowerCase();
    return orgs.filter((org: any) =>
      org.name?.toLowerCase().includes(lower) ||
      org.slug?.toLowerCase().includes(lower)
    );
  }, [orgs, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
        />
      </div>

      {/* Platform Owner Badge */}
      {isPlatformOwner && (
        <div className="p-4 rounded-lg border" style={{ background: "oklch(0.75 0.15 85 / 0.05)", borderColor: "oklch(0.75 0.15 85 / 0.2)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "oklch(0.75 0.15 85 / 0.15)" }}>
              <Crown className="h-5 w-5" style={{ color: "oklch(0.75 0.15 85)" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                You are a Platform Owner
                <Badge className="text-[10px]" style={{ background: "oklch(0.75 0.15 85 / 0.2)", color: "oklch(0.75 0.15 85)", border: "1px solid oklch(0.75 0.15 85 / 0.3)" }}>
                  GOD MODE
                </Badge>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                You have unrestricted access to all {orgs.length} organizations on the platform.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Organizations Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Organizations ({filteredOrgs.length})
        </h3>
        {filteredOrgs.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-zinc-700" />
            <p className="text-sm text-zinc-500">No organizations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredOrgs.map((org: any) => (
              <div
                key={org.id}
                className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400">
                      {(org.name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{org.name}</h4>
                      <p className="text-xs text-zinc-500">{org.slug}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                    {org.memberCount || 1} member{(org.memberCount || 1) !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                    <Building2 className="h-3 w-3 mr-1" />
                    {org.industry || "General"}
                  </Badge>
                  {org.plan && (
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{
                        borderColor: org.plan === "sovereign" ? "oklch(0.75 0.15 85 / 0.3)" : "oklch(0.20 0.01 85)",
                        color: org.plan === "sovereign" ? "oklch(0.75 0.15 85)" : "oklch(0.55 0 0)",
                      }}
                    >
                      {org.plan}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800">
        <div className="flex items-start gap-3">
          <Lock className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data Isolation Guarantee</h4>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Every organization operates in complete isolation. Data is scoped by organization ID at the database level,
              enforced by middleware at the API level, and validated by row-level security checks at the entity level.
              Even Platform Owners access data through the same security pipeline — the only difference is the ability to
              switch between organizations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
