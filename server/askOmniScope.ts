import { invokeLLM } from "./_core/llm";
import * as db from "./db";

export interface AskOmniScopeResult {
  answer: string;
  meetings: Array<{
    id: number;
    meetingDate: Date;
    participants: string[];
    organizations: string[];
    executiveSummary: string;
    relevanceScore: number;
  }>;
  suggestedQuestions: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  answer: string;
  meetings: Array<{
    id: number;
    meetingDate: Date;
    participants: string[];
    organizations: string[];
    executiveSummary: string;
  }>;
  suggestedQuestions: string[];
}

/**
 * Build a compact context snapshot of the entire OmniScope database
 * for the LLM to reason over. Keeps token count manageable.
 * Accepts orgId to scope data to the user's current organization.
 */
async function buildDatabaseContext(orgId?: number | null, pageContext?: string, entityId?: string) {
  const effectiveOrgId = orgId ?? undefined;
  const [allMeetings, allTasks, allContacts, allCompanies] = await Promise.all([
    db.getAllMeetings({ orgId: effectiveOrgId }),
    db.getAllTasks({ orgId: effectiveOrgId }),
    db.getAllContacts(effectiveOrgId),
    db.getAllCompanies({ orgId: effectiveOrgId }),
  ]);

  // Meetings — compact format
  const meetingsSummary = allMeetings.slice(0, 30).map(m => ({
    id: m.id,
    date: new Date(m.meetingDate).toISOString().split('T')[0],
    participants: JSON.parse(m.participants || '[]'),
    organizations: JSON.parse(m.organizations || '[]'),
    summary: (m.executiveSummary || '').slice(0, 200),
    highlights: JSON.parse(m.strategicHighlights || '[]').slice(0, 3),
    opportunities: JSON.parse(m.opportunities || '[]').slice(0, 3),
    risks: JSON.parse(m.risks || '[]').slice(0, 3),
  }));

  // Tasks — compact format
  const tasksSummary = allTasks.slice(0, 50).map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignedTo,
    due: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
    category: t.category,
  }));

  // Contacts — compact format
  const contactsSummary = allContacts.slice(0, 50).map(c => ({
    id: c.id,
    name: c.name,
    company: c.company,
    role: c.role,
    email: c.email,
    status: c.status,
    lastContact: c.lastContactDate ? new Date(c.lastContactDate).toISOString().split('T')[0] : null,
  }));

  // Companies — compact format
  const companiesSummary = allCompanies.slice(0, 30).map(c => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    status: c.status,
    contactCount: c.contactCount || 0,
  }));

  // Entity-specific deep context
  let entityContext = "";
  if (pageContext === "meeting" && entityId) {
    const meeting = allMeetings.find(m => m.id === Number(entityId));
    if (meeting) {
      entityContext = `\n\nCURRENT MEETING (ID: ${meeting.id}):\n${JSON.stringify({
        date: meeting.meetingDate,
        participants: JSON.parse(meeting.participants || '[]'),
        organizations: JSON.parse(meeting.organizations || '[]'),
        summary: meeting.executiveSummary,
        highlights: JSON.parse(meeting.strategicHighlights || '[]'),
        opportunities: JSON.parse(meeting.opportunities || '[]'),
        risks: JSON.parse(meeting.risks || '[]'),
        actionItems: JSON.parse(meeting.actionItems || '[]'),
      }, null, 2)}`;
    }
  } else if (pageContext === "contact" && entityId) {
    const contact = allContacts.find(c => c.id === Number(entityId));
    if (contact) {
      entityContext = `\n\nCURRENT CONTACT:\n${JSON.stringify(contact, null, 2)}`;
    }
  } else if (pageContext === "company" && entityId) {
    const company = allCompanies.find(c => c.id === Number(entityId));
    if (company) {
      entityContext = `\n\nCURRENT COMPANY:\n${JSON.stringify(company, null, 2)}`;
    }
  }

  return {
    meetingsSummary,
    tasksSummary,
    contactsSummary,
    companiesSummary,
    entityContext,
    allMeetings,
  };
}

/**
 * Full chat procedure — multi-turn conversation with full database context
 * Accepts orgId to scope data to the user's current organization.
 */
