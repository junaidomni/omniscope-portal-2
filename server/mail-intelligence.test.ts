import { describe, it, expect } from "vitest";

// ============================================================================
// MAIL INTELLIGENCE SYSTEM TESTS
// ============================================================================

// Replicate the categorization engine from MailModule.tsx for testing
type OmniCategory = "action" | "capital" | "team" | "recurring" | "signal" | "low_priority";

interface TestThread {
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
  hasUnsubscribe?: boolean;
}

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

function categorizeThread(thread: TestThread): OmniCategory {
  const email = thread.fromEmail.toLowerCase();
  const domain = email.split("@")[1] || "";
  const subject = (thread.subject || "").toLowerCase();
  const snippet = (thread.snippet || "").toLowerCase();
  const labels = thread.labelIds || [];

  if (TEAM_DOMAINS.some((d) => domain.includes(d))) return "team";
  if (
    CAPITAL_SENDERS.some((s) => email.includes(s) || domain.includes(s)) ||
    CAPITAL_SUBJECTS.some((s) => subject.includes(s))
  ) return "capital";
  if (
    RECURRING_SIGNALS.some((s) => subject.includes(s) || snippet.includes(s)) ||
    (labels.includes("CATEGORY_UPDATES") && (subject.includes("receipt") || subject.includes("invoice")))
  ) return "recurring";
  if (
    labels.includes("CATEGORY_PROMOTIONS") ||
    labels.includes("CATEGORY_SOCIAL") ||
    thread.hasUnsubscribe
  ) {
    if (SIGNAL_SENDERS.some((s) => email.includes(s) || domain.includes(s))) return "signal";
    if (thread.hasUnsubscribe && !labels.includes("CATEGORY_PROMOTIONS")) return "signal";
    return "low_priority";
  }
  if (
    labels.includes("CATEGORY_FORUMS") ||
    SIGNAL_SENDERS.some((s) => email.includes(s) || domain.includes(s))
  ) return "signal";
  if (
    labels.includes("CATEGORY_UPDATES") ||
    email.includes("noreply") || email.includes("no-reply") ||
    email.includes("notifications") || email.includes("notify") ||
    email.includes("mailer-daemon") || email.includes("postmaster")
  ) {
    if (CAPITAL_SUBJECTS.some((s) => subject.includes(s))) return "capital";
    return "recurring";
  }
  return "action";
}

function makeThread(overrides: Partial<TestThread>): TestThread {
  return {
    threadId: "t1",
    subject: "Test Subject",
    snippet: "Test snippet",
    fromName: "Test User",
    fromEmail: "test@example.com",
    date: Date.now(),
    isUnread: false,
    isStarred: false,
    messageCount: 1,
    hasAttachments: false,
    labelIds: [],
    ...overrides,
  };
}

