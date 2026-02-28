import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DOMPurify from "dompurify";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Mail, Inbox, Send, FileText, Star, Search, RefreshCw, MailPlus,
  PanelLeft, PanelLeftClose, Loader2, X, AlertCircle, ChevronLeft,
  Reply, ReplyAll, Forward, Trash2, Users, User, Plus,
  DollarSign, Repeat, Newspaper, ArrowDown, Zap,
  CheckSquare, Building2, Link2, Unlink,
  Sparkles, ChevronDown, ChevronUp, RotateCw, Target, ListChecks, Hash,
  BarChart3, Check, Minus, SquareCheck, UserPlus, Briefcase, Wand2
} from "lucide-react";
import { PersonAutocomplete, type PersonResult } from "@/components/PersonAutocomplete";

// TYPES — aligned with server/gmailService.ts

type Folder = "inbox" | "sent" | "drafts" | "starred" | "all";
type OmniCategory = "action" | "capital" | "team" | "recurring" | "signal" | "low_priority";

// Server ThreadListItem shape
interface ServerThread {
  threadId: string;
  subject: string;
  snippet: string;
  fromName: string;
  fromEmail: string;
  date: number; // epoch ms
  isUnread: boolean;
  isStarred: boolean;
  messageCount: number;
  hasAttachments: boolean;
  labelIds: string[];
  hasUnsubscribe?: boolean;
}

// Server GmailMessage shape
interface ServerMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  from: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  bodyHtml: string;
  isUnread: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[];
}

interface CategorizedThread extends ServerThread {
  category: OmniCategory;
}

// STAR PRIORITY CONFIG

const STAR_CONFIG: Record<number, { label: string; color: string; bgColor: string; description: string }> = {
  1: { label: "Reply Today", color: "text-yellow-500", bgColor: "bg-yellow-500", description: "Needs a reply today" },
  2: { label: "Delegate", color: "text-orange-500", bgColor: "bg-orange-500", description: "Assign to someone" },
  3: { label: "Critical", color: "text-red-500", bgColor: "bg-red-500", description: "Urgent / time-sensitive" },
};

// CATEGORY ENGINE — OmniScope Mail Intelligence

const TEAM_DOMAINS = ["omniscopex.ae", "kinetixgroup", "kairoai.io"];

const CAPITAL_SENDERS = [
  "stripe", "jpmorgan", "jpmchase", "sfox", "bank", "treasury", "finance",
  "wire", "swift", "custody", "settlement", "clearing",
];

const CAPITAL_SUBJECTS = [
  "invoice", "wire", "payment", "transfer", "settlement", "receipt",
  "statement", "remittance", "confirmation", "otc", "escrow",
];

const RECURRING_SIGNALS = [
  "subscription", "renewal", "billing", "monthly", "annual plan",
  "your receipt", "payment received", "plan update", "auto-renewal",
];

const LOW_PRIORITY_SIGNALS = [
  "unsubscribe", "opt out", "email preferences", "manage subscriptions",
  "view in browser", "view online",
];

export function categorizeThread(thread: ServerThread): OmniCategory {
  const email = (thread.fromEmail || "").toLowerCase();
  const subject = (thread.subject || "").toLowerCase();
  const labels = thread.labelIds || [];
  const domain = email.split("@")[1] || "";

  // 1. Team — internal domains
  if (TEAM_DOMAINS.some((d) => domain.includes(d))) return "team";

  // 2. Capital — financial senders or subjects
  if (CAPITAL_SENDERS.some((s) => email.includes(s) || domain.includes(s))) return "capital";
  if (CAPITAL_SUBJECTS.some((s) => subject.includes(s))) return "capital";

  // 3. Recurring — SaaS, billing, receipts
  if (RECURRING_SIGNALS.some((s) => subject.includes(s))) return "recurring";
  if (labels.includes("CATEGORY_PROMOTIONS") && RECURRING_SIGNALS.some((s) => subject.includes(s))) return "recurring";

  // 4. Low Priority — marketing, promotions, cold outreach
  if (thread.hasUnsubscribe) {
    if (LOW_PRIORITY_SIGNALS.some((s) => subject.includes(s))) return "low_priority";
    if (labels.includes("CATEGORY_PROMOTIONS")) return "low_priority";
    return "signal"; // Has unsubscribe but not promotional → newsletter
  }
  if (labels.includes("CATEGORY_PROMOTIONS")) return "low_priority";

  // 5. Signal — newsletters (already handled above via hasUnsubscribe)

  // 6. Automated notifications → recurring
  if (
    labels.includes("CATEGORY_UPDATES") ||
    email.includes("noreply") ||
    email.includes("no-reply") ||
    email.includes("notifications") ||
    email.includes("notify") ||
    email.includes("mailer-daemon") ||
    email.includes("postmaster")
  ) {
    if (CAPITAL_SUBJECTS.some((s) => subject.includes(s))) return "capital";
    return "recurring";
  }

  // Default: ACTION — requires human attention
  return "action";
}

// CATEGORY CONFIGURATION

const CATEGORY_CONFIG: Record<
  OmniCategory,
  { label: string; icon: React.ElementType; description: string; color: string }
> = {
  action: { label: "Action", icon: Zap, description: "Requires reply, decision, or delegation", color: "text-yellow-500" },
  capital: { label: "Capital", icon: DollarSign, description: "Financial, banking, and deal communication", color: "text-emerald-500" },
  team: { label: "Team", icon: Users, description: "Internal and partner communication", color: "text-blue-500" },
  recurring: { label: "Recurring", icon: Repeat, description: "Subscriptions, receipts, and billing", color: "text-zinc-500" },
  signal: { label: "Signal", icon: Newspaper, description: "Industry newsletters and intelligence", color: "text-purple-500" },
  low_priority: { label: "Low Priority", icon: ArrowDown, description: "Marketing, promotions, cold outreach", color: "text-zinc-600" },
};

