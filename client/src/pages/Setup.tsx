import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useSearch } from "wouter";
import {
  Mail, Calendar, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ExternalLink, Shield, Clock, Loader2, Copy, Info, User, Settings,
  Link2, Zap, ChevronRight, Sparkles, Eye, EyeOff, Monitor,
  HardDrive, FileText, FileSpreadsheet, Power, Plus, Search,
  ToggleLeft, ToggleRight, Lock, Unlock, ChevronDown, ChevronUp,
  Key, Globe, Webhook, Trash2, Edit3, Check, X, ArrowRight,
  Puzzle, MessageSquare, CreditCard, BarChart3, Briefcase, Bot,
  Palette, Upload, Type, Layout, Sun, Moon
} from "lucide-react";
import OmniAvatar, { OmniMode, OmniState, OmniPreferences, getOmniPreferences, setOmniPreferences, STATE_OVERLAYS, OMNI_THEME_PALETTES } from "@/components/OmniAvatar";
import { useDesign } from "@/components/PortalLayout";

type Tab = "profile" | "integrations" | "features" | "webhooks" | "omni" | "appearance" | "plan" | "digest";

export default function Setup() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const googleStatus = params.get("google");
  const initialTab = params.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || "integrations");

  useEffect(() => {
    if (googleStatus === "connected") {
      toast.success("Google account connected successfully!");
      setActiveTab("integrations");
      window.history.replaceState({}, "", "/setup?tab=integrations");
    } else if (googleStatus === "error") {
      const msg = params.get("message") || "Unknown error";
      toast.error(`Google connection failed: ${msg}`);
      setActiveTab("integrations");
      window.history.replaceState({}, "", "/setup?tab=integrations");
    }
  }, [googleStatus]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" />, description: "Account" },
    { id: "integrations", label: "Integrations", icon: <Puzzle className="h-4 w-4" />, description: "Connected services" },
    { id: "features", label: "Feature Controls", icon: <ToggleRight className="h-4 w-4" />, description: "Module toggles" },
    { id: "webhooks", label: "Webhooks & API", icon: <Webhook className="h-4 w-4" />, description: "Endpoints" },
    { id: "omni", label: "Omni Assistant", icon: <Sparkles className="h-4 w-4" />, description: "AI companion" },
    { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" />, description: "Design & theme" },
    { id: "plan", label: "Plan & Usage", icon: <CreditCard className="h-4 w-4" />, description: "Subscription" },
    { id: "digest", label: "Digests & Reports", icon: <Mail className="h-4 w-4" />, description: "Daily & weekly" },
  ];

  return (
    <div className="min-h-screen">
      {/* Premium Header */}
      <div className="border-b border-zinc-800/60 bg-gradient-to-r from-zinc-950 via-zinc-900/80 to-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-600/20 to-yellow-600/5 border border-yellow-600/20 flex items-center justify-center">
              <Settings className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Manage integrations, feature controls, and system configuration
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation — Apple-style pill tabs */}
      <div className="border-b border-zinc-800/40 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-yellow-600/10 text-yellow-400 border border-yellow-600/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 border border-transparent"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "integrations" && <IntegrationsHubTab />}
        {activeTab === "features" && <FeatureControlsTab />}
        {activeTab === "webhooks" && <WebhooksTab />}
        {activeTab === "omni" && <OmniTab />}
        {activeTab === "appearance" && <AppearanceTab />}
        {activeTab === "plan" && <PlanUsageTab />}
        {activeTab === "digest" && <DigestSettingsTab />}
      </div>
    </div>
  );
}

// PROFILE TAB

