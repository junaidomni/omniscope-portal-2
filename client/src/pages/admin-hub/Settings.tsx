/**
 * Admin Hub — Platform Settings
 * Global configuration for the platform.
 */
import { useDesign } from "@/components/PortalLayout";
import { Settings, Globe, Shield, Bell, Palette, Database, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function AdminHubSettings() {
  const { accentColor, isLightTheme } = useDesign();

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";

  const settingsSections = [
    {
      title: "General",
      description: "Platform name, branding, and default configuration",
      icon: Settings,
      action: () => toast.info("General settings coming soon"),
    },
    {
      title: "Appearance & Design",
      description: "Global theme, accent colors, and typography preferences",
      icon: Palette,
      action: () => {
        // Navigate to the workspace setup page for design
        window.location.href = "/setup?tab=design";
      },
      actionLabel: "Open Design Settings",
    },
    {
      title: "Security & Access",
      description: "Authentication policies, session management, and access controls",
      icon: Shield,
      action: () => toast.info("Security settings coming soon"),
    },
    {
      title: "Notifications",
      description: "Platform-wide notification preferences and channels",
      icon: Bell,
      action: () => toast.info("Notification settings coming soon"),
    },
    {
      title: "Domains & DNS",
      description: "Custom domain configuration and SSL management",
      icon: Globe,
      action: () => toast.info("Domain settings coming soon"),
    },
    {
      title: "Data & Storage",
      description: "Database management, backups, and storage quotas",
      icon: Database,
      action: () => toast.info("Data settings coming soon"),
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Platform Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Global configuration that applies across all organizations.
          </p>
        </div>

        {/* Settings Grid */}
        <div className="space-y-3">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.title}
                onClick={section.action}
                className="w-full rounded-2xl p-5 transition-all duration-200 text-left group"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${accentColor}33`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = cardBorder;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${accentColor}12` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: accentColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: textPrimary }}>
                      {section.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                      {section.description}
                    </p>
                  </div>
                  <ExternalLink
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0"
                    style={{ color: textMuted }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Note */}
        <div
          className="rounded-xl p-4 text-xs"
          style={{
            background: `${accentColor}08`,
            border: `1px solid ${accentColor}15`,
            color: textSecondary,
          }}
        >
          Settings marked as "coming soon" are actively being developed. Platform-level settings will override organization-level defaults unless explicitly overridden per org.
        </div>
      </div>
    </div>
  );
}
