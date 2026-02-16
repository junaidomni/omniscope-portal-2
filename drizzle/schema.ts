import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index, bigint, decimal, json } from "drizzle-orm/mysql-core";
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
 * Companies / Accounts table
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  domain: varchar("domain", { length: 500 }),
  industry: varchar("industry", { length: 255 }),
  notes: text("notes"),
  status: mysqlEnum("companyStatus", ["active", "inactive", "prospect", "partner"]).default("active").notNull(),
  owner: varchar("owner", { length: 255 }),
  aiMemory: text("aiMemory"), // Rolling AI company brief
  logoUrl: varchar("logoUrl", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("company_name_idx").on(table.name),
  domainIdx: index("company_domain_idx").on(table.domain),
}));

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Contacts/People table - people we've interacted with across meetings
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  organization: varchar("organization", { length: 255 }),
  title: varchar("title", { length: 255 }), // Job title
  notes: text("notes"), // Manual notes
  dateOfBirth: varchar("dateOfBirth", { length: 20 }),
  address: text("address"),
  website: varchar("website", { length: 500 }),
  linkedin: varchar("linkedin", { length: 500 }),
  aiSummary: text("aiSummary"), // AI-generated relationship summary
  aiMemory: text("aiMemory"), // Rolling AI client brief (who they are, what we're working on, preferences, open loops)
  // Enhanced CRM fields
  companyId: int("companyId").references(() => companies.id, { onDelete: "set null" }),
  category: mysqlEnum("category", ["client", "prospect", "partner", "vendor", "other"]).default("other"),
  starred: boolean("starred").default(false).notNull(),
  rating: int("rating"), // 1-5 relationship rating
  photoUrl: varchar("photoUrl", { length: 1000 }),
  source: varchar("source", { length: 100 }), // how they entered the system: 'fathom', 'manual', 'plaud'
  tags: text("tags"), // JSON array of tag strings
  relationshipScore: int("relationshipScore"), // 0-100 computed score
  engagementScore: int("engagementScore"), // 0-100 computed score
  lastInteractionAt: timestamp("lastInteractionAt"),
  lastContactedAt: timestamp("lastContactedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("contact_name_idx").on(table.name),
  orgIdx: index("contact_org_idx").on(table.organization),
  categoryIdx: index("contact_category_idx").on(table.category),
  starredIdx: index("contact_starred_idx").on(table.starred),
  companyIdx: index("contact_company_idx").on(table.companyId),
}));

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Contact notes - timeline of manual notes for a contact
 */
export const contactNotes = mysqlTable("contact_notes", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: int("createdBy").references(() => users.id),
  createdByName: varchar("createdByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  contactIdx: index("cn_contact_idx").on(table.contactId),
}));

export type ContactNote = typeof contactNotes.$inferSelect;
export type InsertContactNote = typeof contactNotes.$inferInsert;

/**
 * Contact documents - documents associated with contacts (NCNDAs, contracts, etc.)
 */
export const contactDocuments = mysqlTable("contact_documents", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  category: mysqlEnum("contactDocCategory", ["ncnda", "contract", "agreement", "proposal", "invoice", "kyc", "compliance", "correspondence", "other"]).default("other").notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  uploadedBy: int("uploadedBy").references(() => users.id),
}, (table) => ({
  contactIdx: index("cd_contact_idx").on(table.contactId),
  categoryIdx: index("cd_category_idx").on(table.category),
}));

export type ContactDocument = typeof contactDocuments.$inferSelect;
export type InsertContactDocument = typeof contactDocuments.$inferInsert;

/**
 * Employees table - HR employee database
 */
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  // Personal Information
  firstName: varchar("firstName", { length: 255 }).notNull(),
  lastName: varchar("lastName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  dateOfBirth: varchar("dateOfBirth", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 255 }),
  country: varchar("country", { length: 255 }),
  photoUrl: varchar("photoUrl", { length: 1000 }),
  // Emergency Contact
  emergencyContactName: varchar("emergencyContactName", { length: 255 }),
  emergencyContactPhone: varchar("emergencyContactPhone", { length: 50 }),
  emergencyContactRelation: varchar("emergencyContactRelation", { length: 100 }),
  // Employment Details
  hireDate: varchar("hireDate", { length: 20 }).notNull(),
  department: varchar("department", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 255 }).notNull(),
  employmentType: mysqlEnum("employmentType", ["full_time", "part_time", "contractor", "intern"]).default("full_time").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "terminated", "on_leave"]).default("active").notNull(),
  // Compensation
  salary: varchar("salary", { length: 50 }),
  payFrequency: mysqlEnum("payFrequency", ["weekly", "biweekly", "monthly", "per_project"]).default("monthly"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  // Linked contact (optional - links employee to their contact record for meeting tracking)
  contactId: int("contactId").references(() => contacts.id, { onDelete: "set null" }),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  emailIdx: index("emp_email_idx").on(table.email),
  statusIdx: index("emp_status_idx").on(table.status),
  deptIdx: index("emp_dept_idx").on(table.department),
}));

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

/**
 * Payroll records - tracks all payments to employees
 */
