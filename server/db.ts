import { and, desc, eq, gte, like, lte, or, sql, inArray, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, meetings, tasks, tags, meetingTags, contacts, meetingContacts, InsertMeeting, InsertTask, InsertTag, InsertMeetingTag, InsertContact, InsertMeetingContact, contactNotes, InsertContactNote, contactDocuments, InsertContactDocument, employees, InsertEmployee, payrollRecords, InsertPayrollRecord, hrDocuments, InsertHrDocument, companies, InsertCompany, interactions, InsertInteraction, userProfiles, InsertUserProfile, emailStars, InsertEmailStar, emailCompanyLinks, InsertEmailCompanyLink, emailThreadSummaries, InsertEmailThreadSummary, emailMessages, pendingSuggestions, InsertPendingSuggestion, activityLog, InsertActivityLog, contactAliases, InsertContactAlias, companyAliases, InsertCompanyAlias, documents, InsertDocument, documentEntityLinks, InsertDocumentEntityLink, documentFolders, InsertDocumentFolder, documentAccess, InsertDocumentAccess, documentFavorites, InsertDocumentFavorite, documentTemplates, InsertDocumentTemplate, signingProviders, InsertSigningProvider, signingEnvelopes, InsertSigningEnvelope, documentNotes } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    } else if (user.email && ['junaid@omniscopex.ae', 'kyle@omniscopex.ae'].includes(user.email.toLowerCase())) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users);
}

export async function updateUser(userId: number, updates: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(updates).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, userId));
}

export async function completeOnboarding(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, userId));
}

// ============================================================================
// USER PROFILE / SIGNATURE OPERATIONS
// ============================================================================

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return profile || null;
}

export async function upsertUserProfile(userId: number, data: Partial<Omit<InsertUserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserProfile(userId);
  if (existing) {
    await db.update(userProfiles).set(data).where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({ userId, ...data });
  }
  return await getUserProfile(userId);
}

// ============================================================================
// CONTACT OPERATIONS
// ============================================================================

export async function createContact(contact: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contacts).values(contact);
  return Number(result[0].insertId);
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getContactByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(contacts).where(eq(contacts.name, name)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllContacts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contacts).orderBy(asc(contacts.name));
}

export async function updateContact(id: number, updates: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set(updates).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete all related records first
  await db.delete(meetingContacts).where(eq(meetingContacts.contactId, id));
  await db.delete(contactNotes).where(eq(contactNotes.contactId, id));
  await db.delete(contactDocuments).where(eq(contactDocuments.contactId, id));
  await db.delete(interactions).where(eq(interactions.contactId, id));
  // Unlink employees
  await db.update(employees).set({ contactId: null }).where(eq(employees.contactId, id));
  await db.delete(contacts).where(eq(contacts.id, id));
}