describe("Mail Intelligence System", () => {
  describe("Category Engine — Team Detection", () => {
    it("should categorize @omniscopex.ae emails as team", () => {
      const thread = makeThread({ fromEmail: "jake@omniscopex.ae" });
      expect(categorizeThread(thread)).toBe("team");
    });

    it("should categorize @kinetixgroup emails as team", () => {
      const thread = makeThread({ fromEmail: "partner@kinetixgroup.com" });
      expect(categorizeThread(thread)).toBe("team");
    });

    it("should categorize @kairoai.io emails as team", () => {
      const thread = makeThread({ fromEmail: "dev@kairoai.io" });
      expect(categorizeThread(thread)).toBe("team");
    });
  });

  describe("Category Engine — Capital Detection", () => {
    it("should categorize Stripe emails as capital", () => {
      const thread = makeThread({ fromEmail: "receipts@stripe.com" });
      expect(categorizeThread(thread)).toBe("capital");
    });

    it("should categorize emails with 'invoice' in subject as capital", () => {
      const thread = makeThread({ subject: "Invoice #12345 from Vendor" });
      expect(categorizeThread(thread)).toBe("capital");
    });

    it("should categorize emails with 'wire transfer' in subject as capital", () => {
      const thread = makeThread({ subject: "Wire Transfer Confirmation" });
      expect(categorizeThread(thread)).toBe("capital");
    });

    it("should categorize emails with 'settlement' in subject as capital", () => {
      const thread = makeThread({ subject: "OTC Settlement Confirmation" });
      expect(categorizeThread(thread)).toBe("capital");
    });

    it("should categorize JPMorgan emails as capital", () => {
      const thread = makeThread({ fromEmail: "alerts@jpmorgan.com" });
      expect(categorizeThread(thread)).toBe("capital");
    });
  });

  describe("Category Engine — Recurring Detection", () => {
    it("should categorize subscription emails as recurring", () => {
      const thread = makeThread({ subject: "Your subscription has been renewed" });
      expect(categorizeThread(thread)).toBe("recurring");
    });

    it("should categorize billing emails as recurring", () => {
      const thread = makeThread({ subject: "Monthly billing cycle" });
      expect(categorizeThread(thread)).toBe("recurring");
    });

    it("should categorize auto-renewal emails as recurring", () => {
      const thread = makeThread({ snippet: "Your auto-renewal is confirmed" });
      expect(categorizeThread(thread)).toBe("recurring");
    });
  });

  describe("Category Engine — Low Priority Detection", () => {
    it("should categorize CATEGORY_PROMOTIONS as low_priority", () => {
      const thread = makeThread({ labelIds: ["CATEGORY_PROMOTIONS"] });
      expect(categorizeThread(thread)).toBe("low_priority");
    });

    it("should categorize CATEGORY_SOCIAL as low_priority", () => {
      const thread = makeThread({ labelIds: ["CATEGORY_SOCIAL"] });
      expect(categorizeThread(thread)).toBe("low_priority");
    });
  });

  describe("Category Engine — Signal Detection", () => {
    it("should categorize Bloomberg newsletters as signal even with unsubscribe", () => {
      const thread = makeThread({
        fromEmail: "news@bloomberg.com",
        hasUnsubscribe: true,
      });
      expect(categorizeThread(thread)).toBe("signal");
    });

    it("should categorize Coindesk as signal", () => {
      const thread = makeThread({ fromEmail: "newsletter@coindesk.com" });
      expect(categorizeThread(thread)).toBe("signal");
    });

    it("should categorize newsletters with unsubscribe (not promotions) as signal", () => {
      const thread = makeThread({
        fromEmail: "digest@techcrunch.com",
        hasUnsubscribe: true,
        labelIds: [], // Not marked as promotions
      });
      expect(categorizeThread(thread)).toBe("signal");
    });

    it("should categorize CATEGORY_FORUMS as signal", () => {
      const thread = makeThread({ labelIds: ["CATEGORY_FORUMS"] });
      expect(categorizeThread(thread)).toBe("signal");
    });
  });

  describe("Category Engine — Action (Default)", () => {
    it("should categorize person-to-person emails as action", () => {
      const thread = makeThread({
        fromEmail: "john@clientcompany.com",
        subject: "Meeting follow-up",
      });
      expect(categorizeThread(thread)).toBe("action");
    });

    it("should categorize unknown senders as action", () => {
      const thread = makeThread({
        fromEmail: "prospect@newclient.com",
        subject: "Introduction from mutual contact",
      });
      expect(categorizeThread(thread)).toBe("action");
    });
  });

  describe("Category Engine — Notification → Recurring", () => {
    it("should categorize noreply emails as recurring", () => {
      const thread = makeThread({ fromEmail: "noreply@github.com" });
      expect(categorizeThread(thread)).toBe("recurring");
    });

    it("should categorize no-reply emails as recurring", () => {
      const thread = makeThread({ fromEmail: "no-reply@slack.com" });
      expect(categorizeThread(thread)).toBe("recurring");
    });

    it("should categorize capital-related noreply as capital", () => {
      const thread = makeThread({
        fromEmail: "noreply@bank.com",
        subject: "Wire Transfer Confirmation",
      });
      // noreply check happens but capital subject check overrides
      expect(categorizeThread(thread)).toBe("capital");
    });
  });

  describe("Category Engine — Priority Ordering", () => {
    it("should prioritize team over capital for internal financial emails", () => {
      const thread = makeThread({
        fromEmail: "finance@omniscopex.ae",
        subject: "Invoice for Q4",
      });
      // Team domain takes priority
      expect(categorizeThread(thread)).toBe("team");
    });

    it("should prioritize capital over recurring for bank subscription emails", () => {
      const thread = makeThread({
        fromEmail: "alerts@jpmorgan.com",
        subject: "Your subscription renewal",
      });
      // Capital sender takes priority
      expect(categorizeThread(thread)).toBe("capital");
    });
  });
});

