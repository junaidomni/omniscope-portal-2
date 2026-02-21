import { useState, useRef, useEffect } from "react";
import { useOrg, OrgInfo } from "@/contexts/OrgContext";
import { ChevronDown, Plus, Building2, Globe, Check, Crown } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface OrgSwitcherProps {
  collapsed: boolean;
  accentColor: string;
  accentRgb: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  hoverBg: string;
  dividerColor: string;
  isLightTheme: boolean;
  sidebarBg: string;
  onCreateOrg?: () => void;
  onViewAllOrgs?: () => void;
  /** Called after switching to a specific org — use to navigate to workspace from admin hub */
  onSwitchToOrg?: (orgId: number) => void;
}

export default function OrgSwitcher({
  collapsed,
  accentColor,
  accentRgb,
  textPrimary,
  textSecondary,
  textMuted,
  hoverBg,
  dividerColor,
  isLightTheme,
  sidebarBg,
  onCreateOrg,
  onViewAllOrgs,
  onSwitchToOrg,
}: OrgSwitcherProps) {
  const { currentOrg, memberships, switchOrg, isLoading } = useOrg();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Platform owners can see ALL organizations, not just their memberships
  const { data: allOrgs } = trpc.admin.listAllOrganizations.useQuery(undefined, {
    enabled: user?.platformOwner === true,
  });

  // Use all orgs for platform owners, otherwise use memberships
  const displayOrgs = user?.platformOwner && allOrgs
    ? allOrgs.map(org => ({ org, role: "platform_owner" as const }))
    : memberships;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (isLoading || displayOrgs.length === 0) return null;

  const getOrgInitials = (name: string) => {
    return name
      .split(/[\s-]+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const OrgIcon = ({ org, size = 28 }: { org: OrgInfo | null; size?: number }) => {
    if (!org) {
      return (
        <div
          className="rounded-lg flex items-center justify-center shrink-0"
          style={{
            width: size,
            height: size,
            background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
            border: `1px solid ${accentColor}33`,
          }}
        >
          <Globe className="h-3.5 w-3.5" style={{ color: accentColor }} />
        </div>
      );
    }
    if (org.logoUrl) {
      return (
        <img
          src={org.logoUrl}
          alt={org.name}
          className="rounded-lg object-cover shrink-0"
          style={{ width: size, height: size }}
        />
      );
    }
    return (
      <div
        className="rounded-lg flex items-center justify-center shrink-0 font-bold"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.35,
          background: `linear-gradient(135deg, ${org.accentColor || accentColor}33, ${org.accentColor || accentColor}55)`,
          color: org.accentColor || accentColor,
          border: `1px solid ${org.accentColor || accentColor}33`,
        }}
      >
        {getOrgInitials(org.name)}
      </div>
    );
  };

  const handleOrgSwitch = (orgId: number | null) => {
    switchOrg(orgId);
    setOpen(false);
    // If switching to a specific org and callback provided, navigate to workspace
    if (orgId !== null && onSwitchToOrg) {
      onSwitchToOrg(orgId);
    }
  };

  // Collapsed: just show the icon
  if (collapsed) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-center py-2 px-1 rounded-lg transition-all duration-200"
          style={{
            background: open ? hoverBg : "transparent",
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = hoverBg; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
          title={currentOrg?.name || "All Organizations"}
        >
          <OrgIcon org={currentOrg} size={28} />
        </button>

        {open && (
          <div
            className="absolute left-full top-0 ml-2 w-64 rounded-xl shadow-2xl overflow-hidden z-[100]"
            style={{
              background: isLightTheme ? "oklch(0.99 0 0)" : "oklch(0.18 0 0)",
              border: `1px solid ${dividerColor}`,
            }}
          >
            <OrgDropdownContent
              memberships={displayOrgs}
              currentOrg={currentOrg}
              switchOrg={handleOrgSwitch}
              accentColor={accentColor}
              accentRgb={accentRgb}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              hoverBg={hoverBg}
              dividerColor={dividerColor}
              isLightTheme={isLightTheme}
              onCreateOrg={() => { setOpen(false); onCreateOrg?.(); }}
              onViewAllOrgs={() => { setOpen(false); onViewAllOrgs?.(); }}
              OrgIcon={OrgIcon}
              isPlatformOwner={user?.platformOwner === true}
            />
          </div>
        )}
      </div>
    );
  }

  // Expanded: full switcher
  return (
    <div className="relative px-2 py-2" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200"
        style={{
          background: open
            ? `color-mix(in oklch, ${accentColor} 8%, transparent)`
            : "transparent",
          border: `1px solid ${open ? `${accentColor}33` : "transparent"}`,
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = hoverBg;
            e.currentTarget.style.borderColor = dividerColor;
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
          }
        }}
      >
        <OrgIcon org={currentOrg} size={28} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[12px] font-medium truncate" style={{ color: textPrimary }}>
            {currentOrg?.name || "All Organizations"}
          </p>
          {currentOrg?.industry && (
            <p className="text-[10px] truncate" style={{ color: textMuted }}>
              {currentOrg.industry}
            </p>
          )}
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
          style={{
            color: textMuted,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-2 right-2 top-full mt-1 rounded-xl shadow-2xl overflow-hidden z-[100]"
          style={{
            background: isLightTheme ? "oklch(0.99 0 0)" : "oklch(0.18 0 0)",
            border: `1px solid ${dividerColor}`,
          }}
        >
          <OrgDropdownContent
            memberships={displayOrgs}
            currentOrg={currentOrg}
            switchOrg={handleOrgSwitch}
            accentColor={accentColor}
            accentRgb={accentRgb}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            textMuted={textMuted}
            hoverBg={hoverBg}
            dividerColor={dividerColor}
            isLightTheme={isLightTheme}
            onCreateOrg={() => { setOpen(false); onCreateOrg?.(); }}
            onViewAllOrgs={() => { setOpen(false); onViewAllOrgs?.(); }}
            OrgIcon={OrgIcon}
            isPlatformOwner={user?.platformOwner === true}
          />
        </div>
      )}
    </div>
  );
}