export async function searchContacts(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${searchTerm}%`;
  return await db.select().from(contacts).where(
    or(
      like(contacts.name, pattern),
      like(contacts.organization, pattern),
      like(contacts.email, pattern),
    )
  ).orderBy(asc(contacts.name));
}

export async function getOrCreateContact(name: string, org?: string, email?: string, userId?: number) {
  // First try exact match
  let contact = await getContactByName(name);
  
  // If no exact match, try alias lookup (learned from previous merges)
  if (!contact && userId) {
    const aliasContactId = await findContactByAlias(userId, name, email);
    if (aliasContactId) {
      contact = await getContactById(aliasContactId);
      if (contact) {
        console.log(`[Alias] Auto-linked "${name}" to existing contact "${contact.name}" via learned alias`);
      }
    }
  }
  
  // If no exact match, try fuzzy matching
  if (!contact) {
    const allContacts = await getAllContacts();
    const nameLower = name.toLowerCase().trim();
    const nameParts = nameLower.split(/\s+/);
    const firstName = nameParts[0];
    
    // Try email match first (most reliable)
    if (email) {
      contact = allContacts.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase()) || null;
    }
    
    // Try case-insensitive exact match
    if (!contact) {
      contact = allContacts.find((c: any) => (c.name || '').toLowerCase().trim() === nameLower) || null;
    }
    
    // Try reversed name match (e.g., "Ryan Jake" matches "Jake Ryan")
    if (!contact && nameParts.length >= 2) {
      const reversed = [...nameParts].reverse().join(' ');
      contact = allContacts.find((c: any) => (c.name || '').toLowerCase().trim() === reversed) || null;
    }
    
    // REMOVED: Loose first-name-only matching that caused false positives.
    // Instead, if no exact/email/reversed match, create as new pending contact.
    // The duplicate detection system will flag potential matches for manual review.
  }
  
  if (!contact) {
    const id = await createContact({ name, organization: org ?? null, email: email ?? null, approvalStatus: "pending" });
    contact = await getContactById(id);
  } else if (org || email) {
    // Update if new info available
    const updates: Partial<InsertContact> = {};
    if (org && !contact.organization) updates.organization = org;
    if (email && !contact.email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      await updateContact(contact.id, updates);
    }
  }
  return contact;
}

// ============================================================================
// MEETING-CONTACT OPERATIONS
// ============================================================================

export async function linkContactToMeeting(meetingId: number, contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if link already exists to prevent duplicates
  const existing = await db.select({ id: meetingContacts.id })
    .from(meetingContacts)
    .where(and(eq(meetingContacts.meetingId, meetingId), eq(meetingContacts.contactId, contactId)))
    .limit(1);
  if (existing.length > 0) return; // Already linked
  try {
    await db.insert(meetingContacts).values({ meetingId, contactId });
  } catch (e: any) {
    // Ignore duplicate key errors
    if (!e.message?.includes('Duplicate')) throw e;
  }
}

export async function getContactsForMeeting(meetingId: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({ contact: contacts })
    .from(meetingContacts)
    .innerJoin(contacts, eq(meetingContacts.contactId, contacts.id))
    .where(eq(meetingContacts.meetingId, meetingId));
  // Deduplicate by contact ID
  const seen = new Set<number>();
  return results.filter((r: any) => {
    if (seen.has(r.contact.id)) return false;
    seen.add(r.contact.id);
    return true;
  });
}

export async function getMeetingsForContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({ meeting: meetings })
    .from(meetingContacts)
    .innerJoin(meetings, eq(meetingContacts.meetingId, meetings.id))
    .where(eq(meetingContacts.contactId, contactId))
    .orderBy(desc(meetings.meetingDate));
  // Deduplicate by meeting ID
  const seen = new Set<number>();
  return results.filter((r: any) => {
    if (seen.has(r.meeting.id)) return false;
    seen.add(r.meeting.id);
    return true;
  });
}

export async function getTasksForContact(contactName: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(tasks)
    .where(eq(tasks.assignedName, contactName))
    .orderBy(desc(tasks.createdAt));
}

export async function getContactProfile(contactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const contact = await getContactById(contactId);
  if (!contact) return null;
  
  const contactMeetings = await getMeetingsForContact(contactId);
  const contactTasks = await getTasksForContact(contact.name);
  
  // Calculate last meeting date and days since
  let lastMeetingDate: Date | null = null;
  let daysSinceLastMeeting: number | null = null;
  if (contactMeetings.length > 0) {
    lastMeetingDate = contactMeetings[0].meeting.meetingDate;
    const now = new Date();
    daysSinceLastMeeting = Math.floor((now.getTime() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return {
    ...contact,
    meetings: contactMeetings,
    tasks: contactTasks,
    meetingCount: contactMeetings.length,
    taskCount: contactTasks.length,
    openTaskCount: contactTasks.filter(t => t.status !== 'completed').length,
    lastMeetingDate,
    daysSinceLastMeeting,
  };
}

export async function getContactMeetingCount(contactId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(meetingContacts)
    .where(eq(meetingContacts.contactId, contactId));
  return result[0]?.count ?? 0;
}

// ============================================================================
// MEETING OPERATIONS
// ============================================================================

export async function createMeeting(meeting: InsertMeeting) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(meetings).values(meeting);
  return Number(result[0].insertId);
}

export async function getMeetingById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllMeetings(filters?: {
  startDate?: Date;
  endDate?: Date;
  primaryLead?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.startDate) conditions.push(gte(meetings.meetingDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(meetings.meetingDate, filters.endDate));
  if (filters?.primaryLead) conditions.push(eq(meetings.primaryLead, filters.primaryLead));
  
  if (conditions.length > 0) {
    return await db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .orderBy(desc(meetings.meetingDate))
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);
  }
  
  return await db
    .select()
    .from(meetings)
    .orderBy(desc(meetings.meetingDate))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);
}

export async function searchMeetings(searchTerm: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const searchPattern = `%${searchTerm}%`;
  return await db
    .select()
    .from(meetings)
    .where(
      or(
        like(meetings.meetingTitle, searchPattern),
        like(meetings.executiveSummary, searchPattern),
        like(meetings.fullTranscript, searchPattern),
        like(meetings.strategicHighlights, searchPattern),
        like(meetings.opportunities, searchPattern),
        like(meetings.risks, searchPattern),
        like(meetings.participants, searchPattern),
        like(meetings.organizations, searchPattern)
      )
    )
    .orderBy(desc(meetings.meetingDate))
    .limit(limit);
}

export async function updateMeeting(id: number, updates: Partial<InsertMeeting>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(meetings).set(updates).where(eq(meetings.id, id));
}

export async function deleteMeeting(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related records first
  await db.delete(meetingTags).where(eq(meetingTags.meetingId, id));
  await db.delete(meetingContacts).where(eq(meetingContacts.meetingId, id));
  await db.delete(meetings).where(eq(meetings.id, id));
}

export async function getMeetingsBySourceId(sourceId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(meetings).where(eq(meetings.sourceId, sourceId));
}

// ============================================================================
// TAG OPERATIONS
// ============================================================================

export async function createTag(tag: InsertTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tags).values(tag);
  return Number(result[0].insertId);
}

export async function getAllTags(type?: "sector" | "jurisdiction") {
  const db = await getDb();
  if (!db) return [];
  if (type) return await db.select().from(tags).where(eq(tags.type, type));
  return await db.select().from(tags);
}

export async function getTagByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getOrCreateTag(name: string, type: "sector" | "jurisdiction") {
  let tag = await getTagByName(name);
  if (!tag) {
    const tagId = await createTag({ name, type });
    tag = await getTagByName(name);
  }
  return tag;
}

// ============================================================================
// MEETING TAG OPERATIONS
// ============================================================================

export async function addTagToMeeting(meetingId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(meetingTags).values({ meetingId, tagId });
}

export async function getTagsForMeeting(meetingId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ tag: tags })
    .from(meetingTags)
    .innerJoin(tags, eq(meetingTags.tagId, tags.id))
    .where(eq(meetingTags.meetingId, meetingId));
}

export async function getMeetingsByTag(tagId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ meeting: meetings })
    .from(meetingTags)
    .innerJoin(meetings, eq(meetingTags.meetingId, meetings.id))
    .where(eq(meetingTags.tagId, tagId))
    .orderBy(desc(meetings.meetingDate));
}

export async function getMeetingsByTags(tagIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (tagIds.length === 0) return [];
  
  const result = await db
    .select({
      meetingId: meetingTags.meetingId,
      count: sql<number>`count(distinct ${meetingTags.tagId})`.as('tag_count')
    })
    .from(meetingTags)
    .where(sql`${meetingTags.tagId} in (${sql.join(tagIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(meetingTags.meetingId)
    .having(sql`count(distinct ${meetingTags.tagId}) = ${tagIds.length}`);
  
  if (result.length === 0) return [];
  const meetingIds = result.map(r => r.meetingId);
  
  return await db
    .select()
    .from(meetings)
    .where(sql`${meetings.id} in (${sql.join(meetingIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(meetings.meetingDate));
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

export async function createTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(task);
  return Number(result[0].insertId);
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllTasks(filters?: {
  status?: "open" | "in_progress" | "completed";
  assignedTo?: number;
  assignedName?: string;
  meetingId?: number;
  category?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(tasks.status, filters.status));
  if (filters?.assignedTo) conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  if (filters?.assignedName) conditions.push(eq(tasks.assignedName, filters.assignedName));
  if (filters?.meetingId) conditions.push(eq(tasks.meetingId, filters.meetingId));
  if (filters?.category) conditions.push(eq(tasks.category, filters.category));
  
  if (conditions.length > 0) {
    return await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));
  }
  
  return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
}

export async function getTaskCategories() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ category: tasks.category, count: sql<number>`count(*)`.as('count') })
    .from(tasks)
    .where(sql`${tasks.category} IS NOT NULL AND ${tasks.category} != ''`)
    .groupBy(tasks.category)
    .orderBy(desc(sql`count`));
  return result;
}

export async function getTaskAssignees() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ name: tasks.assignedName, count: sql<number>`count(*)`.as('count') })
    .from(tasks)
    .where(sql`${tasks.assignedName} IS NOT NULL AND ${tasks.assignedName} != ''`)
    .groupBy(tasks.assignedName)
    .orderBy(desc(sql`count`));
  return result;
}

export async function updateTask(id: number, updates: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (updates.status === "completed" && !updates.completedAt) {
    updates.completedAt = new Date();
  }
  await db.update(tasks).set(updates).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function getTasksForMeeting(meetingId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks).where(eq(tasks.meetingId, meetingId));
}


// ============================================================================
// INVITATION OPERATIONS
// ============================================================================

import { invitations, InsertInvitation, meetingCategories, InsertMeetingCategory } from "../drizzle/schema";

export async function createInvitation(invitation: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invitations).values(invitation);
  return Number(result[0].insertId);
}

export async function getInvitationByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(invitations).where(eq(invitations.email, email.toLowerCase())).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllInvitations() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invitations).orderBy(desc(invitations.createdAt));
}

export async function updateInvitation(id: number, updates: Partial<InsertInvitation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invitations).set(updates).where(eq(invitations.id, id));
}

export async function deleteInvitation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(invitations).where(eq(invitations.id, id));
}

export async function acceptInvitation(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invitations).set({ acceptedAt: new Date(), userId }).where(eq(invitations.id, id));
}

// ============================================================================
// MEETING CATEGORY OPERATIONS
// ============================================================================

export async function addCategoryToMeeting(meetingId: number, category: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(meetingCategories).values({ meetingId, category });
  } catch (e: any) {
    if (!e.message?.includes('Duplicate')) throw e;
  }
}

export async function removeCategoryFromMeeting(meetingId: number, category: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(meetingCategories).where(
    and(eq(meetingCategories.meetingId, meetingId), eq(meetingCategories.category, category))
  );
}

export async function getCategoriesForMeeting(meetingId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(meetingCategories).where(eq(meetingCategories.meetingId, meetingId));
}

export async function getAllMeetingCategories() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ category: meetingCategories.category, count: sql<number>`count(*)`.as('count') })
    .from(meetingCategories)
    .groupBy(meetingCategories.category)
    .orderBy(desc(sql`count`));
  return result;
}

export async function getMeetingsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ meetingId: meetingCategories.meetingId })
    .from(meetingCategories)
    .where(eq(meetingCategories.category, category));
  if (result.length === 0) return [];
  const meetingIds = result.map(r => r.meetingId);
  return await db
    .select()
    .from(meetings)
    .where(inArray(meetings.id, meetingIds))
    .orderBy(desc(meetings.meetingDate));
}


// ============================================================================
// CONTACT NOTES OPERATIONS
// ============================================================================

export async function createContactNote(note: InsertContactNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactNotes).values(note);
  return Number(result[0].insertId);
}

export async function getNotesForContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contactNotes)
    .where(eq(contactNotes.contactId, contactId))
    .orderBy(desc(contactNotes.createdAt));
}

export async function deleteContactNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactNotes).where(eq(contactNotes.id, id));
}

// ============================================================================
// EMPLOYEE OPERATIONS
// ============================================================================

export async function createEmployee(employee: InsertEmployee) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(employees).values(employee);
  return Number(result[0].insertId);
}

export async function getEmployeeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllEmployees(filters?: { status?: string; department?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(employees.status, filters.status as any));
  if (filters?.department) conditions.push(eq(employees.department, filters.department));
  if (conditions.length > 0) {
    return await db.select().from(employees).where(and(...conditions)).orderBy(asc(employees.firstName));
  }
  return await db.select().from(employees).orderBy(asc(employees.firstName));
}

export async function updateEmployee(id: number, updates: Partial<InsertEmployee>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(employees).set(updates).where(eq(employees.id, id));
}

export async function deleteEmployee(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related records first
  await db.delete(payrollRecords).where(eq(payrollRecords.employeeId, id));
  await db.delete(hrDocuments).where(eq(hrDocuments.employeeId, id));
  await db.delete(employees).where(eq(employees.id, id));
}

export async function searchEmployees(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${searchTerm}%`;
  return await db.select().from(employees).where(
    or(
      like(employees.firstName, pattern),
      like(employees.lastName, pattern),
      like(employees.email, pattern),
      like(employees.jobTitle, pattern),
      like(employees.department, pattern),
    )
  ).orderBy(asc(employees.firstName));
}

export async function getEmployeeDepartments() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ department: employees.department, count: sql<number>`count(*)`.as('count') })
    .from(employees)
    .where(sql`${employees.department} IS NOT NULL AND ${employees.department} != ''`)
    .groupBy(employees.department)
    .orderBy(desc(sql`count`));
  return result;
}

// ============================================================================
// PAYROLL OPERATIONS
// ============================================================================

export async function createPayrollRecord(record: InsertPayrollRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payrollRecords).values(record);
  return Number(result[0].insertId);
}