// HELPERS

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function senderInitials(name: string): string {
  const parts = name.split(/[\s.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function avatarColor(key: string): string {
  const colors = [
    "bg-yellow-600", "bg-blue-600", "bg-emerald-600", "bg-purple-600",
    "bg-rose-600", "bg-cyan-600", "bg-orange-600", "bg-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// CONNECT GMAIL PROMPT

function ConnectGmailPrompt({ needsReauth }: { needsReauth?: boolean }) {
  const authUrlMutation = trpc.mail.getAuthUrl.useMutation();

  const handleConnect = async () => {
    try {
      const result = await authUrlMutation.mutateAsync({
        origin: window.location.origin,
        returnPath: "/mail",
      });
      window.location.href = result.url;
    } catch {
      toast.error("Failed to generate auth URL");
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-black">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-6">
          <Mail className="h-8 w-8 text-yellow-600" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          {needsReauth ? "Gmail Permissions Required" : "Connect Gmail"}
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          {needsReauth
            ? "Re-authenticate to grant Gmail read and manage permissions."
            : "Connect your Google account to access your email within OmniScope."}
        </p>
        <Button
          onClick={handleConnect}
          disabled={authUrlMutation.isPending}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold"
        >
          {authUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
          {needsReauth ? "Re-authenticate" : "Connect Google Account"}
        </Button>
      </div>
    </div>
  );
}

// COMPOSE MODAL

function ComposeModal({
  open, onClose, replyTo, replyAll, forwardMsg,
}: {
  open: boolean;
  onClose: () => void;
  replyTo?: ServerMessage;
  replyAll?: boolean;
  forwardMsg?: ServerMessage;
}) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [toContact, setToContact] = useState<PersonResult | null>(null);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const sendMutation = trpc.mail.send.useMutation();
  const signatureQuery = trpc.profile.getSignatureHtml.useQuery(undefined, { enabled: open });
  const findByEmailQuery = trpc.directory.findByEmail.useQuery(
    { email: to },
    { enabled: open && to.includes("@") && to.includes(".") && !toContact }
  );
  const createContactMutation = trpc.directory.quickCreateContact.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!open) return;
    if (replyTo) {
      setTo(replyTo.fromEmail);
      if (replyAll && replyTo.cc?.length) {
        setCc(replyTo.cc.join(", "));
        setShowCc(true);
      }
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody("");
    } else if (forwardMsg) {
      setTo("");
      setSubject(forwardMsg.subject.startsWith("Fwd:") ? forwardMsg.subject : `Fwd: ${forwardMsg.subject}`);
      const plainBody = (forwardMsg.body || "").replace(/<[^>]+>/g, "");
      setBody(
        `\n\n---------- Forwarded message ----------\nFrom: ${forwardMsg.from}\nDate: ${formatFullDate(parseInt(forwardMsg.internalDate))}\nSubject: ${forwardMsg.subject}\n\n${plainBody}`
      );
    } else {
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
      setShowCc(false);
    }
  }, [open, replyTo, replyAll, forwardMsg]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Recipient required");
      return;
    }
    try {
      let fullBody = body;
      if (signatureQuery.data?.enabled && signatureQuery.data?.html) {
        fullBody = `<div>${body.replace(/\n/g, "<br>")}</div>${signatureQuery.data.html}`;
      }

      await sendMutation.mutateAsync({
        to: to.split(",").map((e) => e.trim()).filter(Boolean),
        cc: cc ? cc.split(",").map((e) => e.trim()).filter(Boolean) : undefined,
        subject,
        body: fullBody,
        isHtml: !!(signatureQuery.data?.enabled && signatureQuery.data?.html),
        threadId: replyTo?.threadId,
      });
      toast.success("Email sent");
      utils.mail.listThreads.invalidate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-white">
            {replyTo ? "Reply" : forwardMsg ? "Forward" : "New Message"}
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-3 space-y-0 border-b border-zinc-800/50">
          <div className="flex items-center gap-2 py-2 border-b border-zinc-800/30">
            <span className="text-xs text-zinc-500 w-8">To</span>
            <div className="flex-1 relative">
              <PersonAutocomplete
                value={toContact}
                onChange={(person) => {
                  setToContact(person);
                  if (person?.email) setTo(person.email);
                }}
                emailMode
                emailValue={to}
                onEmailChange={(val) => {
                  setTo(val);
                  if (toContact) setToContact(null);
                  setShowCreateContact(false);
                }}
                placeholder="recipient@example.com"
                allowCreate={false}
              />
              {/* Create contact suggestion */}
              {!toContact && to.includes("@") && findByEmailQuery.data && !findByEmailQuery.data.contact && !showCreateContact && (
                <button
                  onClick={() => setShowCreateContact(true)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-400 transition-colors mr-2"
                >
                  <UserPlus className="h-3 w-3" /> Save contact
                </button>
              )}
              {toContact && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-emerald-500 mr-2">
                  <Check className="h-3 w-3" /> Known contact
                </div>
              )}
            </div>
            {!showCc && (
              <button onClick={() => setShowCc(true)} className="text-[11px] text-zinc-600 hover:text-zinc-400">
                Cc
              </button>
            )}
          </div>
          {/* Quick create contact inline */}
          {showCreateContact && !toContact && (
            <div className="flex items-center gap-2 py-2 border-b border-zinc-800/30 bg-zinc-800/20 px-2 rounded">
              <UserPlus className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-[11px] text-zinc-400">New contact:</span>
              <input
                id="newContactName"
                placeholder="Name"
                className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={async () => {
                  const nameInput = document.getElementById("newContactName") as HTMLInputElement;
                  const name = nameInput?.value?.trim();
                  if (!name || !to) return;
                  try {
                    const result = await createContactMutation.mutateAsync({ name, email: to });
                    if (result.contact) {
                      setToContact(result.contact as any);
                      toast.success(result.created ? `Contact "${name}" created` : `Contact found: ${result.contact.name}`);
                    }
                    setShowCreateContact(false);
                  } catch { toast.error("Failed to create contact"); }
                }}
                disabled={createContactMutation.isPending}
                className="text-[11px] text-amber-500 hover:text-amber-300 font-medium"
              >
                {createContactMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setShowCreateContact(false)} className="text-zinc-600 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {showCc && (
            <div className="flex items-center gap-2 py-2 border-b border-zinc-800/30">
              <span className="text-xs text-zinc-500 w-8">Cc</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                placeholder="cc@example.com"
              />
            </div>
          )}
          <div className="flex items-center gap-2 py-2">
            <span className="text-xs text-zinc-500 w-8">Subj</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              placeholder="Subject"
            />
          </div>
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full px-5 py-4 bg-transparent text-sm text-zinc-200 outline-none resize-none placeholder:text-zinc-600"
          placeholder="Write your message..."
        />

        {/* Signature preview */}
        {signatureQuery.data?.enabled && signatureQuery.data?.html && (
          <div className="px-5 pb-2">
            <div className="text-[10px] text-zinc-600 mb-1">Signature</div>
            <div
              className="text-xs text-zinc-500 border-t border-zinc-800/40 pt-2"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(signatureQuery.data.html) }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-600">
            {signatureQuery.data?.enabled ? "Signature attached" : "No signature"}
          </div>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !to.trim()}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold h-8 px-4 text-xs"
          >
            {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// STAR PRIORITY SELECTOR

function StarPrioritySelector({
  threadId,
  currentLevel,
  compact,
}: {
  threadId: string;
  currentLevel: number | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setStarMutation = trpc.mail.setStar.useMutation();
  const removeStarMutation = trpc.mail.removeStar.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSetStar = async (level: number) => {
    try {
      if (currentLevel === level) {
        await removeStarMutation.mutateAsync({ threadId });
        toast.success("Star removed");
      } else {
        await setStarMutation.mutateAsync({ threadId, starLevel: level });
        toast.success(`Marked as ${STAR_CONFIG[level].label}`);
      }
      utils.mail.getStars.invalidate();
      utils.mail.getStar.invalidate({ threadId });
    } catch {
      toast.error("Failed to update star");
    }
    setOpen(false);
  };

  const isPending = setStarMutation.isPending || removeStarMutation.isPending;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        disabled={isPending}
        className={`p-1 rounded-md transition-colors ${
          currentLevel
            ? `${STAR_CONFIG[currentLevel].color} hover:bg-zinc-800/50`
            : "text-zinc-700 hover:text-zinc-500 hover:bg-zinc-800/50"
        }`}
      >
        {isPending ? (
          <Loader2 className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} animate-spin`} />
        ) : currentLevel ? (
          <div className="flex items-center gap-0">
            {Array.from({ length: currentLevel }).map((_, i) => (
              <Star key={i} className={`${compact ? "h-2.5 w-2.5" : "h-3 w-3"} fill-current ${compact && i > 0 ? "-ml-0.5" : ""}`} />
            ))}
          </div>
        ) : (
          <Star className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800/60">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Priority</span>
          </div>
          {[1, 2, 3].map((level) => {
            const config = STAR_CONFIG[level];
            const isActive = currentLevel === level;
            return (
              <button
                key={level}
                onClick={(e) => { e.stopPropagation(); handleSetStar(level); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                  ${isActive ? "bg-zinc-800/60" : "hover:bg-zinc-800/40"}`}
              >
                <div className="flex items-center gap-0">
                  {Array.from({ length: level }).map((_, i) => (
                    <Star key={i} className={`h-3 w-3 fill-current ${config.color} ${i > 0 ? "-ml-0.5" : ""}`} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${isActive ? "text-white" : "text-zinc-300"}`}>{config.label}</div>
                  <div className="text-[10px] text-zinc-600">{config.description}</div>
                </div>
                {isActive && <X className="h-3 w-3 text-zinc-500 flex-shrink-0" />}
              </button>
            );
          })}
          {currentLevel && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSetStar(currentLevel); }}
              className="w-full px-3 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 border-t border-zinc-800/60 text-center transition-colors"
            >
              Remove star
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// CONVERT TO TASK MODAL

interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  assignee: PersonResult | null;
  assignedName: string;
  dueDate: string;
  category: string;
}

function ConvertToTaskModal({
  open,
  onClose,
  threadId,
  subject,
  fromEmail,
  initialTasks,
}: {
  open: boolean;
  onClose: () => void;
  threadId: string;
  subject: string;
  fromEmail: string;
  initialTasks?: TaskItem[] | null;
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const convertMutation = trpc.mail.convertToTasks.useMutation();
  const threadTasksQuery = trpc.mail.getThreadTasks.useQuery({ threadId }, { enabled: open });
  const utils = trpc.useUtils();
  const isAiPopulated = !!initialTasks?.length;

  useEffect(() => {
    if (open && initialTasks?.length) {
      // AI-extracted tasks — use them directly
      setTasks(initialTasks);
    } else if (open) {
      setTasks([{
        id: crypto.randomUUID(),
        title: subject || "",
        description: `From: ${fromEmail}`,
        priority: "medium",
        assignee: null,
        assignedName: "",
        dueDate: "",
        category: "",
      }]);
    }
  }, [open, subject, fromEmail, initialTasks]);

  const addTask = () => {
    setTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      priority: "medium" as const,
      assignee: null,
      assignedName: "",
      dueDate: "",
      category: "",
    }]);
  };

  const removeTask = (id: string) => {
    if (tasks.length <= 1) return;
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleConvert = async () => {
    const validTasks = tasks.filter(t => t.title.trim());
    if (!validTasks.length) {
      toast.error("At least one task title required");
      return;
    }
    try {
      const result = await convertMutation.mutateAsync({
        threadId,
        subject,
        fromEmail,
        tasks: validTasks.map(t => ({
          title: t.title.trim(),
          description: t.description || undefined,
          priority: t.priority,
          assignedName: t.assignee?.name || t.assignedName || undefined,
          assigneeContactId: t.assignee?.id || undefined,
          dueDate: t.dueDate || undefined,
          category: t.category || undefined,
          companyId: t.assignee?.companyId || undefined,
        })),
      });
      toast.success(`${result.count} task${result.count !== 1 ? "s" : ""} created`, {
        description: `Linked to email thread`,
        action: {
          label: "View Tasks",
          onClick: () => { window.location.href = "/todo"; },
        },
      });
      utils.mail.getThreadTasks.invalidate({ threadId });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create tasks");
    }
  };

  if (!open) return null;

  const existingTasks = threadTasksQuery.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {isAiPopulated ? <Wand2 className="h-4 w-4 text-emerald-400" /> : <CheckSquare className="h-4 w-4 text-yellow-600" />}
            <h3 className="text-sm font-medium text-white">{isAiPopulated ? "AI-Extracted Tasks" : "Create Tasks from Email"}</h3>
            <span className={`text-[10px] rounded-full px-2 py-0.5 ${isAiPopulated ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>{tasks.length}</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Existing linked tasks */}
        {existingTasks.length > 0 && (
          <div className="px-5 py-2 border-b border-zinc-800/50 bg-zinc-800/20 flex-shrink-0">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Already linked ({existingTasks.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {existingTasks.map((t: any) => (
                <span key={t.id} className="text-[10px] bg-zinc-800/60 border border-zinc-700/30 text-zinc-400 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <CheckSquare className="h-2.5 w-2.5 text-emerald-500" />
                  {t.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {tasks.map((task, idx) => (
            <div key={task.id} className="bg-zinc-800/20 border border-zinc-800/40 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Task {idx + 1}</span>
                {tasks.length > 1 && (
                  <button onClick={() => removeTask(task.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <input
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                className="w-full h-8 px-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-[12px] text-white outline-none focus:border-yellow-600/50 transition-colors"
                placeholder="Task title"
              />

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={task.priority}
                  onChange={(e) => updateTask(task.id, { priority: e.target.value as "low" | "medium" | "high" })}
                  className="h-8 px-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-[11px] text-white outline-none focus:border-yellow-600/50 transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                  className="h-8 px-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-[11px] text-white outline-none focus:border-yellow-600/50 transition-colors [color-scheme:dark]"
                />
                <input
                  value={task.category}
                  onChange={(e) => updateTask(task.id, { category: e.target.value })}
                  className="h-8 px-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-[11px] text-white outline-none focus:border-yellow-600/50 transition-colors"
                  placeholder="Category"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-600 mb-1 block">Assign To</label>
                <PersonAutocomplete
                  value={task.assignee}
                  onChange={(person) => updateTask(task.id, { assignee: person, assignedName: person?.name || "" })}
                  placeholder="Search contacts to assign..."
                  allowCreate={false}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={addTask}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-amber-400 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add another task
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs border-zinc-700 text-zinc-400 bg-transparent">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConvert}
              disabled={convertMutation.isPending || !tasks.some(t => t.title.trim())}
              className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold text-xs"
            >
              {convertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckSquare className="h-3.5 w-3.5 mr-1.5" />}
              Create {tasks.filter(t => t.title.trim()).length} Task{tasks.filter(t => t.title.trim()).length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// LINK TO COMPANY MODAL

function LinkToCompanyModal({
  open,
  onClose,
  threadId,
}: {
  open: boolean;
  onClose: () => void;
  threadId: string;
}) {
  const [search, setSearch] = useState("");
  const companiesQuery = trpc.companies.list.useQuery({ search: search || undefined }, { enabled: open });
  const linkMutation = trpc.mail.linkToCompany.useMutation();
  const utils = trpc.useUtils();

  const handleLink = async (companyId: number, companyName: string) => {
    try {
      await linkMutation.mutateAsync({ threadId, companyId });
      toast.success(`Linked to ${companyName}`);
      utils.mail.getCompanyLinks.invalidate({ threadId });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to link");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-yellow-600" />
            <h3 className="text-sm font-medium text-white">Link to Company</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-white outline-none focus:border-yellow-600/50 transition-colors"
              placeholder="Search companies..."
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {companiesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
            </div>
          ) : !companiesQuery.data?.length ? (
            <div className="text-center py-8">
              <Building2 className="h-5 w-5 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No companies found</p>
            </div>
          ) : (
            companiesQuery.data.map((company: any) => (
              <button
                key={company.id}
                onClick={() => handleLink(company.id, company.name)}
                disabled={linkMutation.isPending}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/20 text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt="" className="w-5 h-5 object-contain rounded" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{company.name}</div>
                  {company.domain && <div className="text-[11px] text-zinc-600 truncate">{company.domain}</div>}
                </div>
                {company.status && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    company.status === "active" ? "bg-emerald-500/10 text-emerald-500" :
                    company.status === "prospect" ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-zinc-800 text-zinc-500"
                  }`}>
                    {company.status}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full text-xs border-zinc-700 text-zinc-400 bg-transparent">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// THREAD ROW

function ThreadRow({
  thread, isSelected, onClick, starLevel, bulkMode, bulkSelected, onBulkToggle,
}: {
  thread: CategorizedThread;
  isSelected: boolean;
  onClick: () => void;
  starLevel: number | null;
  bulkMode?: boolean;
  bulkSelected?: boolean;
  onBulkToggle?: (threadId: string) => void;
}) {
  const config = CATEGORY_CONFIG[thread.category];
  const CategoryIcon = config.icon;

  return (
    <button
      onClick={bulkMode ? () => onBulkToggle?.(thread.threadId) : onClick}
      className={`
        w-full text-left px-4 py-3 border-b border-zinc-800/30 transition-all group
        ${bulkSelected
          ? "bg-yellow-600/5 border-l-2 border-l-yellow-600"
          : isSelected
            ? "bg-zinc-800/60 border-l-2 border-l-yellow-600"
            : "hover:bg-zinc-900/80 border-l-2 border-l-transparent"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox or Avatar */}
        {bulkMode ? (
          <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
            ${bulkSelected
              ? "bg-yellow-600 border-yellow-600"
              : "border-zinc-700 hover:border-zinc-500"
            }`}
          >
            {bulkSelected && <Check className="h-4 w-4 text-black" />}
          </div>
        ) : (
          <div className={`w-8 h-8 rounded-full ${avatarColor(thread.fromEmail)} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            <span className="text-[11px] font-semibold text-white">{senderInitials(thread.fromName || thread.fromEmail)}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {thread.isUnread && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />}
              <span className={`text-[13px] truncate ${thread.isUnread ? "font-semibold text-white" : "text-zinc-300"}`}>
                {thread.fromName || thread.fromEmail}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Star indicator */}
              {starLevel && (
                <div className={`flex items-center gap-0 ${STAR_CONFIG[starLevel].color}`}>
                  {Array.from({ length: starLevel }).map((_, i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-current -ml-0.5 first:ml-0" />
                  ))}
                </div>
              )}
              <CategoryIcon className={`h-3 w-3 ${config.color} opacity-60`} />
              <span className="text-[11px] text-zinc-600 tabular-nums">{formatDate(thread.date)}</span>
            </div>
          </div>
          <div className={`text-[13px] truncate mt-0.5 ${thread.isUnread ? "text-zinc-200" : "text-zinc-400"}`}>
            {thread.subject || "(no subject)"}
          </div>
          <div className="text-[12px] text-zinc-600 truncate mt-0.5">{thread.snippet}</div>
          {thread.messageCount > 1 && (
            <span className="inline-block mt-1 text-[10px] text-zinc-600 bg-zinc-800/60 rounded px-1.5 py-0.5">
              {thread.messageCount} messages
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// EMPTY STATE

function EmptyInbox({ folder, category }: { folder: Folder; category: OmniCategory | "all" }) {
  const config = category !== "all" ? CATEGORY_CONFIG[category as OmniCategory] : null;
  const Icon = config?.icon || Inbox;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800/60 flex items-center justify-center mb-4">
        <Icon className={`h-6 w-6 ${config?.color || "text-zinc-700"}`} />
      </div>
      <p className="text-sm text-zinc-400">
        {category !== "all"
          ? `No emails in ${config?.label}`
          : folder === "inbox"
            ? "Inbox zero"
            : `No emails in ${folder}`}
      </p>
      {config && <p className="text-[11px] text-zinc-600 mt-1">{config.description}</p>}
    </div>
  );
}

// THREAD VIEW (Reading Pane)

function ThreadView({
  threadId, onBack, onReply, onReplyAll, onForward,
}: {
  threadId: string;
  onBack: () => void;
  onReply: (msg: ServerMessage) => void;
  onReplyAll: (msg: ServerMessage) => void;
  onForward: (msg: ServerMessage) => void;
}) {
  const { data, isLoading, error } = trpc.mail.getThread.useQuery({ threadId });
  const trashMutation = trpc.mail.trash.useMutation();
  const starQuery = trpc.mail.getStar.useQuery({ threadId });
  const companyLinksQuery = trpc.mail.getCompanyLinks.useQuery({ threadId });
  const unlinkMutation = trpc.mail.unlinkCompany.useMutation();
  const utils = trpc.useUtils();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [personCardOpen, setPersonCardOpen] = useState(false);
  const [personCardContactId, setPersonCardContactId] = useState<number | null>(null);

  // AI Summary
  const summaryQuery = trpc.mail.getThreadSummary.useQuery({ threadId });
  const summarizeMutation = trpc.mail.summarizeThread.useMutation({
    onSuccess: () => {
      utils.mail.getThreadSummary.invalidate({ threadId });
      setSummaryOpen(true);
    },
  });
  const summaryData = summarizeMutation.data || (summaryQuery.data ? { ...summaryQuery.data, cached: true } : null);

  // AI Task Extraction
  const extractTasksMutation = trpc.mail.extractTasks.useMutation({
    onSuccess: (result) => {
      // Auto-populate the task modal with extracted tasks
      const mapped: TaskItem[] = result.tasks.map((t) => ({
        id: crypto.randomUUID(),
        title: t.title,
        description: t.description || "",
        priority: (["low", "medium", "high"].includes(t.priority) ? t.priority : "medium") as "low" | "medium" | "high",
        assignee: t.assigneeContactId ? { id: t.assigneeContactId, name: t.assigneeName || "", email: t.assigneeEmail || null, phone: null, organization: null, companyId: null, photoUrl: null, title: null, category: null } : null,
        assignedName: t.assigneeName || "",
        dueDate: "",
        category: t.category || "",
      }));
      setAiExtractedTasks(mapped);
      setTaskModalOpen(true);
      toast.success(`${result.tasks.length} action item${result.tasks.length !== 1 ? "s" : ""} extracted`, {
        description: result.threadContext,
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to extract tasks");
    },
  });
  const [aiExtractedTasks, setAiExtractedTasks] = useState<TaskItem[] | null>(null);

  // Find contact from sender email — must be above early returns to maintain hook order
  const firstFromEmail = data?.messages?.[data.messages.length - 1]?.fromEmail || "";
  const senderLookup = trpc.directory.findByEmail.useQuery(
    { email: firstFromEmail },
    { enabled: !!firstFromEmail }
  );
  const senderContact = senderLookup.data?.contact;
  const senderCompany = senderLookup.data?.company;

  // Person card query
  const personCardQuery = trpc.directory.personCard.useQuery(
    { contactId: personCardContactId! },
    { enabled: !!personCardContactId && personCardOpen }
  );
  const threadTasksQuery = trpc.mail.getThreadTasks.useQuery({ threadId });
  const linkedTasks = threadTasksQuery.data || [];

  // Auto-mark unread messages as read when thread is opened
  const toggleReadMutation = trpc.mail.toggleRead.useMutation();
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.messages?.length || markedRef.current === threadId) return;
    const unreadMsgs = data.messages.filter((m: ServerMessage) => m.isUnread);
    if (unreadMsgs.length > 0) {
      markedRef.current = threadId;
      // Mark each unread message as read
      Promise.all(
        unreadMsgs.map((m: ServerMessage) => toggleReadMutation.mutateAsync({ messageId: m.id, read: true }).catch(() => {}))
      ).then(() => {
        // Refresh unread count and thread list
        utils.mail.getUnreadCount.invalidate();
        utils.mail.listThreads.invalidate();
      });
    }
  }, [data?.messages, threadId]);

  const handleTrash = async (msgId: string) => {
    try {
      await trashMutation.mutateAsync({ messageId: msgId });
      toast.success("Moved to trash");
      utils.mail.listThreads.invalidate();
      onBack();
    } catch {
      toast.error("Failed to trash");
    }
  };

  const handleUnlink = async (linkId: number) => {
    try {
      await unlinkMutation.mutateAsync({ linkId });
      toast.success("Company unlinked");
      utils.mail.getCompanyLinks.invalidate({ threadId });
    } catch {
      toast.error("Failed to unlink");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (error || !data?.messages?.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-5 w-5 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">Failed to load thread</p>
        </div>
      </div>
    );
  }

  const messages = data.messages as ServerMessage[];
  const lastMsg = messages[messages.length - 1];
  const companyLinks = companyLinksQuery.data || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Thread Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/60 flex-shrink-0">
        <button
          onClick={onBack}
          className="lg:hidden p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-white truncate">{lastMsg.subject || "(no subject)"}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-zinc-600">{messages.length} message{messages.length !== 1 ? "s" : ""}</p>
            {senderContact && (
              <button
                onClick={() => { setPersonCardContactId(senderContact.id); setPersonCardOpen(true); }}
                className="flex items-center gap-1 text-[10px] text-amber-600/70 hover:text-amber-400 transition-colors"
              >
                <User className="h-2.5 w-2.5" />
                <span>{senderContact.name}</span>
                {senderCompany && <span className="text-zinc-600">· {senderCompany.name}</span>}
              </button>
            )}
            {linkedTasks.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <CheckSquare className="h-2.5 w-2.5" /> {linkedTasks.length} task{linkedTasks.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Star Priority */}
          <StarPrioritySelector
            threadId={threadId}
            currentLevel={starQuery.data?.starLevel ?? null}
          />

          {/* AI Summary */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (summaryData) {
                    setSummaryOpen(!summaryOpen);
                  } else {
                    summarizeMutation.mutate({ threadId, force: false });
                  }
                }}
                disabled={summarizeMutation.isPending}
                className={`p-2 rounded-lg hover:bg-zinc-800/50 transition-colors ${
                  summaryOpen ? "text-yellow-500 bg-zinc-800/50" :
                  summaryData ? "text-yellow-600/60 hover:text-yellow-500" :
                  "text-zinc-600 hover:text-yellow-500"
                }`}
              >
                {summarizeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{summaryData ? (summaryOpen ? "Hide Summary" : "Show Summary") : "AI Summary"}</TooltipContent>
          </Tooltip>

          {/* AI Extract Tasks */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => extractTasksMutation.mutate({ threadId })}
                disabled={extractTasksMutation.isPending}
                className={`p-2 rounded-lg hover:bg-zinc-800/50 transition-colors ${
                  extractTasksMutation.isPending ? "text-yellow-500 animate-pulse" : "text-zinc-600 hover:text-emerald-400"
                }`}
              >
                {extractTasksMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>AI Extract Tasks</TooltipContent>
          </Tooltip>

          {/* Convert to Task (manual) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setAiExtractedTasks(null); setTaskModalOpen(true); }}
                className="p-2 text-zinc-600 hover:text-yellow-500 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <CheckSquare className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Create Tasks Manually</TooltipContent>
          </Tooltip>

          {/* Link to Company */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCompanyModalOpen(true)}
                className="p-2 text-zinc-600 hover:text-blue-400 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <Building2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Link to Company</TooltipContent>
          </Tooltip>

          {/* Trash */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTrash(lastMsg.id)}
                disabled={trashMutation.isPending}
                className="p-2 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Company Links Bar */}
      {companyLinks.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-800/40 bg-zinc-900/30">
          <Link2 className="h-3 w-3 text-zinc-600 flex-shrink-0" />
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Linked:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {companyLinks.map((link: any) => (
              <span
                key={link.id}
                className="inline-flex items-center gap-1.5 text-[11px] bg-zinc-800/60 border border-zinc-700/40 rounded-full px-2.5 py-0.5"
              >
                <Building2 className="h-2.5 w-2.5 text-blue-400" />
                <span className="text-zinc-300">{link.companyName}</span>
                <button
                  onClick={() => handleUnlink(link.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors ml-0.5"
                  disabled={unlinkMutation.isPending}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary Panel */}
      {summaryOpen && summaryData && (
        <div className="border-b border-zinc-800/40 bg-gradient-to-b from-zinc-900/80 to-black">
          <div className="px-5 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-[11px] font-semibold text-yellow-500 uppercase tracking-wider">AI Summary</span>
                {summaryData.cached && (
                  <span className="text-[9px] text-zinc-600 bg-zinc-800/60 rounded px-1.5 py-0.5">cached</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => summarizeMutation.mutate({ threadId, force: true })}
                      disabled={summarizeMutation.isPending}
                      className="p-1 text-zinc-600 hover:text-yellow-500 rounded transition-colors"
                    >
                      <RotateCw className={`h-3 w-3 ${summarizeMutation.isPending ? "animate-spin" : ""}`} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerate</TooltipContent>
                </Tooltip>
                <button
                  onClick={() => setSummaryOpen(false)}
                  className="p-1 text-zinc-600 hover:text-white rounded transition-colors"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Executive Summary */}
            <p className="text-[13px] text-zinc-300 leading-relaxed mb-3">{summaryData.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Key Points */}
              {summaryData.keyPoints?.length > 0 && (
                <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/40">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="h-3 w-3 text-yellow-600" />
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Key Points</span>
                  </div>
                  <ul className="space-y-1">
                    {summaryData.keyPoints.map((pt: string, i: number) => (
                      <li key={i} className="text-[11px] text-zinc-400 leading-relaxed flex gap-1.5">
                        <span className="text-zinc-600 flex-shrink-0">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {summaryData.actionItems?.length > 0 && (
                <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/40">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ListChecks className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Action Items</span>
                  </div>
                  <ul className="space-y-1">
                    {summaryData.actionItems.map((item: string, i: number) => (
                      <li key={i} className="text-[11px] text-zinc-400 leading-relaxed flex gap-1.5">
                        <span className="text-emerald-600 flex-shrink-0">○</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Entities */}
              {summaryData.entities?.length > 0 && (
                <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/40">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Hash className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Entities</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {summaryData.entities.map((entity: string, i: number) => (
                      <span key={i} className="text-[10px] bg-zinc-800/60 border border-zinc-700/30 text-zinc-400 rounded-full px-2 py-0.5">
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className="border-b border-zinc-800/30">
            {/* Message Header */}
            <div className="flex items-start gap-3 px-5 pt-4 pb-2">
              <div className={`w-9 h-9 rounded-full ${avatarColor(msg.fromEmail)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-[11px] font-semibold text-white">{senderInitials(msg.fromName || msg.fromEmail)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-white">{msg.fromName || msg.fromEmail}</span>
                  <span className="text-[11px] text-zinc-600">{formatFullDate(parseInt(msg.internalDate))}</span>
                </div>
                <div className="text-[11px] text-zinc-600 truncate">{msg.fromEmail}</div>
                {msg.to?.length > 0 && (
                  <div className="text-[11px] text-zinc-700 mt-0.5">To: {msg.to.join(", ")}</div>
                )}
              </div>
            </div>

            {/* Message Body */}
            <div className="px-5 pb-4">
              {msg.bodyHtml ? (
                <div
                  className="text-sm text-zinc-300 leading-relaxed [&_a]:text-yellow-500 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_table]:border-collapse [&_td]:p-1 [&_th]:p-1 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.bodyHtml, { ADD_TAGS: ['style'], ADD_ATTR: ['target'] }) }}
                />
              ) : (
                <pre className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {msg.body || "No content"}
                </pre>
              )}
            </div>
          </div>
        ))}

        {/* Reply Actions */}
        <div className="px-5 py-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReply(lastMsg)}
            className="text-xs border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 bg-transparent"
          >
            <Reply className="h-3.5 w-3.5 mr-1.5" /> Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReplyAll(lastMsg)}
            className="text-xs border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 bg-transparent"
          >
            <ReplyAll className="h-3.5 w-3.5 mr-1.5" /> Reply All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onForward(lastMsg)}
            className="text-xs border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 bg-transparent"
          >
            <Forward className="h-3.5 w-3.5 mr-1.5" /> Forward
          </Button>
        </div>
      </div>

      {/* Convert to Task Modal */}
      <ConvertToTaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setAiExtractedTasks(null); }}
        threadId={threadId}
        subject={lastMsg.subject || ""}
        fromEmail={lastMsg.fromEmail || ""}
        initialTasks={aiExtractedTasks}
      />

      {/* Link to Company Modal */}
      <LinkToCompanyModal
        open={companyModalOpen}
        onClose={() => setCompanyModalOpen(false)}
        threadId={threadId}
      />

      {/* Person Card Sidebar */}
      {personCardOpen && personCardContactId && (
        <div className="fixed right-0 top-0 h-full w-80 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-40 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-amber-500" />
              <span className="text-[12px] font-semibold text-white uppercase tracking-wider">Contact</span>
            </div>
            <button onClick={() => setPersonCardOpen(false)} className="p-1 text-zinc-500 hover:text-white rounded">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {personCardQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          ) : personCardQuery.data ? (
            <div className="p-4 space-y-4">
              {/* Person header */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${avatarColor(personCardQuery.data.email || "")} flex items-center justify-center`}>
                  {personCardQuery.data.photoUrl ? (
                    <img src={personCardQuery.data.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-white">{senderInitials(personCardQuery.data.name)}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{personCardQuery.data.name}</div>
                  {personCardQuery.data.title && (
                    <div className="text-[11px] text-zinc-500">{personCardQuery.data.title}</div>
                  )}
                  {personCardQuery.data.email && (
                    <div className="text-[11px] text-zinc-600">{personCardQuery.data.email}</div>
                  )}
                </div>
              </div>

              {/* Company */}
              {personCardQuery.data.company && (
                <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/40">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Company</span>
                  </div>
                  <div className="text-[12px] text-white font-medium">{personCardQuery.data.company.name}</div>
                  {personCardQuery.data.company.industry && (
                    <div className="text-[10px] text-zinc-500 mt-0.5">{personCardQuery.data.company.industry}</div>
                  )}
                </div>
              )}

              {/* Recent tasks */}
              {personCardQuery.data.recentTasks?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckSquare className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Tasks</span>
                  </div>
                  <div className="space-y-1.5">
                    {personCardQuery.data.recentTasks.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          t.status === "completed" ? "bg-emerald-500" :
                          t.priority === "high" ? "bg-red-400" : "bg-zinc-600"
                        }`} />
                        <span className="text-zinc-300 truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent meetings */}
              {personCardQuery.data.recentMeetings?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="h-3 w-3 text-purple-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Meetings</span>
                  </div>
                  <div className="space-y-1.5">
                    {personCardQuery.data.recentMeetings.map((m: any) => (
                      <div key={m.id} className="text-[11px] text-zinc-400">
                        {m.meetingTitle || "Untitled meeting"}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="pt-2 border-t border-zinc-800/40 space-y-1.5">
                <button
                  onClick={() => { setTaskModalOpen(true); setPersonCardOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800/40 rounded-lg transition-colors"
                >
                  <CheckSquare className="h-3 w-3 text-amber-500" /> Create task for this person
                </button>
                <button
                  onClick={() => { setCompanyModalOpen(true); setPersonCardOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800/40 rounded-lg transition-colors"
                >
                  <Building2 className="h-3 w-3 text-blue-400" /> Link company
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-[11px] text-zinc-600">Contact not found</div>
          )}
        </div>
      )}
    </div>
  );
}

// MAIN MAIL MODULE

export default function MailModule() {
  const { user } = useAuth();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [category, setCategory] = useState<OmniCategory | "all">("action");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ServerMessage | undefined>();
  const [replyAll, setReplyAll] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ServerMessage | undefined>();
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Bulk star mutations
  const bulkSetStarsMutation = trpc.mail.bulkSetStars.useMutation();
  const bulkRemoveStarsMutation = trpc.mail.bulkRemoveStars.useMutation();

  const toggleBulkSelect = (threadId: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const selectAll = () => {
    setBulkSelected(new Set(filteredThreads.map((t) => t.threadId)));
  };

  const deselectAll = () => {
    setBulkSelected(new Set());
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setBulkSelected(new Set());
  };

  const handleBulkSetStar = async (level: number) => {
    const ids = Array.from(bulkSelected);
    if (!ids.length) return;
    try {
      await bulkSetStarsMutation.mutateAsync({ threadIds: ids, starLevel: level });
      toast.success(`${ids.length} thread${ids.length !== 1 ? "s" : ""} marked as ${STAR_CONFIG[level].label}`);
      starsQuery.refetch();
      exitBulkMode();
    } catch {
      toast.error("Failed to assign stars");
    }
  };

  const handleBulkRemoveStars = async () => {
    const ids = Array.from(bulkSelected);
    if (!ids.length) return;
    try {
      await bulkRemoveStarsMutation.mutateAsync({ threadIds: ids });
      toast.success(`Stars removed from ${ids.length} thread${ids.length !== 1 ? "s" : ""}`);
      starsQuery.refetch();
      exitBulkMode();
    } catch {
      toast.error("Failed to remove stars");
    }
  };

  // Queries
  const connectionQuery = trpc.mail.connectionStatus.useQuery();
  const isConnected = connectionQuery.data?.connected === true;
  const hasGmailScopes = connectionQuery.data?.hasGmailScopes === true;

  const threadsQuery = trpc.mail.listThreads.useQuery(
    { folder, search: searchQuery || undefined, maxResults: 50, pageToken },
    { enabled: isConnected && hasGmailScopes }
  );

  const unreadQuery = trpc.mail.getUnreadCount.useQuery(undefined, {
    enabled: isConnected && hasGmailScopes,
  });

  // Star priorities for all threads
  const starsQuery = trpc.mail.getStars.useQuery(undefined, {
    enabled: isConnected && hasGmailScopes,
  });

  const starMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (starsQuery.data) {
      starsQuery.data.forEach((s: any) => { map[s.threadId] = s.starLevel; });
    }
    return map;
  }, [starsQuery.data]);

  // Categorize threads
  const categorizedThreads = useMemo<CategorizedThread[]>(() => {
    if (!threadsQuery.data?.threads) return [];
    return (threadsQuery.data.threads as ServerThread[]).map((t) => ({
      ...t,
      category: categorizeThread(t),
    }));
  }, [threadsQuery.data?.threads]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<OmniCategory | "all", number> = {
      all: categorizedThreads.length,
      action: 0, capital: 0, team: 0, recurring: 0, signal: 0, low_priority: 0,
    };
    categorizedThreads.forEach((t) => { counts[t.category]++; });
    return counts;
  }, [categorizedThreads]);

  // Filter by category and star
  const filteredThreads = useMemo(() => {
    let threads = categorizedThreads;
    if (category !== "all") {
      threads = threads.filter((t) => t.category === category);
    }
    if (starFilter !== null) {
      threads = threads.filter((t) => starMap[t.threadId] === starFilter);
    }
    return threads;
  }, [categorizedThreads, category, starFilter, starMap]);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setSelectedThreadId(null);
    setPageToken(undefined);
    setCategory("all");
  };

  const handleRefresh = () => {
    threadsQuery.refetch();
    unreadQuery.refetch();
    starsQuery.refetch();
  };

  const openCompose = () => {
    setReplyTo(undefined);
    setReplyAll(false);
    setForwardMsg(undefined);
    setComposeOpen(true);
  };

  const openReply = (msg: ServerMessage) => {
    setReplyTo(msg);
    setReplyAll(false);
    setForwardMsg(undefined);
    setComposeOpen(true);
  };

  const openReplyAll = (msg: ServerMessage) => {
    setReplyTo(msg);
    setReplyAll(true);
    setForwardMsg(undefined);
    setComposeOpen(true);
  };

  const openForward = (msg: ServerMessage) => {
    setReplyTo(undefined);
    setReplyAll(false);
    setForwardMsg(msg);
    setComposeOpen(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (composeOpen) setComposeOpen(false);
        else if (selectedThreadId) setSelectedThreadId(null);
      }
      if (isInput) return;
      if (e.key === "c") openCompose();
      if (e.key === "b") {
        if (bulkMode) exitBulkMode();
        else setBulkMode(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedThreadId, composeOpen]);

  // Loading state
  if (connectionQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (!isConnected) return <ConnectGmailPrompt />;
  if (!hasGmailScopes) return <ConnectGmailPrompt needsReauth />;

  const folderItems: { id: Folder; icon: React.ElementType; label: string; count?: number }[] = [
    { id: "inbox", icon: Inbox, label: "Inbox", count: unreadQuery.data?.count },
    { id: "sent", icon: Send, label: "Sent" },
    { id: "drafts", icon: FileText, label: "Drafts" },
    { id: "starred", icon: Star, label: "Starred" },
    { id: "all", icon: Mail, label: "All Mail" },
  ];

  const categoryItems: { id: OmniCategory; icon: React.ElementType; label: string; color: string }[] = [
    { id: "action", ...CATEGORY_CONFIG.action },
    { id: "capital", ...CATEGORY_CONFIG.capital },
    { id: "team", ...CATEGORY_CONFIG.team },
    { id: "recurring", ...CATEGORY_CONFIG.recurring },
    { id: "signal", ...CATEGORY_CONFIG.signal },
    { id: "low_priority", ...CATEGORY_CONFIG.low_priority },
  ];

  return (
    <div className="h-[calc(100vh)] flex flex-col bg-black overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          TOP COMMAND BAR
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="h-12 border-b border-zinc-800/80 flex items-center gap-3 px-4 bg-black/95 backdrop-blur flex-shrink-0">
        {/* Sidebar toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
        </Tooltip>

        {/* Current view label */}
        <div className="flex items-center gap-2">
          {category !== "all" && folder === "inbox" ? (
            <>
              {(() => {
                const Icon = CATEGORY_CONFIG[category as OmniCategory].icon;
                return <Icon className={`h-4 w-4 ${CATEGORY_CONFIG[category as OmniCategory].color}`} />;
              })()}
              <span className="text-sm font-medium text-white">{CATEGORY_CONFIG[category as OmniCategory].label}</span>
            </>
          ) : (
            <>
              {(() => {
                const f = folderItems.find((fi) => fi.id === folder);
                const Icon = f?.icon || Mail;
                return <Icon className="h-4 w-4 text-yellow-600" />;
              })()}
              <span className="text-sm font-medium text-white">{folderItems.find((fi) => fi.id === folder)?.label || "Mail"}</span>
            </>
          )}
          {folder === "inbox" && unreadQuery.data?.count && unreadQuery.data.count > 0 ? (
            <span className="text-[10px] bg-yellow-600/20 text-yellow-500 font-semibold px-1.5 py-0.5 rounded-full">
              {unreadQuery.data.count > 99 ? "99+" : unreadQuery.data.count}
            </span>
          ) : null}
        </div>

        {/* Category pills in top bar */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          {categoryItems.map((cat) => {
            const isActive = folder === "inbox" && category === cat.id;
            const count = categoryCounts[cat.id];
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setFolder("inbox");
                  setCategory(cat.id);
                  setSelectedThreadId(null);
                  setPageToken(undefined);
                  setSearchQuery("");
                  setSearchInput("");
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all
                  ${isActive
                    ? "bg-zinc-800 text-white border border-zinc-700/60"
                    : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30"
                  }`}
              >
                <Icon className={`h-3 w-3 ${isActive ? cat.color : ""}`} />
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className={`text-[9px] tabular-nums ${isActive ? cat.color : "text-zinc-700"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex-1 flex justify-end max-w-sm ml-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input
              ref={searchRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search mail..."
              className={`w-full h-8 pl-9 pr-14 rounded-lg text-[13px] text-white placeholder:text-zinc-600 outline-none transition-all
                ${searchFocused
                  ? "bg-zinc-800 border border-zinc-600 ring-1 ring-yellow-600/20"
                  : "bg-zinc-900/80 border border-zinc-800/60 hover:border-zinc-700"
                }
              `}
            />
            {!searchFocused && !searchInput && (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 font-mono">
                ⌘K
              </kbd>
            )}
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </form>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleRefresh}
                disabled={threadsQuery.isFetching}
                className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${threadsQuery.isFetching ? "animate-spin" : ""}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <Button
            onClick={openCompose}
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold h-7 px-3 text-[11px] rounded-lg transition-colors ml-1"
          >
            <MailPlus className="h-3 w-3 mr-1" /> Compose
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT SIDEBAR ─── */}
        {sidebarOpen && (
          <div className="w-52 border-r border-zinc-800/60 bg-zinc-950/40 flex-shrink-0 flex flex-col">
            {/* Folders */}
            <div className="px-3 pt-4 pb-2">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-2 mb-2">Folders</div>
              <nav className="space-y-0.5">
                {folderItems.map((f) => {
                  const Icon = f.icon;
                  const isActive = folder === f.id && category === "all";
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFolder(f.id);
                        setCategory(f.id === "inbox" ? "action" : "all");
                        setSelectedThreadId(null);
                        setPageToken(undefined);
                        setSearchQuery("");
                        setSearchInput("");
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all
                        ${isActive ? "bg-zinc-800/70 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"}`}
                    >
                      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-yellow-600" : ""}`} />
                      <span className="flex-1 text-left">{f.label}</span>
                      {f.count && f.count > 0 ? (
                        <span className={`text-[10px] font-semibold tabular-nums ${isActive ? "text-yellow-500" : "text-zinc-600"}`}>
                          {f.count > 99 ? "99+" : f.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Divider */}
            <div className="mx-4 border-t border-zinc-800/40 my-2" />

            {/* OmniScope Categories */}
            <div className="px-3 pb-2">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-2 mb-2">Categories</div>
              <nav className="space-y-0.5">
                {categoryItems.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = folder === "inbox" && category === cat.id;
                  const count = categoryCounts[cat.id];
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setFolder("inbox");
                        setCategory(cat.id);
                        setSelectedThreadId(null);
                        setPageToken(undefined);
                        setSearchQuery("");
                        setSearchInput("");
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all
                        ${isActive ? "bg-zinc-800/70 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"}`}
                    >
                      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? cat.color : ""}`} />
                      <span className="flex-1 text-left">{cat.label}</span>
                      {count > 0 && (
                        <span className={`text-[10px] font-semibold tabular-nums ${isActive ? cat.color : "text-zinc-700"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Divider */}
            <div className="mx-4 border-t border-zinc-800/40 my-2" />

            {/* Star Priorities — clickable filter */}
            <div className="px-3 pb-4 flex-1">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Priorities</span>
                {starFilter !== null && (
                  <button
                    onClick={() => setStarFilter(null)}
                    className="text-[9px] text-zinc-600 hover:text-yellow-500 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <nav className="space-y-0.5">
                {[1, 2, 3].map((level) => {
                  const config = STAR_CONFIG[level];
                  const count = Object.values(starMap).filter((l) => l === level).length;
                  const isActive = starFilter === level;
                  return (
                    <button
                      key={level}
                      onClick={() => {
                        setStarFilter(isActive ? null : level);
                        setSelectedThreadId(null);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all
                        ${isActive ? "bg-zinc-800/70 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"}`}
                    >
                      <div className={`flex items-center gap-0 ${config.color}`}>
                        {Array.from({ length: level }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current -ml-0.5 first:ml-0" />
                        ))}
                      </div>
                      <span className="flex-1 text-left">{config.label}</span>
                      {count > 0 && (
                        <span className={`text-[10px] font-semibold tabular-nums ${isActive ? config.color : "text-zinc-700"}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Analytics link */}
            <div className="mx-4 border-t border-zinc-800/40 my-2" />
            <div className="px-3 pb-2">
              <a
                href="/mail/analytics"
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-all"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Analytics</span>
              </a>
            </div>

            {/* Keyboard hints */}
            <div className="px-4 py-3 border-t border-zinc-800/40">
              <div className="text-[10px] text-zinc-700 space-y-1">
                <div className="flex justify-between"><span>Search</span><kbd className="font-mono text-zinc-600">⌘K</kbd></div>
                <div className="flex justify-between"><span>Compose</span><kbd className="font-mono text-zinc-600">C</kbd></div>
                <div className="flex justify-between"><span>Bulk select</span><kbd className="font-mono text-zinc-600">B</kbd></div>
                <div className="flex justify-between"><span>Close</span><kbd className="font-mono text-zinc-600">Esc</kbd></div>
              </div>
            </div>
          </div>
        )}

        {/* ─── THREAD LIST ─── */}
        <div className={`${selectedThreadId ? "hidden lg:flex" : "flex"} flex-col border-r border-zinc-800/60 w-[380px] min-w-[320px] max-w-[420px]`}>
          {/* Search active indicator */}
          {searchQuery && (
            <div className="px-4 py-2 border-b border-zinc-800/40 flex items-center gap-2">
              <Search className="h-3 w-3 text-zinc-600" />
              <span className="text-[11px] text-zinc-400">Results for &ldquo;{searchQuery}&rdquo;</span>
              <button
                onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                className="ml-auto text-zinc-600 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Bulk action toolbar */}
          {bulkMode && (
            <div className="px-3 py-2 border-b border-zinc-800/40 bg-zinc-900/60 flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={bulkSelected.size === filteredThreads.length ? deselectAll : selectAll}
                  className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
                >
                  {bulkSelected.size === filteredThreads.length ? (
                    <SquareCheck className="h-3.5 w-3.5 text-yellow-500" />
                  ) : bulkSelected.size > 0 ? (
                    <Minus className="h-3.5 w-3.5" />
                  ) : (
                    <CheckSquare className="h-3.5 w-3.5" />
                  )}
                </button>
                <span className="text-[11px] text-zinc-400">
                  {bulkSelected.size > 0 ? `${bulkSelected.size} selected` : "Select threads"}
                </span>
              </div>

              {bulkSelected.size > 0 && (
                <div className="flex items-center gap-1 ml-auto">
                  {[1, 2, 3].map((level) => {
                    const config = STAR_CONFIG[level];
                    return (
                      <Tooltip key={level}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleBulkSetStar(level)}
                            disabled={bulkSetStarsMutation.isPending}
                            className={`p-1.5 rounded-md hover:bg-zinc-800/50 transition-colors ${config.color}`}
                          >
                            <div className="flex items-center gap-0">
                              {Array.from({ length: level }).map((_, i) => (
                                <Star key={i} className="h-2.5 w-2.5 fill-current -ml-0.5 first:ml-0" />
                              ))}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{config.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <div className="w-px h-4 bg-zinc-800 mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleBulkRemoveStars}
                        disabled={bulkRemoveStarsMutation.isPending}
                        className="p-1.5 text-zinc-600 hover:text-red-400 rounded-md hover:bg-zinc-800/50 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Remove stars</TooltipContent>
                  </Tooltip>
                </div>
              )}

              <button
                onClick={exitBulkMode}
                className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Thread list content */}
          <div className="flex-1 overflow-y-auto">
            {threadsQuery.isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b border-zinc-800/30 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-zinc-800 rounded w-1/3" />
                        <div className="h-3 bg-zinc-800/60 rounded w-2/3" />
                        <div className="h-2.5 bg-zinc-800/40 rounded w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : threadsQuery.data?.error ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <AlertCircle className="h-5 w-5 mb-2" />
                <span className="text-xs">{threadsQuery.data.error}</span>
              </div>
            ) : !filteredThreads.length ? (
              <EmptyInbox folder={folder} category={category} />
            ) : (
              <>
                {filteredThreads.map((thread) => (
                  <ThreadRow
                    key={thread.threadId}
                    thread={thread}
                    isSelected={selectedThreadId === thread.threadId}
                    onClick={() => setSelectedThreadId(thread.threadId)}
                    starLevel={starMap[thread.threadId] || null}
                    bulkMode={bulkMode}
                    bulkSelected={bulkSelected.has(thread.threadId)}
                    onBulkToggle={toggleBulkSelect}
                  />
                ))}

                {threadsQuery.data?.nextPageToken && category === "all" && (
                  <div className="p-4 flex justify-center">
                    <button
                      onClick={() => setPageToken(threadsQuery.data?.nextPageToken)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2 px-4 rounded-lg hover:bg-zinc-800/30"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Star filter indicator */}
          {starFilter !== null && (
            <div className="px-4 py-2 border-b border-zinc-800/40 flex items-center gap-2">
              <div className={`flex items-center gap-0 ${STAR_CONFIG[starFilter].color}`}>
                {Array.from({ length: starFilter }).map((_, i) => (
                  <Star key={i} className="h-2.5 w-2.5 fill-current -ml-0.5 first:ml-0" />
                ))}
              </div>
              <span className="text-[11px] text-zinc-400">Showing {STAR_CONFIG[starFilter].label}</span>
              <button
                onClick={() => setStarFilter(null)}
                className="ml-auto text-zinc-600 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Thread list footer */}
          <div className="px-4 py-2 border-t border-zinc-800/40 text-[10px] text-zinc-700 text-center">
            {starFilter !== null ? (
              <span>{filteredThreads.length} {STAR_CONFIG[starFilter].label} thread{filteredThreads.length !== 1 ? "s" : ""}</span>
            ) : category !== "all" ? (
              <span>{filteredThreads.length} in {CATEGORY_CONFIG[category as OmniCategory].label}</span>
            ) : threadsQuery.data?.resultSizeEstimate ? (
              <span>{threadsQuery.data.resultSizeEstimate} conversations</span>
            ) : null}
          </div>
        </div>

        {/* ─── READING PANE ─── */}
        <div className={`flex-1 flex flex-col bg-black ${!selectedThreadId ? "hidden lg:flex" : "flex"}`}>
          {selectedThreadId ? (
            <ThreadView
              threadId={selectedThreadId}
              onBack={() => setSelectedThreadId(null)}
              onReply={openReply}
              onReplyAll={openReplyAll}
              onForward={openForward}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800/60 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-7 w-7 text-zinc-700" />
                </div>
                <p className="text-sm text-zinc-500">Select a conversation</p>
                <p className="text-[11px] text-zinc-700 mt-1">
                  {filteredThreads.length > 0
                    ? `${filteredThreads.length} conversations${category !== "all" ? ` in ${CATEGORY_CONFIG[category as OmniCategory].label}` : ""}`
                    : "No conversations"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        replyTo={replyTo}
        replyAll={replyAll}
        forwardMsg={forwardMsg}
      />
    </div>
  );
}
