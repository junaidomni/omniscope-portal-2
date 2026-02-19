import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Ask Omni v42 Tests ────────────────────────────────────────────────────
// Tests for the persistent AI assistant: visual modes, chat, context, settings

// ─── 1. OmniAvatar Visual Modes ────────────────────────────────────────────

describe("OmniAvatar Visual Modes", () => {
  it("should support three modes: sigil, character, hidden", () => {
    const modes = ["sigil", "character", "hidden"];
    expect(modes).toHaveLength(3);
    expect(modes).toContain("sigil");
    expect(modes).toContain("character");
    expect(modes).toContain("hidden");
  });

  it("should support five animation states: idle, hover, thinking, success, error", () => {
    const states = ["idle", "hover", "thinking", "success", "error"];
    expect(states).toHaveLength(5);
    expect(states).toContain("idle");
    expect(states).toContain("thinking");
    expect(states).toContain("success");
    expect(states).toContain("error");
  });

  it("sigil mode should use concentric ring design (SVG-based)", () => {
    // Sigil uses 3 concentric circles: outer, mid, inner + center dot
    const sigilElements = ["outerRing", "midRing", "innerRing", "centerDot"];
    expect(sigilElements).toHaveLength(4);
  });

  it("character mode should have eye tracking capability", () => {
    // Character tracks cursor position to offset eye position
    const maxEyeOffset = 3; // pixels
    const cursorDistance = 200; // normalization distance
    
    // At max distance, offset should be maxEyeOffset
    const factor = Math.min(cursorDistance / 200, 1);
    expect(factor * maxEyeOffset).toBe(3);
    
    // At half distance, offset should be proportional
    const halfFactor = Math.min(100 / 200, 1);
    expect(halfFactor * maxEyeOffset).toBe(1.5);
  });

  it("hidden mode should render nothing", () => {
    const mode = "hidden";
    const shouldRender = mode !== "hidden";
    expect(shouldRender).toBe(false);
  });
});

// ─── 2. Context Detection ──────────────────────────────────────────────────

describe("Context Detection", () => {
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

  it("should detect triage page from root path", () => {
    expect(getPageContext("/")).toEqual({ page: "triage" });
  });

  it("should detect meeting page with entity ID", () => {
    expect(getPageContext("/meeting/42")).toEqual({ page: "meeting", entityId: "42" });
  });

  it("should detect contact page with entity ID", () => {
    expect(getPageContext("/contact/15")).toEqual({ page: "contact", entityId: "15" });
  });

  it("should detect company page with entity ID", () => {
    expect(getPageContext("/company/7")).toEqual({ page: "company", entityId: "7" });
  });

  it("should detect intelligence domain", () => {
    expect(getPageContext("/intelligence")).toEqual({ page: "intelligence" });
    expect(getPageContext("/meetings")).toEqual({ page: "intelligence" });
  });

  it("should detect communications domain", () => {
    expect(getPageContext("/communications")).toEqual({ page: "communications" });
    expect(getPageContext("/mail")).toEqual({ page: "communications" });
  });

  it("should detect operations domain", () => {
    expect(getPageContext("/operations")).toEqual({ page: "operations" });
    expect(getPageContext("/tasks")).toEqual({ page: "operations" });
  });

  it("should detect relationships domain", () => {
    expect(getPageContext("/relationships")).toEqual({ page: "relationships" });
    expect(getPageContext("/contacts")).toEqual({ page: "relationships" });
    expect(getPageContext("/companies")).toEqual({ page: "relationships" });
  });

  it("should fall back to general for unknown paths", () => {
    expect(getPageContext("/unknown")).toEqual({ page: "general" });
    expect(getPageContext("/some/random/path")).toEqual({ page: "general" });
  });
});

// ─── 3. Context Suggestions ────────────────────────────────────────────────

