import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import {
  CheckCircle2, ArrowRight, ArrowLeft, Mail, Calendar, Video, Mic,
  Shield, Sparkles, ExternalLink, Loader2, LayoutDashboard, Users,
  FileText, ChevronRight
} from "lucide-react";

type Step = "welcome" | "google" | "tools" | "complete";
const STEPS: Step[] = ["welcome", "google", "tools", "complete"];

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const googleStatus = params.get("google");

  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const { data: onboardingStatus, refetch } = trpc.onboarding.status.useQuery();
  const completeMutation = trpc.onboarding.complete.useMutation();
  const authUrlMutation = trpc.mail.getAuthUrl.useMutation();

  const googleConnected = onboardingStatus?.googleConnected === true;
  const hasGmailScopes = onboardingStatus?.hasGmailScopes === true;
  const googleEmail = onboardingStatus?.googleEmail;

  // Handle Google OAuth callback
  useEffect(() => {
    if (googleStatus === "connected") {
      toast.success("Google account connected successfully!");
      setCurrentStep("tools");
      refetch();
      window.history.replaceState({}, "", "/onboarding");
    } else if (googleStatus === "error") {
      toast.error("Google connection failed. You can try again or skip for now.");
      window.history.replaceState({}, "", "/onboarding");
    }
  }, [googleStatus]);

  // Auto-advance to google step if already past welcome
  useEffect(() => {
    if (googleConnected && currentStep === "google") {
      setCurrentStep("tools");
    }
  }, [googleConnected]);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const handleConnectGoogle = () => {
    authUrlMutation.mutateAsync({ origin: window.location.origin, returnPath: "/onboarding" })
      .then(r => { window.location.href = r.url; })
      .catch(() => toast.error("Failed to start Google authorization"));
  };

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync();
      toast.success("Welcome to OmniScope! Your portal is ready.");
      setLocation("/");
    } catch {
      toast.error("Failed to complete onboarding");
    }
  };

  const handleSkip = async () => {
    try {
      await completeMutation.mutateAsync();
      setLocation("/");
    } catch {
      setLocation("/");
    }
  };

  const goNext = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1]);
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] flex flex-col items-center justify-center py-12 px-4">
      {/* Progress Bar */}
      <div className="w-full max-w-xl mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-500">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip setup →
          </button>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Step indicators */}
        <div className="flex justify-between mt-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full transition-colors ${
                i <= stepIndex ? "bg-yellow-500" : "bg-zinc-700"
              }`} />
              <span className={`text-[10px] ${
                i <= stepIndex ? "text-zinc-300" : "text-zinc-600"
              }`}>
                {step === "welcome" ? "Welcome" : step === "google" ? "Google" : step === "tools" ? "Tools" : "Ready"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="w-full max-w-xl">
        {currentStep === "welcome" && (
          <WelcomeStep userName={user?.name || "there"} onNext={goNext} />
        )}
        {currentStep === "google" && (
          <GoogleStep
            connected={googleConnected}
            hasGmailScopes={hasGmailScopes}
            email={googleEmail || null}
            onConnect={handleConnectGoogle}
            isPending={authUrlMutation.isPending}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {currentStep === "tools" && (
          <ToolsStep onNext={goNext} onBack={goBack} />
        )}
        {currentStep === "complete" && (
          <CompleteStep
            onComplete={handleComplete}
            isPending={completeMutation.isPending}
            googleConnected={googleConnected}
            onBack={goBack}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 1: WELCOME
// ============================================================================

function WelcomeStep({ userName, onNext }: { userName: string; onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="mb-8">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-yellow-600 to-yellow-700 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-600/20">
          <Sparkles className="h-10 w-10 text-black" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">
          Welcome to OmniScope, {userName.split(" ")[0]}
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto">
          Your intelligence portal is ready. Let's connect your tools so everything works seamlessly.
        </p>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800 mb-8">
        <CardContent className="p-6">
          <p className="text-sm text-zinc-300 mb-5">This quick setup will connect:</p>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Gmail & Calendar</p>
                <p className="text-xs text-zinc-500">Sync emails, events, and contacts</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Fathom AI & Plaud</p>
                <p className="text-xs text-zinc-500">Auto-capture meeting intelligence</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-4">
        <Button
          onClick={onNext}
          className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold px-8 py-6 text-base"
        >
          Get Started
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Shield className="h-3.5 w-3.5" />
          <span>Takes about 30 seconds</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 2: GOOGLE ACCOUNT
// ============================================================================

function GoogleStep({
  connected, hasGmailScopes, email, onConnect, isPending, onNext, onBack
}: {
  connected: boolean;
  hasGmailScopes: boolean;
  email: string | null;
  onConnect: () => void;
  isPending: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" className="h-9 w-9">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Connect Google Workspace</h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          Link your Google account to sync Gmail, Calendar, and Contacts with OmniScope.
        </p>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardContent className="p-6">
          {connected ? (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Connected</h3>
              <p className="text-sm text-zinc-400 mb-3">{email}</p>
              <div className="flex items-center justify-center gap-3">
                <Badge className={`${hasGmailScopes ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                  <Mail className="h-3 w-3 mr-1" />Gmail {hasGmailScopes ? "Active" : "Limited"}
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <Calendar className="h-3 w-3 mr-1" />Calendar Active
                </Badge>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-semibold text-zinc-300">What you'll authorize:</h3>
                <div className="space-y-3">
                  {[
                    { icon: <Mail className="h-4 w-4 text-red-400" />, label: "Gmail", desc: "Read, send, and manage emails" },
                    { icon: <Calendar className="h-4 w-4 text-blue-400" />, label: "Calendar", desc: "View and sync your events" },
                    { icon: <Users className="h-4 w-4 text-green-400" />, label: "Contacts", desc: "Match contacts to meeting participants" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                      <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-zinc-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                onClick={onConnect}
                disabled={isPending}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold py-5"
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-5 w-5 mr-2" />
                )}
                Connect Google Account
              </Button>
              <div className="flex items-center justify-center gap-2 mt-3 text-xs text-zinc-500">
                <Shield className="h-3 w-3" />
                <span>OAuth 2.0 — your password is never stored</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="text-zinc-500 hover:text-white">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <Button onClick={onNext} className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
          {connected ? "Continue" : "Skip for now"}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: TOOLS (Fathom + Plaud)
// ============================================================================

function ToolsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
          <Video className="h-8 w-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Meeting Intelligence Tools</h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          These tools automatically capture and analyze your meetings. Install them to unlock the full intelligence pipeline.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {/* Fathom */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Video className="h-6 w-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-white">Fathom AI Notetaker</h3>
                  <a href="https://fathom.video" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 h-8">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Install
                    </Button>
                  </a>
                </div>
                <p className="text-sm text-zinc-400 mb-3">
                  Records and transcribes your video calls. OmniScope automatically imports recordings and generates intelligence reports.
                </p>
                <div className="space-y-2">
                  {[
                    "Install Fathom from fathom.video and create an account",
                    "Enable Fathom to join your Google Meet / Zoom calls",
                    "After your first call, OmniScope automatically imports it",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-zinc-400">{i + 1}</span>
                      </div>
                      <p className="text-xs text-zinc-400">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plaud */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Mic className="h-6 w-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-white">Plaud AI Recorder</h3>
                  <a href="https://www.plaud.ai" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 h-8">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Get Plaud
                    </Button>
                  </a>
                </div>
                <p className="text-sm text-zinc-400 mb-3">
                  Captures in-person meetings and phone calls. Upload recordings to OmniScope for the same intelligence pipeline.
                </p>
                <div className="space-y-2">
                  {[
                    "Get a Plaud AI recorder device from plaud.ai",
                    "Record your in-person meetings and phone calls",
                    "Upload recordings via Meetings → Upload Recording",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-zinc-400">{i + 1}</span>
                      </div>
                      <p className="text-xs text-zinc-400">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="text-zinc-500 hover:text-white">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <Button onClick={onNext} className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
          Continue
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4: COMPLETE
// ============================================================================

function CompleteStep({
  onComplete, isPending, googleConnected, onBack
}: {
  onComplete: () => void;
  isPending: boolean;
  googleConnected: boolean;
  onBack: () => void;
}) {
  const features = [
    { icon: <LayoutDashboard className="h-5 w-5 text-yellow-500" />, label: "Dashboard", desc: "Daily intelligence briefing and activity overview" },
    { icon: <FileText className="h-5 w-5 text-blue-400" />, label: "Meetings", desc: "AI-analyzed meeting transcripts and action items" },
    { icon: <Mail className="h-5 w-5 text-red-400" />, label: "Mail", desc: "Gmail integration with contact matching" },
    { icon: <Users className="h-5 w-5 text-green-400" />, label: "Relationship Hub", desc: "360° view of every contact and company" },
  ];

  return (
    <div className="text-center">
      <div className="mb-8">
        <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">You're All Set</h2>
        <p className="text-zinc-400 text-lg max-w-md mx-auto">
          Your OmniScope portal is configured and ready. Here's what you can do now:
        </p>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800 mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 text-left">
                <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="text-[11px] text-zinc-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!googleConnected && (
        <div className="p-3 rounded-lg bg-yellow-600/10 border border-yellow-600/20 mb-6 text-left">
          <p className="text-xs text-yellow-400">
            <strong>Tip:</strong> You skipped Google connection. You can connect anytime from Setup → Integrations to enable Gmail and Calendar sync.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="text-zinc-500 hover:text-white">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <Button
          onClick={onComplete}
          disabled={isPending}
          className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold px-8 py-5 text-base"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <LayoutDashboard className="h-5 w-5 mr-2" />
          )}
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
