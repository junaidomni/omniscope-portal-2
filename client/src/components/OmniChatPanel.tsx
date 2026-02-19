import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Send,
  Loader2,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  ArrowRight,
  Calendar,
  Building2,
  CheckCircle2,
  Users,
  Mail,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import OmniAvatar, { OmniState } from "./OmniAvatar";
import { Streamdown } from "streamdown";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  meetings?: any[];
  suggestedQuestions?: string[];
}

interface ContextSuggestion {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  query: string;
}

interface OmniChatPanelProps {
  open: boolean;
  onClose: () => void;
  omniMode: "sigil" | "character";
  currentPage: string;
}

// ─── Context Detection ──────────────────────────────────────────────────────

function getPageContext(path: string): { page: string; entityId?: string } {
  if (path === "/" || path.startsWith("/triage")) return { page: "triage" };
  if (path.startsWith("/meeting/")) return { page: "meeting", entityId: path.split("/")[2] };
  if (path.startsWith("/contact/")) return { page: "contact", entityId: path.split("/")[2] };
  if (path.startsWith("/company/")) return { page: "company", entityId: path.split("/")[2] };
  if (path.startsWith("/intelligence") || path.startsWith("/meetings")) return { page: "intelligence" };
  if (path.startsWith("/communications") || path.startsWith("/mail")) return { page: "communications" };
  if (path.startsWith("/operations") || path.startsWith("/tasks")) return { page: "operations" };
  if (path.startsWith("/relationships") || path.startsWith("/contacts") || path.startsWith("/companies")) return { page: "relationships" };
  return { page: "general" };
}

function getContextSuggestions(page: string): ContextSuggestion[] {
  switch (page) {
    case "triage":
      return [
        { icon: CheckCircle2, text: "What should I prioritize today?", query: "What should I prioritize today based on my tasks and meetings?" },
        { icon: Users, text: "Who haven't I contacted recently?", query: "Which contacts have I not reached out to in the past 2 weeks?" },
        { icon: Calendar, text: "Summarize today's meetings", query: "Give me a summary of today's meetings and key takeaways" },
      ];
    case "meeting":
      return [
        { icon: Sparkles, text: "Generate a branded recap", query: "Generate an OmniScope-branded executive summary for this meeting" },
        { icon: Mail, text: "Draft follow-up email", query: "Draft a professional follow-up email to the attendees of this meeting" },
        { icon: CheckCircle2, text: "Extract action items", query: "What are the key action items from this meeting?" },
      ];
    case "contact":
      return [
        { icon: Users, text: "Show relationship history", query: "Show me the full relationship history with this contact including meetings and tasks" },
        { icon: Mail, text: "Draft an outreach email", query: "Draft a professional outreach email to this contact" },
        { icon: Calendar, text: "When did we last meet?", query: "When was my last meeting with this contact and what was discussed?" },
      ];
    case "company":
      return [
        { icon: Building2, text: "Company intelligence brief", query: "Give me a full intelligence brief on this company including all meetings and contacts" },
        { icon: Users, text: "Who are our contacts here?", query: "List all our contacts at this company and their roles" },
        { icon: CheckCircle2, text: "What's the KYB status?", query: "What is the current KYB/approval status for this company?" },
      ];
    case "communications":
      return [
        { icon: Mail, text: "Summarize unread emails", query: "Summarize my most important unread emails" },
        { icon: Sparkles, text: "Draft a response", query: "Help me draft a professional response to the latest email" },
        { icon: Calendar, text: "What's on my calendar?", query: "What meetings do I have coming up this week?" },
      ];
    case "operations":
      return [
        { icon: CheckCircle2, text: "What's overdue?", query: "Show me all overdue tasks and suggest how to prioritize them" },
        { icon: Users, text: "Team workload summary", query: "Give me a summary of task distribution across team members" },
        { icon: Sparkles, text: "Suggest task priorities", query: "Based on deadlines and importance, how should I prioritize my open tasks?" },
      ];
    case "intelligence":
      return [
        { icon: Calendar, text: "Recent meeting insights", query: "What are the key insights from meetings this week?" },
        { icon: Sparkles, text: "Identify opportunities", query: "What opportunities have been identified across recent meetings?" },
        { icon: Building2, text: "Which deals are active?", query: "Give me a status update on all active deals discussed in meetings" },
      ];
    default:
      return [
        { icon: Sparkles, text: "What needs my attention?", query: "What are the most important items that need my attention right now?" },
        { icon: Calendar, text: "Today's schedule", query: "What's on my schedule for today?" },
        { icon: Users, text: "Recent activity summary", query: "Give me a summary of recent activity across meetings, tasks, and contacts" },
      ];
  }
}

// ─── Chat Panel Component ───────────────────────────────────────────────────