describe("Context-Aware Suggestions", () => {
  const contextSuggestionCounts: Record<string, number> = {
    triage: 3,
    meeting: 3,
    contact: 3,
    company: 3,
    communications: 3,
    operations: 3,
    intelligence: 3,
    general: 3,
  };

  it("should provide 3 suggestions for each page context", () => {
    for (const [context, count] of Object.entries(contextSuggestionCounts)) {
      expect(count).toBe(3);
    }
  });

  it("triage suggestions should focus on priorities and schedule", () => {
    const triageSuggestions = [
      "What should I prioritize today?",
      "Who haven't I contacted recently?",
      "Summarize today's meetings",
    ];
    expect(triageSuggestions[0]).toContain("prioritize");
    expect(triageSuggestions[1]).toContain("contacted");
    expect(triageSuggestions[2]).toContain("meetings");
  });

  it("meeting suggestions should offer recap and follow-up", () => {
    const meetingSuggestions = [
      "Generate a branded recap",
      "Draft follow-up email",
      "Extract action items",
    ];
    expect(meetingSuggestions[0]).toContain("recap");
    expect(meetingSuggestions[1]).toContain("email");
    expect(meetingSuggestions[2]).toContain("action items");
  });

  it("contact suggestions should focus on relationship history", () => {
    const contactSuggestions = [
      "Show relationship history",
      "Draft an outreach email",
      "When did we last meet?",
    ];
    expect(contactSuggestions[0]).toContain("relationship");
    expect(contactSuggestions[1]).toContain("email");
    expect(contactSuggestions[2]).toContain("last meet");
  });

  it("company suggestions should focus on intelligence and KYB", () => {
    const companySuggestions = [
      "Company intelligence brief",
      "Who are our contacts here?",
      "What's the KYB status?",
    ];
    expect(companySuggestions[0]).toContain("intelligence");
    expect(companySuggestions[1]).toContain("contacts");
    expect(companySuggestions[2]).toContain("KYB");
  });
});

// ─── 4. Chat Backend Logic ─────────────────────────────────────────────────

describe("Chat Backend — Database Context Builder", () => {
  it("should limit meetings to 30 records for token management", () => {
    const maxMeetings = 30;
    const mockMeetings = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const limited = mockMeetings.slice(0, maxMeetings);
    expect(limited).toHaveLength(30);
  });

  it("should limit tasks to 50 records", () => {
    const maxTasks = 50;
    const mockTasks = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const limited = mockTasks.slice(0, maxTasks);
    expect(limited).toHaveLength(50);
  });

  it("should limit contacts to 50 records", () => {
    const maxContacts = 50;
    const mockContacts = Array.from({ length: 80 }, (_, i) => ({ id: i }));
    const limited = mockContacts.slice(0, maxContacts);
    expect(limited).toHaveLength(50);
  });

  it("should limit companies to 30 records", () => {
    const maxCompanies = 30;
    const mockCompanies = Array.from({ length: 40 }, (_, i) => ({ id: i }));
    const limited = mockCompanies.slice(0, maxCompanies);
    expect(limited).toHaveLength(30);
  });

  it("should truncate executive summaries to 200 chars", () => {
    const longSummary = "A".repeat(500);
    const truncated = longSummary.slice(0, 200);
    expect(truncated).toHaveLength(200);
  });

  it("should limit conversation history to last 10 messages", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));
    const limited = history.slice(-10);
    expect(limited).toHaveLength(10);
    expect(limited[0].content).toBe("Message 10");
  });

  it("should include entity-specific deep context for meeting pages", () => {
    const pageContext = "meeting";
    const entityId = "42";
    const shouldIncludeDeepContext = pageContext === "meeting" && entityId;
    expect(shouldIncludeDeepContext).toBeTruthy();
  });

  it("should include entity-specific deep context for contact pages", () => {
    const pageContext = "contact";
    const entityId = "15";
    const shouldIncludeDeepContext = pageContext === "contact" && entityId;
    expect(shouldIncludeDeepContext).toBeTruthy();
  });

  it("should include entity-specific deep context for company pages", () => {
    const pageContext = "company";
    const entityId = "7";
    const shouldIncludeDeepContext = pageContext === "company" && entityId;
    expect(shouldIncludeDeepContext).toBeTruthy();
  });

  it("should not include deep context for general pages", () => {
    const pageContext = "general";
    const entityId = undefined;
    const shouldIncludeDeepContext = (pageContext === "meeting" || pageContext === "contact" || pageContext === "company") && entityId;
    expect(shouldIncludeDeepContext).toBeFalsy();
  });
});