export async function getPayrollRecordById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(payrollRecords).where(eq(payrollRecords.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPayrollForEmployee(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payrollRecords)
    .where(eq(payrollRecords.employeeId, employeeId))
    .orderBy(desc(payrollRecords.createdAt));
}

export async function getAllPayrollRecords(filters?: { status?: string; employeeId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(payrollRecords.status, filters.status as any));
  if (filters?.employeeId) conditions.push(eq(payrollRecords.employeeId, filters.employeeId));
  if (conditions.length > 0) {
    return await db.select().from(payrollRecords).where(and(...conditions)).orderBy(desc(payrollRecords.createdAt));
  }
  return await db.select().from(payrollRecords).orderBy(desc(payrollRecords.createdAt));
}

export async function updatePayrollRecord(id: number, updates: Partial<InsertPayrollRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(payrollRecords).set(updates).where(eq(payrollRecords.id, id));
}

export async function deletePayrollRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(payrollRecords).where(eq(payrollRecords.id, id));
}

// ============================================================================
// HR DOCUMENT OPERATIONS
// ============================================================================

export async function createHrDocument(doc: InsertHrDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(hrDocuments).values(doc);
  return Number(result[0].insertId);
}

export async function getDocumentsForEmployee(employeeId: number, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(hrDocuments.employeeId, employeeId)];
  if (category) conditions.push(eq(hrDocuments.category, category as any));
  return await db.select().from(hrDocuments)
    .where(and(...conditions))
    .orderBy(desc(hrDocuments.createdAt));
}

export async function deleteHrDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(hrDocuments).where(eq(hrDocuments.id, id));
}

export async function getHrDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(hrDocuments).where(eq(hrDocuments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============================================================================
// CONTACT DOCUMENTS
// ============================================================================

export async function getDocumentsForContact(contactId: number, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(contactDocuments.contactId, contactId)];
  if (category) conditions.push(eq(contactDocuments.category, category as any));
  return await db.select().from(contactDocuments).where(and(...conditions)).orderBy(desc(contactDocuments.createdAt));
}

export async function createContactDocument(data: Omit<InsertContactDocument, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactDocuments).values(data);
  return Number(result[0].insertId);
}

export async function deleteContactDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactDocuments).where(eq(contactDocuments.id, id));
}