export async function chat(
  query: string,
  history: ChatMessage[] = [],
  pageContext?: string,
  entityId?: string,
  orgId?: number | null
): Promise<ChatResult> {
  const ctx = await buildDatabaseContext(orgId, pageContext, entityId);

  const systemPrompt = `You are Omni, OmniScope's intelligent assistant. You are calm, professional, and precise.
You serve an institutional-grade intelligence platform used by family offices, sovereigns, and private capital.

TONE: Confident, minimal, institutional. Never casual or chatty. Think JARVIS, not Siri.

You have full access to the following data:

MEETINGS (${ctx.meetingsSummary.length} records):
${JSON.stringify(ctx.meetingsSummary, null, 1)}

TASKS (${ctx.tasksSummary.length} records):
${JSON.stringify(ctx.tasksSummary, null, 1)}

CONTACTS (${ctx.contactsSummary.length} records):
${JSON.stringify(ctx.contactsSummary, null, 1)}

COMPANIES (${ctx.companiesSummary.length} records):
${JSON.stringify(ctx.companiesSummary, null, 1)}
${ctx.entityContext}

USER IS CURRENTLY VIEWING: ${pageContext || "general dashboard"}

CAPABILITIES:
- Answer questions about any data in the system
- Draft professional emails (OmniScope institutional tone)
- Generate meeting recaps and action item summaries
- Provide strategic recommendations based on data patterns
- Identify stale relationships, overdue tasks, and priority items
- Help with KYB/KYC context for contacts and companies

RULES:
- Always cite specific data when answering (names, dates, numbers)
- If asked to draft an email, write it in full professional format
- If data is insufficient, say so clearly rather than guessing
- Suggest 2-3 relevant follow-up questions
- Return relevant meeting IDs when meetings are referenced`;

  // Build messages array with history
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of history.slice(-8)) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current query
  messages.push({ role: "user", content: query });

  const response = await invokeLLM({
    messages: messages as any,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "omni_chat_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            answer: {
              type: "string",
              description: "The response to the user's query. Use markdown formatting for structure. For email drafts, include the full email."
            },
            relevantMeetingIds: {
              type: "array",
              items: { type: "number" },
              description: "IDs of meetings referenced in the answer. Empty array if none."
            },
            suggestedQuestions: {
              type: "array",
              items: { type: "string" },
              description: "2-3 relevant follow-up questions"
            }
          },
          required: ["answer", "relevantMeetingIds", "suggestedQuestions"],
          additionalProperties: false
        }
      }
    }
  });

  const messageContent = response.choices[0]?.message?.content;
  const contentString = typeof messageContent === 'string' ? messageContent : '{}';
  const result = JSON.parse(contentString);

  // Resolve meeting details
  const relevantMeetings = ctx.allMeetings
    .filter(m => (result.relevantMeetingIds || []).includes(m.id))
    .map(m => ({
      id: m.id,
      meetingDate: m.meetingDate,
      participants: JSON.parse(m.participants || '[]'),
      organizations: JSON.parse(m.organizations || '[]'),
      executiveSummary: m.executiveSummary || '',
    }));

  return {
    answer: result.answer || "I wasn't able to process that request. Please try again.",
    meetings: relevantMeetings,
    suggestedQuestions: result.suggestedQuestions || [],
  };
}

/**
 * Legacy: Process natural language queries about meetings (kept for backward compatibility)
 * Accepts orgId to scope data to the user's current organization.
 */
export async function askOmniScope(query: string, orgId?: number | null): Promise<AskOmniScopeResult> {
  const result = await chat(query, [], undefined, undefined, orgId);
  return {
    answer: result.answer,
    meetings: result.meetings.map(m => ({ ...m, relevanceScore: 1.0 })),
    suggestedQuestions: result.suggestedQuestions,
  };
}

/**
 * Find meetings by participant name (simple search)
 * Accepts orgId to scope data to the user's current organization.
 */
export async function findMeetingsByParticipant(participantName: string, orgId?: number | null) {
  const allMeetings = await db.getAllMeetings({ orgId: orgId ?? undefined });
  
  const matches = allMeetings.filter(m => {
    const participants = JSON.parse(m.participants || '[]');
    return participants.some((p: string) => 
      p.toLowerCase().includes(participantName.toLowerCase())
    );
  });

  return matches.map(m => ({
    id: m.id,
    meetingDate: m.meetingDate,
    participants: JSON.parse(m.participants || '[]'),
    organizations: JSON.parse(m.organizations || '[]'),
    executiveSummary: m.executiveSummary,
  }));
}

/**
 * Find meetings by organization name
 * Accepts orgId to scope data to the user's current organization.
 */
export async function findMeetingsByOrganization(organizationName: string, orgId?: number | null) {
  const allMeetings = await db.getAllMeetings({ orgId: orgId ?? undefined });
  
  const matches = allMeetings.filter(m => {
    const organizations = JSON.parse(m.organizations || '[]');
    return organizations.some((o: string) => 
      o.toLowerCase().includes(organizationName.toLowerCase())
    );
  });

  return matches.map(m => ({
    id: m.id,
    meetingDate: m.meetingDate,
    participants: JSON.parse(m.participants || '[]'),
    organizations: JSON.parse(m.organizations || '[]'),
    executiveSummary: m.executiveSummary,
  }));
}