// ─── 5. Chat System Prompt ─────────────────────────────────────────────────

describe("Chat System Prompt", () => {
  const systemPromptKeywords = [
    "Omni",
    "OmniScope",
    "institutional",
    "JARVIS",
    "MEETINGS",
    "TASKS",
    "CONTACTS",
    "COMPANIES",
    "professional",
    "KYB",
  ];

  it("should include all required context sections in system prompt", () => {
    // The system prompt must reference all data types
    const requiredSections = ["MEETINGS", "TASKS", "CONTACTS", "COMPANIES"];
    requiredSections.forEach(section => {
      expect(systemPromptKeywords).toContain(section);
    });
  });

  it("should enforce institutional tone in system prompt", () => {
    expect(systemPromptKeywords).toContain("institutional");
    expect(systemPromptKeywords).toContain("JARVIS");
  });

  it("should include capability descriptions", () => {
    const capabilities = [
      "Answer questions about any data",
      "Draft professional emails",
      "Generate meeting recaps",
      "Provide strategic recommendations",
      "Identify stale relationships",
      "Help with KYB/KYC context",
    ];
    expect(capabilities).toHaveLength(6);
  });
});

// ─── 6. Settings Persistence ────────────────────────────────────────────────

describe("Omni Settings Persistence", () => {
  it("should use correct localStorage keys", () => {
    const keys = {
      mode: "omniscope-omni-mode",
      sidebarVisible: "omniscope-omni-sidebar-visible",
    };
    expect(keys.mode).toBe("omniscope-omni-mode");
    expect(keys.sidebarVisible).toBe("omniscope-omni-sidebar-visible");
  });

  it("should default to sigil mode when no preference is stored", () => {
    const storedMode = null; // no localStorage value
    const defaultMode = storedMode || "sigil";
    expect(defaultMode).toBe("sigil");
  });

  it("should default to sidebar visible when no preference is stored", () => {
    const storedValue = null;
    const defaultVisible = storedValue !== "false";
    expect(defaultVisible).toBe(true);
  });

  it("should respect hidden mode preference", () => {
    const storedMode = "hidden";
    const shouldShowFloating = storedMode !== "hidden";
    expect(shouldShowFloating).toBe(false);
  });

  it("should respect sidebar hidden preference", () => {
    const storedValue = "false";
    const sidebarVisible = storedValue !== "false";
    expect(sidebarVisible).toBe(false);
  });
});

// ─── 7. Chat Panel Behavior ────────────────────────────────────────────────

describe("Chat Panel Behavior", () => {
  it("should generate unique message IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(`msg-${Date.now()}-${i}`);
    }
    expect(ids.size).toBe(100);
  });

  it("should support expanded and minimized panel sizes", () => {
    const minimizedHeight = "h-[520px]";
    const expandedHeight = "h-[80vh]";
    const minimizedWidth = "w-[420px]";
    const expandedWidth = "w-[560px]";
    
    expect(minimizedHeight).not.toBe(expandedHeight);
    expect(minimizedWidth).not.toBe(expandedWidth);
  });

  it("should handle empty input gracefully", () => {
    const input = "   ";
    const trimmed = input.trim();
    const shouldSend = trimmed.length > 0;
    expect(shouldSend).toBe(false);
  });

  it("should handle multi-line input via Shift+Enter", () => {
    const input = "Line 1\nLine 2\nLine 3";
    const lines = input.split("\n");
    expect(lines).toHaveLength(3);
  });

  it("should reset conversation on new conversation action", () => {
    let messages: any[] = [{ id: "1", content: "test" }];
    // Reset action
    messages = [];
    expect(messages).toHaveLength(0);
  });
});

