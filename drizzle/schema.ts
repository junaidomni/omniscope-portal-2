import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Contacts table - people we've interacted with across meetings
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  organization: varchar("organization", { length: 255 }),
  title: varchar("title", { length: 255 }), // Job title
  notes: text("notes"), // AI-generated summary of interactions
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("contact_name_idx").on(table.name),
  orgIdx: index("contact_org_idx").on(table.organization),
}));

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Meetings table - stores all call intelligence reports
 */
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  
  // Metadata
  meetingDate: timestamp("meetingDate").notNull(),
  primaryLead: varchar("primaryLead", { length: 255 }).notNull(),
  participants: text("participants").notNull(), // JSON array of participant names
  organizations: text("organizations"), // JSON array of organization names
  jurisdictions: text("jurisdictions"), // JSON array of jurisdictions
  
  // Intelligence Content
  executiveSummary: text("executiveSummary").notNull(),
  strategicHighlights: text("strategicHighlights"), // JSON array
  opportunities: text("opportunities"), // JSON array
  risks: text("risks"), // JSON array
  keyQuotes: text("keyQuotes"), // JSON array
  intelligenceData: text("intelligenceData"), // JSON object
  
  // Full transcript for search
  fullTranscript: text("fullTranscript"),
  
  // Source tracking
  sourceType: mysqlEnum("sourceType", ["plaud", "fathom", "manual"]).notNull(),
  sourceId: varchar("sourceId", { length: 255 }),
  
  // Generated branded report
  brandedReportUrl: text("brandedReportUrl"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").references(() => users.id),
}, (table) => ({
  meetingDateIdx: index("meeting_date_idx").on(table.meetingDate),
  primaryLeadIdx: index("primary_lead_idx").on(table.primaryLead),
  sourceIdIdx: index("source_id_idx").on(table.sourceId),
}));

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;

/**
 * Tags table - sectors and jurisdictions for categorization
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  type: mysqlEnum("type", ["sector", "jurisdiction"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("type_idx").on(table.type),
}));

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Meeting tags junction table
 */
export const meetingTags = mysqlTable("meeting_tags", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  tagId: int("tagId").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingIdIdx: index("meeting_id_idx").on(table.meetingId),
  tagIdIdx: index("tag_id_idx").on(table.tagId),
}));

export type MeetingTag = typeof meetingTags.$inferSelect;
export type InsertMeetingTag = typeof meetingTags.$inferInsert;

/**
 * Tasks table - action items from meetings or manually created
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  
  // Task details
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "completed"]).default("open").notNull(),
  category: varchar("category", { length: 255 }), // e.g. "Little Miracles", "Gold", "BTC", "Private Placement"
  
  // Assignment - store name string for team members (Junaid, Kyle, Jake, Sania)
  assignedTo: int("assignedTo").references(() => users.id),
  assignedName: varchar("assignedName", { length: 255 }), // Direct name for non-user team members
  
  // Source tracking
  meetingId: int("meetingId").references(() => meetings.id, { onDelete: "set null" }),
  isAutoGenerated: boolean("isAutoGenerated").default(false).notNull(),
  
  // Timeline
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").references(() => users.id),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
  assignedToIdx: index("assigned_to_idx").on(table.assignedTo),
  meetingIdIdx: index("task_meeting_id_idx").on(table.meetingId),
  categoryIdx: index("category_idx").on(table.category),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Meeting contacts junction table
 */
export const meetingContacts = mysqlTable("meeting_contacts", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  contactId: int("contactId").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingContactMeetingIdx: index("mc_meeting_id_idx").on(table.meetingId),
  meetingContactContactIdx: index("mc_contact_id_idx").on(table.contactId),
}));

export type MeetingContact = typeof meetingContacts.$inferSelect;
export type InsertMeetingContact = typeof meetingContacts.$inferInsert;

/**
 * Calendar events cache - synced from Google Calendar
 */
export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  googleEventId: varchar("googleEventId", { length: 512 }).notNull().unique(),
  summary: varchar("summary", { length: 500 }).notNull(),
  description: text("description"),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  isAllDay: boolean("isAllDay").default(false).notNull(),
  location: varchar("location", { length: 500 }),
  attendees: text("attendees"), // JSON array of emails
  hangoutLink: varchar("hangoutLink", { length: 500 }),
  htmlLink: varchar("htmlLink", { length: 500 }),
  calendarId: varchar("calendarId", { length: 255 }).default("primary").notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  googleEventIdx: index("google_event_idx").on(table.googleEventId),
  startTimeIdx: index("start_time_idx").on(table.startTime),
}));

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

/**
 * Relations
 */
export const meetingsRelations = relations(meetings, ({ many, one }) => ({
  tags: many(meetingTags),
  tasks: many(tasks),
  contacts: many(meetingContacts),
  creator: one(users, {
    fields: [meetings.createdBy],
    references: [users.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  meetings: many(meetingContacts),
}));

export const meetingContactsRelations = relations(meetingContacts, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingContacts.meetingId],
    references: [meetings.id],
  }),
  contact: one(contacts, {
    fields: [meetingContacts.contactId],
    references: [contacts.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  meetings: many(meetingTags),
}));

export const meetingTagsRelations = relations(meetingTags, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingTags.meetingId],
    references: [meetings.id],
  }),
  tag: one(tags, {
    fields: [meetingTags.tagId],
    references: [tags.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  meeting: one(meetings, {
    fields: [tasks.meetingId],
    references: [meetings.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  createdMeetings: many(meetings),
  assignedTasks: many(tasks),
}));
