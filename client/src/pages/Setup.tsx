import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useSearch } from "wouter";
import {
  Mail, Calendar, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ExternalLink, Shield, Clock, Loader2, Copy, Info, User, Settings,
  Link2, Zap, ChevronRight, Sparkles, Eye, EyeOff, Monitor
} from "lucide-react";
import OmniAvatar, { OmniMode, OmniState } from "@/components/OmniAvatar";

type Tab = "profile" | "integrations" | "webhooks" | "omni";

export default function Setup() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const googleStatus = params.get("google");
  const initialTab = params.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || "integrations");

  // Show toast on redirect from Google OAuth
  useEffect(() => {
    if (googleStatus === "connected") {
      toast.success("Google account connected successfully! Gmail and Calendar scopes are now active.");
      setActiveTab("integrations");
      window.history.replaceState({}, "", "/setup?tab=integrations");
    } else if (googleStatus === "error") {
      const msg = params.get("message") || "Unknown error";
      toast.error(`Google connection failed: ${msg}`);
      setActiveTab("integrations");
      window.history.replaceState({}, "", "/setup?tab=integrations");
    }
  }, [googleStatus]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
    { id: "integrations", label: "Integrations", icon: <Settings className="h-4 w-4" /> },
    { id: "webhooks", label: "Webhooks & API", icon: <Link2 className="h-4 w-4" /> },
    { id: "omni", label: "Omni Assistant", icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Setup</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your profile, connected services, and API integrations.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 border-b border-zinc-800 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all relative ${
              activeTab === tab.id
                ? "text-yellow-500 bg-zinc-900/50"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-600" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileTab />}
      {activeTab === "integrations" && <IntegrationsTab />}
      {activeTab === "webhooks" && <WebhooksTab />}
      {activeTab === "omni" && <OmniTab />}
    </div>
  );
}

// ============================================================================
// PROFILE TAB
// ============================================================================

function ProfileTab() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-white">Your Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-yellow-600 flex items-center justify-center text-black font-bold text-2xl shrink-0">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">{user?.name || "User"}</h3>
              <p className="text-sm text-zinc-400">{user?.email || "No email"}</p>
              <Badge className="mt-2 bg-yellow-600/10 text-yellow-500 border-yellow-600/20 text-xs">
                {user?.role === "admin" ? "Administrator" : "Team Member"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Name</label>
              <p className="text-sm text-white mt-1">{user?.name || "—"}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Email</label>
              <p className="text-sm text-white mt-1">{user?.email || "—"}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Role</label>
              <p className="text-sm text-white mt-1 capitalize">{user?.role || "user"}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Login Method</label>
              <p className="text-sm text-white mt-1">Manus OAuth</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/30 border-zinc-800/50">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-zinc-300">Account Security</p>
            <p className="text-xs text-zinc-500 mt-1">
              Your account is secured via Manus OAuth. Password management and two-factor authentication
              are handled through your Manus account settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// INTEGRATIONS TAB (merged from old Integrations page)
// ============================================================================

function IntegrationsTab() {
  const { data: mailStatus, isLoading: mailLoading } = trpc.mail.connectionStatus.useQuery();
  const authUrlMutation = trpc.mail.getAuthUrl.useMutation();
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  const googleConnected = mailStatus?.connected === true;
  const googleEmail = mailStatus?.email || null;
  const hasGmailScopes = mailStatus?.hasGmailScopes === true;
  const hasCalendarScopes = mailStatus?.hasCalendarScopes === true;
  const needsReauth = googleConnected && !hasGmailScopes;

  useEffect(() => {
    if (!redirectUri) {
      setRedirectUri(`${window.location.origin}/api/google/callback`);
    }
  }, []);

  const handleConnect = () => {
    authUrlMutation.mutateAsync({ origin: window.location.origin, returnPath: "/setup?tab=integrations" })
      .then(r => { window.location.href = r.url; })
      .catch(() => toast.error("Failed to generate auth URL"));
  };

  const handleReconnect = () => {
    authUrlMutation.mutateAsync({ origin: window.location.origin, returnPath: "/setup?tab=integrations" })
      .then(r => { window.location.href = r.url; })
      .catch(() => toast.error("Failed to generate auth URL"));
  };

  const copyRedirectUri = () => {
    if (redirectUri) {
      navigator.clipboard.writeText(redirectUri);
      toast.success("Redirect URI copied to clipboard");
    }
  };

  return (
    <div className="space-y-6">
      {/* Scope Warning Banner */}
      {needsReauth && (
        <div className="p-4 rounded-lg bg-yellow-600/10 border border-yellow-600/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-400 mb-1">Gmail Permissions Required</h3>
            <p className="text-xs text-zinc-300 mb-3">
              Your Google account is connected, but the current authorization only includes Calendar and Send permissions.
              To use the full Mail module, you need to re-authenticate with expanded Gmail scopes.
            </p>
            <Button
              onClick={handleReconnect}
              disabled={authUrlMutation.isPending}
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
            >
              {authUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Re-authenticate with Gmail Access
            </Button>
          </div>
        </div>
      )}

      {/* Google Workspace Integration */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-6 w-6">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg text-white">Google Workspace</CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">Gmail, Calendar, and Contacts</p>
              </div>
            </div>
            {mailLoading ? (
              <Skeleton className="h-6 w-24 bg-zinc-800" />
            ) : googleConnected ? (
              needsReauth ? (
                <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  <AlertTriangle className="h-3 w-3 mr-1" />Partial
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />Connected
                </Badge>
              )
            ) : (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                <XCircle className="h-3 w-3 mr-1" />Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {googleConnected ? (
            <>
              {/* Connected Account Info */}
              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{(googleEmail || "?")[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{googleEmail}</p>
                      <p className="text-xs text-zinc-500">Google Account</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleReconnect}
                    disabled={authUrlMutation.isPending}
                    className="border-zinc-700 text-zinc-400 hover:text-white h-8">
                    {authUrlMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Re-authenticate
                  </Button>
                </div>
              </div>

              {/* Service Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Gmail */}
                <div className={`p-4 rounded-lg border ${hasGmailScopes ? "bg-zinc-800/30 border-zinc-800" : "bg-yellow-600/5 border-yellow-600/20"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium text-white">Gmail</span>
                    {hasGmailScopes ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 ml-auto">Active</Badge>
                    ) : (
                      <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[10px] px-1.5 py-0 ml-auto">Limited</Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      {hasGmailScopes ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-yellow-500" />}
                      Read emails
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />Send emails
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      {hasGmailScopes ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-yellow-500" />}
                      Search & manage
                    </div>
                  </div>
                  {!hasGmailScopes && (
                    <p className="text-[10px] text-yellow-500/70 mt-2">Re-authenticate to enable full Gmail access</p>
                  )}
                </div>

                {/* Calendar */}
                <div className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">Calendar</span>
                    <Badge className={`${hasCalendarScopes ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'} text-[10px] px-1.5 py-0 ml-auto`}>
                      {hasCalendarScopes ? 'Active' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />View events
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />Sync meetings
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />Create events
                    </div>
                  </div>
                </div>

                {/* Fathom */}
                <div className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-4 w-4 rounded bg-purple-500/20 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-purple-400">F</span>
                    </div>
                    <span className="text-sm font-medium text-white">Fathom AI</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 ml-auto">Active</Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />Auto-sync meetings
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />AI transcription
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />Contact extraction
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions & Security */}
              <div className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-800">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-white">Permissions & Security</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>OAuth 2.0 — No passwords stored</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>Tokens encrypted at rest</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasGmailScopes ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                    )}
                    <span>Scopes: Calendar{hasGmailScopes ? ", Gmail (full)" : ", Gmail (send only)"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>Auto-refresh tokens on expiry</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Not Connected State */
            <div className="py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Connect Google Workspace</h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
                Connect your Google account to enable Gmail integration, calendar sync, and contact matching.
                OmniScope uses OAuth 2.0 — your password is never stored.
              </p>
              <Button onClick={handleConnect}
                disabled={authUrlMutation.isPending}
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                {authUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Connect Google Account
              </Button>
              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />Secure OAuth 2.0
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />Takes 30 seconds
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redirect URI Setup Card (admin-level info) */}
      {redirectUri && (
        <Card className="bg-zinc-900/30 border-zinc-800/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-white">Google Cloud Console Setup</span>
            </div>
            <p className="text-xs text-zinc-400">
              For Google OAuth to work, this <strong className="text-zinc-200">Authorized redirect URI</strong> must be registered in your Google Cloud Console OAuth 2.0 credentials:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-yellow-400 bg-zinc-900 px-3 py-2 rounded border border-zinc-800 break-all">
                {redirectUri}
              </code>
              <Button variant="outline" size="sm" onClick={copyRedirectUri}
                className="border-zinc-700 text-zinc-400 hover:text-white h-8 flex-shrink-0">
                <Copy className="h-3.5 w-3.5 mr-1" />Copy
              </Button>
            </div>
            <p className="text-[10px] text-zinc-500">
              Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google Cloud Console → Credentials</a> → Edit your OAuth 2.0 Client ID → Add this URI under "Authorized redirect URIs" → Save.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// WEBHOOKS TAB
// ============================================================================

function WebhooksTab() {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">Webhooks & API</CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">Zapier, Plaud, and custom integrations</p>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-purple-500/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-400">P</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Plaud Webhook</p>
                  <p className="text-xs text-zinc-500">Auto-ingest meeting recordings</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Listening</Badge>
            </div>

            <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-orange-500/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-orange-400">Z</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Zapier Webhook</p>
                  <p className="text-xs text-zinc-500">Custom automation triggers</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Listening</Badge>
            </div>

            <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Webhook Endpoint</span>
              </div>
              <code className="text-xs text-zinc-400 bg-zinc-900 px-3 py-2 rounded block break-all">
                POST /api/webhook/ingest
              </code>
              <p className="text-xs text-zinc-500 mt-2">
                Send meeting transcripts, recordings, or structured data to this endpoint for automatic processing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon */}
      <Card className="bg-zinc-900/50 border-zinc-800 opacity-60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Clock className="h-5 w-5 text-zinc-500" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Coming Soon</CardTitle>
              <p className="text-xs text-zinc-400 mt-0.5">Planned integrations</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/50 text-center">
              <p className="text-sm font-medium text-zinc-400">Slack</p>
              <p className="text-xs text-zinc-600 mt-1">Team notifications</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/50 text-center">
              <p className="text-sm font-medium text-zinc-400">WhatsApp</p>
              <p className="text-xs text-zinc-600 mt-1">Message tracking</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/50 text-center">
              <p className="text-sm font-medium text-zinc-400">HubSpot</p>
              <p className="text-xs text-zinc-600 mt-1">CRM sync</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================================================
// OMNI ASSISTANT TAB
// ============================================================================

const OMNI_MODE_KEY = "omniscope-omni-mode";
const OMNI_SIDEBAR_KEY = "omniscope-omni-sidebar-visible";

function OmniTab() {
  const [mode, setMode] = useState<OmniMode>(() => {
    try { return (localStorage.getItem(OMNI_MODE_KEY) as OmniMode) || "sigil"; } catch { return "sigil"; }
  });
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    try { return localStorage.getItem(OMNI_SIDEBAR_KEY) !== "false"; } catch { return true; }
  });
  const [previewState, setPreviewState] = useState<OmniState>("idle");

  const handleModeChange = (newMode: OmniMode) => {
    setMode(newMode);
    try { localStorage.setItem(OMNI_MODE_KEY, newMode); } catch {}
    // Dispatch storage event so PortalLayout picks up the change in real-time
    window.dispatchEvent(new StorageEvent("storage", { key: OMNI_MODE_KEY, newValue: newMode }));
    toast.success(`Omni appearance set to ${newMode === "sigil" ? "Sigil" : newMode === "character" ? "Character" : "Hidden"}`);
  };

  const handleSidebarToggle = (visible: boolean) => {
    setSidebarVisible(visible);
    try { localStorage.setItem(OMNI_SIDEBAR_KEY, String(visible)); } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: OMNI_SIDEBAR_KEY, newValue: String(visible) }));
  };

  const modes: { id: OmniMode; label: string; description: string }[] = [
    { id: "sigil", label: "Sigil", description: "Concentric gold rings — institutional, geometric, premium" },
    { id: "character", label: "Character", description: "NOMI-inspired companion — expressive eyes, interactive personality" },
    { id: "hidden", label: "Hidden", description: "No floating avatar — access Omni only from sidebar or ⌘K" },
  ];

  const states: { id: OmniState; label: string }[] = [
    { id: "idle", label: "Idle" },
    { id: "hover", label: "Hover" },
    { id: "thinking", label: "Thinking" },
    { id: "success", label: "Success" },
    { id: "error", label: "Error" },
  ];

  return (
    <div className="space-y-6">
      {/* Live Preview */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Omni Assistant
          </CardTitle>
          <p className="text-xs text-zinc-400 mt-1">
            Your persistent AI companion. Customize how Omni appears and behaves across the portal.
          </p>
        </CardHeader>
        <CardContent>
          {/* Live Preview Area */}
          <div className="mb-8">
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-3 block">Live Preview</label>
            <div className="bg-black/50 rounded-xl border border-zinc-800 p-8 flex flex-col items-center gap-6">
              {mode === "hidden" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <EyeOff className="h-10 w-10 text-zinc-600" />
                  <p className="text-sm text-zinc-500">Avatar hidden — use ⌘K or sidebar to access Omni</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <OmniAvatar mode={mode} state={previewState} size={96} badge={previewState === "idle"} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">
                      {mode === "sigil" ? "OmniScope Sigil" : "NOMI Companion"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {previewState === "idle" && "Calm, breathing — ready when you are"}
                      {previewState === "hover" && "Attentive — eyes tracking, glow intensifies"}
                      {previewState === "thinking" && "Processing — contemplative, focused"}
                      {previewState === "success" && "Task complete — brief celebration"}
                      {previewState === "error" && "Something's off — subtle concern"}
                    </p>
                  </div>
                </>
              )}

              {/* State Switcher */}
              {mode !== "hidden" && (
                <div className="flex gap-2">
                  {states.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setPreviewState(s.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        previewState === s.id
                          ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30"
                          : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mode Selector */}
          <div className="mb-8">
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-3 block">Appearance Mode</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === m.id
                      ? "bg-yellow-600/10 border-yellow-600/40 ring-1 ring-yellow-600/20"
                      : "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
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
                      <Badge className="ml-auto bg-yellow-600/20 text-yellow-500 border-yellow-600/30 text-[10px]">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{m.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar Toggle */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-3 block">Sidebar Visibility</label>
            <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-white">Show "Ask Omni" in sidebar</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Display the Ask Omni entry in the sidebar navigation. You can always use ⌘K regardless.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSidebarToggle(!sidebarVisible)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  sidebarVisible ? "bg-yellow-600" : "bg-zinc-700"
                }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                  sidebarVisible ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Reference */}
      <Card className="bg-zinc-900/30 border-zinc-800/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
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
        </CardContent>
      </Card>
    </div>
  );
}