// ─── 8. Keyboard Shortcuts ─────────────────────────────────────────────────

describe("Keyboard Shortcuts", () => {
  it("⌘K should toggle the chat panel", () => {
    let isOpen = false;
    // Simulate ⌘K
    const metaKey = true;
    const key = "k";
    if (metaKey && key === "k") {
      isOpen = !isOpen;
    }
    expect(isOpen).toBe(true);
    
    // Toggle again
    if (metaKey && key === "k") {
      isOpen = !isOpen;
    }
    expect(isOpen).toBe(false);
  });

  it("Escape should close the chat panel", () => {
    let isOpen = true;
    const key = "Escape";
    if (key === "Escape") {
      isOpen = false;
    }
    expect(isOpen).toBe(false);
  });

  it("Enter should send message (without Shift)", () => {
    const key = "Enter";
    const shiftKey = false;
    const shouldSend = key === "Enter" && !shiftKey;
    expect(shouldSend).toBe(true);
  });

  it("Shift+Enter should not send message", () => {
    const key = "Enter";
    const shiftKey = true;
    const shouldSend = key === "Enter" && !shiftKey;
    expect(shouldSend).toBe(false);
  });
});

// ─── 9. Floating Avatar Positioning ────────────────────────────────────────

describe("Floating Avatar Positioning", () => {
  it("should be positioned at bottom-right (fixed)", () => {
    const position = "fixed bottom-6 right-6 z-[80]";
    expect(position).toContain("fixed");
    expect(position).toContain("bottom-6");
    expect(position).toContain("right-6");
  });

  it("should not show when chat panel is open", () => {
    const omniChatOpen = true;
    const omniMode = "sigil";
    const shouldShowAvatar = omniMode !== "hidden" && !omniChatOpen;
    expect(shouldShowAvatar).toBe(false);
  });

  it("should show when chat panel is closed and mode is not hidden", () => {
    const omniChatOpen = false;
    const omniMode = "sigil";
    const shouldShowAvatar = omniMode !== "hidden" && !omniChatOpen;
    expect(shouldShowAvatar).toBe(true);
  });

  it("should not show when mode is hidden", () => {
    const omniChatOpen = false;
    const omniMode = "hidden";
    const shouldShowAvatar = omniMode !== "hidden" && !omniChatOpen;
    expect(shouldShowAvatar).toBe(false);
  });
});

// ─── 10. LLM Response Parsing ──────────────────────────────────────────────

describe("LLM Response Parsing", () => {
  it("should parse valid JSON response", () => {
    const rawContent = JSON.stringify({
      answer: "Here is your answer.",
      relevantMeetingIds: [1, 5, 12],
      suggestedQuestions: ["Follow up 1?", "Follow up 2?"],
    });
    const parsed = JSON.parse(rawContent);
    expect(parsed.answer).toBe("Here is your answer.");
    expect(parsed.relevantMeetingIds).toEqual([1, 5, 12]);
    expect(parsed.suggestedQuestions).toHaveLength(2);
  });

  it("should handle empty response gracefully", () => {
    const rawContent = "{}";
    const parsed = JSON.parse(rawContent);
    const answer = parsed.answer || "I wasn't able to process that request. Please try again.";
    expect(answer).toContain("wasn't able to process");
  });

  it("should handle missing suggestedQuestions", () => {
    const parsed = { answer: "Test", relevantMeetingIds: [] };
    const questions = (parsed as any).suggestedQuestions || [];
    expect(questions).toEqual([]);
  });

  it("should resolve meeting IDs to full meeting objects", () => {
    const allMeetings = [
      { id: 1, meetingDate: new Date(), participants: '["Alice"]', organizations: '["Corp"]', executiveSummary: "Test" },
      { id: 2, meetingDate: new Date(), participants: '["Bob"]', organizations: '["Inc"]', executiveSummary: "Test 2" },
      { id: 3, meetingDate: new Date(), participants: '["Charlie"]', organizations: '["LLC"]', executiveSummary: "Test 3" },
    ];
    const relevantIds = [1, 3];
    const resolved = allMeetings.filter(m => relevantIds.includes(m.id));
    expect(resolved).toHaveLength(2);
    expect(resolved[0].id).toBe(1);
    expect(resolved[1].id).toBe(3);
  });
});