export async function getContactDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(contactDocuments).where(eq(contactDocuments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============================================================================
// EMPLOYEE-CONTACT LINKING
// ============================================================================

export async function linkEmployeeToContact(employeeId: number, contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(employees).set({ contactId }).where(eq(employees.id, employeeId));
}

export async function getEmployeeByContactId(contactId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(employees).where(eq(employees.contactId, contactId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getEmployeeByName(firstName: string, lastName: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(employees)
    .where(and(
      eq(employees.firstName, firstName),
      eq(employees.lastName, lastName)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}


// ============================================================================
// COMPANIES OPERATIONS
// ============================================================================

export async function createCompany(company: Omit<InsertCompany, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(companies).values(company);
  return result[0].insertId;
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllCompanies(filters?: { status?: string; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(companies.status, filters.status as any));
  if (filters?.search) conditions.push(or(
    like(companies.name, `%${filters.search}%`),
    like(companies.domain, `%${filters.search}%`)
  ));
  const query = conditions.length > 0
    ? db.select().from(companies).where(and(...conditions)).orderBy(desc(companies.updatedAt))
    : db.select().from(companies).orderBy(desc(companies.updatedAt));
  return await query;
}

export async function updateCompany(id: number, updates: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(updates).where(eq(companies.id, id));
}

export async function deleteCompany(id: number) {
  const db = await getDb();
  if (!db) return;
  // Unlink contacts from this company first
  await db.update(contacts).set({ companyId: null }).where(eq(contacts.companyId, id));
  // Delete company interactions
  await db.delete(interactions).where(eq(interactions.companyId, id));
  await db.delete(companies).where(eq(companies.id, id));
}

export async function getCompanyByDomain(domain: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companies).where(eq(companies.domain, domain)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCompanyByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companies).where(eq(companies.name, name)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPeopleForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contacts).where(eq(contacts.companyId, companyId)).orderBy(contacts.name);
}

export async function getTasksForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks).where(eq(tasks.companyId, companyId)).orderBy(desc(tasks.createdAt));
}

// ============================================================================
// INTERACTIONS OPERATIONS
// ============================================================================

export async function createInteraction(interaction: Omit<InsertInteraction, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(interactions).values(interaction);
  return result[0].insertId;
}

export async function getInteractionsForContact(contactId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(interactions)
    .where(eq(interactions.contactId, contactId))
    .orderBy(desc(interactions.timestamp))
    .limit(limit);
}

export async function getInteractionsForCompany(companyId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(interactions)
    .where(eq(interactions.companyId, companyId))
    .orderBy(desc(interactions.timestamp))
    .limit(limit);
}

export async function getAllInteractions(filters?: { type?: string; contactId?: number; companyId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.type) conditions.push(eq(interactions.type, filters.type as any));
  if (filters?.contactId) conditions.push(eq(interactions.contactId, filters.contactId));
  if (filters?.companyId) conditions.push(eq(interactions.companyId, filters.companyId));
  const limit = filters?.limit ?? 100;
  const query = conditions.length > 0
    ? db.select().from(interactions).where(and(...conditions)).orderBy(desc(interactions.timestamp)).limit(limit)
    : db.select().from(interactions).orderBy(desc(interactions.timestamp)).limit(limit);
  return await query;
}

export async function deleteInteraction(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(interactions).where(eq(interactions.id, id));
}

// Check if interaction already exists for a source record
export async function getInteractionBySource(sourceType: string, sourceRecordId: number, contactId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(interactions)
    .where(and(
      eq(interactions.sourceType, sourceType),
      eq(interactions.sourceRecordId, sourceRecordId),
      eq(interactions.contactId, contactId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============================================================================
// ENHANCED CONTACT OPERATIONS
// ============================================================================

export async function getContactsWithCompany() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    contact: contacts,
    companyName: companies.name,
  }).from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .orderBy(desc(contacts.updatedAt));
  return result.map(r => ({
    ...r.contact,
    companyName: r.companyName,
  }));
}

export async function updateContactScores(contactId: number, relationshipScore: number, engagementScore: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contacts).set({ relationshipScore, engagementScore }).where(eq(contacts.id, contactId));
}

export async function getContactsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contacts).where(eq(contacts.companyId, companyId)).orderBy(contacts.name);
}

// Global search across people, companies, meetings, tasks
export async function globalSearch(query: string) {
  const db = await getDb();
  if (!db) return { people: [], companies: [], meetings: [], tasks: [] };
  const q = `%${query}%`;
  
  const [people, companiesResult, meetingsResult, tasksResult] = await Promise.all([
    db.select().from(contacts).where(or(
      like(contacts.name, q),
      like(contacts.email, q),
      like(contacts.organization, q),
      like(contacts.title, q)
    )).limit(20),
    db.select().from(companies).where(or(
      like(companies.name, q),
      like(companies.domain, q),
      like(companies.industry, q)
    )).limit(20),
    db.select().from(meetings).where(or(
      like(meetings.meetingTitle, q),
      like(meetings.executiveSummary, q),
      like(meetings.participants, q)
    )).orderBy(desc(meetings.meetingDate)).limit(20),
    db.select().from(tasks).where(or(
      like(tasks.title, q),
      like(tasks.description, q),
      like(tasks.assignedName, q)
    )).orderBy(desc(tasks.createdAt)).limit(20),
  ]);
  
  return { people, companies: companiesResult, meetings: meetingsResult, tasks: tasksResult };
}


// ============================================================================
// SYSTEM-WIDE NAME PROPAGATION
// When a contact or company name changes, propagate across the entire system
// ============================================================================

/**
 * Propagate a contact name change across meetings (participants JSON),
 * tasks (assignedName), and interactions (summary text).
 */
export async function propagateContactNameChange(contactId: number, oldName: string, newName: string) {
  const db = await getDb();
  if (!db) return;

  try {
    // 1. Update tasks where assignedName matches the old name
    await db.update(tasks)
      .set({ assignedName: newName })
      .where(and(
        eq(tasks.assignedName, oldName)
      ));

    // 2. Update meeting participants JSON — find meetings linked via meeting_contacts
    const linkedMeetings = await db.select({ meetingId: meetingContacts.meetingId })
      .from(meetingContacts)
      .where(eq(meetingContacts.contactId, contactId));

    for (const { meetingId } of linkedMeetings) {
      const [meeting] = await db.select({ id: meetings.id, participants: meetings.participants })
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      if (meeting?.participants) {
        try {
          const participantsList: string[] = JSON.parse(meeting.participants);
          const idx = participantsList.findIndex(p => p.toLowerCase() === oldName.toLowerCase());
          if (idx !== -1) {
            participantsList[idx] = newName;
            await db.update(meetings)
              .set({ participants: JSON.stringify(participantsList) })
              .where(eq(meetings.id, meetingId));
          }
        } catch { /* skip if JSON parse fails */ }
      }
    }

    // 3. Update primaryLead in meetings if it matches
    await db.update(meetings)
      .set({ primaryLead: newName })
      .where(eq(meetings.primaryLead, oldName));

    console.log(`[Propagation] Contact name "${oldName}" → "${newName}" propagated across system`);
  } catch (error) {
    console.error("[Propagation] Failed to propagate contact name change:", error);
  }
}

/**
 * Propagate a company name change across contacts (organization field),
 * meetings (organizations JSON), and interactions.
 */
export async function propagateCompanyNameChange(companyId: number, oldName: string, newName: string) {
  const db = await getDb();
  if (!db) return;

  try {
    // 1. Update contacts linked to this company — update their organization field
    await db.update(contacts)
      .set({ organization: newName })
      .where(and(
        eq(contacts.companyId, companyId),
        eq(contacts.organization, oldName)
      ));

    // 2. Update meetings organizations JSON where the old name appears
    const allMeetings = await db.select({ id: meetings.id, organizations: meetings.organizations })
      .from(meetings)
      .where(like(meetings.organizations, `%${oldName}%`));

    for (const meeting of allMeetings) {
      if (meeting.organizations) {
        try {
          const orgList: string[] = JSON.parse(meeting.organizations);
          const idx = orgList.findIndex(o => o.toLowerCase() === oldName.toLowerCase());
          if (idx !== -1) {
            orgList[idx] = newName;
            await db.update(meetings)
              .set({ organizations: JSON.stringify(orgList) })
              .where(eq(meetings.id, meeting.id));
          }
        } catch { /* skip if JSON parse fails */ }
      }
    }

    console.log(`[Propagation] Company name "${oldName}" → "${newName}" propagated across system`);
  } catch (error) {
    console.error("[Propagation] Failed to propagate company name change:", error);
  }
}


// ============================================================================
// EMAIL STAR PRIORITY OPERATIONS
// ============================================================================

export async function getEmailStar(threadId: string, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [star] = await db.select().from(emailStars)
    .where(and(eq(emailStars.threadId, threadId), eq(emailStars.userId, userId)))
    .limit(1);
  return star || null;
}

export async function getEmailStarsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailStars)
    .where(eq(emailStars.userId, userId))
    .orderBy(desc(emailStars.updatedAt));
}

export async function setEmailStar(threadId: string, userId: number, starLevel: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getEmailStar(threadId, userId);
  if (existing) {
    await db.update(emailStars)
      .set({ starLevel })
      .where(and(eq(emailStars.threadId, threadId), eq(emailStars.userId, userId)));
  } else {
    await db.insert(emailStars).values({ threadId, userId, starLevel });
  }
  return await getEmailStar(threadId, userId);
}

export async function removeEmailStar(threadId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(emailStars)
    .where(and(eq(emailStars.threadId, threadId), eq(emailStars.userId, userId)));
  return { success: true };
}

export async function getStarredThreadIds(userId: number, starLevel?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(emailStars.userId, userId)];
  if (starLevel) conditions.push(eq(emailStars.starLevel, starLevel));
  const rows = await db.select({ threadId: emailStars.threadId, starLevel: emailStars.starLevel })
    .from(emailStars)
    .where(and(...conditions));
  return rows;
}