export default function OmniChatPanel({ open, onClose, omniMode, currentPage }: OmniChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [omniState, setOmniState] = useState<OmniState>("idle");
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [, setLocation] = useLocation();

  const pageContext = getPageContext(currentPage);
  const suggestions = getContextSuggestions(pageContext.page);

  const askMutation = trpc.ask.chat.useMutation({
    onSuccess: (data) => {
      setOmniState("success");
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
        meetings: data.meetings,
        suggestedQuestions: data.suggestedQuestions,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setTimeout(() => setOmniState("idle"), 1500);
    },
    onError: () => {
      setOmniState("error");
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "I encountered an issue processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setTimeout(() => setOmniState("idle"), 2000);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || askMutation.isPending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: q,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setOmniState("thinking");

    // Build conversation history for multi-turn
    const history = [...messages, userMsg].map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    askMutation.mutate({
      query: q,
      context: pageContext.page,
      entityId: pageContext.entityId,
      history: history.slice(-10), // Last 10 messages for context
    });
  }, [input, messages, askMutation, pageContext]);

  const handleSuggestionClick = (query: string) => {
    setInput(query);
    // Auto-send
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setOmniState("thinking");

    const history = [...messages, userMsg].map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    askMutation.mutate({
      query,
      context: pageContext.page,
      entityId: pageContext.entityId,
      history: history.slice(-10),
    });
    setInput("");
  };

  const handleReset = () => {
    setMessages([]);
    setOmniState("idle");
    inputRef.current?.focus();
  };

  const handleMeetingClick = (meetingId: number) => {
    onClose();
    setLocation(`/meeting/${meetingId}`);
  };

  if (!open) return null;

  const panelHeight = expanded ? "h-[80vh]" : "h-[520px]";
  const panelWidth = expanded ? "w-[560px]" : "w-[420px]";

  return (
    <>
      {/* Backdrop — subtle, click to close */}
      <div
        className="fixed inset-0 z-[90] bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed bottom-20 right-6 z-[91] ${panelWidth} ${panelHeight} bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-slide-up-panel`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm shrink-0">
          <OmniAvatar mode={omniMode} state={omniState} size={32} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Ask Omni</h3>
            <p className="text-[10px] text-zinc-500">
              {omniState === "thinking" ? "Analyzing..." :
               omniState === "success" ? "Ready" :
               omniState === "error" ? "Try again" :
               `Viewing: ${pageContext.page}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="New conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              title={expanded ? "Minimize" : "Expand"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Empty state — show context suggestions */}
          {messages.length === 0 && (
            <div className="space-y-4 pt-2">
              {/* Welcome */}
              <div className="text-center py-4">
                <OmniAvatar mode={omniMode} state="idle" size={48} />
                <p className="text-sm text-zinc-300 mt-3 font-medium">How can I help?</p>
                <p className="text-xs text-zinc-500 mt-1">
                  I have access to your meetings, tasks, contacts, and companies.
                </p>
              </div>

              {/* Context suggestions */}
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">
                  Suggested for this page
                </p>
                <div className="space-y-1.5">
                  {suggestions.map((s, idx) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(s.query)}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors group border border-transparent hover:border-zinc-700/40"
                      >
                        <Icon className="h-4 w-4 text-yellow-600/60 group-hover:text-yellow-500 shrink-0 transition-colors" />
                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">{s.text}</span>
                        <ChevronRight className="h-3 w-3 text-zinc-700 group-hover:text-zinc-500 ml-auto shrink-0 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${msg.role === "user" ? "order-2" : ""}`}>
                {/* Avatar for assistant */}
                {msg.role === "assistant" && (
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-1">
                      <OmniAvatar mode={omniMode} state="idle" size={24} />
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="bg-zinc-800/60 border border-zinc-700/30 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                        <div className="text-sm text-zinc-200 leading-relaxed prose prose-invert prose-sm max-w-none">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      </div>

                      {/* Relevant meetings */}
                      {msg.meetings && msg.meetings.length > 0 && (
                        <div className="space-y-1">
                          {msg.meetings.slice(0, 3).map((m: any) => (
                            <button
                              key={m.id}
                              onClick={() => handleMeetingClick(m.id)}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/30 border border-zinc-700/20 hover:border-yellow-600/30 hover:bg-zinc-800/50 transition-all group"
                            >
                              <Calendar className="h-3.5 w-3.5 text-emerald-500/60 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-zinc-300 group-hover:text-white truncate">
                                  {m.participants?.join(", ") || "Meeting"}
                                </p>
                                <p className="text-[10px] text-zinc-600">
                                  {new Date(m.meetingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              </div>
                              <ArrowRight className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Follow-up suggestions */}
                      {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedQuestions.map((q: string, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleSuggestionClick(q)}
                              className="text-[11px] text-zinc-500 hover:text-yellow-500 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/30 hover:border-yellow-600/30 px-2.5 py-1 rounded-full transition-all"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* User message */}
                {msg.role === "user" && (
                  <div className="bg-yellow-600/15 border border-yellow-600/20 rounded-xl rounded-tr-sm px-3.5 py-2.5">
                    <p className="text-sm text-zinc-200">{msg.content}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {askMutation.isPending && (
            <div className="flex items-start gap-2">
              <div className="shrink-0 mt-1">
                <OmniAvatar mode={omniMode} state="thinking" size={24} />
              </div>
              <div className="bg-zinc-800/40 border border-zinc-700/20 rounded-xl rounded-tl-sm px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />
                  <span className="text-xs text-zinc-400">Analyzing your intelligence vault...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-900/95 backdrop-blur-sm shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Omni anything..."
              rows={1}
              className="flex-1 bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-yellow-600/40 resize-none max-h-24 transition-colors"
              disabled={askMutation.isPending}
              style={{ minHeight: "40px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || askMutation.isPending}
              className="p-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-black transition-colors shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-zinc-600">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700/40 text-zinc-500 font-mono text-[9px]">Enter</kbd> to send
              <span className="mx-1.5">·</span>
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700/40 text-zinc-500 font-mono text-[9px]">Shift+Enter</kbd> new line
            </p>
            <p className="text-[10px] text-zinc-600">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700/40 text-zinc-500 font-mono text-[9px]">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