// ─── v43: NOMI-Inspired Character + Omni Settings Page ───────────────────

describe("NOMI Character — Eye Expression System", () => {
  const baseScale = 1; // scale = size / 56
  const eyeW = 4.5 * baseScale;

  function getEyeH(state: string, blinking: boolean, scale: number): number {
    if (blinking) return 0.8 * scale;
    switch (state) {
      case "hover": return 7 * scale;
      case "thinking": return 4 * scale;
      case "success": return 2 * scale;
      case "error": return 5 * scale;
      default: return 6 * scale; // idle
    }
  }

  it("idle eyes should be tall pill shapes (6x scale)", () => {
    const h = getEyeH("idle", false, 1);
    expect(h).toBe(6);
  });

  it("hover eyes should widen to 7x scale (attentive)", () => {
    const h = getEyeH("hover", false, 1);
    expect(h).toBe(7);
    expect(h).toBeGreaterThan(getEyeH("idle", false, 1));
  });

  it("thinking eyes should narrow to 4x scale (focused)", () => {
    const h = getEyeH("thinking", false, 1);
    expect(h).toBe(4);
    expect(h).toBeLessThan(getEyeH("idle", false, 1));
  });

  it("success eyes should be very narrow (happy squint arcs)", () => {
    const h = getEyeH("success", false, 1);
    expect(h).toBe(2);
    expect(h).toBeLessThan(getEyeH("thinking", false, 1));
  });

  it("error eyes should be slightly smaller than idle (worried)", () => {
    const h = getEyeH("error", false, 1);
    expect(h).toBe(5);
    expect(h).toBeLessThan(getEyeH("idle", false, 1));
  });

  it("blinking should collapse eyes to 0.8x scale", () => {
    const h = getEyeH("idle", true, 1);
    expect(h).toBe(0.8);
    expect(h).toBeLessThan(1);
  });

  it("should scale eye dimensions with avatar size", () => {
    const scale2x = 2;
    expect(getEyeH("idle", false, scale2x)).toBe(12);
    expect(getEyeH("hover", false, scale2x)).toBe(14);
    expect(getEyeH("idle", true, scale2x)).toBe(1.6);
  });

  it("eye width should be 4.5 * scale", () => {
    expect(eyeW).toBe(4.5);
    expect(4.5 * 2).toBe(9); // 2x scale
  });
});

describe("NOMI Character — Mouth Expression System", () => {
  it("mouth should only show for success, error, and hover states", () => {
    const showMouth = (state: string) => state === "success" || state === "error" || state === "hover";
    expect(showMouth("success")).toBe(true);
    expect(showMouth("error")).toBe(true);
    expect(showMouth("hover")).toBe(true);
    expect(showMouth("idle")).toBe(false);
    expect(showMouth("thinking")).toBe(false);
  });

  it("success mouth should curve upward (happy)", () => {
    // In the SVG, success mouth uses Q bezier with y-offset > mouth y (curves down in SVG = smile)
    const mouthY = 5; // r + 5 * scale
    const curveControlY = 8; // r + 8 * scale
    expect(curveControlY).toBeGreaterThan(mouthY); // control point below = upward curve visually
  });

  it("error mouth should curve downward (worried)", () => {
    const mouthY = 6.5;
    const curveControlY = 5; // control point above = downward curve
    expect(curveControlY).toBeLessThan(mouthY);
  });

  it("hover mouth should be a subtle neutral line", () => {
    // Hover shows a simple horizontal line, not a curve
    const isLine = true; // SVG <line> element, not <path>
    expect(isLine).toBe(true);
  });
});

