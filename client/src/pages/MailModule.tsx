import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Mail, Inbox, Send, FileText, Star, Search, RefreshCw, MailPlus,
  PanelLeft, PanelLeftClose, Loader2, X, AlertCircle, ChevronLeft,
  Reply, ReplyAll, Forward, Trash2, Users,
  DollarSign, Repeat, Newspaper, ArrowDown, Zap
} from "lucide-react";

// ============================================================================
// TYPES — aligned with server/gmailService.ts
// ============================================================================

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

// ============================================================================
// CATEGORY ENGINE — OmniScope Mail Intelligence
// ============================================================================

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
  "your receipt", "payment received", "auto-renewal", "plan update",
];

const SIGNAL_SENDERS = [
  "bloomberg", "reuters", "coindesk", "theblock", "decrypt",
  "morning brew", "axios", "substack",
];

function categorizeThread(thread: ServerThread): OmniCategory {
  const email = thread.fromEmail.toLowerCase();
  const domain = email.split("@")[1] || "";
  const subject = (thread.subject || "").toLowerCase();
  const snippet = (thread.snippet || "").toLowerCase();
  const labels = thread.labelIds || [];

  // 1. TEAM — internal and partner domains
  if (TEAM_DOMAINS.some((d) => domain.includes(d))) return "team";

  // 2. CAPITAL — financial/banking/deal communication
  if (
    CAPITAL_SENDERS.some((s) => email.includes(s) || domain.includes(s)) ||
    CAPITAL_SUBJECTS.some((s) => subject.includes(s))
  )
    return "capital";

  // 3. RECURRING — SaaS subscriptions and recurring payments
  if (
    RECURRING_SIGNALS.some((s) => subject.includes(s) || snippet.includes(s)) ||
    (labels.includes("CATEGORY_UPDATES") && (subject.includes("receipt") || subject.includes("invoice")))
  )
    return "recurring";

  // 4. LOW PRIORITY — promotions, marketing, cold outreach
  if (
    labels.includes("CATEGORY_PROMOTIONS") ||
    labels.includes("CATEGORY_SOCIAL") ||
    thread.hasUnsubscribe
  ) {
    if (SIGNAL_SENDERS.some((s) => email.includes(s) || domain.includes(s))) return "signal";
    if (thread.hasUnsubscribe && !labels.includes("CATEGORY_PROMOTIONS")) return "signal";
    return "low_priority";
  }

  // 5. SIGNAL — newsletters and industry updates
  if (
    labels.includes("CATEGORY_FORUMS") ||
    SIGNAL_SENDERS.some((s) => email.includes(s) || domain.includes(s))
  )
    return "signal";

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

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

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

// ============================================================================
// HELPERS
// ============================================================================

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

// ============================================================================
// CONNECT GMAIL PROMPT
// ============================================================================

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

// ============================================================================
// COMPOSE MODAL
// ============================================================================

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
  const sendMutation = trpc.mail.send.useMutation();
  const signatureQuery = trpc.profile.getSignatureHtml.useQuery(undefined, { enabled: open });
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
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              placeholder="recipient@email.com"
              autoFocus
            />
            {!showCc && (
              <button onClick={() => setShowCc(true)} className="text-[11px] text-zinc-600 hover:text-zinc-400">Cc</button>
            )}
          </div>
          {showCc && (
            <div className="flex items-center gap-2 py-2 border-b border-zinc-800/30">
              <span className="text-xs text-zinc-500 w-8">Cc</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                placeholder="cc@email.com"
              />
            </div>
          )}
          <div className="flex items-center gap-2 py-2">
            <span className="text-xs text-zinc-500 w-8">Sub</span>
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
          className="w-full h-48 px-5 py-4 bg-transparent text-sm text-white outline-none resize-none placeholder:text-zinc-600"
          placeholder="Write your message..."
        />

        {/* Signature Preview */}
        {signatureQuery.data?.enabled && signatureQuery.data?.html && (
          <div className="px-5 pb-3">
            <div className="text-[10px] text-zinc-600 mb-1">Signature</div>
            <div
              className="text-xs text-zinc-500 border-t border-zinc-800/50 pt-2"
              dangerouslySetInnerHTML={{ __html: signatureQuery.data.html }}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
          <div className="text-[11px] text-zinc-600">
            {signatureQuery.data?.enabled ? "Signature attached" : "No signature"}
          </div>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !to.trim()}
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold h-8 px-5 text-xs rounded-lg"
          >
            {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// THREAD ROW
// ============================================================================

function ThreadRow({
  thread, isSelected, onClick,
}: {
  thread: CategorizedThread;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = CATEGORY_CONFIG[thread.category];
  const CategoryIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-4 py-3 border-b border-zinc-800/30 transition-all group
        ${isSelected
          ? "bg-zinc-800/60 border-l-2 border-l-yellow-600"
          : "hover:bg-zinc-900/80 border-l-2 border-l-transparent"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full ${avatarColor(thread.fromEmail)} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <span className="text-[11px] font-semibold text-white">{senderInitials(thread.fromName || thread.fromEmail)}</span>
        </div>

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

// ============================================================================
// EMPTY STATE
// ============================================================================

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

// ============================================================================
// THREAD VIEW (Reading Pane)
// ============================================================================

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
  const utils = trpc.useUtils();

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
          <p className="text-[11px] text-zinc-600 mt-0.5">{messages.length} message{messages.length !== 1 ? "s" : ""}</p>
        </div>
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
                  dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
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
    </div>
  );
}

// ============================================================================
// MAIN MAIL MODULE
// ============================================================================

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
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Filter by category
  const filteredThreads = useMemo(() => {
    if (category === "all") return categorizedThreads;
    return categorizedThreads.filter((t) => t.category === category);
  }, [categorizedThreads, category]);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setSelectedThreadId(null);
    setPageToken(undefined);
    setCategory("all");
  };

  const handleRefresh = () => {
    threadsQuery.refetch();
    unreadQuery.refetch();
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

        {/* Search */}
        <div className="flex-1 flex justify-center max-w-lg mx-auto">
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
            <div className="px-3 pb-4 flex-1">
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

            {/* Keyboard hints */}
            <div className="px-4 py-3 border-t border-zinc-800/40">
              <div className="text-[10px] text-zinc-700 space-y-1">
                <div className="flex justify-between"><span>Search</span><kbd className="font-mono text-zinc-600">⌘K</kbd></div>
                <div className="flex justify-between"><span>Compose</span><kbd className="font-mono text-zinc-600">C</kbd></div>
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

          {/* Thread list footer */}
          <div className="px-4 py-2 border-t border-zinc-800/40 text-[10px] text-zinc-700 text-center">
            {category !== "all" ? (
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