export const payrollRecords = mysqlTable("payroll_records", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
  // Pay period
  payPeriodStart: varchar("payPeriodStart", { length: 20 }).notNull(),
  payPeriodEnd: varchar("payPeriodEnd", { length: 20 }).notNull(),
  // Payment details
  amount: varchar("amount", { length: 50 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["bank_transfer", "check", "crypto", "cash", "wire", "other"]).default("bank_transfer").notNull(),
  paymentDate: varchar("paymentDate", { length: 20 }),
  status: mysqlEnum("payrollStatus", ["pending", "paid", "overdue", "cancelled"]).default("pending").notNull(),
  // Documentation
  notes: text("notes"),
  receiptUrl: varchar("receiptUrl", { length: 1000 }),
  receiptKey: varchar("receiptKey", { length: 500 }),
  invoiceUrl: varchar("invoiceUrl", { length: 1000 }),
  invoiceKey: varchar("invoiceKey", { length: 500 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").references(() => users.id),
}, (table) => ({
  employeeIdx: index("pr_employee_idx").on(table.employeeId),
  statusIdx: index("pr_status_idx").on(table.status),
}));

export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type InsertPayrollRecord = typeof payrollRecords.$inferInsert;

/**
 * HR Documents - employee documents (contracts, IDs, tax forms, etc.)
 */
export const hrDocuments = mysqlTable("hr_documents", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  category: mysqlEnum("docCategory", ["contract", "id_document", "tax_form", "certification", "onboarding", "performance", "payslip", "invoice", "receipt", "other"]).default("other").notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 500 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"), // bytes
  notes: text("notes"),
  uploadedBy: int("uploadedBy").references(() => users.id),
  uploadedByName: varchar("uploadedByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  employeeIdx: index("hd_employee_idx").on(table.employeeId),
  categoryIdx: index("hd_category_idx").on(table.category),
}));

export type HrDocument = typeof hrDocuments.$inferSelect;
export type InsertHrDocument = typeof hrDocuments.$inferInsert;

/**
 * Meetings table - stores all call intelligence reports
 */
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  
  // Metadata
  meetingTitle: varchar("meetingTitle", { length: 500 }),
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
  
  // CRM linking
  contactId: int("contactId").references(() => contacts.id, { onDelete: "set null" }),
  companyId: int("companyId").references(() => companies.id, { onDelete: "set null" }),
  
  // Notes / comments
  notes: text("notes"),
  
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
 * Invitations table - invite-only access control
 */
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  invitedBy: int("invitedBy").references(() => users.id),
  acceptedAt: timestamp("acceptedAt"),
  userId: int("userId").references(() => users.id), // linked after they sign up
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  emailIdx: index("invitation_email_idx").on(table.email),
}));

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

/**
 * Meeting categories - predefined categories for tagging
 */
export const meetingCategories = mysqlTable("meeting_categories", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingCatMeetingIdx: index("mc_cat_meeting_idx").on(table.meetingId),
  meetingCatCategoryIdx: index("mc_cat_category_idx").on(table.category),
}));

export type MeetingCategory = typeof meetingCategories.$inferSelect;
export type InsertMeetingCategory = typeof meetingCategories.$inferInsert;

/**
 * Google OAuth tokens - stores refresh tokens for Google Calendar/Gmail API access
 */
export const googleTokens = mysqlTable("google_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenType: varchar("tokenType", { length: 50 }).default("Bearer").notNull(),
  scope: text("scope"),
  expiresAt: timestamp("expiresAt"),
  email: varchar("email", { length: 320 }), // Google account email
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("google_token_user_idx").on(table.userId),
}));

export type GoogleToken = typeof googleTokens.$inferSelect;
export type InsertGoogleToken = typeof googleTokens.$inferInsert;

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

export const contactsRelations = relations(contacts, ({ many, one }) => ({
  meetings: many(meetingContacts),
  notes: many(contactNotes),
  documents: many(contactDocuments),
  interactions: many(interactions),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));

export const contactDocumentsRelations = relations(contactDocuments, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactDocuments.contactId],
    references: [contacts.id],
  }),
  uploader: one(users, {
    fields: [contactDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const contactNotesRelations = relations(contactNotes, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactNotes.contactId],
    references: [contacts.id],
  }),
  createdByUser: one(users, {
    fields: [contactNotes.createdBy],
    references: [users.id],
  }),
}));

export const employeesRelations = relations(employees, ({ many, one }) => ({
  payrollRecords: many(payrollRecords),
  documents: many(hrDocuments),
  contact: one(contacts, {
    fields: [employees.contactId],
    references: [contacts.id],
  }),
}));

export const payrollRecordsRelations = relations(payrollRecords, ({ one }) => ({
  employee: one(employees, {
    fields: [payrollRecords.employeeId],
    references: [employees.id],
  }),
}));

export const hrDocumentsRelations = relations(hrDocuments, ({ one }) => ({
  employee: one(employees, {
    fields: [hrDocuments.employeeId],
    references: [employees.id],
  }),
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

/**
 * Interactions table - unified timeline of all interactions
 */
export const interactions = mysqlTable("interactions", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("interactionType", ["meeting", "note", "doc_shared", "task_update", "email", "intro", "call"]).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  contactId: int("contactId").references(() => contacts.id, { onDelete: "cascade" }),
  companyId: int("companyId").references(() => companies.id, { onDelete: "set null" }),
  sourceRecordId: int("sourceRecordId"), // meeting_id, doc_id, task_id, etc.
  sourceType: varchar("sourceType", { length: 50 }), // 'meeting', 'contact_note', 'contact_document', 'task'
  summary: text("summary"),
  details: text("details"), // JSON with extra data
  tags: text("interactionTags"), // JSON array of tags
  createdBy: int("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  contactIdx: index("interaction_contact_idx").on(table.contactId),
  companyIdx: index("interaction_company_idx").on(table.companyId),
  typeIdx: index("interaction_type_idx").on(table.type),
  timestampIdx: index("interaction_timestamp_idx").on(table.timestamp),
}));

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

export const interactionsRelations = relations(interactions, ({ one }) => ({
  contact: one(contacts, {
    fields: [interactions.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [interactions.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [interactions.createdBy],
    references: [users.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  people: many(contacts),
  interactions: many(interactions),
}));