// Shared dropdown content
function OrgDropdownContent({
  memberships,
  currentOrg,
  switchOrg,
  accentColor,
  accentRgb,
  textPrimary,
  textSecondary,
  textMuted,
  hoverBg,
  dividerColor,
  isLightTheme,
  onCreateOrg,
  onViewAllOrgs,
  OrgIcon,
  isPlatformOwner,
}: {
  memberships: any[];
  currentOrg: OrgInfo | null;
  switchOrg: (id: number | null) => void;
  accentColor: string;
  accentRgb: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  hoverBg: string;
  dividerColor: string;
  isLightTheme: boolean;
  onCreateOrg: () => void;
  onViewAllOrgs: () => void;
  OrgIcon: React.ComponentType<{ org: OrgInfo | null; size?: number }>;
  isPlatformOwner?: boolean;
}) {
  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    account_owner: "Owner",
    org_admin: "Admin",
    manager: "Manager",
    member: "Member",
    viewer: "Viewer",
    platform_owner: "Platform Owner",
  };

  return (
    <div className="py-1.5">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: textMuted }}>
          Organizations
        </p>
        {isPlatformOwner && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}33` }}>
            <Crown className="h-2.5 w-2.5" style={{ color: accentColor }} />
            <span className="text-[9px] font-semibold" style={{ color: accentColor }}>SUPER ADMIN</span>
          </div>
        )}
      </div>

      {/* All Organizations option — navigates to admin hub */}
      <button
        onClick={onViewAllOrgs}
        className="w-full flex items-center gap-2.5 px-3 py-2 transition-all duration-150"
        style={{
          background: currentOrg === null ? `color-mix(in oklch, ${accentColor} 8%, transparent)` : "transparent",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = currentOrg === null
            ? `color-mix(in oklch, ${accentColor} 8%, transparent)`
            : "transparent";
        }}
      >
        <OrgIcon org={null} size={24} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[12px] font-medium" style={{ color: textPrimary }}>All Organizations</p>
          <p className="text-[10px]" style={{ color: textMuted }}>Super Admin Hub</p>
        </div>
        {currentOrg === null && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />}
      </button>

      {/* Divider */}
      <div className="mx-3 my-1" style={{ borderTop: `1px solid ${dividerColor}` }} />

      {/* Org list */}
      <div className="max-h-[240px] overflow-y-auto">
        {memberships.map((m) => {
          const isActive = currentOrg?.id === m.org.id;
          return (
            <button
              key={m.org.id}
              onClick={() => switchOrg(m.org.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 transition-all duration-150"
              style={{
                background: isActive ? `color-mix(in oklch, ${accentColor} 8%, transparent)` : "transparent",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isActive
                  ? `color-mix(in oklch, ${accentColor} 8%, transparent)`
                  : "transparent";
              }}
            >
              <OrgIcon org={m.org} size={24} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[12px] font-medium truncate" style={{ color: textPrimary }}>
                  {m.org.name}
                </p>
                <p className="text-[10px]" style={{ color: textMuted }}>
                  {roleLabels[m.role] || m.role}
                </p>
              </div>
              {isActive && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />}
            </button>
          );
        })}
      </div>

      {/* Create new org */}
      <div className="mx-3 my-1" style={{ borderTop: `1px solid ${dividerColor}` }} />
      <button
        onClick={onCreateOrg}
        className="w-full flex items-center gap-2.5 px-3 py-2 transition-all duration-150"
        style={{ color: textSecondary }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hoverBg;
          e.currentTarget.style.color = accentColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = textSecondary;
        }}
      >
        <div
          className="rounded-lg flex items-center justify-center shrink-0"
          style={{
            width: 24,
            height: 24,
            border: `1px dashed ${isLightTheme ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"}`,
          }}
        >
          <Plus className="h-3 w-3" />
        </div>
        <span className="text-[12px]">New Organization</span>
      </button>
    </div>
  );
}
