import { and, desc, eq, gte, like, lte, or, sql, inArray, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, meetings, tasks, tags, meetingTags, contacts, meetingContacts, InsertMeeting, InsertTask, InsertTag, InsertMeetingTag, InsertContact, InsertMeetingContact } from "../drizzle/schema";
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
  // Delete junction records first
  await db.delete(meetingContacts).where(eq(meetingContacts.contactId, id));
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

export async function getOrCreateContact(name: string, org?: string, email?: string) {
  let contact = await getContactByName(name);
  if (!contact) {
    const id = await createContact({ name, organization: org ?? null, email: email ?? null });
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
  return await db
    .select({ contact: contacts })
    .from(meetingContacts)
    .innerJoin(contacts, eq(meetingContacts.contactId, contacts.id))
    .where(eq(meetingContacts.meetingId, meetingId));
}

export async function getMeetingsForContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ meeting: meetings })
    .from(meetingContacts)
    .innerJoin(meetings, eq(meetingContacts.meetingId, meetings.id))
    .where(eq(meetingContacts.contactId, contactId))
    .orderBy(desc(meetings.meetingDate));
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
