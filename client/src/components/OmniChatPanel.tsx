import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Zap,
  Globe,
  FileText,
  Target,
} from "lucide-react";
import OmniAvatar, { OmniState } from "./OmniAvatar";
import { useDesign } from "./PortalLayout";
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
  category: string;
}

interface OmniChatPanelProps {
  open: boolean;
  onClose: () => void;
  omniMode: "sigil" | "character";
  currentPage: string;
}

// ─── Context Detection ──────────────────────────────────────────────────────

function getPageContext(path: string): { page: string; entityId?: string; label: string } {
  if (path === "/" || path.startsWith("/triage")) return { page: "triage", label: "Command Center" };
  if (path.startsWith("/meeting/")) return { page: "meeting", entityId: path.split("/")[2], label: "Meeting" };
  if (path.startsWith("/contact/")) return { page: "contact", entityId: path.split("/")[2], label: "Contact" };
  if (path.startsWith("/company/")) return { page: "company", entityId: path.split("/")[2], label: "Company" };
  if (path.startsWith("/intelligence") || path.startsWith("/meetings")) return { page: "intelligence", label: "Intelligence" };
  if (path.startsWith("/communications") || path.startsWith("/mail")) return { page: "communications", label: "Communications" };
  if (path.startsWith("/operations") || path.startsWith("/tasks")) return { page: "operations", label: "Operations" };
  if (path.startsWith("/relationships") || path.startsWith("/contacts") || path.startsWith("/companies")) return { page: "relationships", label: "Relationships" };
  if (path.startsWith("/hr")) return { page: "hr", label: "HR Hub" };
  if (path.startsWith("/setup")) return { page: "settings", label: "Settings" };
  return { page: "general", label: "Portal" };
}

