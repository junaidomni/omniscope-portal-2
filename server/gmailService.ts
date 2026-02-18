/**
 * Gmail Service Layer
 * Full email operations: list threads, get thread, send, reply, forward, sync headers.
 * Uses the existing Google OAuth infrastructure from googleCalendar.ts.
 */
import { getGmailClient, isGoogleConnected } from "./googleCalendar";
import { getDb } from "./db";
import { emailMessages, emailEntityLinks, contacts } from "../drizzle/schema";
import { eq, and, desc, inArray, like, or, sql } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export interface GmailThread {
  id: string;
  historyId: string;
  snippet: string;
  messages: GmailMessage[];
}

export interface GmailMessage {
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

export interface ThreadListItem {
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

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  threadId?: string; // For replies
  inReplyTo?: string; // Message-ID for threading
  references?: string; // References header for threading
}

// ============================================================================
// HELPER: Parse email headers
// ============================================================================

function getHeader(headers: any[], name: string): string {
  const header = headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, "").trim(), email: match[2].trim() };
  }
  return { name: raw.trim(), email: raw.trim() };
}

function parseEmailList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((e) => {
    const parsed = parseEmailAddress(e.trim());
    return parsed.email;
  }).filter(Boolean);
}

// ============================================================================
// LIST THREADS
// ============================================================================

/**
 * List Gmail threads for a user with folder/search support.
 * Returns lightweight thread summaries for the list view.
 */
