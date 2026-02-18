import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Mail, Calendar, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ExternalLink, Shield, Clock, Loader2, Copy, ChevronRight, Info
} from "lucide-react";
import { useSearch } from "wouter";

export default function Integrations() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const googleStatus = params.get("google");

  // Show toast on redirect from Google OAuth
  useEffect(() => {
    if (googleStatus === "connected") {
      toast.success("Google account connected successfully! Gmail and Calendar scopes are now active.");
      // Clean URL
      window.history.replaceState({}, "", "/integrations");
    } else if (googleStatus === "error") {
      const msg = params.get("message") || "Unknown error";
      toast.error(`Google connection failed: ${msg}`);
      window.history.replaceState({}, "", "/integrations");
    }
  }, [googleStatus]);

  // Check Google connection status (now includes scope info)
  const { data: mailStatus, isLoading: mailLoading, refetch: refetchMail } = trpc.mail.connectionStatus.useQuery();
  const authUrlMutation = trpc.mail.getAuthUrl.useMutation();
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  const googleConnected = mailStatus?.connected === true;
  const googleEmail = mailStatus?.email || null;
  const hasGmailScopes = mailStatus?.hasGmailScopes === true;
  const hasCalendarScopes = mailStatus?.hasCalendarScopes === true;
  const needsReauth = googleConnected && !hasGmailScopes;

  // Pre-fetch the redirect URI so we can display it
  useEffect(() => {
    if (!redirectUri) {
      const origin = window.location.origin;
      setRedirectUri(`${origin}/api/google/callback`);
    }
  }, []);

  const handleConnect = () => {
    authUrlMutation.mutateAsync({ origin: window.location.origin, returnPath: "/integrations" })
      .then(r => { window.location.href = r.url; })
      .catch(() => toast.error("Failed to generate auth URL"));
  };

  const handleReconnect = () => {
    authUrlMutation.mutateAsync({ origin: window.location.origin, returnPath: "/integrations" })
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
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage connected services and data sources. All connections use secure OAuth — OmniScope never stores your passwords.
        </p>
      </div>

      {/* Scope Warning Banner */}
      {needsReauth && (
        <div className="p-4 rounded-lg bg-yellow-600/10 border border-yellow-600/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-400 mb-1">Gmail Permissions Required</h3>
            <p className="text-xs text-zinc-300 mb-3">
              Your Google account is connected, but the current authorization only includes Calendar and Send permissions.
              To use the full Mail module (read, search, star, and manage emails), you need to re-authenticate with expanded Gmail scopes.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleReconnect}
                disabled={authUrlMutation.isPending}
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
              >
                {authUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Re-authenticate with Gmail Access
              </Button>
              <span className="text-[10px] text-zinc-500">This will open Google's consent screen</span>
            </div>
          </div>
        </div>
      )}

      {/* Redirect URI Setup Card */}
      {redirectUri && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm text-white">Google Cloud Console Setup</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-400">
              For Google OAuth to work, you must add this <strong className="text-zinc-200">Authorized redirect URI</strong> to your Google Cloud Console OAuth 2.0 credentials:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-yellow-400 bg-zinc-900 px-3 py-2 rounded border border-zinc-800 break-all">
                {redirectUri}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyRedirectUri}
                className="border-zinc-700 text-zinc-400 hover:text-white h-8 flex-shrink-0"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />Copy
              </Button>
            </div>
            <p className="text-[10px] text-zinc-500">
              Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google Cloud Console → Credentials</a> → Edit your OAuth 2.0 Client ID → Add this URI under "Authorized redirect URIs" → Save.
              {" "}Note: If you publish this site to a custom domain, you'll need to add that domain's redirect URI as well.
            </p>
          </CardContent>
        </Card>
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
                  <div className="flex gap-2">
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
                      {hasGmailScopes ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-yellow-500" />
                      )}
                      Read emails
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Send emails
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      {hasGmailScopes ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-yellow-500" />
                      )}
                      Search & manage
                    </div>
                  </div>
                  {!hasGmailScopes && (
                    <p className="text-[10px] text-yellow-500/70 mt-2">
                      Re-authenticate to enable full Gmail access
                    </p>
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

      {/* Webhook Integrations */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
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
