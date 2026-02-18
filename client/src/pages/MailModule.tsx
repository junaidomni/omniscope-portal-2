import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Mail, Inbox, Send, FileText, Star, Search, RefreshCw, Loader2,
  ChevronDown, ChevronRight, Paperclip, Reply, ReplyAll, Forward,
  Trash2, MailOpen, MailPlus, X, ArrowLeft, Clock, AlertCircle,
  StarOff, Eye, EyeOff, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// TYPES
// ============================================================================

type Folder = "inbox" | "sent" | "drafts" | "starred" | "all";

interface ThreadListItem {
  threadId: string;
  subject: string;
  snippet: string;
  fromName: string;
  fromEmail: string;
  date: number;
  isUnread: boolean;
  isStarred: boolean;
  messageCount: number;
  hasAttachments: boolean;
  labelIds: string[];
}

interface GmailMessage {
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

// ============================================================================
// HELPERS
// ============================================================================

function timeAgo(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(ts: string | number): string {
  const d = new Date(typeof ts === "string" ? parseInt(ts) : ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-yellow-600", "bg-blue-600", "bg-green-600", "bg-purple-600",
  "bg-red-600", "bg-cyan-600", "bg-orange-600", "bg-pink-600",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ============================================================================
// COMPOSE DRAWER
// ============================================================================

function ComposeDrawer({
  open,
  onClose,
  replyTo,
  replyAll,
  forwardMsg,
}: {
  open: boolean;
  onClose: () => void;
  replyTo?: GmailMessage;
  replyAll?: boolean;
  forwardMsg?: GmailMessage;
}) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);

  const sendMutation = trpc.mail.send.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (replyTo) {
      setTo(replyTo.fromEmail);
      if (replyAll) {
        const allRecipients = [...replyTo.to, ...replyTo.cc].filter(e => e !== replyTo.fromEmail);
        setCc(allRecipients.join(", "));
        setShowCc(allRecipients.length > 0);
      }
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody(`\n\n---\nOn ${formatDate(replyTo.internalDate)}, ${replyTo.fromName} wrote:\n> ${replyTo.body.split("\n").join("\n> ")}`);
    } else if (forwardMsg) {
      setSubject(forwardMsg.subject.startsWith("Fwd:") ? forwardMsg.subject : `Fwd: ${forwardMsg.subject}`);
      setBody(`\n\n--- Forwarded message ---\nFrom: ${forwardMsg.from}\nDate: ${formatDate(forwardMsg.internalDate)}\nSubject: ${forwardMsg.subject}\n\n${forwardMsg.body}`);
    } else {
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
      setShowCc(false);
    }
  }, [replyTo, replyAll, forwardMsg, open]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Please enter a recipient");
      return;
    }