function ProfileTab() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const uploadPhotoMutation = trpc.profile.uploadPhoto.useMutation({
    onSuccess: () => {
      toast.success("Profile photo updated");
      window.location.reload();
    },
    onError: (err: any) => toast.error(err.message || "Failed to upload photo"),
  });

  const handlePhotoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
      setUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadPhotoMutation.mutate({ base64, fileName: file.name, mimeType: file.type }, {
          onSettled: () => setUploading(false),
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="bg-zinc-900/40 border-zinc-800/60 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-yellow-600/10 via-zinc-900 to-zinc-900" />
        <CardContent className="relative px-6 pb-6">
          <div className="flex items-end gap-5 -mt-10">
            <div className="relative group">
              {(user as any)?.profilePhotoUrl ? (
                <img src={(user as any).profilePhotoUrl} alt={user?.name || ""} className="h-20 w-20 rounded-2xl object-cover border-4 border-zinc-900 shadow-xl" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-yellow-600 to-yellow-700 flex items-center justify-center text-black font-bold text-3xl border-4 border-zinc-900 shadow-xl">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <button
                onClick={handlePhotoUpload}
                disabled={uploading}
                className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer border-4 border-transparent"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <div className="text-center">
                    <Edit3 className="h-4 w-4 text-white mx-auto" />
                    <span className="text-[9px] text-white/80 mt-0.5 block">Change</span>
                  </div>
                )}
              </button>
            </div>
            <div className="pb-1">
              <h3 className="text-xl font-bold text-white">{user?.name || "User"}</h3>
              <p className="text-sm text-zinc-400">{user?.email || "No email"}</p>
            </div>
            <Badge className="ml-auto mb-1 bg-yellow-600/10 text-yellow-500 border-yellow-600/20 text-xs">
              {user?.role === "admin" ? "Administrator" : "Team Member"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-zinc-800/60">
            {[
              { label: "Name", value: user?.name },
              { label: "Email", value: user?.email },
              { label: "Role", value: user?.role || "user" },
              { label: "Login Method", value: "Manus OAuth" },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">{field.label}</label>
                <p className="text-sm text-white mt-1 capitalize">{field.value || "—"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40 flex items-start gap-3">
        <Shield className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-zinc-300">Account Security</p>
          <p className="text-xs text-zinc-500 mt-1">
            Your account is secured via Manus OAuth. Password management and two-factor authentication
            are handled through your Manus account settings.
          </p>
        </div>
      </div>
    </div>
  );
}

// INTEGRATIONS HUB TAB — The main event

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  communication: { label: "Communication", icon: <MessageSquare className="h-4 w-4" />, color: "blue" },
  intelligence: { label: "Intelligence", icon: <Bot className="h-4 w-4" />, color: "purple" },
  finance: { label: "Finance", icon: <CreditCard className="h-4 w-4" />, color: "emerald" },
  productivity: { label: "Productivity", icon: <Briefcase className="h-4 w-4" />, color: "orange" },
  custom: { label: "Custom", icon: <Puzzle className="h-4 w-4" />, color: "zinc" },
};

function IntegrationsHubTab() {
  const { data: integrationsList, isLoading } = trpc.integrations.list.useQuery();
  const { data: mailStatus } = trpc.mail.connectionStatus.useQuery();
  const { data: driveStatus } = trpc.drive.connectionStatus.useQuery();
  const authUrlMutation = trpc.mail.getAuthUrl.useMutation();
  const toggleMutation = trpc.integrations.toggle.useMutation();
  const updateApiKeyMutation = trpc.integrations.updateApiKey.useMutation();
  const upsertMutation = trpc.integrations.upsert.useMutation();
  const deleteMutation = trpc.integrations.delete.useMutation();
  const utils = trpc.useUtils();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingApiKey, setEditingApiKey] = useState<number | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ slug: "", name: "", description: "", category: "custom" as const, type: "api_key" as const, baseUrl: "", apiKey: "" });

  const googleConnected = mailStatus?.connected === true;
  const hasGmailScopes = mailStatus?.hasGmailScopes === true;
  const hasDriveScopes = driveStatus?.hasDriveScopes === true;

  // Filtered integrations
  const filtered = useMemo(() => {
    if (!integrationsList) return [];
    return integrationsList.filter((i) => {
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [integrationsList, filterCategory, searchQuery]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const i of filtered) {
      const cat = i.category || "custom";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(i);
    }
    return groups;
  }, [filtered]);

  // Stats
  const stats = useMemo(() => {
    if (!integrationsList) return { total: 0, active: 0, connected: 0 };
    return {
      total: integrationsList.length,
      active: integrationsList.filter((i) => i.enabled).length,
      connected: integrationsList.filter((i) => i.status === "connected").length,
    };
  }, [integrationsList]);

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id, enabled });
      utils.integrations.list.invalidate();
      toast.success(enabled ? "Integration enabled" : "Integration disabled");
    } catch {
      toast.error("Failed to toggle integration");
    }
  };

  const handleSaveApiKey = async (id: number) => {
    try {
      await updateApiKeyMutation.mutateAsync({ id, apiKey: apiKeyValue || null });
      utils.integrations.list.invalidate();
      setEditingApiKey(null);
      setApiKeyValue("");
      toast.success("API key updated");
    } catch {
      toast.error("Failed to update API key");
    }
  };

  const handleGoogleConnect = () => {
    authUrlMutation.mutateAsync({ origin: window.location.origin, returnPath: "/setup?tab=integrations" })
      .then((r) => { window.location.href = r.url; })
      .catch(() => toast.error("Failed to generate auth URL"));
  };

  const handleAddCustom = async () => {
    if (!customForm.slug || !customForm.name) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        slug: customForm.slug,
        name: customForm.name,
        description: customForm.description || undefined,
        category: "custom",
        type: customForm.type,
        baseUrl: customForm.baseUrl || undefined,
        apiKey: customForm.apiKey || undefined,
        enabled: true,
        status: customForm.apiKey ? "connected" : "pending",
      });
      utils.integrations.list.invalidate();
      setShowAddCustom(false);
      setCustomForm({ slug: "", name: "", description: "", category: "custom", type: "api_key", baseUrl: "", apiKey: "" });
      toast.success("Custom integration added");
    } catch {
      toast.error("Failed to add integration");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      utils.integrations.list.invalidate();
      setExpandedId(null);
      toast.success("Integration removed");
    } catch {
      toast.error("Failed to remove integration");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full bg-zinc-800/40 rounded-xl" />)}
      </div>
    );
  }

  const categoryOrder = ["communication", "intelligence", "finance", "productivity", "custom"];

  return (
    <div className="space-y-8">
      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Integrations", value: stats.total, icon: <Puzzle className="h-4 w-4" />, color: "zinc" },
          { label: "Active", value: stats.active, icon: <Power className="h-4 w-4" />, color: "emerald" },
          { label: "Connected", value: stats.connected, icon: <CheckCircle2 className="h-4 w-4" />, color: "yellow" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-${stat.color === "zinc" ? "zinc-400" : stat.color === "emerald" ? "emerald-400" : "yellow-500"}`}>{stat.icon}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zinc-900/50 border-zinc-800/60 text-white placeholder:text-zinc-600 h-10"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              filterCategory === "all" ? "bg-yellow-600/10 text-yellow-400 border border-yellow-600/20" : "text-zinc-500 hover:text-zinc-300 border border-zinc-800/40 hover:bg-zinc-800/40"
            }`}
          >
            All
          </button>
          {categoryOrder.map((cat) => {
            const meta = CATEGORY_META[cat];
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filterCategory === cat ? "bg-yellow-600/10 text-yellow-400 border border-yellow-600/20" : "text-zinc-500 hover:text-zinc-300 border border-zinc-800/40 hover:bg-zinc-800/40"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <Button
          onClick={() => setShowAddCustom(true)}
          size="sm"
          className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium h-10 px-4"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Custom
        </Button>
      </div>

      {/* Google Workspace Special Banner (if not connected) */}
      {!googleConnected && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-blue-600/5 via-zinc-900/50 to-zinc-900/50 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-7 w-7">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Connect Google Workspace</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Enable Gmail, Calendar, Drive, Docs & Sheets in one click</p>
              </div>
            </div>
            <Button onClick={handleGoogleConnect} disabled={authUrlMutation.isPending}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/10 font-medium">
              {authUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Connect
            </Button>
          </div>
        </div>
      )}

      {/* Gmail scope warning */}
      {googleConnected && !hasGmailScopes && (
        <div className="p-4 rounded-xl bg-yellow-600/5 border border-yellow-600/20 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-400 mb-1">Gmail Permissions Required</h3>
            <p className="text-xs text-zinc-400 mb-3">
              Re-authenticate to enable full Gmail access (read, search, manage).
            </p>
            <Button onClick={handleGoogleConnect} disabled={authUrlMutation.isPending} size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
              {authUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Re-authenticate
            </Button>
          </div>
        </div>
      )}

      {/* Integration Cards by Category */}
      {categoryOrder.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const meta = CATEGORY_META[cat];

        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-zinc-500">{meta.icon}</span>
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{meta.label}</h2>
              <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((integration) => {
                const isExpanded = expandedId === integration.id;
                const isGoogle = integration.slug === "google-workspace";
                const isFathom = integration.slug === "fathom";
                const isActive = isGoogle ? googleConnected : integration.enabled;
                const statusText = isGoogle
                  ? (googleConnected ? "Connected" : "Not connected")
                  : integration.status === "connected" ? "Connected"
                  : integration.status === "error" ? "Error"
                  : integration.status === "pending" ? "Pending"
                  : "Not connected";
                const statusColor = statusText === "Connected" ? "emerald" : statusText === "Error" ? "red" : statusText === "Pending" ? "yellow" : "zinc";

                return (
                  <div
                    key={integration.id}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? "bg-zinc-900/60 border-yellow-600/20 ring-1 ring-yellow-600/10"
                        : "bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700/60 hover:bg-zinc-900/40"
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      className="p-4 flex items-center gap-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : integration.id)}
                    >
                      {/* Icon */}
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${integration.iconColor || "#71717a"}15`,
                          borderColor: `${integration.iconColor || "#71717a"}30`,
                        }}
                      >
                        {isGoogle ? (
                          <svg viewBox="0 0 24 24" className="h-5 w-5">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                        ) : (
                          <span className="text-xs font-bold" style={{ color: integration.iconColor || "#71717a" }}>
                            {integration.iconLetter || integration.name.charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white truncate">{integration.name}</h3>
                          {integration.isBuiltIn && (
                            <Badge className="bg-zinc-800/60 text-zinc-500 border-zinc-700/40 text-[9px] px-1.5 py-0">Built-in</Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{integration.description}</p>
                      </div>

                      {/* Status + Toggle */}
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge className={`bg-${statusColor}-500/10 text-${statusColor}-400 border-${statusColor}-500/20 text-[10px] px-2 py-0.5`}>
                          {statusText}
                        </Badge>

                        {!isGoogle && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggle(integration.id, !integration.enabled); }}
                            className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${
                              integration.enabled ? "bg-yellow-600" : "bg-zinc-700"
                            }`}
                            style={{ width: 40, height: 22 }}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform duration-200 shadow-sm ${
                              integration.enabled ? "translate-x-[18px]" : "translate-x-0"
                            }`} />
                          </button>
                        )}

                        <ChevronDown className={`h-4 w-4 text-zinc-600 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-zinc-800/40 pt-4 space-y-4">
                        {/* Google-specific details */}
                        {isGoogle && googleConnected && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <Mail className="h-3.5 w-3.5 text-zinc-500" />
                              <span>Connected as: <span className="text-white">{mailStatus?.email || "—"}</span></span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {[
                                { label: "Gmail", ok: hasGmailScopes, icon: <Mail className="h-3 w-3" /> },
                                { label: "Calendar", ok: mailStatus?.hasCalendarScopes, icon: <Calendar className="h-3 w-3" /> },
                                { label: "Drive", ok: hasDriveScopes, icon: <HardDrive className="h-3 w-3" /> },
                                { label: "Docs", ok: driveStatus?.hasDocsScopes, icon: <FileText className="h-3 w-3" /> },
                                { label: "Sheets", ok: driveStatus?.hasSheetsScopes, icon: <FileSpreadsheet className="h-3 w-3" /> },
                              ].map((s) => (
                                <div key={s.label} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${s.ok ? "bg-emerald-500/5 text-emerald-400" : "bg-yellow-500/5 text-yellow-400"}`}>
                                  {s.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                  {s.icon}
                                  <span>{s.label}</span>
                                </div>
                              ))}
                            </div>
                            <Button onClick={handleGoogleConnect} variant="outline" size="sm"
                              disabled={authUrlMutation.isPending}
                              className="border-zinc-700 text-zinc-400 hover:text-white h-8 mt-2">
                              {authUrlMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                              Re-authenticate
                            </Button>
                          </div>
                        )}

                        {isGoogle && !googleConnected && (
                          <Button onClick={handleGoogleConnect} disabled={authUrlMutation.isPending}
                            className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium w-full">
                            {authUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                            Connect Google Account
                          </Button>
                        )}

                        {/* API Key management for non-OAuth integrations */}
                        {!isGoogle && (integration.type === "api_key" || integration.type === "custom") && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <Key className="h-3.5 w-3.5" />
                              <span className="uppercase tracking-wider font-medium">API Key</span>
                            </div>
                            {editingApiKey === integration.id ? (
                              <div className="flex gap-2">
                                <Input
                                  type="password"
                                  placeholder="Enter API key..."
                                  value={apiKeyValue}
                                  onChange={(e) => setApiKeyValue(e.target.value)}
                                  className="bg-zinc-800/50 border-zinc-700 text-white h-9 text-sm flex-1"
                                />
                                <Button size="sm" onClick={() => handleSaveApiKey(integration.id)}
                                  className="bg-yellow-600 hover:bg-yellow-700 text-black h-9 px-3">
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingApiKey(null); setApiKeyValue(""); }}
                                  className="border-zinc-700 text-zinc-400 h-9 px-3">
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs text-zinc-500 bg-zinc-800/30 px-3 py-2 rounded-lg border border-zinc-800/40 truncate">
                                  {integration.apiKey ? "••••••••••••••••" : "No API key configured"}
                                </code>
                                <Button size="sm" variant="outline" onClick={() => { setEditingApiKey(integration.id); setApiKeyValue(integration.apiKey || ""); }}
                                  className="border-zinc-700 text-zinc-400 hover:text-white h-8 px-3">
                                  <Edit3 className="h-3 w-3 mr-1" />Edit
                                </Button>
                              </div>
                            )}

                            {isFathom && (
                              <p className="text-[10px] text-zinc-600">
                                Fathom API key is managed via environment variables. Update it in the Secrets panel of the Management UI.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Webhook URL for webhook-type integrations */}
                        {integration.type === "webhook" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <Webhook className="h-3.5 w-3.5" />
                              <span className="uppercase tracking-wider font-medium">Webhook Endpoint</span>
                            </div>
                            <code className="text-xs text-zinc-400 bg-zinc-800/30 px-3 py-2 rounded-lg border border-zinc-800/40 block break-all">
                              POST /api/webhook/ingest
                            </code>
                            <p className="text-[10px] text-zinc-600">
                              Send payloads to this endpoint. OmniScope will auto-detect the source and process accordingly.
                            </p>
                          </div>
                        )}

                        {/* Base URL for custom integrations */}
                        {integration.baseUrl && (
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <Globe className="h-3.5 w-3.5" />
                            <span>Base URL: <span className="text-zinc-300">{integration.baseUrl}</span></span>
                          </div>
                        )}

                        {/* Last sync */}
                        {integration.lastSyncAt && (
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Last synced: <span className="text-zinc-300">{new Date(integration.lastSyncAt).toLocaleString()}</span></span>
                          </div>
                        )}

                        {/* Delete for custom integrations */}
                        {!integration.isBuiltIn && (
                          <div className="pt-2 border-t border-zinc-800/40">
                            <Button variant="outline" size="sm" onClick={() => handleDelete(integration.id)}
                              className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-8">
                              <Trash2 className="h-3 w-3 mr-1.5" />Remove Integration
                            </Button>
                          </div>
                        )}

                        {/* "Coming Soon" for unconnected built-in future integrations */}
                        {integration.isBuiltIn && integration.status === "disconnected" && !isGoogle && integration.type === "oauth" && (
                          <div className="p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/30 text-center">
                            <p className="text-xs text-zinc-500">OAuth integration coming soon. Enable to be notified when available.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Custom Integration Modal */}
      {showAddCustom && (
        <Card className="bg-zinc-900/60 border-yellow-600/20 ring-1 ring-yellow-600/10">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-yellow-500" />
                Add Custom Integration
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAddCustom(false)} className="text-zinc-500 hover:text-white h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Name *</label>
                <Input placeholder="e.g., Twilio" value={customForm.name}
                  onChange={(e) => setCustomForm({ ...customForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })}
                  className="bg-zinc-800/50 border-zinc-700 text-white h-9" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Slug (auto)</label>
                <Input placeholder="auto-generated" value={customForm.slug} readOnly
                  className="bg-zinc-800/30 border-zinc-800 text-zinc-500 h-9" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Description</label>
              <Input placeholder="What does this integration do?" value={customForm.description}
                onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                className="bg-zinc-800/50 border-zinc-700 text-white h-9" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Type</label>
                <select value={customForm.type}
                  onChange={(e) => setCustomForm({ ...customForm, type: e.target.value as any })}
                  className="w-full bg-zinc-800/50 border border-zinc-700 text-white h-9 rounded-md px-3 text-sm">
                  <option value="api_key">API Key</option>
                  <option value="webhook">Webhook</option>
                  <option value="oauth">OAuth</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Base URL</label>
                <Input placeholder="https://api.example.com" value={customForm.baseUrl}
                  onChange={(e) => setCustomForm({ ...customForm, baseUrl: e.target.value })}
                  className="bg-zinc-800/50 border-zinc-700 text-white h-9" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">API Key</label>
              <Input type="password" placeholder="Enter API key (optional)" value={customForm.apiKey}
                onChange={(e) => setCustomForm({ ...customForm, apiKey: e.target.value })}
                className="bg-zinc-800/50 border-zinc-700 text-white h-9" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddCustom(false)}
                className="border-zinc-700 text-zinc-400 hover:text-white">Cancel</Button>
              <Button onClick={handleAddCustom}
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                <Plus className="h-4 w-4 mr-1.5" />Add Integration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// FEATURE CONTROLS TAB

const FEATURE_CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  core: { label: "Core Platform", icon: <Shield className="h-4 w-4" />, description: "Essential features that power the platform" },
  communication: { label: "Communication", icon: <MessageSquare className="h-4 w-4" />, description: "Email, calendar, and messaging" },
  intelligence: { label: "Intelligence & AI", icon: <Bot className="h-4 w-4" />, description: "AI-powered analysis and insights" },
  operations: { label: "Operations", icon: <Briefcase className="h-4 w-4" />, description: "Documents, tasks, and workflows" },
  experimental: { label: "Experimental", icon: <Sparkles className="h-4 w-4" />, description: "Beta features in development" },
};

function FeatureControlsTab() {
  const { data: toggles, isLoading } = trpc.integrations.listToggles.useQuery();
  const setToggleMutation = trpc.integrations.setToggle.useMutation();
  const utils = trpc.useUtils();

  const handleToggle = async (key: string, enabled: boolean) => {
    try {
      await setToggleMutation.mutateAsync({ key, enabled });
      utils.integrations.listToggles.invalidate();
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update feature toggle");
    }
  };

  // Group by category
  const grouped = useMemo(() => {
    if (!toggles) return {};
    const groups: Record<string, typeof toggles> = {};
    for (const t of toggles) {
      const cat = t.category || "core";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [toggles]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full bg-zinc-800/40 rounded-xl" />)}
      </div>
    );
  }

  const categoryOrder = ["core", "communication", "intelligence", "operations", "experimental"];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40 flex items-start gap-3">
        <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-zinc-300">Feature Controls</p>
          <p className="text-xs text-zinc-500 mt-1">
            Enable or disable entire modules across the platform. Core features cannot be disabled.
            Changes take effect immediately for all users.
          </p>
        </div>
      </div>

      {categoryOrder.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const meta = FEATURE_CATEGORY_META[cat];

        return (
          <div key={cat}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-zinc-500">{meta.icon}</span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{meta.label}</h2>
                <p className="text-[10px] text-zinc-600">{meta.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              {items.map((toggle) => (
                <div
                  key={toggle.id}
                  className={`p-4 rounded-xl border transition-all ${
                    toggle.enabled
                      ? "bg-zinc-900/40 border-zinc-800/50"
                      : "bg-zinc-950/30 border-zinc-800/30 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`h-2 w-2 rounded-full ${toggle.enabled ? "bg-emerald-400" : "bg-zinc-600"}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white">{toggle.label}</h3>
                          {toggle.isLocked && (
                            <Lock className="h-3 w-3 text-zinc-600" />
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{toggle.description}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => !toggle.isLocked && handleToggle(toggle.featureKey, !toggle.enabled)}
                      disabled={toggle.isLocked}
                      className={`relative rounded-full transition-colors duration-200 ${
                        toggle.isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                      } ${toggle.enabled ? "bg-yellow-600" : "bg-zinc-700"}`}
                      style={{ width: 44, height: 24 }}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                        toggle.enabled ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// WEBHOOKS TAB

function WebhooksTab() {
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  useEffect(() => {
    setRedirectUri(`${window.location.origin}/api/google/callback`);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Active Webhooks */}
      <Card className="bg-zinc-900/40 border-zinc-800/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Webhook className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-base text-white">Active Webhooks</CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">Incoming data endpoints</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Plaud */}
          <div className="p-4 rounded-xl bg-zinc-800/20 border border-zinc-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-purple-400">P</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Plaud Webhook</p>
                <p className="text-xs text-zinc-500">Auto-ingest meeting recordings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">Listening</span>
            </div>
          </div>

          {/* Zapier */}
          <div className="p-4 rounded-xl bg-zinc-800/20 border border-zinc-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-400">Z</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Zapier Webhook</p>
                <p className="text-xs text-zinc-500">Custom automation triggers</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">Listening</span>
            </div>
          </div>

          {/* Fathom */}
          <div className="p-4 rounded-xl bg-zinc-800/20 border border-zinc-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-violet-400">F</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Fathom AI Webhook</p>
                <p className="text-xs text-zinc-500">Meeting transcripts & summaries</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">Listening</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Endpoint */}
      <Card className="bg-zinc-900/40 border-zinc-800/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Link2 className="h-4 w-4 text-zinc-500" />
            Endpoint Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-2 block">Ingest Endpoint</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-yellow-400 bg-zinc-900/60 px-4 py-2.5 rounded-lg border border-zinc-800/40 break-all font-mono">
                POST /api/webhook/ingest
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/api/webhook/ingest`)}
                className="border-zinc-700 text-zinc-400 hover:text-white h-9 px-3">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">
              Send meeting transcripts, recordings, or structured data. OmniScope auto-detects the source format.
            </p>
          </div>

          {redirectUri && (
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-2 block">Google OAuth Redirect URI</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-blue-400 bg-zinc-900/60 px-4 py-2.5 rounded-lg border border-zinc-800/40 break-all font-mono">
                  {redirectUri}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(redirectUri)}
                  className="border-zinc-700 text-zinc-400 hover:text-white h-9 px-3">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">
                Register this URI in{" "}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                  Google Cloud Console
                </a>{" "}
                under OAuth 2.0 Client ID → Authorized redirect URIs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40 flex items-start gap-3">
        <Shield className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-zinc-300">Webhook Security</p>
          <p className="text-xs text-zinc-500 mt-1">
            All webhook endpoints validate payload signatures when a webhook secret is configured.
            OAuth tokens are encrypted at rest and auto-refresh on expiry.
          </p>
        </div>
      </div>
    </div>
  );
}


// OMNI ASSISTANT TAB

const OMNI_MODE_KEY = "omniscope-omni-mode";
const OMNI_SIDEBAR_KEY = "omniscope-omni-sidebar-visible";

function OmniTab() {
  const { prefs: designPrefs } = useDesign();
  const currentTheme = designPrefs?.theme || "obsidian";

  const [mode, setMode] = useState<OmniMode>(() => {
    try { return (localStorage.getItem(OMNI_MODE_KEY) as OmniMode) || "sigil"; } catch { return "sigil"; }
  });
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    try { return localStorage.getItem(OMNI_SIDEBAR_KEY) !== "false"; } catch { return true; }
  });
  const [previewState, setPreviewState] = useState<OmniState>("idle");
  const [omniPrefs, setOmniPrefs] = useState<OmniPreferences>(getOmniPreferences);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleModeChange = (newMode: OmniMode) => {
    setMode(newMode);
    try { localStorage.setItem(OMNI_MODE_KEY, newMode); } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: OMNI_MODE_KEY, newValue: newMode }));
    toast.success(`Omni appearance set to ${newMode === "sigil" ? "Sigil" : newMode === "character" ? "Character" : "Hidden"}`);
  };

  const handleSidebarToggle = (visible: boolean) => {
    setSidebarVisible(visible);
    try { localStorage.setItem(OMNI_SIDEBAR_KEY, String(visible)); } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: OMNI_SIDEBAR_KEY, newValue: String(visible) }));
  };

  const handlePrefToggle = (key: keyof OmniPreferences) => {
    const updated = { ...omniPrefs, [key]: !omniPrefs[key] };
    setOmniPrefs(updated);
    setOmniPreferences(updated);
    toast.success(`${key === "emotionalReactions" ? "Emotional reactions" : key === "idleAnimations" ? "Idle animations" : "Proactive states"} ${updated[key] ? "enabled" : "disabled"}`);
  };

  const modes: { id: OmniMode; label: string; description: string }[] = [
    { id: "sigil", label: "Sigil", description: "Concentric gold rings — institutional, geometric, premium" },
    { id: "character", label: "Character", description: "NOMI-inspired companion — expressive eyes, interactive personality" },
    { id: "hidden", label: "Hidden", description: "No floating avatar — access Omni only from sidebar or ⌘K" },
  ];

  // All emotional states with descriptions and triggers
  const allStates: { id: OmniState; label: string; description: string; trigger: string; color: string; category: "core" | "emotional" | "action" }[] = [
    { id: "idle", label: "Idle", description: "Calm, breathing — ready when you are", trigger: "Default resting state", color: OMNI_THEME_PALETTES[currentTheme]?.rim || "#d4af37", category: "core" },
    { id: "hover", label: "Hover", description: "Attentive — eyes tracking, glow intensifies", trigger: "Mouse hovers over Omni", color: OMNI_THEME_PALETTES[currentTheme]?.rim || "#d4af37", category: "core" },
    { id: "thinking", label: "Thinking", description: "Processing your request — contemplative, focused", trigger: "AI is generating a response", color: STATE_OVERLAYS.thinking?.color || "#6366f1", category: "core" },
    { id: "success", label: "Success", description: "Task complete — brief celebration", trigger: "Action completed successfully", color: STATE_OVERLAYS.success?.color || "#22c55e", category: "core" },
    { id: "error", label: "Error", description: "Something went wrong — subtle concern", trigger: "An operation failed", color: STATE_OVERLAYS.error?.color || "#ef4444", category: "core" },
    { id: "curious", label: "Curious", description: "Wide-eyed, inquisitive — tilted head", trigger: "New or unusual data detected", color: OMNI_THEME_PALETTES[currentTheme]?.rim || "#d4af37", category: "emotional" },
    { id: "concerned", label: "Concerned", description: "Slightly worried — narrowed eyes, warm amber glow", trigger: "Overdue items detected (1-3)", color: STATE_OVERLAYS.concerned?.color || "#f59e0b", category: "emotional" },
    { id: "focused", label: "Focused", description: "Deep concentration — narrowed eyes, blue glow", trigger: "Many high-priority items (5+)", color: STATE_OVERLAYS.focused?.color || "#3b82f6", category: "emotional" },
    { id: "alert", label: "Alert", description: "Urgent attention needed — orange pulse", trigger: "Critical overdue items (3+)", color: STATE_OVERLAYS.alert?.color || "#f97316", category: "emotional" },
    { id: "proud", label: "Proud", description: "Celebrating your accomplishments — sparkles", trigger: "All tasks completed for the day", color: STATE_OVERLAYS.proud?.color || "#eab308", category: "emotional" },
    { id: "waiting", label: "Waiting", description: "Patient, calm dots — cyan glow", trigger: "Pending approvals (5+)", color: STATE_OVERLAYS.waiting?.color || "#06b6d4", category: "emotional" },
    { id: "relaxed", label: "Relaxed", description: "Content, gentle float — soft gold", trigger: "Light workload, everything under control", color: OMNI_THEME_PALETTES[currentTheme]?.rim || "#d4af37", category: "emotional" },
    { id: "wave", label: "Wave", description: "Friendly greeting — arm wave gesture", trigger: "First visit of the day", color: OMNI_THEME_PALETTES[currentTheme]?.rim || "#d4af37", category: "action" },
    { id: "thumbsup", label: "Thumbs Up", description: "Approval gesture — encouraging", trigger: "Task marked as complete", color: OMNI_THEME_PALETTES[currentTheme]?.rim || "#d4af37", category: "action" },
    { id: "celebrate", label: "Celebrate", description: "Full celebration — sparkles and ring flash", trigger: "Major milestone achieved", color: STATE_OVERLAYS.celebrate?.color || "#eab308", category: "action" },
  ];

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Toggle component for reuse
  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`relative rounded-full transition-colors duration-200 flex-shrink-0 ${
        enabled ? "bg-yellow-600" : "bg-zinc-700"
      }`}
      style={{ width: 44, height: 24 }}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
        enabled ? "translate-x-5" : "translate-x-0"
      }`} />
    </button>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Live Preview */}
      <Card className="bg-zinc-900/40 border-zinc-800/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Omni Assistant
          </CardTitle>
          <p className="text-xs text-zinc-500 mt-1">
            Your persistent AI companion. Omni reacts to your workload, tracks your cursor, and adapts its emotional state based on real-time portal data.
          </p>
        </CardHeader>
        <CardContent>
          {/* Live Preview Area */}
          <div className="mb-8">
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium mb-3 block">Live Preview</label>
            <div className="bg-black/40 rounded-xl border border-zinc-800/40 p-8 flex flex-col items-center gap-6">
              {mode === "hidden" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <EyeOff className="h-10 w-10 text-zinc-600" />
                  <p className="text-sm text-zinc-500">Avatar hidden — use ⌘K or sidebar to access Omni</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <OmniAvatar mode={mode} state={previewState} size={96} badge={previewState === "idle"} theme={currentTheme} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">
                      {mode === "sigil" ? "OmniScope Sigil" : "NOMI Companion"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {allStates.find(s => s.id === previewState)?.description || ""}
                    </p>
                  </div>
                </>
              )}

              {/* State selector — all states, grouped */}
              {mode !== "hidden" && (
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {allStates.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setPreviewState(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          previewState === s.id
                            ? "text-white border"
                            : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                        style={previewState === s.id ? {
                          backgroundColor: `${s.color}20`,
                          borderColor: `${s.color}50`,
                          color: s.color,
                        } : undefined}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mode Selector */}
          <div className="mb-8">
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium mb-3 block">Appearance Mode</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === m.id
                      ? "bg-yellow-600/10 border-yellow-600/30 ring-1 ring-yellow-600/10"
                      : "bg-zinc-900/30 border-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      mode === m.id ? "bg-yellow-600/20" : "bg-zinc-800"
                    }`}>
                      {m.id === "sigil" && <Monitor className={`h-4 w-4 ${mode === m.id ? "text-yellow-500" : "text-zinc-500"}`} />}
                      {m.id === "character" && <Eye className={`h-4 w-4 ${mode === m.id ? "text-yellow-500" : "text-zinc-500"}`} />}
                      {m.id === "hidden" && <EyeOff className={`h-4 w-4 ${mode === m.id ? "text-yellow-500" : "text-zinc-500"}`} />}
                    </div>
                    <span className={`text-sm font-semibold ${mode === m.id ? "text-yellow-400" : "text-white"}`}>
                      {m.label}
                    </span>
                    {mode === m.id && (
                      <Badge className="ml-auto bg-yellow-600/20 text-yellow-500 border-yellow-600/30 text-[9px]">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{m.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar Toggle */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium mb-3 block">Sidebar Visibility</label>
            <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-white">Show "Ask Omni" in sidebar</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Display the Ask Omni entry in the sidebar navigation. You can always use ⌘K regardless.
                  </p>
                </div>
              </div>
              <Toggle enabled={sidebarVisible} onToggle={() => handleSidebarToggle(!sidebarVisible)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Behavior Controls */}
      <Card className="bg-zinc-900/40 border-zinc-800/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-yellow-500" />
            Behavior Controls
          </CardTitle>
          <p className="text-xs text-zinc-500 mt-1">
            Fine-tune how Omni behaves. Toggle individual features on or off.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Emotional Reactions Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Eye className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Emotional Reactions</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Omni changes its expression and glow color based on its emotional state. When off, Omni stays in a calm idle state.
                </p>
              </div>
            </div>
            <Toggle enabled={omniPrefs.emotionalReactions} onToggle={() => handlePrefToggle("emotionalReactions")} />
          </div>

          {/* Idle Animations Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Zap className="h-4 w-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Idle Animations</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Gentle floating, occasional glances, and curiosity tilts when Omni is resting. When off, Omni stays still.
                </p>
              </div>
            </div>
            <Toggle enabled={omniPrefs.idleAnimations} onToggle={() => handlePrefToggle("idleAnimations")} />
          </div>

          {/* Proactive State Changes Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Proactive State Changes</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Omni automatically reacts to your triage data — overdue tasks, pending approvals, workload levels. When off, Omni only reacts to direct interactions.
                </p>
              </div>
            </div>
            <Toggle enabled={omniPrefs.proactiveStates} onToggle={() => handlePrefToggle("proactiveStates")} />
          </div>
        </CardContent>
      </Card>

      {/* Emotional States Guide */}
      <Card className="bg-zinc-900/40 border-zinc-800/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Palette className="h-5 w-5 text-yellow-500" />
            Emotional States Guide
          </CardTitle>
          <p className="text-xs text-zinc-500 mt-1">
            Omni has 15 distinct emotional states. Each state changes the eye shape, rim glow color, and animation. Click any state above in the preview to see it live.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Core States */}
          <button
            onClick={() => toggleSection("core")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/40 hover:bg-zinc-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Core States</span>
              <span className="text-[10px] text-zinc-600 ml-1">Always active</span>
            </div>
            {expandedSection === "core" ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
          </button>
          {expandedSection === "core" && (
            <div className="space-y-2 pl-1">
              {allStates.filter(s => s.category === "core").map((s) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/30">
                  <div className="h-3 w-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{s.label}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>
                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" /> Trigger: {s.trigger}
                    </p>
                  </div>
                  <button
                    onClick={() => setPreviewState(s.id)}
                    className="text-[10px] text-zinc-500 hover:text-yellow-400 transition-colors px-2 py-1 rounded border border-zinc-800/40 hover:border-yellow-600/30 flex-shrink-0"
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Emotional States */}
          <button
            onClick={() => toggleSection("emotional")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/40 hover:bg-zinc-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Emotional States</span>
              <span className="text-[10px] text-zinc-600 ml-1">Data-driven reactions</span>
            </div>
            {expandedSection === "emotional" ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
          </button>
          {expandedSection === "emotional" && (
            <div className="space-y-2 pl-1">
              {allStates.filter(s => s.category === "emotional").map((s) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/30">
                  <div className="h-3 w-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{s.label}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>
                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" /> Trigger: {s.trigger}
                    </p>
                  </div>
                  <button
                    onClick={() => setPreviewState(s.id)}
                    className="text-[10px] text-zinc-500 hover:text-yellow-400 transition-colors px-2 py-1 rounded border border-zinc-800/40 hover:border-yellow-600/30 flex-shrink-0"
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action States */}
          <button
            onClick={() => toggleSection("action")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/40 hover:bg-zinc-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Action States</span>
              <span className="text-[10px] text-zinc-600 ml-1">Gestures & celebrations</span>
            </div>
            {expandedSection === "action" ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
          </button>
          {expandedSection === "action" && (
            <div className="space-y-2 pl-1">
              {allStates.filter(s => s.category === "action").map((s) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/30">
                  <div className="h-3 w-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{s.label}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>
                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" /> Trigger: {s.trigger}
                    </p>
                  </div>
                  <button
                    onClick={() => setPreviewState(s.id)}
                    className="text-[10px] text-zinc-500 hover:text-yellow-400 transition-colors px-2 py-1 rounded border border-zinc-800/40 hover:border-yellow-600/30 flex-shrink-0"
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme Color Adaptation */}
      <Card className="bg-zinc-900/40 border-zinc-800/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Sun className="h-5 w-5 text-yellow-500" />
            Theme Adaptation
          </CardTitle>
          <p className="text-xs text-zinc-500 mt-1">
            Omni's rim and ambient glow automatically adapts to your active design theme. The gold eye core stays consistent as Omni's identity.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(OMNI_THEME_PALETTES).map(([name, palette]) => (
              <div
                key={name}
                className={`p-3 rounded-xl border transition-all ${
                  name === currentTheme
                    ? "border-yellow-600/30 bg-yellow-600/5"
                    : "border-zinc-800/40 bg-zinc-900/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full border border-zinc-700/50" style={{ backgroundColor: palette.rim, boxShadow: `0 0 8px ${palette.rim}40` }} />
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{palette.rim}</p>
                  </div>
                  {name === currentTheme && (
                    <Badge className="ml-auto bg-yellow-600/20 text-yellow-500 border-yellow-600/30 text-[9px]">Active</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-3">
            Change your theme in the Appearance tab to see Omni adapt.
          </p>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40 flex items-start gap-3">
        <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-zinc-300">Keyboard Shortcuts</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <kbd className="text-[10px] text-zinc-400 font-mono bg-zinc-800 border border-zinc-700/60 px-1.5 py-0.5 rounded">⌘K</kbd>
              <span className="text-xs text-zinc-500">Open Ask Omni from anywhere</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="text-[10px] text-zinc-400 font-mono bg-zinc-800 border border-zinc-700/60 px-1.5 py-0.5 rounded">Esc</kbd>
              <span className="text-xs text-zinc-500">Close Omni panel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// APPEARANCE TAB — Design Templates, Logo, Accent Color, Sidebar Style

const DESIGN_TEMPLATES = [
  {
    id: "obsidian" as const,
    name: "Obsidian",
    description: "Default black & gold — institutional, premium",
    accent: "#d4af37",
    bg: "#000000",
    card: "#0a0a0a",
    text: "#ffffff",
    preview: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)",
    accentPreview: "linear-gradient(135deg, #d4af37, #b8962e)",
  },
  {
    id: "ivory" as const,
    name: "Ivory",
    description: "Light mode — clean, minimal, Apple-inspired",
    accent: "#1a1a1a",
    bg: "#fafafa",
    card: "#ffffff",
    text: "#0a0a0a",
    preview: "linear-gradient(135deg, #fafafa 0%, #f0f0f0 50%, #fafafa 100%)",
    accentPreview: "linear-gradient(135deg, #1a1a1a, #333333)",
  },
  {
    id: "midnight" as const,
    name: "Midnight",
    description: "Deep navy & silver — sophisticated, modern",
    accent: "#7c8db5",
    bg: "#0b0e17",
    card: "#111827",
    text: "#e5e7eb",
    preview: "linear-gradient(135deg, #0b0e17 0%, #111827 50%, #0b0e17 100%)",
    accentPreview: "linear-gradient(135deg, #7c8db5, #5b6f96)",
  },
  {
    id: "emerald" as const,
    name: "Emerald",
    description: "Dark with green accents — wealth, growth",
    accent: "#10b981",
    bg: "#030712",
    card: "#0a1628",
    text: "#e5e7eb",
    preview: "linear-gradient(135deg, #030712 0%, #0a1628 50%, #030712 100%)",
    accentPreview: "linear-gradient(135deg, #10b981, #059669)",
  },
  {
    id: "slate" as const,
    name: "Slate",
    description: "Warm grey & amber — understated, professional",
    accent: "#f59e0b",
    bg: "#0f0f0f",
    card: "#1c1917",
    text: "#e7e5e4",
    preview: "linear-gradient(135deg, #0f0f0f 0%, #1c1917 50%, #0f0f0f 100%)",
    accentPreview: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
];

const SIDEBAR_STYLES = [
  { id: "default" as const, name: "Standard", description: "Full sidebar with labels and section headers" },
  { id: "compact" as const, name: "Compact", description: "Narrower sidebar with tighter spacing" },
  { id: "minimal" as const, name: "Minimal", description: "Ultra-clean with reduced visual elements" },
];

const ACCENT_PRESETS = [
  { color: "#d4af37", name: "Gold" },
  { color: "#3b82f6", name: "Blue" },
  { color: "#10b981", name: "Emerald" },
  { color: "#8b5cf6", name: "Violet" },
  { color: "#f43f5e", name: "Rose" },
  { color: "#f59e0b", name: "Amber" },
  { color: "#06b6d4", name: "Cyan" },
  { color: "#ec4899", name: "Pink" },
  { color: "#ffffff", name: "White" },
];

function AppearanceTab() {
  const { accentColor, logoUrl, theme, refetch } = useDesign();
  const designQuery = trpc.design.get.useQuery();
  const updateMutation = trpc.design.update.useMutation({
    onSuccess: () => {
      refetch();
      designQuery.refetch();
      toast.success("Appearance updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });
  const uploadLogoMutation = trpc.design.uploadLogo.useMutation({
    onSuccess: () => {
      refetch();
      designQuery.refetch();
      toast.success("Logo updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to upload logo"),
  });

  const currentTheme = designQuery.data?.theme || "obsidian";
  const currentAccent = designQuery.data?.accentColor || "#d4af37";
  const currentSidebarStyle = designQuery.data?.sidebarStyle || "default";
  const currentLogo = designQuery.data?.logoUrl;

  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [selectedAccent, setSelectedAccent] = useState(currentAccent);
  const [selectedSidebarStyle, setSelectedSidebarStyle] = useState(currentSidebarStyle);
  const [customAccent, setCustomAccent] = useState(currentAccent);
  const [uploading, setUploading] = useState(false);

  // Sync with server data
  useEffect(() => {
    if (designQuery.data) {
      setSelectedTheme(designQuery.data.theme || "obsidian");
      setSelectedAccent(designQuery.data.accentColor || "#d4af37");
      setSelectedSidebarStyle(designQuery.data.sidebarStyle || "default");
      setCustomAccent(designQuery.data.accentColor || "#d4af37");
    }
  }, [designQuery.data]);

  const handleThemeSelect = (themeId: string) => {
    const template = DESIGN_TEMPLATES.find(t => t.id === themeId);
    setSelectedTheme(themeId);
    if (template) {
      setSelectedAccent(template.accent);
      setCustomAccent(template.accent);
    }
    updateMutation.mutate({ 
      theme: themeId as any,
      accentColor: template?.accent,
    });
  };

  const handleAccentSelect = (color: string) => {
    setSelectedAccent(color);
    setCustomAccent(color);
    updateMutation.mutate({ accentColor: color });
  };

  const handleSidebarStyleSelect = (style: string) => {
    setSelectedSidebarStyle(style);
    updateMutation.mutate({ sidebarStyle: style as any });
  };

  const handleLogoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
      setUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadLogoMutation.mutate({ base64, mimeType: file.type }, {
          onSettled: () => setUploading(false),
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleRemoveLogo = () => {
    updateMutation.mutate({ logoUrl: null });
  };

  const hasChanges = selectedTheme !== currentTheme || selectedAccent !== currentAccent || selectedSidebarStyle !== currentSidebarStyle;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Section: Logo */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `rgba(${hexToRgb(selectedAccent)}, 0.1)` }}>
            <Upload className="h-4 w-4" style={{ color: selectedAccent }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Brand Logo</h3>
            <p className="text-xs text-zinc-500">Upload your custom logo for the sidebar and login page</p>
          </div>
        </div>

        <div className="p-6 rounded-xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-6">
            {/* Logo Preview */}
            <div 
              className="w-40 h-20 rounded-xl flex items-center justify-center relative group overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(255,255,255,0.1)' }}
            >
              {currentLogo ? (
                <>
                  <img src={currentLogo} alt="Custom Logo" className="max-w-full max-h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={handleLogoUpload} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                      <Edit3 className="h-3.5 w-3.5 text-white" />
                    </button>
                    <button onClick={handleRemoveLogo} className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <Upload className="h-5 w-5 text-zinc-600 mx-auto mb-1" />
                  <span className="text-[10px] text-zinc-600">No logo</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <Button
                onClick={handleLogoUpload}
                disabled={uploading}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {currentLogo ? "Replace Logo" : "Upload Logo"}
              </Button>
              <p className="text-[10px] text-zinc-600">PNG, JPG, SVG, or WebP. Max 5MB. Recommended: 160×40px or similar aspect ratio.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Design Templates */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `rgba(${hexToRgb(selectedAccent)}, 0.1)` }}>
            <Palette className="h-4 w-4" style={{ color: selectedAccent }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Design Templates</h3>
            <p className="text-xs text-zinc-500">Choose a pre-built theme that matches your brand</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {DESIGN_TEMPLATES.map((template) => {
            const isActive = selectedTheme === template.id;
            return (
              <button
                key={template.id}
                onClick={() => handleThemeSelect(template.id)}
                className="text-left rounded-xl overflow-hidden transition-all duration-200 group relative"
                style={{
                  border: isActive ? `2px solid ${template.accent}` : '2px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Theme Preview */}
                <div className="h-24 relative" style={{ background: template.preview }}>
                  {/* Mini sidebar preview */}
                  <div className="absolute left-0 top-0 bottom-0 w-8" style={{ background: template.card, borderRight: `1px solid rgba(255,255,255,0.05)` }}>
                    <div className="mt-3 mx-1.5 space-y-1.5">
                      {[1,2,3].map(i => (
                        <div key={i} className="h-1 rounded-full" style={{ 
                          background: i === 1 ? template.accent : 'rgba(255,255,255,0.1)',
                          width: i === 1 ? '100%' : '70%',
                        }} />
                      ))}
                    </div>
                  </div>
                  {/* Mini content preview */}
                  <div className="absolute left-10 top-3 right-2">
                    <div className="h-2 w-16 rounded-sm mb-2" style={{ background: `${template.accent}40` }} />
                    <div className="h-1.5 w-full rounded-sm mb-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <div className="h-1.5 w-3/4 rounded-sm" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                  {/* Accent dot */}
                  <div className="absolute bottom-2 right-2 h-4 w-4 rounded-full" style={{ background: template.accentPreview }} />
                  {/* Active checkmark */}
                  {isActive && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center" style={{ backgroundColor: template.accent }}>
                      <Check className="h-3 w-3" style={{ color: template.bg }} />
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className="px-3 py-2.5" style={{ background: template.card }}>
                  <p className="text-xs font-semibold" style={{ color: template.text }}>{template.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: `${template.text}80` }}>{template.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section: Accent Color */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `rgba(${hexToRgb(selectedAccent)}, 0.1)` }}>
            <Sun className="h-4 w-4" style={{ color: selectedAccent }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Accent Color</h3>
            <p className="text-xs text-zinc-500">Customize the primary accent used across the interface</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
          {/* Preset Colors */}
          <div className="flex items-center gap-2 mb-4">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.color}
                onClick={() => handleAccentSelect(preset.color)}
                className="relative group"
                title={preset.name}
              >
                <div 
                  className="h-8 w-8 rounded-full transition-transform duration-200 group-hover:scale-110"
                  style={{ 
                    backgroundColor: preset.color,
                    boxShadow: selectedAccent === preset.color ? `0 0 0 2px #000, 0 0 0 4px ${preset.color}` : 'none',
                    border: preset.color === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  }}
                />
                {selectedAccent === preset.color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5" style={{ color: preset.color === '#ffffff' || preset.color === '#f59e0b' || preset.color === '#d4af37' ? '#000' : '#fff' }} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom Color Input */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="h-5 w-5 rounded-md" style={{ backgroundColor: customAccent }} />
              <Input
                value={customAccent}
                onChange={(e) => setCustomAccent(e.target.value)}
                className="w-24 h-7 text-xs bg-transparent border-none p-0 text-zinc-300 font-mono"
                placeholder="#d4af37"
              />
            </div>
            <Button
              onClick={() => handleAccentSelect(customAccent)}
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-400 hover:text-white text-xs"
              disabled={customAccent === selectedAccent}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      {/* Section: Sidebar Style */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `rgba(${hexToRgb(selectedAccent)}, 0.1)` }}>
            <Layout className="h-4 w-4" style={{ color: selectedAccent }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Sidebar Style</h3>
            <p className="text-xs text-zinc-500">Choose how the navigation sidebar appears</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {SIDEBAR_STYLES.map((style) => {
            const isActive = selectedSidebarStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() => handleSidebarStyleSelect(style.id)}
                className="p-4 rounded-xl text-left transition-all duration-200"
                style={{
                  background: isActive ? `rgba(${hexToRgb(selectedAccent)}, 0.06)` : 'rgba(255,255,255,0.02)',
                  border: isActive ? `1px solid rgba(${hexToRgb(selectedAccent)}, 0.3)` : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">{style.name}</span>
                  {isActive && (
                    <div className="h-4 w-4 rounded-full flex items-center justify-center" style={{ backgroundColor: selectedAccent }}>
                      <Check className="h-2.5 w-2.5 text-black" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">{style.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Preview Card — Reactive */}
      {(() => {
        const tpl = DESIGN_TEMPLATES.find(t => t.id === selectedTheme) || DESIGN_TEMPLATES[0];
        const isLight = selectedTheme === "ivory";
        const previewBg = tpl.bg;
        const previewCard = tpl.card;
        const previewText = tpl.text;
        const previewBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
        const previewMuted = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
        const previewSidebar = isLight ? '#f5f5f5' : 'rgba(15,15,15,0.98)';
        const previewSidebarBorder = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
        const sidebarW = selectedSidebarStyle === "compact" ? 'w-10' : selectedSidebarStyle === "minimal" ? 'w-8' : 'w-12';
        return (
          <div className="p-5 rounded-xl border transition-all duration-300" style={{ background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderColor: previewBorder }}>
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="h-4 w-4" style={{ color: isLight ? '#666' : '#888' }} />
              <span className="text-xs font-semibold" style={{ color: previewText }}>Live Preview</span>
              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">LIVE</Badge>
            </div>
            <div className="h-36 rounded-lg overflow-hidden flex transition-all duration-500" style={{ background: previewBg, border: `1px solid ${previewBorder}` }}>
              {/* Mini sidebar */}
              <div className={`${sidebarW} h-full flex flex-col items-center py-3 gap-2 transition-all duration-300 shrink-0`} style={{ background: previewSidebar, borderRight: `1px solid ${previewSidebarBorder}` }}>
                <div className="h-5 w-5 rounded-md transition-colors duration-300" style={{ background: `rgba(${hexToRgb(selectedAccent)}, 0.15)`, border: `1px solid rgba(${hexToRgb(selectedAccent)}, 0.25)` }} />
                <div className="flex-1 flex flex-col items-center gap-1.5 mt-1">
                  {[true, false, false, false, false].map((active, i) => (
                    <div key={i} className="h-1 w-4 rounded-full transition-colors duration-300" style={{ background: active ? selectedAccent : previewMuted }} />
                  ))}
                </div>
                <div className="h-4 w-4 rounded-full transition-colors duration-300" style={{ backgroundColor: selectedAccent }} />
              </div>
              {/* Mini content area */}
              <div className="flex-1 p-3">
                {/* Header bar */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-16 rounded-sm transition-colors duration-300" style={{ background: `rgba(${hexToRgb(selectedAccent)}, 0.3)` }} />
                  <div className="flex-1" />
                  <div className="h-2 w-8 rounded-sm" style={{ background: previewMuted }} />
                </div>
                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-12 rounded-md p-1.5 transition-colors duration-300" style={{ background: previewCard, border: `1px solid ${previewBorder}` }}>
                      <div className="h-1 w-5 rounded-full mb-1" style={{ background: i === 1 ? `rgba(${hexToRgb(selectedAccent)}, 0.4)` : previewMuted }} />
                      <div className="h-3 w-4 rounded-sm" style={{ background: i === 1 ? selectedAccent : previewMuted, opacity: i === 1 ? 0.7 : 0.3 }} />
                    </div>
                  ))}
                </div>
                {/* Content lines */}
                <div className="space-y-1">
                  <div className="h-1 w-full rounded-sm" style={{ background: previewMuted }} />
                  <div className="h-1 w-3/4 rounded-sm" style={{ background: previewMuted, opacity: 0.6 }} />
                  <div className="h-1 w-1/2 rounded-sm" style={{ background: previewMuted, opacity: 0.3 }} />
                </div>
              </div>
            </div>
            <p className="text-[10px] mt-2 text-center" style={{ color: isLight ? '#999' : '#555' }}>
              {tpl.name} theme · {selectedSidebarStyle} sidebar · accent {selectedAccent}
            </p>
          </div>
        );
      })()}

      {/* Info Note */}
      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: selectedAccent }} />
        <div>
          <p className="text-xs font-medium text-zinc-300">Design preferences are saved per user</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Each team member can customize their own appearance. Changes apply immediately across the portal.
            Theme templates will be expanded with more options in future updates.
          </p>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  } catch {
    return "212, 175, 55";
  }
}


// ─── PLAN & USAGE TAB ─────────────────────────────────────────────────────────

function PlanUsageTab() {
  const { data: planData, isLoading } = trpc.plans.myPlan.useQuery();
  const { data: allPlans } = trpc.plans.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const plan = planData?.plan;
  const usage = planData?.usage;
  const limits = planData?.limits;
  const context = planData?.context;
  const planKey = context?.planKey || "starter";

  // Plan tier styling
  const tierStyles: Record<string, { gradient: string; border: string; accent: string; label: string }> = {
    starter: {
      gradient: "from-zinc-800/50 to-zinc-900/80",
      border: "border-zinc-700/40",
      accent: "text-zinc-400",
      label: "Starter",
    },
    professional: {
      gradient: "from-blue-950/30 to-zinc-900/80",
      border: "border-blue-800/30",
      accent: "text-blue-400",
      label: "Professional",
    },
    enterprise: {
      gradient: "from-yellow-950/20 to-zinc-900/80",
      border: "border-yellow-700/30",
      accent: "text-yellow-400",
      label: "Enterprise",
    },
    sovereign: {
      gradient: "from-amber-950/30 to-zinc-900/80",
      border: "border-amber-600/30",
      accent: "text-amber-400",
      label: "Sovereign",
    },
  };

  const style = tierStyles[planKey] || tierStyles.starter;

  function formatLimit(val: number | undefined): string {
    if (val === undefined || val === null) return "—";
    if (val === -1) return "Unlimited";
    return val.toLocaleString();
  }

  function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
    const isUnlimited = max === -1;
    const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
    const isWarning = !isUnlimited && pct >= 80;
    const isDanger = !isUnlimited && pct >= 95;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">{label}</span>
          <span className={`text-sm font-medium ${isDanger ? "text-red-400" : isWarning ? "text-yellow-400" : "text-zinc-300"}`}>
            {current.toLocaleString()} / {formatLimit(max)}
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-2 rounded-full overflow-hidden bg-zinc-800">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background: isDanger
                  ? "linear-gradient(90deg, #ef4444, #dc2626)"
                  : isWarning
                  ? "linear-gradient(90deg, #eab308, #f59e0b)"
                  : "linear-gradient(90deg, #22c55e, #16a34a)",
              }}
            />
          </div>
        )}
        {isUnlimited && (
          <div className="h-2 rounded-full overflow-hidden bg-zinc-800">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-600/30 to-emerald-500/10" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <div className={`rounded-2xl border ${style.border} bg-gradient-to-br ${style.gradient} overflow-hidden`}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-600/20 to-yellow-600/5 border border-yellow-600/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Current Plan</h2>
                  <p className="text-xs text-zinc-500">Your organization's subscription</p>
                </div>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg border ${style.border} bg-black/20`}>
              <span className={`text-xl font-bold ${style.accent}`}>{style.label}</span>
            </div>
          </div>

          {plan && (
            <div className="mt-6 grid grid-cols-3 gap-6">
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Monthly Price</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {plan.priceMonthly ? `$${plan.priceMonthly}` : "Custom"}
                  {plan.priceMonthly && <span className="text-sm font-normal text-zinc-500">/mo</span>}
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Annual Price</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {plan.priceAnnual ? `$${plan.priceAnnual}` : "Custom"}
                  {plan.priceAnnual && <span className="text-sm font-normal text-zinc-500">/yr</span>}
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Status</span>
                <div className="mt-1">
                  {planData?.subscription ? (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium ${
                      planData.subscription.status === "active"
                        ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/30"
                        : planData.subscription.status === "trialing"
                        ? "bg-blue-950/40 text-blue-400 border border-blue-800/30"
                        : "bg-red-950/40 text-red-400 border border-red-800/30"
                    }`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {planData.subscription.status.charAt(0).toUpperCase() + planData.subscription.status.slice(1)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/30">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      No subscription
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Usage Meters */}
      {usage && limits && (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-5 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-yellow-500" />
            Usage & Limits
          </h3>
          <div className="space-y-5">
            <UsageBar
              current={usage.contacts || 0}
              max={limits.maxContacts || 0}
              label="Contacts"
            />
            <UsageBar
              current={usage.meetings || 0}
              max={limits.maxMeetingsPerMonth || 0}
              label="Meetings (this month)"
            />
            <UsageBar
              current={usage.users || 0}
              max={limits.maxUsersPerOrg || 0}
              label="Team Members"
            />
            <UsageBar
              current={usage.organizations || 0}
              max={limits.maxOrganizations || 0}
              label="Organizations"
            />
          </div>
        </div>
      )}

      {/* Plan Features */}
      {plan?.features && plan.features.length > 0 && (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Included Features
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {plan.features.map((feature: string) => (
              <div
                key={feature}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/20"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-zinc-300 capitalize">
                  {feature.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade Options */}
      {allPlans && allPlans.length > 0 && (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-yellow-500" />
            Available Plans
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allPlans.map((p: any) => {
              const isCurrent = p.key === planKey;
              const pStyle = tierStyles[p.key] || tierStyles.starter;
              return (
                <div
                  key={p.key}
                  className={`rounded-xl border p-4 transition-all ${
                    isCurrent
                      ? `${pStyle.border} bg-gradient-to-br ${pStyle.gradient} ring-1 ring-yellow-600/20`
                      : "border-zinc-800/40 bg-zinc-900/60 hover:border-zinc-700/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-semibold ${pStyle.accent}`}>
                      {p.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-yellow-600/10 text-yellow-500 border border-yellow-600/20">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold text-white mb-3">
                    {p.priceMonthly ? `$${p.priceMonthly}` : "Custom"}
                    {p.priceMonthly && <span className="text-xs font-normal text-zinc-500">/mo</span>}
                  </div>
                  <div className="space-y-1.5 text-xs text-zinc-500">
                    <div>{formatLimit(p.maxContacts)} contacts</div>
                    <div>{formatLimit(p.maxMeetingsPerMonth)} meetings/mo</div>
                    <div>{formatLimit(p.maxUsersPerOrg)} users/org</div>
                    <div>{formatLimit(p.maxOrganizations)} organizations</div>
                    <div>{formatLimit(p.maxStorageGb)} GB storage</div>
                  </div>
                  {!isCurrent && (
                    <button
                      className="mt-4 w-full py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/60 border border-zinc-700/30 hover:bg-zinc-700/60 transition-colors"
                      onClick={() => toast.info("Contact your administrator to change plans.")}
                    >
                      {allPlans.indexOf(p) > allPlans.findIndex((pp: any) => pp.key === planKey)
                        ? "Upgrade"
                        : "Downgrade"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


/* ─────────────────────── Digest Settings Tab ─────────────────────── */
function DigestSettingsTab() {
  const { data: prefs, isLoading } = trpc.digest.getPreferences.useQuery();
  const updatePrefs = trpc.digest.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Digest preferences updated");
      utils.digest.getPreferences.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const previewDaily = trpc.digest.previewDaily.useMutation();
  const previewWeekly = trpc.digest.previewWeekly.useMutation();
  const utils = trpc.useUtils();

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-zinc-900/60 border-zinc-800/60">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const togglePref = (key: string, value: boolean) => {
    updatePrefs.mutate({ [key]: value } as any);
  };

  const sections = [
    { key: "includeMeetingSummaries", label: "Meeting Summaries", desc: "Intelligence briefings from recent meetings" },
    { key: "includeTaskOverview", label: "Task Overview", desc: "Open tasks, priorities, and deadlines" },
    { key: "includeContactActivity", label: "Contact Activity", desc: "New contacts, pending approvals, recent interactions" },
    { key: "includeAiInsights", label: "AI Insights", desc: "Strategic analysis and recommendations" },
    { key: "includeUpcomingCalendar", label: "Upcoming Calendar", desc: "Scheduled meetings and events" },
    { key: "includeKpiMetrics", label: "KPI Metrics", desc: "Key performance indicators and trends" },
  ];

  return (
    <div className="space-y-6">
      {/* Daily Digest */}
      <Card className="bg-zinc-900/60 border-zinc-800/60">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-600/20 to-yellow-600/5 border border-yellow-600/20 flex items-center justify-center">
                <Sun className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">Daily Digest</CardTitle>
                <p className="text-sm text-zinc-500 mt-0.5">Morning briefing delivered every day</p>
              </div>
            </div>
            <button
              onClick={() => togglePref("dailyDigestEnabled", !prefs?.dailyDigestEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs?.dailyDigestEnabled ? "bg-yellow-600" : "bg-zinc-700"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                prefs?.dailyDigestEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-zinc-400 block mb-1">Delivery Time</label>
              <Input
                type="time"
                value={prefs?.dailyDigestTime || "08:00"}
                onChange={(e) => updatePrefs.mutate({ dailyDigestTime: e.target.value })}
                className="bg-zinc-800/60 border-zinc-700 text-white w-32"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-zinc-400 block mb-1">Timezone</label>
              <Input
                value={prefs?.timezone || "America/New_York"}
                onChange={(e) => updatePrefs.mutate({ timezone: e.target.value })}
                className="bg-zinc-800/60 border-zinc-700 text-white"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => previewDaily.mutate({})}
            disabled={previewDaily.isPending}
            className="border-zinc-700 text-zinc-300 hover:text-white"
          >
            {previewDaily.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview Today's Digest
          </Button>
          {previewDaily.data && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-800/40 border border-zinc-700/50 max-h-96 overflow-y-auto">
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{previewDaily.data.markdown}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Digest */}
      <Card className="bg-zinc-900/60 border-zinc-800/60">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-600/5 border border-blue-600/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">Weekly Digest</CardTitle>
                <p className="text-sm text-zinc-500 mt-0.5">Comprehensive weekly intelligence report</p>
              </div>
            </div>
            <button
              onClick={() => togglePref("weeklyDigestEnabled", !prefs?.weeklyDigestEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs?.weeklyDigestEnabled ? "bg-blue-600" : "bg-zinc-700"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                prefs?.weeklyDigestEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-zinc-400 block mb-1">Delivery Day</label>
              <select
                value={prefs?.weeklyDigestDay || "monday"}
                onChange={(e) => updatePrefs.mutate({ weeklyDigestDay: e.target.value as any })}
                className="w-full rounded-md bg-zinc-800/60 border border-zinc-700 text-white px-3 py-2 text-sm"
              >
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                  <option key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm text-zinc-400 block mb-1">Delivery Time</label>
              <Input
                type="time"
                value={prefs?.weeklyDigestTime || "09:00"}
                onChange={(e) => updatePrefs.mutate({ weeklyDigestTime: e.target.value })}
                className="bg-zinc-800/60 border-zinc-700 text-white w-32"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => previewWeekly.mutate({})}
            disabled={previewWeekly.isPending}
            className="border-zinc-700 text-zinc-300 hover:text-white"
          >
            {previewWeekly.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview This Week's Digest
          </Button>
          {previewWeekly.data && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-800/40 border border-zinc-700/50 max-h-96 overflow-y-auto">
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{previewWeekly.data.markdown}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross-Org Consolidation */}
      <Card className="bg-zinc-900/60 border-zinc-800/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-600/20 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Multi-Company Consolidation</CardTitle>
              <p className="text-sm text-zinc-500 mt-0.5">Combine data from all your organizations into one report</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
            <div>
              <p className="text-sm font-medium text-white">Consolidated cross-org digest</p>
              <p className="text-xs text-zinc-500 mt-0.5">See all companies in a single report with per-org sections</p>
            </div>
            <button
              onClick={() => togglePref("crossOrgConsolidated", !prefs?.crossOrgConsolidated)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs?.crossOrgConsolidated ? "bg-emerald-600" : "bg-zinc-700"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                prefs?.crossOrgConsolidated ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Report Sections */}
      <Card className="bg-zinc-900/60 border-zinc-800/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-600/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Report Sections</CardTitle>
              <p className="text-sm text-zinc-500 mt-0.5">Choose what to include in your digests</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sections.map((section) => (
              <div
                key={section.key}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-zinc-600/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-white">{section.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{section.desc}</p>
                </div>
                <button
                  onClick={() => togglePref(section.key, !(prefs as any)?.[section.key])}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    (prefs as any)?.[section.key] ? "bg-yellow-600" : "bg-zinc-700"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    (prefs as any)?.[section.key] ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Method */}
      <Card className="bg-zinc-900/60 border-zinc-800/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-600/20 to-cyan-600/5 border border-cyan-600/20 flex items-center justify-center">
              <Mail className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Delivery Method</CardTitle>
              <p className="text-sm text-zinc-500 mt-0.5">How you receive your digests</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "in_app", label: "In-App Only", icon: <Monitor className="h-5 w-5" /> },
              { value: "email", label: "Email Only", icon: <Mail className="h-5 w-5" /> },
              { value: "both", label: "Both", icon: <Zap className="h-5 w-5" /> },
            ].map((method) => (
              <button
                key={method.value}
                onClick={() => updatePrefs.mutate({ deliveryMethod: method.value as any })}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  prefs?.deliveryMethod === method.value
                    ? "bg-yellow-600/10 border-yellow-600/30 text-yellow-400"
                    : "bg-zinc-800/30 border-zinc-700/30 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600/40"
                }`}
              >
                {method.icon}
                <span className="text-xs font-medium">{method.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