function getContextSuggestions(page: string): ContextSuggestion[] {
  switch (page) {
    case "triage":
      return [
        { icon: Target, text: "What should I prioritize today?", query: "What should I prioritize today based on my tasks and meetings?", category: "Priority" },
        { icon: Users, text: "Who haven't I contacted recently?", query: "Which contacts have I not reached out to in the past 2 weeks?", category: "Relationships" },
        { icon: Calendar, text: "Summarize today's meetings", query: "Give me a summary of today's meetings and key takeaways", category: "Intelligence" },
      ];
    case "meeting":
      return [
        { icon: FileText, text: "Generate a branded recap", query: "Generate an OmniScope-branded executive summary for this meeting", category: "Documents" },
        { icon: Mail, text: "Draft follow-up email", query: "Draft a professional follow-up email to the attendees of this meeting", category: "Communications" },
        { icon: CheckCircle2, text: "Extract action items", query: "What are the key action items from this meeting?", category: "Tasks" },
      ];
    case "contact":
      return [
        { icon: Users, text: "Show relationship history", query: "Show me the full relationship history with this contact including meetings and tasks", category: "Relationships" },
        { icon: Mail, text: "Draft an outreach email", query: "Draft a professional outreach email to this contact", category: "Communications" },
        { icon: Calendar, text: "When did we last meet?", query: "When was my last meeting with this contact and what was discussed?", category: "Intelligence" },
      ];
    case "company":
      return [
        { icon: Building2, text: "Company intelligence brief", query: "Give me a full intelligence brief on this company including all meetings and contacts", category: "Intelligence" },
        { icon: Users, text: "Who are our contacts here?", query: "List all our contacts at this company and their roles", category: "Relationships" },
        { icon: CheckCircle2, text: "What's the KYB status?", query: "What is the current KYB/approval status for this company?", category: "Compliance" },
      ];
    case "communications":
      return [
        { icon: Mail, text: "Summarize unread emails", query: "Summarize my most important unread emails", category: "Communications" },
        { icon: Sparkles, text: "Draft a response", query: "Help me draft a professional response to the latest email", category: "AI Assist" },
        { icon: Calendar, text: "What's on my calendar?", query: "What meetings do I have coming up this week?", category: "Schedule" },
      ];
    case "operations":
      return [
        { icon: CheckCircle2, text: "What's overdue?", query: "Show me all overdue tasks and suggest how to prioritize them", category: "Tasks" },
        { icon: Users, text: "Team workload summary", query: "Give me a summary of task distribution across team members", category: "Team" },
        { icon: Sparkles, text: "Suggest task priorities", query: "Based on deadlines and importance, how should I prioritize my open tasks?", category: "AI Assist" },
      ];
    case "intelligence":
      return [
        { icon: Calendar, text: "Recent meeting insights", query: "What are the key insights from meetings this week?", category: "Intelligence" },
        { icon: Zap, text: "Identify opportunities", query: "What opportunities have been identified across recent meetings?", category: "Strategy" },
        { icon: Building2, text: "Which deals are active?", query: "Give me a status update on all active deals discussed in meetings", category: "Pipeline" },
      ];
    default:
      return [
        { icon: Sparkles, text: "What needs my attention?", query: "What are the most important items that need my attention right now?", category: "Priority" },
        { icon: Calendar, text: "Today's schedule", query: "What's on my schedule for today?", category: "Schedule" },
        { icon: Globe, text: "Recent activity summary", query: "Give me a summary of recent activity across meetings, tasks, and contacts", category: "Overview" },
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
  const { theme } = useDesign();

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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
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

    const history = [...messages, userMsg].map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    askMutation.mutate({
      query: q,
      context: pageContext.page,
      entityId: pageContext.entityId,
      history: history.slice(-10),
    });
  }, [input, messages, askMutation, pageContext]);

  const handleSuggestionClick = (query: string) => {
    setInput(query);
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

  const panelHeight = expanded ? "h-[85vh]" : "h-[560px]";
  const panelWidth = expanded ? "w-[600px]" : "w-[440px]";

  return (
    <>
      {/* Backdrop — premium blur */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed bottom-20 right-6 z-[91] ${panelWidth} ${panelHeight} flex flex-col overflow-hidden`}
        style={{
          background: 'rgba(12,12,12,0.95)',
          backdropFilter: 'blur(40px) saturate(1.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '20px',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8), 0 0 1px rgba(255,255,255,0.1)',
          animation: 'omniSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div 
          className="flex items-center gap-3 px-5 py-3.5 shrink-0"
          style={{ 
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div className="relative">
            <OmniAvatar mode={omniMode} state={omniState} size={34} theme={theme} />
            {/* Status dot */}
            <div 
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
              style={{ 
                borderColor: 'rgba(12,12,12,0.95)',
                backgroundColor: omniState === "thinking" ? "#f59e0b" : omniState === "error" ? "#ef4444" : "#22c55e",
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">Ask Omni</h3>
              <div 
                className="px-1.5 py-0.5 rounded-md text-[9px] font-medium"
                style={{ 
                  background: 'rgba(212,175,55,0.08)',
                  color: 'rgba(212,175,55,0.7)',
                  border: '1px solid rgba(212,175,55,0.1)',
                }}
              >
                AI
              </div>
            </div>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {omniState === "thinking" ? "Analyzing your intelligence vault..." :
               omniState === "success" ? "Response ready" :
               omniState === "error" ? "Something went wrong" :
               `Context: ${pageContext.label}`}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            {messages.length > 0 && (
              <button
                onClick={handleReset}
                className="p-2 rounded-lg transition-all duration-200"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'transparent'; }}
                title="New conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'transparent'; }}
              title={expanded ? "Minimize" : "Expand"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'transparent'; }}
              title="Close (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ─── Messages Area ─── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="space-y-6 pt-2">
              {/* Welcome */}
              <div className="text-center py-6">
                <div className="inline-block">
                  <OmniAvatar mode={omniMode} state="idle" size={56} theme={theme} />
                </div>
                <h4 className="text-base font-semibold text-white mt-4 tracking-tight">How can I help?</h4>
                <p className="text-xs mt-1.5 max-w-[280px] mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  I have access to your meetings, tasks, contacts, companies, and email — ask me anything.
                </p>
              </div>

              {/* Context suggestions — premium cards */}
              <div>
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Suggested for {pageContext.label}
                </p>
                <div className="space-y-2">
                  {suggestions.map((s, idx) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(s.query)}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(212,175,55,0.04)';
                          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                        }}
                      >
                        <div 
                          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200"
                          style={{ background: 'rgba(212,175,55,0.06)' }}
                        >
                          <Icon className="h-4 w-4 transition-colors duration-200" style={{ color: 'rgba(212,175,55,0.5)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] text-zinc-300 group-hover:text-white transition-colors block">{s.text}</span>
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{s.category}</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-all duration-200 group-hover:translate-x-0.5" style={{ color: 'rgba(255,255,255,0.15)' }} />
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
              <div className={`max-w-[88%] ${msg.role === "user" ? "order-2" : ""}`}>
                {/* Assistant message */}
                {msg.role === "assistant" && (
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-1">
                      <OmniAvatar mode={omniMode} state="idle" size={26} theme={theme} />
                    </div>
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div 
                        className="rounded-2xl rounded-tl-md px-4 py-3"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div className="text-[13px] text-zinc-200 leading-relaxed prose prose-invert prose-sm max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-[11px] [&_code]:bg-zinc-800/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      </div>

                      {/* Relevant meetings */}
                      {msg.meetings && msg.meetings.length > 0 && (
                        <div className="space-y-1.5">
                          {msg.meetings.slice(0, 3).map((m: any) => (
                            <button
                              key={m.id}
                              onClick={() => handleMeetingClick(m.id)}
                              className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 group"
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(212,175,55,0.04)';
                                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                              }}
                            >
                              <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(34,197,94,0.6)' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-zinc-300 group-hover:text-white truncate transition-colors">
                                  {m.participants?.join(", ") || "Meeting"}
                                </p>
                                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                  {new Date(m.meetingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              </div>
                              <ArrowRight className="h-3 w-3 shrink-0 group-hover:translate-x-0.5 transition-all" style={{ color: 'rgba(255,255,255,0.15)' }} />
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
                              className="text-[11px] px-3 py-1.5 rounded-full transition-all duration-200"
                              style={{
                                color: 'rgba(255,255,255,0.4)',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'rgba(212,175,55,0.8)';
                                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)';
                                e.currentTarget.style.background = 'rgba(212,175,55,0.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                              }}
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
                  <div 
                    className="rounded-2xl rounded-tr-md px-4 py-3"
                    style={{
                      background: 'rgba(212,175,55,0.08)',
                      border: '1px solid rgba(212,175,55,0.12)',
                    }}
                  >
                    <p className="text-[13px] text-zinc-200 leading-relaxed">{msg.content}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {askMutation.isPending && (
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 mt-1">
                <OmniAvatar mode={omniMode} state="thinking" size={26} theme={theme} />
              </div>
              <div 
                className="rounded-2xl rounded-tl-md px-4 py-3.5"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: 'rgba(212,175,55,0.5)',
                          animation: `omniPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ─── Input Area ─── */}
        <div 
          className="px-5 py-4 shrink-0"
          style={{ 
            borderTop: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          <div 
            className="flex items-end gap-2 rounded-xl px-3.5 py-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
          >
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
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-zinc-600 outline-none resize-none max-h-24"
              disabled={askMutation.isPending}
              style={{ minHeight: "36px", lineHeight: "1.5" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || askMutation.isPending}
              className="p-2 rounded-lg transition-all duration-200 shrink-0"
              style={{
                background: input.trim() ? 'rgba(212,175,55,0.9)' : 'rgba(255,255,255,0.04)',
                color: input.trim() ? '#000' : 'rgba(255,255,255,0.15)',
              }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2.5 px-1">
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}>Enter</kbd>
              <span className="mx-1.5" style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
              <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}>Shift+Enter</kbd>
              <span className="ml-1" style={{ color: 'rgba(255,255,255,0.15)' }}>new line</span>
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}>Esc</kbd>
              <span className="ml-1" style={{ color: 'rgba(255,255,255,0.15)' }}>close</span>
            </p>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes omniSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes omniPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}