    try {
      const toList = to.split(",").map(e => e.trim()).filter(Boolean);
      const ccList = cc ? cc.split(",").map(e => e.trim()).filter(Boolean) : undefined;

      await sendMutation.mutateAsync({
        to: toList,
        cc: ccList,
        subject,
        body,
        isHtml: false,
        threadId: replyTo?.threadId,
      });

      toast.success("Email sent");
      utils.mail.listThreads.invalidate();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-0 right-6 w-[520px] bg-zinc-900 border border-zinc-700 rounded-t-xl shadow-2xl z-50 flex flex-col" style={{ maxHeight: "70vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800/50 rounded-t-xl">
        <span className="text-sm font-medium text-white">
          {replyTo ? "Reply" : forwardMsg ? "Forward" : "New Message"}
        </span>
        <button onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Fields */}
      <div className="px-4 py-2 space-y-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-8">To</span>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="h-8 bg-transparent border-0 text-sm text-white focus-visible:ring-0 px-0"
          />
          {!showCc && (
            <button onClick={() => setShowCc(true)} className="text-xs text-yellow-600 hover:text-yellow-500 whitespace-nowrap">
              Cc
            </button>
          )}
        </div>
        {showCc && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-8">Cc</span>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="h-8 bg-transparent border-0 text-sm text-white focus-visible:ring-0 px-0"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-8">Sub</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-8 bg-transparent border-0 text-sm text-white focus-visible:ring-0 px-0"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-2 overflow-y-auto">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          className="min-h-[200px] bg-transparent border-0 text-sm text-zinc-200 focus-visible:ring-0 resize-none px-0"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700">
        <div className="flex items-center gap-2">
          {/* Future: attachment button */}
        </div>
        <Button
          onClick={handleSend}
          disabled={sendMutation.isPending || !to.trim()}
          className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium text-sm px-6"
          size="sm"
        >
          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// THREAD LIST ITEM
// ============================================================================

function ThreadRow({
  thread,
  isSelected,
  onClick,
}: {
  thread: ThreadListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 transition-colors ${
        isSelected
          ? "bg-yellow-600/10 border-l-2 border-l-yellow-600"
          : thread.isUnread
            ? "bg-zinc-800/30 hover:bg-zinc-800/60"
            : "hover:bg-zinc-800/40"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full ${getAvatarColor(thread.fromName)} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <span className="text-xs font-semibold text-white">{getInitials(thread.fromName || thread.fromEmail)}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: name + time */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-sm truncate ${thread.isUnread ? "font-semibold text-white" : "text-zinc-300"}`}>
              {thread.fromName || thread.fromEmail}
            </span>
            <span className="text-xs text-zinc-500 flex-shrink-0">{timeAgo(thread.date)}</span>
          </div>

          {/* Subject */}
          <div className={`text-sm truncate mb-0.5 ${thread.isUnread ? "font-medium text-zinc-200" : "text-zinc-400"}`}>
            {thread.subject}
            {thread.messageCount > 1 && (
              <span className="text-xs text-zinc-500 ml-1">({thread.messageCount})</span>
            )}
          </div>

          {/* Snippet */}
          <div className="text-xs text-zinc-500 truncate">{thread.snippet}</div>

          {/* Indicators */}
          <div className="flex items-center gap-2 mt-1">
            {thread.isStarred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
            {thread.hasAttachments && <Paperclip className="h-3 w-3 text-zinc-500" />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// THREAD VIEW (Message Detail)
// ============================================================================

function ThreadView({
  threadId,
  onBack,
  onReply,
  onReplyAll,
  onForward,
}: {
  threadId: string;
  onBack: () => void;
  onReply: (msg: GmailMessage) => void;
  onReplyAll: (msg: GmailMessage) => void;
  onForward: (msg: GmailMessage) => void;
}) {
  const { data, isLoading, error } = trpc.mail.getThread.useQuery({ threadId });
  const toggleStarMut = trpc.mail.toggleStar.useMutation();
  const trashMut = trpc.mail.trash.useMutation();
  const utils = trpc.useUtils();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Auto-expand last message
  useEffect(() => {
    if (data?.messages && data.messages.length > 0) {
      const last = data.messages[data.messages.length - 1];
      setExpandedMessages(new Set([last.id]));
    }
  }, [data?.messages]);

  const toggleExpand = (id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTrash = async (messageId: string) => {
    try {
      await trashMut.mutateAsync({ messageId });
      toast.success("Message moved to trash");
      utils.mail.listThreads.invalidate();
      onBack();
    } catch {
      toast.error("Failed to trash message");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (error || !data?.messages?.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load thread
      </div>
    );
  }

  const subject = data.messages[0]?.subject || "(No Subject)";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Thread Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <button onClick={onBack} className="text-zinc-400 hover:text-white lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-white flex-1 truncate">{subject}</h2>
        <span className="text-xs text-zinc-500">{data.messages.length} message{data.messages.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {data.messages.map((msg, idx) => {
          const isExpanded = expandedMessages.has(msg.id);
          const isLast = idx === data.messages.length - 1;

          return (
            <div key={msg.id} className={`border border-zinc-800 rounded-lg overflow-hidden ${isLast ? "bg-zinc-800/30" : ""}`}>
              {/* Message Header */}
              <button
                onClick={() => toggleExpand(msg.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full ${getAvatarColor(msg.fromName)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xs font-semibold text-white">{getInitials(msg.fromName || msg.fromEmail)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{msg.fromName || msg.fromEmail}</span>
                    <span className="text-xs text-zinc-500">&lt;{msg.fromEmail}&gt;</span>
                  </div>
                  {!isExpanded && (
                    <div className="text-xs text-zinc-500 truncate mt-0.5">{msg.snippet}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-zinc-500">{formatDate(msg.internalDate)}</span>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                </div>
              </button>

              {/* Expanded Body */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  {/* Recipients */}
                  <div className="text-xs text-zinc-500 mb-3 pl-11">
                    <span>To: {msg.to.join(", ")}</span>
                    {msg.cc.length > 0 && <span className="ml-3">Cc: {msg.cc.join(", ")}</span>}
                  </div>

                  {/* Body */}
                  <div className="pl-11">
                    {msg.bodyHtml ? (
                      <div
                        className="text-sm text-zinc-200 prose prose-invert prose-sm max-w-none [&_a]:text-yellow-500 [&_img]:max-w-full [&_img]:rounded"
                        dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                      />
                    ) : (
                      <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans">{msg.body}</pre>
                    )}

                    {/* Attachments */}
                    {msg.hasAttachments && msg.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300">
                            <Paperclip className="h-3 w-3 text-zinc-500" />
                            <span className="truncate max-w-[200px]">{att.filename}</span>
                            <span className="text-zinc-500">({Math.round(att.size / 1024)}KB)</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onReply(msg); }}
                        className="text-xs border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                      >
                        <Reply className="h-3.5 w-3.5 mr-1" /> Reply
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onReplyAll(msg); }}
                        className="text-xs border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                      >
                        <ReplyAll className="h-3.5 w-3.5 mr-1" /> Reply All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onForward(msg); }}
                        className="text-xs border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                      >
                        <Forward className="h-3.5 w-3.5 mr-1" /> Forward
                      </Button>
                      <div className="flex-1" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                          <DropdownMenuItem
                            onClick={() => {
                              toggleStarMut.mutate({ messageId: msg.id, starred: !msg.isStarred }, {
                                onSuccess: () => { utils.mail.getThread.invalidate({ threadId }); utils.mail.listThreads.invalidate(); },
                              });
                            }}
                            className="text-zinc-300 hover:text-white"
                          >
                            {msg.isStarred ? <StarOff className="h-4 w-4 mr-2" /> : <Star className="h-4 w-4 mr-2" />}
                            {msg.isStarred ? "Unstar" : "Star"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTrash(msg.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// CONNECT GMAIL PROMPT
// ============================================================================

function ConnectGmailPrompt({ needsReauth }: { needsReauth?: boolean }) {
  const getAuthUrl = trpc.mail.getAuthUrl.useMutation();

  const handleConnect = async () => {
    try {
      const { url } = await getAuthUrl.mutateAsync({ origin: window.location.origin, returnPath: "/mail" });
      window.location.href = url;
    } catch {
      toast.error("Failed to get Google auth URL");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-6">
          <Mail className="h-8 w-8 text-yellow-600" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          {needsReauth ? "Gmail Permissions Required" : "Connect Gmail"}
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          {needsReauth
            ? "Your Google account is connected, but Gmail read/manage permissions are missing. Re-authenticate to grant full Gmail access, then come back to the Mail page."
            : "Connect your Gmail account to view, send, and manage emails directly from OmniScope. Your emails are fetched on-demand and never stored on our servers."
          }
        </p>
        <Button
          onClick={handleConnect}
          disabled={getAuthUrl.isPending}
          className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
        >
          {getAuthUrl.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
          {needsReauth ? "Re-authenticate with Gmail Access" : "Connect Gmail"}
        </Button>
        {needsReauth && (
          <p className="text-xs text-zinc-500 mt-4">
            Make sure the redirect URI is registered in your{" "}
            <a href="/integrations" className="text-yellow-600 hover:text-yellow-500 underline">Integrations settings</a>.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN MAIL MODULE
// ============================================================================

export default function MailModule() {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<GmailMessage | undefined>();
  const [replyAll, setReplyAll] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<GmailMessage | undefined>();
  const [pageToken, setPageToken] = useState<string | undefined>();

  // Check connection (now includes scope info)
  const connectionQuery = trpc.mail.connectionStatus.useQuery();
  const isConnected = connectionQuery.data?.connected;
  const hasGmailScopes = connectionQuery.data?.hasGmailScopes;

  // Unread count - only if we have Gmail scopes
  const unreadQuery = trpc.mail.getUnreadCount.useQuery(undefined, {
    enabled: !!isConnected && !!hasGmailScopes,
    refetchInterval: 60000,
  });

  // Thread list - only if we have Gmail scopes
  const threadsQuery = trpc.mail.listThreads.useQuery(
    { folder, search: searchQuery || undefined, maxResults: 25, pageToken },
    { enabled: !!isConnected && !!hasGmailScopes }
  );

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setSelectedThreadId(null);
    setPageToken(undefined);
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

  const openReply = (msg: GmailMessage) => {
    setReplyTo(msg);
    setReplyAll(false);
    setForwardMsg(undefined);
    setComposeOpen(true);
  };

  const openReplyAll = (msg: GmailMessage) => {
    setReplyTo(msg);
    setReplyAll(true);
    setForwardMsg(undefined);
    setComposeOpen(true);
  };

  const openForward = (msg: GmailMessage) => {
    setReplyTo(undefined);
    setReplyAll(false);
    setForwardMsg(msg);
    setComposeOpen(true);
  };

  // Loading state
  if (connectionQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  // Not connected or missing Gmail scopes
  if (!isConnected) {
    return (
      <div className="h-full flex bg-black">
        <ConnectGmailPrompt />
      </div>
    );
  }

  if (!hasGmailScopes) {
    return (
      <div className="h-full flex bg-black">
        <ConnectGmailPrompt needsReauth />
      </div>
    );
  }

  const folders: { id: Folder; icon: React.ElementType; label: string; count?: number }[] = [
    { id: "inbox", icon: Inbox, label: "Inbox", count: unreadQuery.data?.count },
    { id: "sent", icon: Send, label: "Sent" },
    { id: "drafts", icon: FileText, label: "Drafts" },
    { id: "starred", icon: Star, label: "Starred" },
    { id: "all", icon: Mail, label: "All Mail" },
  ];

  return (
    <div className="h-[calc(100vh-0px)] flex bg-black overflow-hidden">
      {/* Left: Folder Nav + Thread List */}
      <div className={`${selectedThreadId ? "hidden lg:flex" : "flex"} flex-col border-r border-zinc-800 bg-zinc-900/30`} style={{ width: "380px", minWidth: "380px" }}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-yellow-600" />
            Mail
          </h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={threadsQuery.isFetching}
              className="text-zinc-400 hover:text-white h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${threadsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={openCompose}
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium h-8"
            >
              <MailPlus className="h-4 w-4 mr-1" /> Compose
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-zinc-800">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search emails..."
              className="pl-9 h-9 bg-zinc-800/50 border-zinc-700 text-sm text-white"
            />
          </form>
        </div>

        {/* Folder Tabs */}
        <div className="flex px-2 py-2 gap-1 border-b border-zinc-800 overflow-x-auto">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFolder(f.id); setSelectedThreadId(null); setPageToken(undefined); setSearchQuery(""); setSearchInput(""); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                folder === f.id
                  ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
              {f.count && f.count > 0 ? (
                <span className="bg-yellow-600 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {f.count > 99 ? "99+" : f.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {threadsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
            </div>
          ) : threadsQuery.data?.error ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <AlertCircle className="h-6 w-6 mb-2" />
              <span className="text-sm">{threadsQuery.data.error}</span>
            </div>
          ) : !threadsQuery.data?.threads?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Inbox className="h-8 w-8 mb-2" />
              <span className="text-sm">No emails found</span>
            </div>
          ) : (
            <>
              {threadsQuery.data.threads.map((thread) => (
                <ThreadRow
                  key={thread.threadId}
                  thread={thread}
                  isSelected={selectedThreadId === thread.threadId}
                  onClick={() => setSelectedThreadId(thread.threadId)}
                />
              ))}

              {/* Pagination */}
              {threadsQuery.data.nextPageToken && (
                <div className="p-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageToken(threadsQuery.data?.nextPageToken)}
                    className="text-xs border-zinc-700 text-zinc-400 hover:text-white"
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Thread View */}
      <div className={`flex-1 flex flex-col ${!selectedThreadId ? "hidden lg:flex" : "flex"}`}>
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
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">Select an email to read</p>
              <p className="text-xs text-zinc-600 mt-1">
                {threadsQuery.data?.resultSizeEstimate
                  ? `${threadsQuery.data.resultSizeEstimate} emails in ${folder}`
                  : `Viewing ${folder}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Compose Drawer */}
      <ComposeDrawer
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        replyTo={replyTo}
        replyAll={replyAll}
        forwardMsg={forwardMsg}
      />
    </div>
  );
}