export async function listGmailThreads(
  userId: number,
  options: {
    folder?: "inbox" | "sent" | "drafts" | "starred" | "all";
    search?: string;
    maxResults?: number;
    pageToken?: string;
  } = {}
): Promise<{
  threads: ThreadListItem[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  error?: string;
}> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return { threads: [], error: "Gmail not connected" };

  try {
    // Build query based on folder
    let q = options.search || "";
    switch (options.folder) {
      case "inbox":
        q = `in:inbox ${q}`.trim();
        break;
      case "sent":
        q = `in:sent ${q}`.trim();
        break;
      case "drafts":
        q = `in:drafts ${q}`.trim();
        break;
      case "starred":
        q = `is:starred ${q}`.trim();
        break;
      case "all":
      default:
        // No folder filter
        break;
    }

    const response = await gmail.users.threads.list({
      userId: "me",
      q: q || undefined,
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken || undefined,
    });

    const threadList = response.data.threads || [];
    const threads: ThreadListItem[] = [];

    // Fetch minimal details for each thread (batch-friendly)
    for (const t of threadList) {
      if (!t.id) continue;

      try {
        const threadDetail = await gmail.users.threads.get({
          userId: "me",
          id: t.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const messages = threadDetail.data.messages || [];
        if (messages.length === 0) continue;

        // Use the last message for display
        const lastMsg = messages[messages.length - 1];
        const headers = lastMsg.payload?.headers || [];
        const fromRaw = getHeader(headers, "From");
        const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);
        const subject = getHeader(headers, "Subject") || "(No Subject)";

        // Check for unread across all messages
        const isUnread = messages.some((m) => m.labelIds?.includes("UNREAD"));
        const isStarred = messages.some((m) => m.labelIds?.includes("STARRED"));
        const hasAttachments = messages.some((m) => {
          const parts = m.payload?.parts || [];
          return parts.some((p) => p.filename && p.filename.length > 0);
        });

        threads.push({
          threadId: t.id,
          subject,
          snippet: t.snippet || lastMsg.snippet || "",
          fromName,
          fromEmail,
          date: parseInt(lastMsg.internalDate || "0"),
          isUnread,
          isStarred,
          messageCount: messages.length,
          hasAttachments,
          labelIds: lastMsg.labelIds || [],
        });
      } catch (err) {
        // Skip threads that fail to load
        console.warn(`[Gmail] Failed to load thread ${t.id}:`, (err as Error).message);
      }
    }

    return {
      threads,
      nextPageToken: response.data.nextPageToken || undefined,
      resultSizeEstimate: response.data.resultSizeEstimate || undefined,
    };
  } catch (error: any) {
    console.error("[Gmail] List threads error:", error.message);
    return { threads: [], error: error.message };
  }
}

// ============================================================================
// GET THREAD (Full messages with bodies)
// ============================================================================

/**
 * Fetch a full Gmail thread with all message bodies.
 */
export async function getGmailThread(
  userId: number,
  threadId: string
): Promise<{ messages: GmailMessage[]; error?: string }> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return { messages: [], error: "Gmail not connected" };

  try {
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages: GmailMessage[] = [];

    for (const msg of response.data.messages || []) {
      const headers = msg.payload?.headers || [];
      const fromRaw = getHeader(headers, "From");
      const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);

      // Extract body
      let bodyText = "";
      let bodyHtml = "";
      const attachments: GmailMessage["attachments"] = [];

      const extractParts = (payload: any) => {
        if (!payload) return;

        // Check for direct body
        if (payload.mimeType === "text/plain" && payload.body?.data) {
          bodyText = Buffer.from(payload.body.data, "base64url").toString("utf-8");
        }
        if (payload.mimeType === "text/html" && payload.body?.data) {
          bodyHtml = Buffer.from(payload.body.data, "base64url").toString("utf-8");
        }

        // Check for attachments
        if (payload.filename && payload.filename.length > 0 && payload.body?.attachmentId) {
          attachments.push({
            filename: payload.filename,
            mimeType: payload.mimeType || "application/octet-stream",
            size: payload.body.size || 0,
            attachmentId: payload.body.attachmentId,
          });
        }

        // Recurse into parts
        if (payload.parts) {
          for (const part of payload.parts) {
            extractParts(part);
          }
        }
      }

      extractParts(msg.payload);

      // If no plain text, strip HTML
      if (!bodyText && bodyHtml) {
        bodyText = bodyHtml.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      }

      messages.push({
        id: msg.id || "",
        threadId: msg.threadId || threadId,
        labelIds: msg.labelIds || [],
        snippet: msg.snippet || "",
        internalDate: msg.internalDate || "0",
        from: fromRaw,
        fromName,
        fromEmail,
        to: parseEmailList(getHeader(headers, "To")),
        cc: parseEmailList(getHeader(headers, "Cc")),
        bcc: parseEmailList(getHeader(headers, "Bcc")),
        subject: getHeader(headers, "Subject") || "(No Subject)",
        body: bodyText,
        bodyHtml,
        isUnread: msg.labelIds?.includes("UNREAD") || false,
        isStarred: msg.labelIds?.includes("STARRED") || false,
        hasAttachments: attachments.length > 0,
        attachments,
      });
    }

    // Mark thread as read
    try {
      await gmail.users.threads.modify({
        userId: "me",
        id: threadId,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
    } catch {
      // Non-critical
    }

    return { messages };
  } catch (error: any) {
    console.error("[Gmail] Get thread error:", error.message);
    return { messages: [], error: error.message };
  }
}

// ============================================================================
// SEND EMAIL
// ============================================================================

/**
 * Send an email (compose, reply, or forward) via Gmail API.
 */
export async function sendGmailEmailFull(
  userId: number,
  params: SendEmailParams
): Promise<{ success: boolean; messageId?: string; threadId?: string; error?: string }> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return { success: false, error: "Gmail not connected" };

  try {
    // Get the user's email for From header
    const connectionInfo = await isGoogleConnected(userId);
    const fromEmail = connectionInfo.email || "me";

    // Build MIME message
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const mimeLines: string[] = [];

    mimeLines.push(`From: ${fromEmail}`);
    mimeLines.push(`To: ${params.to.join(", ")}`);
    if (params.cc && params.cc.length > 0) {
      mimeLines.push(`Cc: ${params.cc.join(", ")}`);
    }
    if (params.bcc && params.bcc.length > 0) {
      mimeLines.push(`Bcc: ${params.bcc.join(", ")}`);
    }
    mimeLines.push(`Subject: ${params.subject}`);

    // Threading headers for replies
    if (params.inReplyTo) {
      mimeLines.push(`In-Reply-To: ${params.inReplyTo}`);
    }
    if (params.references) {
      mimeLines.push(`References: ${params.references}`);
    }

    mimeLines.push("MIME-Version: 1.0");

    if (params.isHtml) {
      mimeLines.push('Content-Type: text/html; charset="UTF-8"');
    } else {
      mimeLines.push('Content-Type: text/plain; charset="UTF-8"');
    }

    mimeLines.push("");
    mimeLines.push(params.body);

    const rawMessage = mimeLines.join("\r\n");
    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: params.threadId || undefined,
      },
    });

    console.log(`[Gmail] Email sent: ${response.data.id} to ${params.to.join(", ")}`);

    return {
      success: true,
      messageId: response.data.id || undefined,
      threadId: response.data.threadId || undefined,
    };
  } catch (error: any) {
    console.error("[Gmail] Send error:", error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// GET UNREAD COUNT
// ============================================================================

/**
 * Get the unread message count for the user's inbox.
 */
export async function getUnreadCount(userId: number): Promise<number> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return 0;

  try {
    const response = await gmail.users.labels.get({
      userId: "me",
      id: "INBOX",
    });

    return response.data.messagesUnread || 0;
  } catch (error: any) {
    console.error("[Gmail] Unread count error:", error.message);
    return 0;
  }
}

// ============================================================================
// TOGGLE STAR
// ============================================================================

/**
 * Toggle star on a message.
 */
export async function toggleStar(
  userId: number,
  messageId: string,
  starred: boolean
): Promise<boolean> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return false;

  try {
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: starred
        ? { addLabelIds: ["STARRED"] }
        : { removeLabelIds: ["STARRED"] },
    });
    return true;
  } catch (error: any) {
    console.error("[Gmail] Toggle star error:", error.message);
    return false;
  }
}