// ============================================================================
// EMAIL-TO-COMPANY LINK OPERATIONS
// ============================================================================

export async function getEmailCompanyLinks(threadId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: emailCompanyLinks.id,
    threadId: emailCompanyLinks.threadId,
    companyId: emailCompanyLinks.companyId,
    companyName: companies.name,
    companyDomain: companies.domain,
    userId: emailCompanyLinks.userId,
    createdAt: emailCompanyLinks.createdAt,
  })
    .from(emailCompanyLinks)
    .innerJoin(companies, eq(emailCompanyLinks.companyId, companies.id))
    .where(eq(emailCompanyLinks.threadId, threadId));
}

export async function linkEmailToCompany(threadId: string, companyId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check for existing link
  const [existing] = await db.select().from(emailCompanyLinks)
    .where(and(
      eq(emailCompanyLinks.threadId, threadId),
      eq(emailCompanyLinks.companyId, companyId),
    ))
    .limit(1);
  if (existing) return existing;
  const result = await db.insert(emailCompanyLinks).values({ threadId, companyId, userId });
  return { id: Number(result[0].insertId), threadId, companyId, userId };
}

export async function unlinkEmailFromCompany(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(emailCompanyLinks).where(eq(emailCompanyLinks.id, linkId));
  return { success: true };
}

export async function getCompanyEmailThreads(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({ threadId: emailCompanyLinks.threadId })
    .from(emailCompanyLinks)
    .where(eq(emailCompanyLinks.companyId, companyId));
}


// ============================================================================
// EMAIL THREAD SUMMARIES
// ============================================================================

export async function getThreadSummary(threadId: string, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select()
    .from(emailThreadSummaries)
    .where(and(
      eq(emailThreadSummaries.threadId, threadId),
      eq(emailThreadSummaries.userId, userId)
    ))
    .limit(1);
  return result || null;
}

export async function upsertThreadSummary(
  threadId: string,
  userId: number,
  data: {
    summary: string;
    keyPoints: string[] | null;
    actionItems: string[] | null;
    entities: string[] | null;
    messageCount: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getThreadSummary(threadId, userId);
  if (existing) {
    await db.update(emailThreadSummaries)
      .set({
        summary: data.summary,
        keyPoints: data.keyPoints ? JSON.stringify(data.keyPoints) : null,
        actionItems: data.actionItems ? JSON.stringify(data.actionItems) : null,
        entities: data.entities ? JSON.stringify(data.entities) : null,
        messageCount: data.messageCount,
        updatedAt: new Date(),
      })
      .where(eq(emailThreadSummaries.id, existing.id));
    return { id: existing.id, cached: false };
  }

  const result = await db.insert(emailThreadSummaries).values({
    threadId,
    userId,
    summary: data.summary,
    keyPoints: data.keyPoints ? JSON.stringify(data.keyPoints) : null,
    actionItems: data.actionItems ? JSON.stringify(data.actionItems) : null,
    entities: data.entities ? JSON.stringify(data.entities) : null,
    messageCount: data.messageCount,
  });
  return { id: Number(result[0].insertId), cached: false };
}

// ============================================================================
// BULK STAR ASSIGNMENT
// ============================================================================

export async function bulkSetEmailStars(threadIds: string[], userId: number, starLevel: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results: { threadId: string; starLevel: number }[] = [];
  for (const threadId of threadIds) {
    const existing = await getEmailStar(threadId, userId);
    if (existing) {
      await db.update(emailStars)
        .set({ starLevel, updatedAt: new Date() })
        .where(and(eq(emailStars.threadId, threadId), eq(emailStars.userId, userId)));
    } else {
      await db.insert(emailStars).values({ threadId, userId, starLevel });
    }
    results.push({ threadId, starLevel });
  }
  return results;
}

export async function bulkRemoveEmailStars(threadIds: string[], userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const threadId of threadIds) {
    await db.delete(emailStars)
      .where(and(eq(emailStars.threadId, threadId), eq(emailStars.userId, userId)));
  }
  return { removed: threadIds.length };
}

// ============================================================================
// EMAIL ANALYTICS
// ============================================================================