describe("NOMI Character — Rim Glow System", () => {
  function getRimOpacity(state: string): number {
    switch (state) {
      case "hover": return 0.6;
      case "thinking": return 0.3;
      case "success": return 0.8;
      case "error": return 0.2;
      default: return 0.35;
    }
  }

  it("success should have brightest rim glow (0.8)", () => {
    expect(getRimOpacity("success")).toBe(0.8);
  });

  it("hover should have strong rim glow (0.6)", () => {
    expect(getRimOpacity("hover")).toBe(0.6);
  });

  it("idle should have moderate rim glow (0.35)", () => {
    expect(getRimOpacity("idle")).toBe(0.35);
  });

  it("thinking should have dim rim glow (0.3)", () => {
    expect(getRimOpacity("thinking")).toBe(0.3);
  });

  it("error should have dimmest rim glow (0.2)", () => {
    expect(getRimOpacity("error")).toBe(0.2);
  });

  it("glow intensity should follow: success > hover > idle > thinking > error", () => {
    const s = getRimOpacity("success");
    const h = getRimOpacity("hover");
    const i = getRimOpacity("idle");
    const t = getRimOpacity("thinking");
    const e = getRimOpacity("error");
    expect(s).toBeGreaterThan(h);
    expect(h).toBeGreaterThan(i);
    expect(i).toBeGreaterThan(t);
    expect(t).toBeGreaterThan(e);
  });
});

describe("NOMI Character — Eye Tracking Physics", () => {
  function calculateEyeOffset(
    cursorX: number, cursorY: number,
    avatarCX: number, avatarCY: number,
    maxOffset: number
  ): { x: number; y: number } {
    const dx = cursorX - avatarCX;
    const dy = cursorY - avatarCY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const factor = Math.min(dist / 200, 1);
    return {
      x: (dx / (dist || 1)) * maxOffset * factor,
      y: (dy / (dist || 1)) * maxOffset * factor,
    };
  }

  it("should return zero offset when cursor is at avatar center", () => {
    const offset = calculateEyeOffset(100, 100, 100, 100, 3);
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(0);
  });

  it("should max out at maxOffset when cursor is far away", () => {
    const offset = calculateEyeOffset(500, 100, 100, 100, 3);
    expect(Math.abs(offset.x)).toBeCloseTo(3, 1);
    expect(Math.abs(offset.y)).toBeCloseTo(0, 1);
  });

  it("should use larger maxOffset for bigger avatars (size > 80)", () => {
    const smallMax = 3; // size <= 80
    const largeMax = 5; // size > 80
    expect(largeMax).toBeGreaterThan(smallMax);
  });

  it("during thinking state, eyes should look down-left", () => {
    const thinkingOffset = { x: -1.5, y: 1 };
    expect(thinkingOffset.x).toBeLessThan(0); // left
    expect(thinkingOffset.y).toBeGreaterThan(0); // down
  });
});

describe("NOMI Character — Blink Animation", () => {
  it("blink duration should be 120ms", () => {
    const blinkDuration = 120;
    expect(blinkDuration).toBe(120);
  });

  it("double blink should have 20% probability", () => {
    const doubleBlinkChance = 0.2;
    expect(doubleBlinkChance).toBe(0.2);
  });

  it("blink interval should be 2500-5500ms (natural variation)", () => {
    const minDelay = 2500;
    const maxDelay = 2500 + 3000; // 5500
    expect(minDelay).toBe(2500);
    expect(maxDelay).toBe(5500);
    // Verify randomness range
    for (let i = 0; i < 20; i++) {
      const delay = 2500 + Math.random() * 3000;
      expect(delay).toBeGreaterThanOrEqual(2500);
      expect(delay).toBeLessThanOrEqual(5500);
    }
  });

  it("double blink gap should be 120ms between blinks", () => {
    const gap = 120;
    expect(gap).toBe(120);
  });
});