// ============================================================================
// TOGGLE READ/UNREAD
// ============================================================================

/**
 * Mark a message as read or unread.
 */
export async function toggleRead(
  userId: number,
  messageId: string,
  read: boolean
): Promise<boolean> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return false;

  try {
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: read
        ? { removeLabelIds: ["UNREAD"] }
        : { addLabelIds: ["UNREAD"] },
    });
    return true;
  } catch (error: any) {
    console.error("[Gmail] Toggle read error:", error.message);
    return false;
  }
}

// ============================================================================
// TRASH / DELETE
// ============================================================================

/**
 * Move a message to trash.
 */
export async function trashMessage(userId: number, messageId: string): Promise<boolean> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return false;

  try {
    await gmail.users.messages.trash({ userId: "me", id: messageId });
    return true;
  } catch (error: any) {
    console.error("[Gmail] Trash error:", error.message);
    return false;
  }
}

// ============================================================================
// SYNC HEADERS (Lightweight metadata sync for entity linking)
// ============================================================================

/**
 * Sync email headers to local DB for entity linking and fast search.
 * Only stores metadata — full body is fetched on demand.
 */
export async function syncEmailHeaders(
  userId: number,
  options: { maxResults?: number } = {}
): Promise<{ synced: number; linked: number; error?: string }> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return { synced: 0, linked: 0, error: "Gmail not connected" };

  const db = await getDb();
  if (!db) return { synced: 0, linked: 0, error: "Database not available" };

  try {
    // Fetch recent messages
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: options.maxResults || 100,
      q: "in:inbox OR in:sent",
    });

    const messageIds = response.data.messages || [];
    let synced = 0;
    let linked = 0;

    // Get all contacts for entity linking
    const allContacts = await db
      .select({ id: contacts.id, email: contacts.email, name: contacts.name })
      .from(contacts);

    const emailToContact = new Map<string, number>();
    for (const c of allContacts) {
      if (c.email) {
        emailToContact.set(c.email.toLowerCase(), c.id);
      }
    }

    for (const msgRef of messageIds) {
      if (!msgRef.id) continue;

      // Check if already synced
      const existing = await db
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.userId, userId),
            eq(emailMessages.gmailMessageId, msgRef.id)
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      try {
        // Fetch metadata only
        const msgDetail = await gmail.users.messages.get({
          userId: "me",
          id: msgRef.id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
        });

        const headers = msgDetail.data.payload?.headers || [];
        const fromRaw = getHeader(headers, "From");
        const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);
        const toEmails = parseEmailList(getHeader(headers, "To"));
        const ccEmails = parseEmailList(getHeader(headers, "Cc"));
        const subject = getHeader(headers, "Subject") || "(No Subject)";
        const hasAttachments = (msgDetail.data.payload?.parts || []).some(
          (p) => p.filename && p.filename.length > 0
        );

        // Insert email metadata
        const [inserted] = await db.insert(emailMessages).values({
          userId,
          gmailMessageId: msgRef.id,
          gmailThreadId: msgDetail.data.threadId || "",
          fromEmail,
          fromName,
          toEmails: JSON.stringify(toEmails),
          ccEmails: JSON.stringify(ccEmails),
          subject,
          snippet: msgDetail.data.snippet || "",
          internalDate: parseInt(msgDetail.data.internalDate || "0"),
          isUnread: msgDetail.data.labelIds?.includes("UNREAD") || false,
          isStarred: msgDetail.data.labelIds?.includes("STARRED") || false,
          labelIds: JSON.stringify(msgDetail.data.labelIds || []),
          hasAttachments,
        });

        synced++;

        // Entity linking: match from/to/cc to contacts
        const emailId = inserted.insertId;
        const allParticipants = [
          { email: fromEmail, type: "from" as const },
          ...toEmails.map((e) => ({ email: e, type: "to" as const })),
          ...ccEmails.map((e) => ({ email: e, type: "cc" as const })),
        ];

        for (const participant of allParticipants) {
          const contactId = emailToContact.get(participant.email.toLowerCase());
          if (contactId) {
            await db.insert(emailEntityLinks).values({
              emailMessageId: emailId,
              contactId,
              linkType: participant.type,
            });
            linked++;
          }
        }
      } catch (err) {
        console.warn(`[Gmail] Failed to sync message ${msgRef.id}:`, (err as Error).message);
      }
    }

    console.log(`[Gmail] Sync complete: ${synced} synced, ${linked} linked`);
    return { synced, linked };
  } catch (error: any) {
    console.error("[Gmail] Sync headers error:", error.message);
    return { synced: 0, linked: 0, error: error.message };
  }
}

// ============================================================================
// GET EMAILS BY CONTACT
// ============================================================================

/**
 * Get Gmail threads related to a specific contact by their email address.
 */
export async function getEmailsByContact(
  userId: number,
  contactEmail: string,
  maxResults: number = 15
): Promise<{ threads: ThreadListItem[]; error?: string }> {
  if (!contactEmail) return { threads: [], error: "No email address provided" };

  // Search Gmail for threads involving this email
  return listGmailThreads(userId, {
    search: contactEmail,
    maxResults,
    folder: "all",
  });
}

// ============================================================================
// GET ATTACHMENT
// ============================================================================

/**
 * Get an attachment from a Gmail message.
 */
export async function getAttachment(
  userId: number,
  messageId: string,
  attachmentId: string
): Promise<{ data: Buffer; error?: string }> {
  const gmail = await getGmailClient(userId);
  if (!gmail) return { data: Buffer.alloc(0), error: "Gmail not connected" };

  try {
    const response = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    const data = Buffer.from(response.data.data || "", "base64url");
    return { data };
  } catch (error: any) {
    console.error("[Gmail] Get attachment error:", error.message);
    return { data: Buffer.alloc(0), error: error.message };
  }
}