export async function getEmailAnalytics(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get all synced email messages for this user
  const allMessages = await db.select()
    .from(emailMessages)
    .where(eq(emailMessages.userId, userId))
    .orderBy(desc(emailMessages.internalDate));

  // Get all stars for this user
  const allStars = await db.select()
    .from(emailStars)
    .where(eq(emailStars.userId, userId));

  const now = Date.now();
  const oneDayMs = 86400000;
  const oneWeekMs = 7 * oneDayMs;
  const thirtyDaysMs = 30 * oneDayMs;

  // Total counts
  const totalMessages = allMessages.length;
  const totalThreads = new Set(allMessages.map(m => m.gmailThreadId)).size;
  const unreadCount = allMessages.filter(m => m.isUnread).length;

  // Messages in last 7 days / 30 days
  const last7Days = allMessages.filter(m => m.internalDate && (now - m.internalDate) < oneWeekMs);
  const last30Days = allMessages.filter(m => m.internalDate && (now - m.internalDate) < thirtyDaysMs);

  // Daily volume for last 14 days
  const dailyVolume: { date: string; received: number; sent: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = now - (i * oneDayMs);
    const dayEnd = dayStart + oneDayMs;
    const dayStr = new Date(dayStart).toISOString().split("T")[0];
    const dayMessages = allMessages.filter(m =>
      m.internalDate && m.internalDate >= dayStart && m.internalDate < dayEnd
    );
    const received = dayMessages.filter(m => {
      const labels = m.labelIds ? JSON.parse(m.labelIds) : [];
      return labels.includes("INBOX") || !labels.includes("SENT");
    }).length;
    const sent = dayMessages.filter(m => {
      const labels = m.labelIds ? JSON.parse(m.labelIds) : [];
      return labels.includes("SENT");
    }).length;
    dailyVolume.push({ date: dayStr, received, sent });
  }

  // Top senders (from received emails)
  const senderCounts: Record<string, { name: string; email: string; count: number }> = {};
  allMessages.forEach(m => {
    if (!m.fromEmail) return;
    const labels = m.labelIds ? JSON.parse(m.labelIds) : [];
    if (labels.includes("SENT")) return; // skip sent
    const key = m.fromEmail.toLowerCase();
    if (!senderCounts[key]) {
      senderCounts[key] = { name: m.fromName || m.fromEmail, email: key, count: 0 };
    }
    senderCounts[key].count++;
  });
  const topSenders = Object.values(senderCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top domains
  const domainCounts: Record<string, number> = {};
  allMessages.forEach(m => {
    if (!m.fromEmail) return;
    const labels = m.labelIds ? JSON.parse(m.labelIds) : [];
    if (labels.includes("SENT")) return;
    const domain = m.fromEmail.split("@")[1]?.toLowerCase();
    if (domain) domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  // Star distribution
  const starDistribution = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
  allStars.forEach(s => {
    starDistribution[s.starLevel] = (starDistribution[s.starLevel] || 0) + 1;
  });
  const totalStarred = allStars.length;

  // Attachment rate
  const withAttachments = allMessages.filter(m => m.hasAttachments).length;
  const attachmentRate = totalMessages > 0 ? Math.round((withAttachments / totalMessages) * 100) : 0;

  return {
    totalMessages,
    totalThreads,
    unreadCount,
    last7DaysCount: last7Days.length,
    last30DaysCount: last30Days.length,
    dailyVolume,
    topSenders,
    topDomains,
    starDistribution,
    totalStarred,
    attachmentRate,
    withAttachments,
  };
}

// ============================================================================
// UNIFIED DIRECTORY — search contacts, auto-detect company, person card
// ============================================================================

export async function directorySearch(query: string, limit = 15) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${query}%`;
  const results = await db.select({
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    organization: contacts.organization,
    companyId: contacts.companyId,
    photoUrl: contacts.photoUrl,
    title: contacts.title,
    category: contacts.category,
  }).from(contacts).where(
    or(
      like(contacts.name, pattern),
      like(contacts.email, pattern),
      like(contacts.organization, pattern),
    )
  ).orderBy(asc(contacts.name)).limit(limit);
  return results;
}

export async function getPersonCard(contactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get contact with company
  const contact = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact.length) return null;
  
  const person = contact[0];
  
  // Get company info if linked
  let company = null;
  if (person.companyId) {
    const c = await db.select().from(companies).where(eq(companies.id, person.companyId)).limit(1);
    company = c[0] || null;
  }
  
  // Get recent tasks assigned to this person
  const recentTasks = await db.select({
    id: tasks.id,
    title: tasks.title,
    status: tasks.status,
    priority: tasks.priority,
    dueDate: tasks.dueDate,
  }).from(tasks).where(
    or(
      eq(tasks.contactId, contactId),
      eq(tasks.assigneeContactId, contactId),
    )
  ).orderBy(desc(tasks.createdAt)).limit(5);
  
  // Get recent meetings
  const recentMeetings = await db.select({
    meetingId: meetingContacts.meetingId,
  }).from(meetingContacts).where(eq(meetingContacts.contactId, contactId)).limit(5);
  
  let meetingDetails: any[] = [];
  if (recentMeetings.length > 0) {
    const meetingIds = recentMeetings.map(m => m.meetingId);
    meetingDetails = await db.select({
      id: meetings.id,
      meetingTitle: meetings.meetingTitle,
      meetingDate: meetings.meetingDate,
    }).from(meetings).where(inArray(meetings.id, meetingIds)).orderBy(desc(meetings.meetingDate)).limit(5);
  }
  
  // Get email company links count
  const emailLinks = person.companyId ? await db.select({
    id: emailCompanyLinks.id,
  }).from(emailCompanyLinks).where(eq(emailCompanyLinks.companyId, person.companyId)).limit(10) : [];
  
  return {
    ...person,
    company,
    recentTasks,
    recentMeetings: meetingDetails,
    emailLinkCount: emailLinks.length,
  };
}

export async function findCompanyByEmailDomain(email: string) {
  const db = await getDb();
  if (!db) return null;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  
  // Skip common email providers
  const commonDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "protonmail.com", "mail.com", "live.com"];
  if (commonDomains.includes(domain)) return null;
  
  const result = await db.select().from(companies).where(eq(companies.domain, domain)).limit(1);
  return result[0] || null;
}

export async function createTasksFromEmail(taskList: Array<{
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  assigneeContactId?: number | null;
  assignedName?: string | null;
  dueDate?: Date | null;
  category?: string | null;
  sourceThreadId: string;
  contactId?: number | null;
  companyId?: number | null;
  createdBy: number;
}>) {
  const db = await getDb();
  if (!db) return [];
  
  const ids: number[] = [];
  for (const task of taskList) {
    const result = await db.insert(tasks).values({
      title: task.title,
      description: task.description ?? null,
      priority: task.priority,
      assigneeContactId: task.assigneeContactId ?? null,
      assignedName: task.assignedName ?? null,
      assignedTo: null,
      dueDate: task.dueDate ?? null,
      category: task.category ?? null,
      sourceThreadId: task.sourceThreadId,
      contactId: task.contactId ?? null,
      companyId: task.companyId ?? null,
      isAutoGenerated: false,
      createdBy: task.createdBy,
      notes: `Created from email thread: ${task.sourceThreadId}`,
    });
    ids.push(result[0].insertId);
  }
  return ids;
}

export async function getTasksByThreadId(threadId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks).where(eq(tasks.sourceThreadId, threadId)).orderBy(desc(tasks.createdAt));
}

export async function findContactByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(contacts).where(eq(contacts.email, email)).limit(1);
  return result[0] || null;
}


// ============================================================================
// PENDING SUGGESTIONS OPERATIONS
// ============================================================================

export async function createPendingSuggestion(data: InsertPendingSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pendingSuggestions).values(data);
  return result[0].insertId;
}

export async function getPendingSuggestions(filters?: { type?: string; status?: string; contactId?: number; companyId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.type) conditions.push(eq(pendingSuggestions.type, filters.type as any));
  if (filters?.status) conditions.push(eq(pendingSuggestions.status, filters.status as any));
  if (filters?.contactId) conditions.push(eq(pendingSuggestions.contactId, filters.contactId));
  if (filters?.companyId) conditions.push(eq(pendingSuggestions.companyId, filters.companyId));
  
  const query = conditions.length > 0
    ? db.select().from(pendingSuggestions).where(and(...conditions)).orderBy(desc(pendingSuggestions.createdAt))
    : db.select().from(pendingSuggestions).orderBy(desc(pendingSuggestions.createdAt));
  return await query;
}

export async function getPendingSuggestionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(pendingSuggestions).where(eq(pendingSuggestions.id, id)).limit(1);
  return result[0] || null;
}

export async function updatePendingSuggestion(id: number, data: Partial<InsertPendingSuggestion>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pendingSuggestions).set(data).where(eq(pendingSuggestions.id, id));
}

export async function getPendingSuggestionsCount() {
  const db = await getDb();
  if (!db) return { companyLink: 0, enrichment: 0, companyEnrichment: 0, total: 0 };
  const all = await db.select().from(pendingSuggestions).where(eq(pendingSuggestions.status, "pending"));
  return {
    companyLink: all.filter(s => s.type === "company_link").length,
    enrichment: all.filter(s => s.type === "enrichment").length,
    companyEnrichment: all.filter(s => s.type === "company_enrichment").length,
    total: all.length,
  };
}

export async function checkDuplicateSuggestion(type: string, contactId?: number, companyId?: number, suggestedCompanyId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const conditions = [
    eq(pendingSuggestions.type, type as any),
    eq(pendingSuggestions.status, "pending"),
  ];
  if (contactId) conditions.push(eq(pendingSuggestions.contactId, contactId));
  if (companyId) conditions.push(eq(pendingSuggestions.companyId, companyId));
  if (suggestedCompanyId) conditions.push(eq(pendingSuggestions.suggestedCompanyId, suggestedCompanyId));
  const result = await db.select().from(pendingSuggestions).where(and(...conditions)).limit(1);
  return result.length > 0;
}


// ─── Activity Log / Audit Trail ──────────────────────────────────────────────

export async function logActivity(entry: {
  userId: number;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  details?: string;
  metadata?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  try {
    const [result] = await db.insert(activityLog).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: String(entry.entityId),
      entityName: entry.entityName || null,
      details: entry.details || null,
      metadata: entry.metadata || null,
    });
    return result.insertId;
  } catch (e) {
    console.error("[ActivityLog] Failed to log activity:", e);
    return null;
  }
}

export async function getActivityLog(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions: any[] = [];
  if (opts.action) conditions.push(eq(activityLog.action, opts.action));
  if (opts.entityType) conditions.push(eq(activityLog.entityType, opts.entityType));
  if (opts.startDate) conditions.push(gte(activityLog.createdAt, opts.startDate));
  if (opts.endDate) conditions.push(lte(activityLog.createdAt, opts.endDate));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: activityLog.id,
        userId: activityLog.userId,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        entityName: activityLog.entityName,
        details: activityLog.details,
        metadata: activityLog.metadata,
        createdAt: activityLog.createdAt,
        userName: users.name,
      })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .where(where)
      .orderBy(desc(activityLog.createdAt))
      .limit(opts.limit || 50)
      .offset(opts.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .where(where),
  ]);

  return {
    items,
    total: countResult[0]?.count || 0,
  };
}


// ============================================================================
// CONTACT ALIASES — Smart duplicate learning
// ============================================================================

export async function saveContactAlias(userId: number, contactId: number, aliasName: string, aliasEmail?: string, source: string = "merge") {
  const db = await getDb();
  if (!db) return null;
  // Check if alias already exists
  const existing = await db.select().from(contactAliases).where(
    and(eq(contactAliases.userId, userId), eq(contactAliases.contactId, contactId), eq(contactAliases.aliasName, aliasName))
  ).limit(1);
  if (existing.length > 0) return existing[0];
  const [result] = await db.insert(contactAliases).values({ userId, contactId, aliasName, aliasEmail, source });
  return { id: result.insertId, userId, contactId, aliasName, aliasEmail, source };
}

export async function findContactByAlias(userId: number, name: string, email?: string) {
  const db = await getDb();
  if (!db) return null;
  const normalizedName = name.trim().toLowerCase();
  // Check by name alias
  const byName = await db.select().from(contactAliases)
    .where(and(eq(contactAliases.userId, userId), sql`LOWER(${contactAliases.aliasName}) = ${normalizedName}`))
    .limit(1);
  if (byName.length > 0) return byName[0].contactId;
  // Check by email alias
  if (email) {
    const byEmail = await db.select().from(contactAliases)
      .where(and(eq(contactAliases.userId, userId), eq(contactAliases.aliasEmail, email.toLowerCase())))
      .limit(1);
    if (byEmail.length > 0) return byEmail[0].contactId;
  }
  return null;
}

export async function getAliasesForContact(userId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contactAliases).where(
    and(eq(contactAliases.userId, userId), eq(contactAliases.contactId, contactId))
  );
}

// ============================================================================
// COMPANY ALIASES — Smart duplicate learning
// ============================================================================

export async function saveCompanyAlias(userId: number, companyId: number, aliasName: string, source: string = "merge") {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(companyAliases).where(
    and(eq(companyAliases.userId, userId), eq(companyAliases.companyId, companyId), eq(companyAliases.aliasName, aliasName))
  ).limit(1);
  if (existing.length > 0) return existing[0];
  const [result] = await db.insert(companyAliases).values({ userId, companyId, aliasName, source });
  return { id: result.insertId, userId, companyId, aliasName, source };
}

export async function findCompanyByAlias(userId: number, name: string) {
  const db = await getDb();
  if (!db) return null;
  const normalizedName = name.trim().toLowerCase();
  const byName = await db.select().from(companyAliases)
    .where(and(eq(companyAliases.userId, userId), sql`LOWER(${companyAliases.aliasName}) = ${normalizedName}`))
    .limit(1);
  if (byName.length > 0) return byName[0].companyId;
  return null;
}


// ============================================================================
// INTELLIGENCE VAULT — Document Operations
// ============================================================================

export async function listDocuments(filters?: {
  collection?: string;
  category?: string;
  status?: string;
  folderId?: number | null;
  ownerId?: number;
  isTemplate?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (filters?.collection) conditions.push(eq(documents.collection, filters.collection as any));
  if (filters?.category) conditions.push(eq(documents.category, filters.category as any));
  if (filters?.status) conditions.push(eq(documents.status, filters.status as any));
  if (filters?.folderId !== undefined) {
    if (filters.folderId === null) {
      conditions.push(sql`${documents.folderId} IS NULL`);
    } else {
      conditions.push(eq(documents.folderId, filters.folderId));
    }
  }
  if (filters?.ownerId) conditions.push(eq(documents.ownerId, filters.ownerId));
  if (filters?.isTemplate !== undefined) conditions.push(eq(documents.isTemplate, filters.isTemplate));
  if (filters?.search) conditions.push(like(documents.title, `%${filters.search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const [items, countResult] = await Promise.all([
    db.select().from(documents).where(where).orderBy(desc(documents.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(documents).where(where),
  ]);
  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return null;
  const links = await db.select().from(documentEntityLinks).where(eq(documentEntityLinks.documentId, id));
  const favs = await db.select().from(documentFavorites).where(eq(documentFavorites.documentId, id));
  const envelopes = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.documentId, id));
  return { ...doc, entityLinks: links, favorites: favs, envelopes };
}

export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documents).values(data);
  return { id: result.insertId, ...data };
}

export async function updateDocument(id: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(documents).set(data).where(eq(documents.id, id));
  return getDocumentById(id);
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(documents).where(eq(documents.id, id));
  return true;
}

export async function getDocumentsByEntity(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select().from(documentEntityLinks)
    .where(and(eq(documentEntityLinks.entityType, entityType as any), eq(documentEntityLinks.entityId, entityId)));
  if (links.length === 0) return [];
  const docIds = links.map(l => l.documentId);
  return db.select().from(documents).where(inArray(documents.id, docIds)).orderBy(desc(documents.updatedAt));
}

export async function getRecentDocuments(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).orderBy(desc(documents.updatedAt)).limit(limit);
}