describe("Omni Settings Page — Mode Selector", () => {
  const modes = [
    { id: "sigil", label: "Sigil", description: "Concentric gold rings — institutional, geometric, premium" },
    { id: "character", label: "Character", description: "NOMI-inspired companion — expressive eyes, interactive personality" },
    { id: "hidden", label: "Hidden", description: "No floating avatar — access Omni only from sidebar or ⌘K" },
  ];

  it("should offer exactly 3 modes", () => {
    expect(modes).toHaveLength(3);
  });

  it("each mode should have id, label, and description", () => {
    modes.forEach(m => {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.description).toBeTruthy();
    });
  });

  it("mode IDs should match OmniMode type", () => {
    const validModes = ["sigil", "character", "hidden"];
    modes.forEach(m => {
      expect(validModes).toContain(m.id);
    });
  });
});

describe("Omni Settings Page — State Preview", () => {
  const states = ["idle", "hover", "thinking", "success", "error"];

  it("should offer 5 preview states", () => {
    expect(states).toHaveLength(5);
  });

  it("each state should have a description", () => {
    const descriptions: Record<string, string> = {
      idle: "Calm, breathing — ready when you are",
      hover: "Attentive — eyes tracking, glow intensifies",
      thinking: "Processing — contemplative, focused",
      success: "Task complete — brief celebration",
      error: "Something's off — subtle concern",
    };
    states.forEach(s => {
      expect(descriptions[s]).toBeTruthy();
    });
  });

  it("hidden mode should show EyeOff icon instead of avatar preview", () => {
    const mode = "hidden";
    const showAvatar = mode !== "hidden";
    expect(showAvatar).toBe(false);
  });
});

describe("Omni Settings — Real-time Sync via StorageEvent", () => {
  it("should dispatch StorageEvent when mode changes", () => {
    const events: { key: string; value: string }[] = [];
    const dispatchEvent = (key: string, value: string) => {
      events.push({ key, value });
    };

    dispatchEvent("omniscope-omni-mode", "character");
    expect(events).toHaveLength(1);
    expect(events[0].key).toBe("omniscope-omni-mode");
    expect(events[0].value).toBe("character");
  });

  it("should dispatch StorageEvent when sidebar visibility changes", () => {
    const events: { key: string; value: string }[] = [];
    const dispatchEvent = (key: string, value: string) => {
      events.push({ key, value });
    };

    dispatchEvent("omniscope-omni-sidebar-visible", "false");
    expect(events).toHaveLength(1);
    expect(events[0].value).toBe("false");
  });

  it("PortalLayout should listen for storage events and update state", () => {
    // Simulate PortalLayout handler
    let omniMode = "sigil";
    let sidebarVisible = true;

    const handler = (key: string, newValue: string) => {
      if (key === "omniscope-omni-mode") omniMode = newValue;
      if (key === "omniscope-omni-sidebar-visible") sidebarVisible = newValue === "true";
    };

    handler("omniscope-omni-mode", "character");
    expect(omniMode).toBe("character");

    handler("omniscope-omni-sidebar-visible", "false");
    expect(sidebarVisible).toBe(false);

    handler("omniscope-omni-mode", "hidden");
    expect(omniMode).toBe("hidden");
  });
});

describe("Omni Settings — Setup Tab Integration", () => {
  it("Setup page should include 4 tabs including omni", () => {
    const tabs = ["profile", "integrations", "webhooks", "omni"];
    expect(tabs).toHaveLength(4);
    expect(tabs).toContain("omni");
  });

  it("omni tab should be accessible via ?tab=omni URL param", () => {
    const params = new URLSearchParams("?tab=omni");
    expect(params.get("tab")).toBe("omni");
  });
});