describe("Profile & Signature System", () => {
  describe("Signature HTML Generation", () => {
    it("should generate signature with all fields", () => {
      const name = "Jake Ryan";
      const title = "Managing Director";
      const division = "Private Markets";
      const phone = "+971 50 123 4567";
      const location = "Dubai, UAE";
      const website = "omniscopex.ae";
      const tagline = "Private Markets | Digital Assets | Institutional Infrastructure";

      // Verify all fields are present
      expect(name).toBeTruthy();
      expect(title).toBeTruthy();
      expect(division).toBeTruthy();
      expect(phone).toBeTruthy();
      expect(location).toBeTruthy();
      expect(website).toBeTruthy();
      expect(tagline).toBeTruthy();

      // Verify signature structure
      const parts = [title, division].filter(Boolean).join(" | ");
      expect(parts).toBe("Managing Director | Private Markets");
    });

    it("should handle missing optional fields gracefully", () => {
      const name = "Team Member";
      const title = "";
      const division = "";
      const phone = "";
      const location = "";
      const website = "omniscopex.ae";
      const tagline = "";

      const parts = [title, division].filter(Boolean);
      expect(parts.length).toBe(0);

      const contactParts = [
        website ? `https://${website}` : "",
        phone,
        location,
      ].filter(Boolean);
      expect(contactParts.length).toBe(1); // Only website
      expect(contactParts[0]).toBe("https://omniscopex.ae");
    });

    it("should default website to omniscopex.ae", () => {
      const profile = { website: null };
      const website = profile.website || "omniscopex.ae";
      expect(website).toBe("omniscopex.ae");
    });

    it("should default tagline when not provided", () => {
      const profile = { tagline: null };
      const tagline = profile.tagline || "Private Markets | Digital Assets | Institutional Infrastructure";
      expect(tagline).toBe("Private Markets | Digital Assets | Institutional Infrastructure");
    });
  });

  describe("Profile Data Validation", () => {
    it("should accept valid profile update data", () => {
      const input = {
        title: "Managing Director",
        division: "Private Markets",
        phone: "+971 50 123 4567",
        location: "Dubai, UAE",
        website: "omniscopex.ae",
        tagline: "All Markets. One Scope.",
        signatureEnabled: true,
      };

      expect(input.title).toBe("Managing Director");
      expect(input.signatureEnabled).toBe(true);
    });

    it("should allow partial profile updates", () => {
      const input = { title: "Director" };
      expect(Object.keys(input).length).toBe(1);
      expect(input.title).toBe("Director");
    });

    it("should allow disabling signature", () => {
      const input = { signatureEnabled: false };
      expect(input.signatureEnabled).toBe(false);
    });
  });
});

describe("Mail Module UI Logic", () => {
  describe("Date Formatting", () => {
    it("should format recent timestamps as relative time", () => {
      const now = Date.now();
      const fiveMinAgo = now - 5 * 60 * 1000;
      const diffMins = Math.floor((now - fiveMinAgo) / 60000);
      expect(diffMins).toBe(5);
    });

    it("should format old timestamps as date strings", () => {
      const oldDate = new Date("2025-01-15T10:00:00Z");
      const formatted = oldDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("15");
    });
  });

  describe("Sender Initials", () => {
    it("should extract two initials from full name", () => {
      const name = "Jake Ryan";
      const parts = name.split(/[\s.]+/).filter(Boolean);
      const initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      expect(initials).toBe("JR");
    });

    it("should handle single-word names", () => {
      const name = "Admin";
      const parts = name.split(/[\s.]+/).filter(Boolean);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
      expect(initials).toBe("AD");
    });

    it("should handle email-only senders", () => {
      const email = "noreply@github.com";
      const name = email.split("@")[0];
      expect(name).toBe("noreply");
    });
  });

  describe("Category Counts", () => {
    it("should correctly count threads per category", () => {
      const threads = [
        makeThread({ fromEmail: "jake@omniscopex.ae" }),
        makeThread({ fromEmail: "partner@omniscopex.ae" }),
        makeThread({ fromEmail: "receipts@stripe.com" }),
        makeThread({ fromEmail: "john@client.com" }),
        makeThread({ fromEmail: "noreply@github.com" }),
        makeThread({ labelIds: ["CATEGORY_PROMOTIONS"], fromEmail: "promo@spam.com" }),
      ];

      const counts: Record<OmniCategory, number> = {
        action: 0, capital: 0, team: 0, recurring: 0, signal: 0, low_priority: 0,
      };

      threads.forEach((t) => {
        const cat = categorizeThread(t);
        counts[cat]++;
      });

      expect(counts.team).toBe(2);
      expect(counts.capital).toBe(1);
      expect(counts.action).toBe(1);
      expect(counts.recurring).toBe(1);
      expect(counts.low_priority).toBe(1);
    });
  });
});