export async function getFavoriteDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const favs = await db.select().from(documentFavorites).where(eq(documentFavorites.userId, userId));
  if (favs.length === 0) return [];
  const docIds = favs.map(f => f.documentId);
  return db.select().from(documents).where(inArray(documents.id, docIds)).orderBy(desc(documents.updatedAt));
}

export async function toggleFavorite(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(documentFavorites)
    .where(and(eq(documentFavorites.userId, userId), eq(documentFavorites.documentId, documentId))).limit(1);
  if (existing.length > 0) {
    await db.delete(documentFavorites).where(eq(documentFavorites.id, existing[0].id));
    return false; // unfavorited
  } else {
    await db.insert(documentFavorites).values({ userId, documentId });
    return true; // favorited
  }
}

// Entity links
export async function addDocumentEntityLink(data: InsertDocumentEntityLink) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documentEntityLinks).values(data);
  return { id: result.insertId, ...data };
}

export async function removeDocumentEntityLink(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(documentEntityLinks).where(eq(documentEntityLinks.id, id));
  return true;
}

// Document Notes
export async function getDocumentNotes(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  const notes = await db.select().from(documentNotes).where(eq(documentNotes.documentId, documentId)).orderBy(desc(documentNotes.createdAt));
  // Enrich with user names
  const userIds = [...new Set(notes.map(n => n.userId))];
  if (userIds.length === 0) return [];
  const userList = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds));
  const userMap = Object.fromEntries(userList.map(u => [u.id, u.name]));
  return notes.map(n => ({ ...n, userName: userMap[n.userId] || "Unknown" }));
}

export async function addDocumentNote(documentId: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documentNotes).values({ documentId, userId, content });
  return { id: result.insertId, documentId, userId, content };
}

export async function deleteDocumentNote(noteId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(documentNotes).where(and(eq(documentNotes.id, noteId), eq(documentNotes.userId, userId)));
  return true;
}

export async function getDocumentEntityLinks(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentEntityLinks).where(eq(documentEntityLinks.documentId, documentId));
}

// ============================================================================
// VAULT — Folder Operations
// ============================================================================

export async function listFolders(filters?: { collection?: string; parentId?: number | null; ownerId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.collection) conditions.push(eq(documentFolders.collection, filters.collection as any));
  if (filters?.parentId !== undefined) {
    if (filters.parentId === null) {
      conditions.push(sql`${documentFolders.parentId} IS NULL`);
    } else {
      conditions.push(eq(documentFolders.parentId, filters.parentId));
    }
  }
  if (filters?.ownerId) conditions.push(eq(documentFolders.ownerId, filters.ownerId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(documentFolders).where(where).orderBy(asc(documentFolders.sortOrder), asc(documentFolders.name));
}

export async function createFolder(data: InsertDocumentFolder) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documentFolders).values(data);
  return { id: result.insertId, ...data };
}

export async function updateFolder(id: number, data: Partial<InsertDocumentFolder>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(documentFolders).set(data).where(eq(documentFolders.id, id));
  const [folder] = await db.select().from(documentFolders).where(eq(documentFolders.id, id)).limit(1);
  return folder ?? null;
}

export async function deleteFolder(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(documentFolders).where(eq(documentFolders.id, id));
  return true;
}

// ============================================================================
// VAULT — Template Operations
// ============================================================================

export async function listTemplates(filters?: { category?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.category) conditions.push(eq(documentTemplates.category, filters.category as any));
  if (filters?.isActive !== undefined) conditions.push(eq(documentTemplates.isActive, filters.isActive));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(documentTemplates).where(where).orderBy(desc(documentTemplates.timesUsed), asc(documentTemplates.name));
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id)).limit(1);
  return template ?? null;
}

export async function createTemplate(data: InsertDocumentTemplate) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documentTemplates).values(data);
  return { id: result.insertId, ...data };
}

export async function updateTemplate(id: number, data: Partial<InsertDocumentTemplate>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(documentTemplates).set(data).where(eq(documentTemplates.id, id));
  return getTemplateById(id);
}

export async function incrementTemplateUsage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(documentTemplates).set({ timesUsed: sql`${documentTemplates.timesUsed} + 1` }).where(eq(documentTemplates.id, id));
}

// ============================================================================
// VAULT — Signing Provider Operations
// ============================================================================

export async function listSigningProviders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signingProviders).orderBy(desc(signingProviders.isDefault), asc(signingProviders.displayName));
}

export async function getSigningProviderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [provider] = await db.select().from(signingProviders).where(eq(signingProviders.id, id)).limit(1);
  return provider ?? null;
}

export async function getDefaultSigningProvider() {
  const db = await getDb();
  if (!db) return null;
  const [provider] = await db.select().from(signingProviders).where(eq(signingProviders.isDefault, true)).limit(1);
  return provider ?? null;
}

export async function upsertSigningProvider(data: InsertSigningProvider) {
  const db = await getDb();
  if (!db) return null;
  // If setting as default, clear other defaults first
  if (data.isDefault) {
    await db.update(signingProviders).set({ isDefault: false }).where(eq(signingProviders.isDefault, true));
  }
  const existing = await db.select().from(signingProviders).where(eq(signingProviders.provider, data.provider)).limit(1);
  if (existing.length > 0) {
    await db.update(signingProviders).set(data).where(eq(signingProviders.id, existing[0].id));
    return { ...existing[0], ...data };
  }
  const [result] = await db.insert(signingProviders).values(data);
  return { id: result.insertId, ...data };
}

export async function deleteSigningProvider(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(signingProviders).where(eq(signingProviders.id, id));
  return true;
}

// ============================================================================
// VAULT — Signing Envelope Operations
// ============================================================================

export async function listSigningEnvelopes(filters?: { status?: string; documentId?: number; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(signingEnvelopes.status, filters.status as any));
  if (filters?.documentId) conditions.push(eq(signingEnvelopes.documentId, filters.documentId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  const [items, countResult] = await Promise.all([
    db.select().from(signingEnvelopes).where(where).orderBy(desc(signingEnvelopes.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(signingEnvelopes).where(where),
  ]);
  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getSigningEnvelopeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [envelope] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, id)).limit(1);
  return envelope ?? null;
}

export async function createSigningEnvelope(data: InsertSigningEnvelope) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(signingEnvelopes).values(data);
  return { id: result.insertId, ...data };
}

export async function updateSigningEnvelope(id: number, data: Partial<InsertSigningEnvelope>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(signingEnvelopes).set(data).where(eq(signingEnvelopes.id, id));
  return getSigningEnvelopeById(id);
}

// Document access
export async function grantDocumentAccess(data: InsertDocumentAccess) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documentAccess).values(data);
  return { id: result.insertId, ...data };
}

export async function revokeDocumentAccess(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(documentAccess).where(eq(documentAccess.id, id));
  return true;
}

export async function getDocumentAccessList(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentAccess).where(eq(documentAccess.documentId, documentId));
}
