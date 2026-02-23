import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index, uniqueIndex, bigint, decimal, json } from "drizzle-orm/mysql-core";
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
  platformOwner: boolean("platformOwner").default(false).notNull(), // Super-admin flag — bypasses orgId filtering, can view all accounts
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  profilePhotoUrl: text("profilePhotoUrl"),
  notificationPreferences: text("notificationPreferences"), // JSON: { callNotifications: boolean, soundVolume: number, deliveryMethod: string }
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// MULTI-TENANT: Accounts, Organizations, Memberships
// ============================================================================

/**
 * Accounts — top-level paying entity (a person or business who subscribes).
 * Jake = one account. Nick = another account. Each account owns N organizations.
 */
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("accountName", { length: 500 }).notNull(),
  ownerUserId: int("accountOwnerUserId").notNull().references(() => users.id),
  plan: mysqlEnum("accountPlan", ["starter", "professional", "enterprise", "sovereign"]).default("starter").notNull(),
  status: mysqlEnum("accountStatus", ["active", "suspended", "cancelled"]).default("active").notNull(),
  maxOrganizations: int("accountMaxOrgs").default(5).notNull(),
  maxUsersPerOrg: int("accountMaxUsersPerOrg").default(25).notNull(),
  billingEmail: varchar("accountBillingEmail", { length: 320 }),
  mrrCents: int("accountMrrCents").default(0).notNull(), // Monthly recurring revenue in cents
  trialEndsAt: timestamp("accountTrialEndsAt"), // When trial expires (null = no trial)
  healthScore: int("accountHealthScore").default(100).notNull(), // 0-100 account health
  lastActiveAt: timestamp("accountLastActiveAt").defaultNow().notNull(), // Last login by any user
  metadata: text("accountMetadata"), // JSON: extra account-level config
  createdAt: timestamp("accountCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("accountUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerIdx: index("account_owner_idx").on(table.ownerUserId),
  statusIdx: index("account_status_idx").on(table.status),
}));

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/**
 * Organizations — a workspace/company under an account.
 * OmniScope, Kinetix, Pinnacle Partners, etc.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("orgAccountId").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: varchar("orgName", { length: 500 }).notNull(),
  slug: varchar("orgSlug", { length: 100 }).notNull().unique(), // URL-friendly identifier
  logoUrl: text("orgLogoUrl"),
  accentColor: varchar("orgAccentColor", { length: 32 }).default("#d4af37"),
  industry: varchar("orgIndustry", { length: 255 }),
  domain: varchar("orgDomain", { length: 500 }), // e.g. kinetix.com
  timezone: varchar("orgTimezone", { length: 100 }).default("America/New_York"),
  status: mysqlEnum("orgStatus", ["active", "suspended", "archived"]).default("active").notNull(),
  settings: text("orgSettings"), // JSON: org-level feature flags, preferences
  onboardingCompleted: boolean("orgOnboardingCompleted").default(false).notNull(),
  createdAt: timestamp("orgCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("orgUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountIdx: index("org_account_idx").on(table.accountId),
  slugIdx: index("org_slug_idx").on(table.slug),
  statusIdx: index("org_status_idx").on(table.status),
}));

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Organization Memberships — maps users to orgs with roles.
 * A user can belong to multiple orgs (e.g., Jake in OmniScope + Kinetix).
 * Roles: super_admin (platform god), account_owner (owns the account),
 *        org_admin (manages one org), manager (team lead), member (standard), viewer (read-only)
 */
export const orgMemberships = mysqlTable("org_memberships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("omUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: int("omOrgId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: mysqlEnum("omRole", ["super_admin", "account_owner", "org_admin", "manager", "member", "viewer"]).default("member").notNull(),
  isDefault: boolean("omIsDefault").default(false).notNull(), // user's default org on login
  invitedBy: int("omInvitedBy").references(() => users.id),
  joinedAt: timestamp("omJoinedAt").defaultNow().notNull(),
  updatedAt: timestamp("omUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userOrgIdx: uniqueIndex("om_user_org_idx").on(table.userId, table.organizationId),
  orgIdx: index("om_org_idx").on(table.organizationId),
  userIdx: index("om_user_idx").on(table.userId),
  roleIdx: index("om_role_idx").on(table.role),
}));

export type OrgMembership = typeof orgMemberships.$inferSelect;
export type InsertOrgMembership = typeof orgMemberships.$inferInsert;

// Multi-tenant relations
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  owner: one(users, { fields: [accounts.ownerUserId], references: [users.id] }),
  organizations: many(organizations),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  account: one(accounts, { fields: [organizations.accountId], references: [accounts.id] }),
  memberships: many(orgMemberships),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  user: one(users, { fields: [orgMemberships.userId], references: [users.id] }),
  organization: one(organizations, { fields: [orgMemberships.organizationId], references: [organizations.id] }),
  inviter: one(users, { fields: [orgMemberships.invitedBy], references: [users.id] }),
}));

/**
 * Companies / Accounts table
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  domain: varchar("domain", { length: 500 }),
  industry: varchar("industry", { length: 255 }),
  notes: text("notes"),
  status: mysqlEnum("companyStatus", ["active", "inactive", "prospect", "partner"]).default("active").notNull(),
  approvalStatus: mysqlEnum("companyApprovalStatus", ["approved", "pending", "rejected"]).default("approved").notNull(),
  owner: varchar("owner", { length: 255 }),
  aiMemory: text("aiMemory"), // Rolling AI company brief
  logoUrl: varchar("logoUrl", { length: 1000 }),
  // Strategic intelligence fields
  location: varchar("companyLocation", { length: 500 }),
  internalRating: int("internalRating"), // 1-5 internal rating
  jurisdictionRisk: mysqlEnum("jurisdictionRisk", ["low", "medium", "high", "critical"]),
  bankingPartner: varchar("bankingPartner", { length: 500 }),
  custodian: varchar("custodian", { length: 500 }),
  regulatoryExposure: text("regulatoryExposure"),
  entityType: mysqlEnum("entityType", ["sovereign", "private", "institutional", "family_office", "other"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("company_name_idx").on(table.name),
  domainIdx: index("company_domain_idx").on(table.domain),
  approvalIdx: index("company_approval_idx").on(table.approvalStatus),
}));

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Contacts/People table - people we've interacted with across meetings
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("contactOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  // Approval workflow
  approvalStatus: mysqlEnum("contactApprovalStatus", ["approved", "pending", "rejected"]).default("approved").notNull(),
  // Intelligence fields
  riskTier: mysqlEnum("riskTier", ["low", "medium", "high", "critical"]),
  complianceStage: mysqlEnum("complianceStage", ["not_started", "in_progress", "cleared", "flagged"]),
  influenceWeight: mysqlEnum("influenceWeight", ["decision_maker", "influencer", "gatekeeper", "champion", "end_user"]),
  introducerSource: varchar("introducerSource", { length: 500 }), // who introduced them
  referralChain: text("referralChain"), // JSON: chain of introductions
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("contact_name_idx").on(table.name),
  orgIdx: index("contact_org_idx").on(table.organization),
  categoryIdx: index("contact_category_idx").on(table.category),
  starredIdx: index("contact_starred_idx").on(table.starred),
  companyIdx: index("contact_company_idx").on(table.companyId),
  approvalIdx: index("contact_approval_idx").on(table.approvalStatus),
}));

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Contact notes - timeline of manual notes for a contact
 */
export const contactNotes = mysqlTable("contact_notes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("cnOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("cdOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("empOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("prOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("hrOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("mtgOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  
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
  orgId: int("tagOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("mtOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("taskOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  
  // Task details
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "completed"]).default("open").notNull(),
  category: varchar("category", { length: 255 }), // e.g. "Little Miracles", "Gold", "BTC", "Private Placement"
  
  // Assignment - linked to directory
  assignedTo: int("assignedTo").references(() => users.id),
  assignedName: varchar("assignedName", { length: 255 }), // Display name (auto-populated from contact)
  assigneeContactId: int("assigneeContactId").references(() => contacts.id, { onDelete: "set null" }), // Linked contact entity
  
  // Source tracking
  meetingId: int("meetingId").references(() => meetings.id, { onDelete: "set null" }),
  sourceThreadId: varchar("sourceThreadId", { length: 255 }), // Gmail thread ID if created from email
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
  orgId: int("mcOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("ceOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("invOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  platformOwner: boolean("platformOwner").default(false).notNull(), // Super-admin flag
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
  orgId: int("mcOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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
  orgId: int("intxOrgId").references(() => organizations.id, { onDelete: "cascade" }),
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


/**
 * Email messages — lightweight metadata cache for Gmail threads/messages.
 * Full body is fetched on-demand from Gmail API; we only store headers for fast UI.
 */
export const emailMessages = mysqlTable("email_messages", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("emOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  gmailMessageId: varchar("gmailMessageId", { length: 255 }).notNull(),
  gmailThreadId: varchar("gmailThreadId", { length: 255 }).notNull(),
  fromEmail: varchar("fromEmail", { length: 320 }),
  fromName: varchar("fromName", { length: 255 }),
  toEmails: text("toEmails"), // JSON array of email strings
  ccEmails: text("ccEmails"), // JSON array of email strings
  subject: varchar("subject", { length: 1000 }),
  snippet: text("snippet"),
  internalDate: bigint("internalDate", { mode: "number" }), // Gmail epoch ms
  isUnread: boolean("isUnread").default(true).notNull(),
  isStarred: boolean("isStarred").default(false).notNull(),
  labelIds: text("labelIds"), // JSON array of Gmail label IDs
  hasAttachments: boolean("hasAttachments").default(false).notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("em_user_idx").on(table.userId),
  threadIdx: index("em_thread_idx").on(table.gmailThreadId),
  messageIdx: index("em_message_idx").on(table.gmailMessageId),
  dateIdx: index("em_date_idx").on(table.internalDate),
  userThreadIdx: index("em_user_thread_idx").on(table.userId, table.gmailThreadId),
}));

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = typeof emailMessages.$inferInsert;

/**
 * Email entity links — maps emails to contacts and companies for contextual views.
 */
export const emailEntityLinks = mysqlTable("email_entity_links", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("eelOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  emailMessageId: int("emailMessageId").notNull().references(() => emailMessages.id, { onDelete: "cascade" }),
  contactId: int("contactId").references(() => contacts.id, { onDelete: "cascade" }),
  companyId: int("companyId").references(() => companies.id, { onDelete: "set null" }),
  linkType: mysqlEnum("linkType", ["from", "to", "cc", "manual"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("eel_email_idx").on(table.emailMessageId),
  contactIdx: index("eel_contact_idx").on(table.contactId),
  companyIdx: index("eel_company_idx").on(table.companyId),
}));

export type EmailEntityLink = typeof emailEntityLinks.$inferSelect;
export type InsertEmailEntityLink = typeof emailEntityLinks.$inferInsert;

/**
 * Email relations
 */
export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [emailMessages.userId],
    references: [users.id],
  }),
  entityLinks: many(emailEntityLinks),
}));

export const emailEntityLinksRelations = relations(emailEntityLinks, ({ one }) => ({
  email: one(emailMessages, {
    fields: [emailEntityLinks.emailMessageId],
    references: [emailMessages.id],
  }),
  contact: one(contacts, {
    fields: [emailEntityLinks.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [emailEntityLinks.companyId],
    references: [companies.id],
  }),
}));

/**
 * User profiles — extended profile data for signature system and personalization.
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  title: varchar("title", { length: 255 }), // e.g. "Managing Director"
  division: varchar("division", { length: 255 }), // e.g. "Private Markets"
  phone: varchar("phone", { length: 50 }),
  location: varchar("location", { length: 255 }), // e.g. "Dubai, UAE"
  website: varchar("website", { length: 500 }).default("omniscopex.ae"),
  tagline: varchar("tagline", { length: 500 }), // Optional tagline
  signatureEnabled: boolean("signatureEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("up_user_idx").on(table.userId),
}));

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

/**
 * Email Star Priority System
 * 1 = Reply Today, 2 = Delegate, 3 = Critical
 */
export const emailStars = mysqlTable("email_stars", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("esOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  threadId: varchar("threadId", { length: 255 }).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  starLevel: int("starLevel").notNull(), // 1, 2, or 3
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  threadUserIdx: index("es_thread_user_idx").on(table.threadId, table.userId),
  userIdx: index("es_user_idx").on(table.userId),
  starLevelIdx: index("es_star_level_idx").on(table.starLevel),
}));

export type EmailStar = typeof emailStars.$inferSelect;
export type InsertEmailStar = typeof emailStars.$inferInsert;

export const emailStarsRelations = relations(emailStars, ({ one }) => ({
  user: one(users, {
    fields: [emailStars.userId],
    references: [users.id],
  }),
}));

/**
 * Email-to-Company Links
 * Associates Gmail threads with CRM companies
 */
export const emailCompanyLinks = mysqlTable("email_company_links", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("eclOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  threadId: varchar("threadId", { length: 255 }).notNull(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  threadIdx: index("ecl_thread_idx").on(table.threadId),
  companyIdx: index("ecl_company_idx").on(table.companyId),
  userIdx: index("ecl_user_idx").on(table.userId),
}));

export type EmailCompanyLink = typeof emailCompanyLinks.$inferSelect;
export type InsertEmailCompanyLink = typeof emailCompanyLinks.$inferInsert;

export const emailCompanyLinksRelations = relations(emailCompanyLinks, ({ one }) => ({
  company: one(companies, {
    fields: [emailCompanyLinks.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [emailCompanyLinks.userId],
    references: [users.id],
  }),
}));


/**
 * Email Thread Summaries — cached AI-generated summaries for Gmail threads.
 * Avoids re-invoking LLM for the same thread unless explicitly refreshed.
 */
export const emailThreadSummaries = mysqlTable("email_thread_summaries", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("etsOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  threadId: varchar("threadId", { length: 255 }).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  keyPoints: text("keyPoints"), // JSON array of key points
  actionItems: text("actionItems"), // JSON array of action items
  entities: text("entities"), // JSON array of entities mentioned
  messageCount: int("messageCount").notNull(), // number of messages when summary was generated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  threadUserIdx: uniqueIndex("ets_thread_user_idx").on(table.threadId, table.userId),
  userIdx: index("ets_user_idx").on(table.userId),
}));

export type EmailThreadSummary = typeof emailThreadSummaries.$inferSelect;
export type InsertEmailThreadSummary = typeof emailThreadSummaries.$inferInsert;

/**
 * Pending Suggestions — stages all auto-detected changes for user review.
 * Types:
 *   - "company_link": AI wants to link a contact to a company
 *   - "enrichment": AI-extracted data for a contact (email, phone, title, etc.)
 *   - "company_enrichment": AI-extracted data for a company
 */
export const pendingSuggestions = mysqlTable("pending_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("psOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  type: mysqlEnum("suggestionType", ["company_link", "enrichment", "company_enrichment"]).notNull(),
  status: mysqlEnum("suggestionStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  // Target entity
  contactId: int("contactId").references(() => contacts.id, { onDelete: "cascade" }),
  companyId: int("companyId").references(() => companies.id, { onDelete: "cascade" }),
  // For company_link: the company to link to
  suggestedCompanyId: int("suggestedCompanyId").references(() => companies.id, { onDelete: "cascade" }),
  // For enrichment: JSON of suggested field updates { email: "...", phone: "...", etc. }
  suggestedData: text("suggestedData"),
  // Context
  reason: text("reason"), // Why this was suggested (e.g., "Mentioned in meeting: Deal Review")
  sourceMeetingId: int("sourceMeetingId").references(() => meetings.id, { onDelete: "set null" }),
  confidence: int("confidence"), // 0-100 confidence score
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy").references(() => users.id),
}, (table) => ({
  typeIdx: index("ps_type_idx").on(table.type),
  statusIdx: index("ps_status_idx").on(table.status),
  contactIdx: index("ps_contact_idx").on(table.contactId),
  companyIdx: index("ps_company_idx").on(table.companyId),
}));

export type PendingSuggestion = typeof pendingSuggestions.$inferSelect;
export type InsertPendingSuggestion = typeof pendingSuggestions.$inferInsert;

export const pendingSuggestionsRelations = relations(pendingSuggestions, ({ one }) => ({
  contact: one(contacts, {
    fields: [pendingSuggestions.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [pendingSuggestions.companyId],
    references: [companies.id],
  }),
  suggestedCompany: one(companies, {
    fields: [pendingSuggestions.suggestedCompanyId],
    references: [companies.id],
  }),
  sourceMeeting: one(meetings, {
    fields: [pendingSuggestions.sourceMeetingId],
    references: [meetings.id],
  }),
  reviewer: one(users, {
    fields: [pendingSuggestions.reviewedBy],
    references: [users.id],
  }),
}));


/**
 * Activity Log / Audit Trail — records every CRM action for compliance
 */
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("alOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // approve_contact, reject_contact, merge_contacts, approve_company, reject_company, approve_suggestion, reject_suggestion, enrich_contact, enrich_company, bulk_approve, bulk_reject, dedup_merge, dedup_dismiss
  entityType: varchar("entityType", { length: 50 }).notNull(), // contact, company, suggestion, task
  entityId: varchar("entityId", { length: 255 }).notNull(), // ID of the affected entity
  entityName: varchar("entityName", { length: 500 }), // Human-readable name for display
  details: text("details"), // JSON string with action-specific details
  metadata: text("metadata"), // Additional context (e.g., merge source/target, old/new values)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("activity_user_idx").on(table.userId),
  actionIdx: index("activity_action_idx").on(table.action),
  entityIdx: index("activity_entity_idx").on(table.entityType, table.entityId),
  createdAtIdx: index("activity_created_idx").on(table.createdAt),
}));

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));


/**
 * Contact aliases — learned name mappings for duplicate prevention.
 * When a user merges "Kyle" with an existing contact, the alias is saved
 * so future meeting syncs auto-link "Kyle" to the correct contact.
 */
export const contactAliases = mysqlTable("contact_aliases", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("caOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull(), // owner of this alias
  contactId: int("contactId").notNull(), // the canonical contact
  aliasName: varchar("aliasName", { length: 500 }).notNull(), // the alternate name
  aliasEmail: varchar("aliasEmail", { length: 500 }), // optional alternate email
  source: varchar("aliasSource", { length: 100 }).default("merge").notNull(), // how it was learned: merge, manual
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userContactIdx: index("alias_user_contact_idx").on(table.userId, table.contactId),
  aliasNameIdx: index("alias_name_idx").on(table.userId, table.aliasName),
  aliasEmailIdx: index("alias_email_idx").on(table.userId, table.aliasEmail),
}));

export type ContactAlias = typeof contactAliases.$inferSelect;
export type InsertContactAlias = typeof contactAliases.$inferInsert;

export const contactAliasRelations = relations(contactAliases, ({ one }) => ({
  user: one(users, {
    fields: [contactAliases.userId],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [contactAliases.contactId],
    references: [contacts.id],
  }),
}));

/**
 * Company aliases — learned name mappings for company duplicate prevention.
 */
export const companyAliases = mysqlTable("company_aliases", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("coaOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull(),
  companyId: int("companyId").notNull(),
  aliasName: varchar("companyAliasName", { length: 500 }).notNull(),
  source: varchar("companyAliasSource", { length: 100 }).default("merge").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userCompanyIdx: index("calias_user_company_idx").on(table.userId, table.companyId),
  aliasNameIdx: index("calias_name_idx").on(table.userId, table.aliasName),
}));

export type CompanyAlias = typeof companyAliases.$inferSelect;
export type InsertCompanyAlias = typeof companyAliases.$inferInsert;

export const companyAliasRelations = relations(companyAliases, ({ one }) => ({
  user: one(users, {
    fields: [companyAliases.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [companyAliases.companyId],
    references: [companies.id],
  }),
}));


// ============================================================================
// INTELLIGENCE VAULT — Document Management System
// ============================================================================

/**
 * Document folders — hierarchical folder structure for the Vault.
 * Folders can be linked to entities (company/contact) for counterparty collections.
 */
export const documentFolders = mysqlTable("document_folders", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("dfOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  parentId: int("parentId"), // self-referencing FK (null = root)
  collection: mysqlEnum("folderCollection", ["company_repo", "personal", "counterparty", "templates", "signed", "transactions"]).notNull(),
  ownerId: int("ownerId").references(() => users.id, { onDelete: "set null" }), // for personal folders
  entityType: mysqlEnum("folderEntityType", ["company", "contact"]), // for counterparty folders
  entityId: int("folderEntityId"), // linked entity ID
  googleFolderId: varchar("googleFolderId", { length: 500 }), // Google Drive folder ID
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  parentIdx: index("df_parent_idx").on(table.parentId),
  collectionIdx: index("df_collection_idx").on(table.collection),
  ownerIdx: index("df_owner_idx").on(table.ownerId),
  entityIdx: index("df_entity_idx").on(table.entityType, table.entityId),
}));

export type DocumentFolder = typeof documentFolders.$inferSelect;
export type InsertDocumentFolder = typeof documentFolders.$inferInsert;

/**
 * Documents — central record for every document in the Vault.
 * Supports Google Drive files, uploaded files, and generated documents.
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("docOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("docTitle", { length: 1000 }).notNull(),
  description: text("docDescription"),
  sourceType: mysqlEnum("docSourceType", ["google_doc", "google_sheet", "google_slide", "pdf", "uploaded", "generated"]).notNull(),
  googleFileId: varchar("googleFileId", { length: 500 }),
  googleMimeType: varchar("googleMimeType", { length: 255 }),
  s3Url: varchar("docS3Url", { length: 1000 }),
  s3Key: varchar("docS3Key", { length: 500 }),
  fileName: varchar("docFileName", { length: 500 }),
  mimeType: varchar("docMimeType", { length: 255 }),
  collection: mysqlEnum("docCollection", ["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo").notNull(),
  category: mysqlEnum("docCategory2", ["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other").notNull(),
  subcategory: varchar("docSubcategory", { length: 255 }), // e.g. "sppp", "ncnda", "jva", "kyc"
  status: mysqlEnum("docStatus", ["draft", "active", "pending_signature", "sent", "viewed", "signed", "voided", "declined", "archived"]).default("active").notNull(),
  visibility: mysqlEnum("docVisibility", ["organization", "team", "private", "restricted"]).default("organization").notNull(),
  folderId: int("docFolderId").references(() => documentFolders.id, { onDelete: "set null" }),
  ownerId: int("docOwnerId").references(() => users.id, { onDelete: "set null" }),
  isTemplate: boolean("isTemplate").default(false).notNull(),
  fileSize: int("docFileSize"), // bytes
  aiSummary: text("docAiSummary"), // AI-generated document summary
  aiExtractedEntities: text("docAiEntities"), // JSON: AI-detected entity names
  lastSyncedAt: timestamp("docLastSyncedAt"),
  googleModifiedAt: timestamp("docGoogleModifiedAt"),
  createdAt: timestamp("docCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("docUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  titleIdx: index("doc_title_idx").on(table.title),
  collectionIdx: index("doc_collection_idx").on(table.collection),
  categoryIdx: index("doc_category_idx").on(table.category),
  statusIdx: index("doc_status_idx").on(table.status),
  ownerIdx: index("doc_owner_idx").on(table.ownerId),
  folderIdx: index("doc_folder_idx").on(table.folderId),
  templateIdx: index("doc_template_idx").on(table.isTemplate),
  googleFileIdx: index("doc_google_file_idx").on(table.googleFileId),
}));

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Document entity links — many-to-many between documents and CRM entities.
 * This is the core of entity-first retrieval.
 */
export const documentEntityLinks = mysqlTable("document_entity_links", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("delOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  documentId: int("delDocumentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
  entityType: mysqlEnum("delEntityType", ["company", "contact", "meeting"]).notNull(),
  entityId: int("delEntityId").notNull(),
  linkType: mysqlEnum("delLinkType", ["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary").notNull(),
  createdAt: timestamp("delCreatedAt").defaultNow().notNull(),
}, (table) => ({
  documentIdx: index("del_document_idx").on(table.documentId),
  entityIdx: index("del_entity_idx").on(table.entityType, table.entityId),
  docEntityIdx: index("del_doc_entity_idx").on(table.documentId, table.entityType, table.entityId),
}));

export type DocumentEntityLink = typeof documentEntityLinks.$inferSelect;
export type InsertDocumentEntityLink = typeof documentEntityLinks.$inferInsert;

/**
 * Document access — per-document and per-folder permission grants.
 */
export const documentAccess = mysqlTable("document_access", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("daOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  documentId: int("daDocumentId").references(() => documents.id, { onDelete: "cascade" }),
  folderId: int("daFolderId").references(() => documentFolders.id, { onDelete: "cascade" }),
  userId: int("daUserId").references(() => users.id, { onDelete: "cascade" }),
  contactId: int("daContactId").references(() => contacts.id, { onDelete: "cascade" }),
  companyId: int("daCompanyId").references(() => companies.id, { onDelete: "cascade" }),
  accessLevel: mysqlEnum("daAccessLevel", ["view", "edit", "admin"]).default("view").notNull(),
  grantedBy: int("daGrantedBy").references(() => users.id),
  createdAt: timestamp("daCreatedAt").defaultNow().notNull(),
}, (table) => ({
  documentIdx: index("da_document_idx").on(table.documentId),
  folderIdx: index("da_folder_idx").on(table.folderId),
  userIdx: index("da_user_idx").on(table.userId),
  contactIdx: index("da_contact_idx").on(table.contactId),
  companyIdx: index("da_company_idx").on(table.companyId),
}));

export type DocumentAccess = typeof documentAccess.$inferSelect;
export type InsertDocumentAccess = typeof documentAccess.$inferInsert;

/**
 * Document favorites — per-user document bookmarks.
 */
export const documentFavorites = mysqlTable("document_favorites", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("dfavOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("dfUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: int("dfDocumentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
  createdAt: timestamp("dfCreatedAt").defaultNow().notNull(),
}, (table) => ({
  userDocIdx: uniqueIndex("df_user_doc_idx").on(table.userId, table.documentId),
}));

export type DocumentFavorite = typeof documentFavorites.$inferSelect;
export type InsertDocumentFavorite = typeof documentFavorites.$inferInsert;

/**
 * Document templates — registered templates with merge field schemas.
 * Templates are Google Docs with {{placeholder}} fields that get auto-filled.
 */
export const documentTemplates = mysqlTable("document_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("dtOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("dtName", { length: 500 }).notNull(),
  description: text("dtDescription"),
  category: mysqlEnum("dtCategory", ["agreement", "compliance", "intake", "profile", "other"]).default("agreement").notNull(),
  subcategory: varchar("dtSubcategory", { length: 255 }), // "sppp", "ncnda", "jva", "cis"
  googleFileId: varchar("dtGoogleFileId", { length: 500 }), // Google Doc template file ID
  s3Url: varchar("dtS3Url", { length: 1000 }), // S3 URL for uploaded templates
  mergeFieldSchema: text("dtMergeFieldSchema"), // JSON: field definitions for the generation modal
  defaultRecipientRoles: text("dtDefaultRecipientRoles"), // JSON: default signer roles
  version: int("dtVersion").default(1).notNull(),
  isActive: boolean("dtIsActive").default(true).notNull(),
  timesUsed: int("dtTimesUsed").default(0).notNull(),
  createdBy: int("dtCreatedBy").references(() => users.id),
  createdAt: timestamp("dtCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("dtUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("dt_name_idx").on(table.name),
  categoryIdx: index("dt_category_idx").on(table.category),
  activeIdx: index("dt_active_idx").on(table.isActive),
}));

export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = typeof documentTemplates.$inferInsert;

/**
 * Signing providers — stores connected e-signature provider configurations.
 * Supports multiple providers: Firma, SignatureAPI, DocuSeal, PandaDocs, DocuSign, BoldSign, eSignly.
 */
export const signingProviders = mysqlTable("signing_providers", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("spOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  provider: mysqlEnum("spProvider", ["firma", "signatureapi", "docuseal", "pandadocs", "docusign", "boldsign", "esignly"]).notNull(),
  displayName: varchar("spDisplayName", { length: 255 }).notNull(),
  isActive: boolean("spIsActive").default(false).notNull(),
  isDefault: boolean("spIsDefault").default(false).notNull(),
  apiKey: text("spApiKey"), // encrypted API key
  apiSecret: text("spApiSecret"), // encrypted API secret (if needed)
  baseUrl: varchar("spBaseUrl", { length: 500 }), // custom API base URL (for self-hosted)
  webhookSecret: varchar("spWebhookSecret", { length: 500 }), // webhook verification secret
  config: text("spConfig"), // JSON: provider-specific configuration
  createdBy: int("spCreatedBy").references(() => users.id),
  createdAt: timestamp("spCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("spUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerIdx: index("sp_provider_idx").on(table.provider),
  activeIdx: index("sp_active_idx").on(table.isActive),
  defaultIdx: index("sp_default_idx").on(table.isDefault),
}));

export type SigningProvider = typeof signingProviders.$inferSelect;
export type InsertSigningProvider = typeof signingProviders.$inferInsert;

/**
 * Signing envelopes — tracks e-signature requests across all providers.
 * Each envelope = one document sent for signature to one or more recipients.
 */
export const signingEnvelopes = mysqlTable("signing_envelopes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("seOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  documentId: int("seDocumentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
  providerId: int("seProviderId").notNull().references(() => signingProviders.id),
  providerEnvelopeId: varchar("seProviderEnvelopeId", { length: 500 }), // ID from the signing provider
  status: mysqlEnum("seStatus", ["draft", "sent", "viewed", "completed", "declined", "voided", "expired"]).default("draft").notNull(),
  recipients: text("seRecipients"), // JSON: array of { name, email, role, order, status, signedAt }
  sentAt: timestamp("seSentAt"),
  completedAt: timestamp("seCompletedAt"),
  signedDocumentUrl: varchar("seSignedDocUrl", { length: 1000 }), // S3 URL of signed PDF
  signedDocumentKey: varchar("seSignedDocKey", { length: 500 }),
  metadata: text("seMetadata"), // JSON: provider-specific metadata
  createdBy: int("seCreatedBy").references(() => users.id),
  createdAt: timestamp("seCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("seUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  documentIdx: index("se_document_idx").on(table.documentId),
  providerIdx: index("se_provider_idx").on(table.providerId),
  statusIdx: index("se_status_idx").on(table.status),
  providerEnvelopeIdx: index("se_provider_envelope_idx").on(table.providerEnvelopeId),
}));

export type SigningEnvelope = typeof signingEnvelopes.$inferSelect;
export type InsertSigningEnvelope = typeof signingEnvelopes.$inferInsert;

// ============================================================================
// VAULT RELATIONS
// ============================================================================

export const documentFoldersRelations = relations(documentFolders, ({ one, many }) => ({
  owner: one(users, { fields: [documentFolders.ownerId], references: [users.id] }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  folder: one(documentFolders, { fields: [documents.folderId], references: [documentFolders.id] }),
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
  entityLinks: many(documentEntityLinks),
  favorites: many(documentFavorites),
  accessGrants: many(documentAccess),
  envelopes: many(signingEnvelopes),
}));

export const documentEntityLinksRelations = relations(documentEntityLinks, ({ one }) => ({
  document: one(documents, { fields: [documentEntityLinks.documentId], references: [documents.id] }),
}));

export const documentAccessRelations = relations(documentAccess, ({ one }) => ({
  document: one(documents, { fields: [documentAccess.documentId], references: [documents.id] }),
  folder: one(documentFolders, { fields: [documentAccess.folderId], references: [documentFolders.id] }),
  user: one(users, { fields: [documentAccess.userId], references: [users.id] }),
  contact: one(contacts, { fields: [documentAccess.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [documentAccess.companyId], references: [companies.id] }),
  granter: one(users, { fields: [documentAccess.grantedBy], references: [users.id] }),
}));

export const documentFavoritesRelations = relations(documentFavorites, ({ one }) => ({
  user: one(users, { fields: [documentFavorites.userId], references: [users.id] }),
  document: one(documents, { fields: [documentFavorites.documentId], references: [documents.id] }),
}));

export const documentTemplatesRelations = relations(documentTemplates, ({ one }) => ({
  creator: one(users, { fields: [documentTemplates.createdBy], references: [users.id] }),
}));

export const signingProvidersRelations = relations(signingProviders, ({ one, many }) => ({
  creator: one(users, { fields: [signingProviders.createdBy], references: [users.id] }),
  envelopes: many(signingEnvelopes),
}));

export const signingEnvelopesRelations = relations(signingEnvelopes, ({ one }) => ({
  document: one(documents, { fields: [signingEnvelopes.documentId], references: [documents.id] }),
  provider: one(signingProviders, { fields: [signingEnvelopes.providerId], references: [signingProviders.id] }),
  creator: one(users, { fields: [signingEnvelopes.createdBy], references: [users.id] }),
}));


/**
 * Document Notes — notes left on documents in the internal viewer
 */
export const documentNotes = mysqlTable("document_notes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("noteOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  documentId: int("noteDocId").notNull().references(() => documents.id, { onDelete: "cascade" }),
  userId: int("noteUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("noteContent").notNull(),
  createdAt: timestamp("noteCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("noteUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  docIdx: index("note_doc_idx").on(table.documentId),
}));

export const documentNotesRelations = relations(documentNotes, ({ one }) => ({
  document: one(documents, { fields: [documentNotes.documentId], references: [documents.id] }),
  user: one(users, { fields: [documentNotes.userId], references: [users.id] }),
}));


/**
 * Integrations — centralized registry for all connected services.
 * Each row represents one integration (built-in or custom).
 * Built-in integrations are seeded on first run; custom ones are user-created.
 */
export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("intOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  slug: varchar("intSlug", { length: 100 }).notNull().unique(),
  name: varchar("intName", { length: 255 }).notNull(),
  description: text("intDescription"),
  category: mysqlEnum("intCategory", [
    "intelligence",   // Fathom, Plaud, meeting tools
    "communication",  // Gmail, Calendar, Slack, Discord, WhatsApp
    "finance",        // QuickBooks, Stripe, invoicing
    "productivity",   // Google Drive, Docs, Sheets, Notion
    "custom",         // User-defined API integrations
  ]).notNull().default("custom"),
  type: mysqlEnum("intType", ["oauth", "api_key", "webhook", "custom"]).notNull().default("api_key"),
  enabled: boolean("intEnabled").default(false).notNull(),
  status: mysqlEnum("intStatus", ["connected", "disconnected", "error", "pending"]).default("disconnected").notNull(),
  iconUrl: text("intIconUrl"),       // URL to integration logo/icon
  iconColor: varchar("intIconColor", { length: 20 }),  // fallback color for icon badge
  iconLetter: varchar("intIconLetter", { length: 5 }), // fallback letter for icon badge
  apiKey: text("intApiKey"),         // encrypted API key (if applicable)
  apiSecret: text("intApiSecret"),   // encrypted API secret (if applicable)
  baseUrl: varchar("intBaseUrl", { length: 500 }),      // API base URL
  webhookUrl: text("intWebhookUrl"),                    // incoming webhook URL
  webhookSecret: varchar("intWebhookSecret", { length: 500 }), // webhook verification secret
  oauthConnected: boolean("intOauthConnected").default(false),
  config: text("intConfig"),         // JSON: provider-specific configuration
  metadata: text("intMetadata"),     // JSON: extra metadata (scopes, last sync, etc.)
  isBuiltIn: boolean("intIsBuiltIn").default(false).notNull(), // true = system integration, false = user-created
  sortOrder: int("intSortOrder").default(0).notNull(),
  lastSyncAt: timestamp("intLastSyncAt"),
  createdBy: int("intCreatedBy").references(() => users.id),
  createdAt: timestamp("intCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("intUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("int_slug_idx").on(table.slug),
  categoryIdx: index("int_category_idx").on(table.category),
  enabledIdx: index("int_enabled_idx").on(table.enabled),
}));

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

/**
 * Feature Toggles — global on/off switches for major platform features.
 * Allows admins to enable/disable entire modules without code changes.
 */
export const featureToggles = mysqlTable("feature_toggles", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("ftOrgId").references(() => organizations.id, { onDelete: "cascade" }),
  featureKey: varchar("ftKey", { length: 100 }).notNull(),
  label: varchar("ftLabel", { length: 255 }).notNull(),
  description: text("ftDescription"),
  category: mysqlEnum("ftCategory", [
    "core",           // Essential features (meetings, tasks, contacts)
    "communication",  // Email, calendar, messaging
    "intelligence",   // AI analysis, reports, insights
    "operations",     // Tasks, documents, signing
    "experimental",   // Beta features
  ]).notNull().default("core"),
  enabled: boolean("ftEnabled").default(true).notNull(),
  isLocked: boolean("ftIsLocked").default(false).notNull(), // locked = cannot be disabled
  requiredPlan: mysqlEnum("ftRequiredPlan", ["starter", "professional", "enterprise"]).default("starter").notNull(),
  sortOrder: int("ftSortOrder").default(0).notNull(),
  updatedBy: int("ftUpdatedBy").references(() => users.id),
  updatedAt: timestamp("ftUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgKeyIdx: uniqueIndex("ft_org_key_idx").on(table.orgId, table.featureKey),
  keyIdx: index("ft_key_idx").on(table.featureKey),
  categoryIdx: index("ft_category_idx").on(table.category),
}));

export type FeatureToggle = typeof featureToggles.$inferSelect;
export type InsertFeatureToggle = typeof featureToggles.$inferInsert;


// ─── Design Preferences ────────────────────────────────────────────────────
export const designPreferences = mysqlTable("design_preferences", {
  id: int("dpId").primaryKey().autoincrement(),
  userId: int("dpUserId").notNull().references(() => users.id),
  theme: mysqlEnum("dpTheme", [
    "obsidian",       // Default black & gold
    "ivory",          // Light cream & charcoal
    "midnight",       // Deep navy & silver
    "emerald",        // Dark green & gold
    "slate",          // Cool gray & blue
  ]).notNull().default("obsidian"),
  accentColor: varchar("dpAccentColor", { length: 32 }).default("#d4af37").notNull(),
  logoUrl: text("dpLogoUrl"),
  sidebarStyle: mysqlEnum("dpSidebarStyle", [
    "default",
    "compact",
    "minimal",
  ]).notNull().default("default"),
  sidebarPosition: mysqlEnum("dpSidebarPosition", ["left", "right"]).notNull().default("left"),
  fontFamily: varchar("dpFontFamily", { length: 64 }).default("Inter").notNull(),
  updatedAt: timestamp("dpUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex("dp_user_idx").on(table.userId),
}));
export type DesignPreference = typeof designPreferences.$inferSelect;
export type InsertDesignPreference = typeof designPreferences.$inferInsert;


// ============================================================================
// PLANS & SUBSCRIPTIONS
// ============================================================================

/**
 * Plans — defines the available subscription tiers.
 * Starter → Professional → Enterprise → Sovereign
 * Each plan defines limits and which features are included.
 */
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("planKey", { length: 50 }).notNull().unique(), // "starter", "professional", "enterprise", "sovereign"
  name: varchar("planName", { length: 100 }).notNull(),
  description: text("planDescription"),
  tier: int("planTier").notNull().default(0), // 0=starter, 1=pro, 2=enterprise, 3=sovereign — for comparison
  // Pricing
  priceMonthly: decimal("planPriceMonthly", { precision: 10, scale: 2 }), // null = custom pricing
  priceAnnual: decimal("planPriceAnnual", { precision: 10, scale: 2 }),
  currency: varchar("planCurrency", { length: 10 }).default("USD").notNull(),
  // Limits
  maxOrganizations: int("planMaxOrgs").default(1).notNull(),
  maxUsersPerOrg: int("planMaxUsersPerOrg").default(5).notNull(),
  maxContacts: int("planMaxContacts").default(500).notNull(), // -1 = unlimited
  maxMeetingsPerMonth: int("planMaxMeetingsPerMonth").default(50).notNull(), // -1 = unlimited
  maxStorageGb: int("planMaxStorageGb").default(5).notNull(), // -1 = unlimited
  // Feature flags (which feature categories are included)
  includesCore: boolean("planIncludesCore").default(true).notNull(),
  includesCommunication: boolean("planIncludesComm").default(false).notNull(),
  includesIntelligence: boolean("planIncludesIntel").default(false).notNull(),
  includesOperations: boolean("planIncludesOps").default(false).notNull(),
  includesExperimental: boolean("planIncludesExp").default(false).notNull(),
  // Capabilities
  hasApiAccess: boolean("planHasApi").default(false).notNull(),
  hasPrioritySupport: boolean("planHasPrioritySupport").default(false).notNull(),
  hasWhiteLabel: boolean("planHasWhiteLabel").default(false).notNull(),
  hasDedicatedAccount: boolean("planHasDedicatedAccount").default(false).notNull(),
  hasCustomIntegrations: boolean("planHasCustomIntegrations").default(false).notNull(),
  // Meta
  isActive: boolean("planIsActive").default(true).notNull(),
  sortOrder: int("planSortOrder").default(0).notNull(),
  createdAt: timestamp("planCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("planUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  keyIdx: uniqueIndex("plan_key_idx").on(table.key),
  tierIdx: index("plan_tier_idx").on(table.tier),
}));

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

/**
 * Subscriptions — links an account to a plan with billing state.
 * One active subscription per account at a time.
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("subAccountId").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  planId: int("subPlanId").notNull().references(() => plans.id),
  status: mysqlEnum("subStatus", ["active", "trialing", "past_due", "cancelled", "expired"]).default("active").notNull(),
  billingCycle: mysqlEnum("subBillingCycle", ["monthly", "annual", "custom"]).default("monthly").notNull(),
  // Dates
  startDate: timestamp("subStartDate").defaultNow().notNull(),
  endDate: timestamp("subEndDate"),
  trialEndsAt: timestamp("subTrialEndsAt"),
  cancelledAt: timestamp("subCancelledAt"),
  // Payment
  stripeCustomerId: varchar("subStripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("subStripeSubId", { length: 255 }),
  // Override limits (null = use plan defaults)
  overrideMaxOrgs: int("subOverrideMaxOrgs"),
  overrideMaxUsersPerOrg: int("subOverrideMaxUsers"),
  overrideMaxContacts: int("subOverrideMaxContacts"),
  overrideMaxStorageGb: int("subOverrideMaxStorage"),
  // Meta
  notes: text("subNotes"),
  createdAt: timestamp("subCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("subUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountIdx: index("sub_account_idx").on(table.accountId),
  planIdx: index("sub_plan_idx").on(table.planId),
  statusIdx: index("sub_status_idx").on(table.status),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Plan Feature Map — explicitly maps which feature keys are included in each plan.
 * This allows fine-grained control beyond the category-level booleans on the plan.
 */
export const planFeatures = mysqlTable("plan_features", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("pfPlanId").notNull().references(() => plans.id, { onDelete: "cascade" }),
  featureKey: varchar("pfFeatureKey", { length: 100 }).notNull(),
  included: boolean("pfIncluded").default(true).notNull(),
}, (table) => ({
  planFeatureIdx: uniqueIndex("pf_plan_feature_idx").on(table.planId, table.featureKey),
  planIdx: index("pf_plan_idx").on(table.planId),
}));

export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = typeof planFeatures.$inferInsert;

// Plans & Subscriptions relations
export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
  features: many(planFeatures),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  account: one(accounts, { fields: [subscriptions.accountId], references: [accounts.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));

export const planFeaturesRelations = relations(planFeatures, ({ one }) => ({
  plan: one(plans, { fields: [planFeatures.planId], references: [plans.id] }),
}));


// ============================================================================
// DIGEST & REPORTING PREFERENCES
// ============================================================================

/**
 * Digest Preferences — per-user report delivery settings.
 * Controls daily/weekly digest frequency, included sections, and delivery method.
 * Account owners get cross-org consolidated digests; org members get single-org digests.
 */
export const digestPreferences = mysqlTable("digest_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("dgUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: int("dgAccountId").references(() => accounts.id, { onDelete: "cascade" }),
  // Frequency
  dailyDigestEnabled: boolean("dgDailyEnabled").default(true).notNull(),
  weeklyDigestEnabled: boolean("dgWeeklyEnabled").default(true).notNull(),
  dailyDigestTime: varchar("dgDailyTime", { length: 10 }).default("08:00").notNull(), // HH:mm in user's timezone
  weeklyDigestDay: mysqlEnum("dgWeeklyDay", ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).default("monday").notNull(),
  weeklyDigestTime: varchar("dgWeeklyTime", { length: 10 }).default("09:00").notNull(),
  timezone: varchar("dgTimezone", { length: 100 }).default("America/New_York").notNull(),
  // Scope
  crossOrgConsolidated: boolean("dgCrossOrg").default(true).notNull(), // true = one digest for all orgs; false = separate per org
  // Included sections
  includeMeetingSummaries: boolean("dgIncMeetings").default(true).notNull(),
  includeTaskOverview: boolean("dgIncTasks").default(true).notNull(),
  includeContactActivity: boolean("dgIncContacts").default(true).notNull(),
  includeAiInsights: boolean("dgIncAi").default(true).notNull(),
  includeUpcomingCalendar: boolean("dgIncCalendar").default(true).notNull(),
  includeKpiMetrics: boolean("dgIncKpi").default(true).notNull(),
  // Delivery
  deliveryMethod: mysqlEnum("dgDelivery", ["in_app", "email", "both"]).default("both").notNull(),
  // Last sent timestamps
  lastDailyDigestAt: timestamp("dgLastDaily"),
  lastWeeklyDigestAt: timestamp("dgLastWeekly"),
  // Meta
  createdAt: timestamp("dgCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("dgUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex("dg_user_idx").on(table.userId),
  accountIdx: index("dg_account_idx").on(table.accountId),
}));

export type DigestPreference = typeof digestPreferences.$inferSelect;
export type InsertDigestPreference = typeof digestPreferences.$inferInsert;

export const digestPreferencesRelations = relations(digestPreferences, ({ one }) => ({
  user: one(users, { fields: [digestPreferences.userId], references: [users.id] }),
  account: one(accounts, { fields: [digestPreferences.accountId], references: [accounts.id] }),
}));

// ============================================================================
// PLATFORM AUDIT LOG & BILLING
// ============================================================================

/**
 * Platform Audit Log — tracks every significant action across the platform.
 * Used for compliance, security monitoring, and platform owner visibility.
 */
export const platformAuditLog = mysqlTable("platform_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  userEmail: varchar("userEmail", { length: 320 }),
  accountId: int("accountId"),
  accountName: varchar("accountName", { length: 500 }),
  orgId: int("orgId"),
  orgName: varchar("orgName", { length: 500 }),
  action: varchar("action", { length: 100 }).notNull(), // e.g. "create", "update", "delete", "login", "plan_change", "role_change", "account_switch"
  entityType: varchar("entityType", { length: 100 }), // e.g. "contact", "meeting", "task", "user", "organization", "account"
  entityId: int("entityId"),
  details: text("details"), // JSON: additional context about the action
  ipAddress: varchar("ipAddress", { length: 45 }),
}, (table) => ({
  timestampIdx: index("pal_timestamp_idx").on(table.timestamp),
  userIdx: index("pal_user_idx").on(table.userId),
  accountIdx: index("pal_account_idx").on(table.accountId),
  orgIdx: index("pal_org_idx").on(table.orgId),
  actionIdx: index("pal_action_idx").on(table.action),
  entityIdx: index("pal_entity_idx").on(table.entityType),
}));

export type PlatformAuditLogEntry = typeof platformAuditLog.$inferSelect;
export type InsertPlatformAuditLogEntry = typeof platformAuditLog.$inferInsert;

/**
 * Billing Events — tracks plan changes, payments, credits, and refunds.
 */
export const billingEvents = mysqlTable("billing_events", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["plan_change", "payment", "refund", "credit", "trial_start", "trial_end"]).notNull(),
  amountCents: int("amountCents").default(0).notNull(), // Amount in cents (positive = charge, negative = credit/refund)
  fromPlan: varchar("fromPlan", { length: 50 }),
  toPlan: varchar("toPlan", { length: 50 }),
  description: text("description"),
  performedBy: int("performedBy").references(() => users.id), // Who made the change (null = system)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("be_account_idx").on(table.accountId),
  typeIdx: index("be_type_idx").on(table.type),
  createdIdx: index("be_created_idx").on(table.createdAt),
}));

export type BillingEvent = typeof billingEvents.$inferSelect;
export type InsertBillingEvent = typeof billingEvents.$inferInsert;

export const billingEventsRelations = relations(billingEvents, ({ one }) => ({
  account: one(accounts, { fields: [billingEvents.accountId], references: [accounts.id] }),
  performer: one(users, { fields: [billingEvents.performedBy], references: [users.id] }),
}));

// ============================================================================
// LOGIN HISTORY — tracks user sign-in events for security auditing
// ============================================================================
export const loginHistory = mysqlTable("login_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  loginAt: timestamp("loginAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  success: boolean("success").default(true).notNull(),
  failureReason: varchar("failureReason", { length: 255 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  deviceType: varchar("deviceType", { length: 50 }),
}, (table) => ({
  userIdx: index("lh_user_idx").on(table.userId),
  loginAtIdx: index("lh_login_at_idx").on(table.loginAt),
}));
export type LoginHistoryEntry = typeof loginHistory.$inferSelect;
export type InsertLoginHistory = typeof loginHistory.$inferInsert;
export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, { fields: [loginHistory.userId], references: [users.id] }),
}));


// ============================================================================
// COMMUNICATIONS
// ============================================================================

/**
 * Workspaces - top-level container for channels (e.g., "OmniScope")
 */
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("workspaceOrgId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("workspaceName", { length: 500 }).notNull(),
  description: text("workspaceDescription"),
  avatar: varchar("workspaceAvatar", { length: 1000 }),
  isDefault: boolean("workspaceIsDefault").default(false).notNull(), // One default workspace per org
  createdBy: int("workspaceCreatedBy").notNull().references(() => users.id),
  createdAt: timestamp("workspaceCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("workspaceUpdatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("workspace_org_idx").on(table.orgId),
  createdByIdx: index("workspace_created_by_idx").on(table.createdBy),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

/**
 * Channels - DMs, group chats, and deal rooms
 */
export const channels = mysqlTable("channels", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("channelOrgId").references(() => organizations.id, { onDelete: "cascade" }), // NULL for cross-org DMs
  workspaceId: int("channelWorkspaceId").references(() => workspaces.id, { onDelete: "cascade" }), // NULL for DMs
  parentChannelId: int("channelParentId").references(() => channels.id, { onDelete: "cascade" }), // NULL for top-level, set for sub-channels
  type: mysqlEnum("channelType", ["dm", "group", "deal_room", "announcement"]).notNull(),
  name: varchar("channelName", { length: 500 }),
  description: text("channelDescription"),
  avatar: varchar("channelAvatar", { length: 1000 }),
  isPinned: boolean("channelIsPinned").default(false).notNull(),
  isArchived: boolean("channelIsArchived").default(false).notNull(),
  createdBy: int("channelCreatedBy").notNull().references(() => users.id),
  createdAt: timestamp("channelCreatedAt").defaultNow().notNull(),
  updatedAt: timestamp("channelUpdatedAt").defaultNow().onUpdateNow().notNull(),
  lastMessageAt: timestamp("channelLastMessageAt"),
}, (table) => ({
  orgIdx: index("channel_org_idx").on(table.orgId),
  typeIdx: index("channel_type_idx").on(table.type),
  createdByIdx: index("channel_created_by_idx").on(table.createdBy),
}));

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = typeof channels.$inferInsert;

/**
 * Channel members - who's in each channel
 */
export const channelMembers = mysqlTable("channel_members", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("cmChannelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: int("cmUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("cmRole", ["owner", "admin", "member", "guest"]).default("member").notNull(),
  isGuest: boolean("cmIsGuest").default(false).notNull(), // External party (not in org)
  joinedAt: timestamp("cmJoinedAt").defaultNow().notNull(),
  lastReadAt: timestamp("cmLastReadAt"), // For unread count calculation
  isMuted: boolean("cmIsMuted").default(false).notNull(),
}, (table) => ({
  channelUserIdx: uniqueIndex("cm_channel_user_idx").on(table.channelId, table.userId),
  channelIdx: index("cm_channel_idx").on(table.channelId),
  userIdx: index("cm_user_idx").on(table.userId),
}));

export type ChannelMember = typeof channelMembers.$inferSelect;
export type InsertChannelMember = typeof channelMembers.$inferInsert;

/**
 * Messages - all chat messages
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("msgChannelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: int("msgUserId").notNull().references(() => users.id),
  content: text("msgContent").notNull(),
  type: mysqlEnum("msgType", ["text", "file", "system", "call"]).default("text").notNull(),
  replyToId: int("msgReplyToId").references(() => messages.id), // For threaded replies
  linkedMeetingId: int("msgLinkedMeetingId").references(() => meetings.id),
  linkedContactId: int("msgLinkedContactId").references(() => contacts.id),
  linkedTaskId: int("msgLinkedTaskId").references(() => tasks.id),
  isPinned: boolean("msgIsPinned").default(false).notNull(),
  isEdited: boolean("msgIsEdited").default(false).notNull(),
  isDeleted: boolean("msgIsDeleted").default(false).notNull(),
  createdAt: timestamp("msgCreatedAt").defaultNow().notNull(),
  editedAt: timestamp("msgEditedAt"),
}, (table) => ({
  channelIdx: index("msg_channel_idx").on(table.channelId),
  userIdx: index("msg_user_idx").on(table.userId),
  createdAtIdx: index("msg_created_at_idx").on(table.createdAt),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Message reactions - emoji reactions on messages
 */
export const messageReactions = mysqlTable("message_reactions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("mrMessageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: int("mrUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("mrEmoji", { length: 50 }).notNull(),
  createdAt: timestamp("mrCreatedAt").defaultNow().notNull(),
}, (table) => ({
  messageUserEmojiIdx: uniqueIndex("mr_msg_user_emoji_idx").on(table.messageId, table.userId, table.emoji),
  messageIdx: index("mr_message_idx").on(table.messageId),
}));

export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertMessageReaction = typeof messageReactions.$inferInsert;

/**
 * Message attachments - files, images, videos
 */
export const messageAttachments = mysqlTable("message_attachments", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("maMessageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  fileUrl: varchar("maFileUrl", { length: 1000 }).notNull(),
  fileName: varchar("maFileName", { length: 500 }).notNull(),
  fileSize: int("maFileSize").notNull(), // bytes
  mimeType: varchar("maMimeType", { length: 100 }).notNull(),
  thumbnailUrl: varchar("maThumbnailUrl", { length: 1000 }),
  createdAt: timestamp("maCreatedAt").defaultNow().notNull(),
}, (table) => ({
  messageIdx: index("ma_message_idx").on(table.messageId),
}));

export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type InsertMessageAttachment = typeof messageAttachments.$inferInsert;

/**
 * User presence - online/away/offline status
 */
export const userPresence = mysqlTable("user_presence", {
  userId: int("upUserId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("upStatus", ["online", "away", "offline"]).default("offline").notNull(),
  lastSeenAt: timestamp("upLastSeenAt").defaultNow().notNull(),
});

export type UserPresence = typeof userPresence.$inferSelect;
export type InsertUserPresence = typeof userPresence.$inferInsert;

/**
 * Typing indicators - who's typing in which channel
 */
export const typingIndicators = mysqlTable("typing_indicators", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("tiChannelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: int("tiUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("tiStartedAt").defaultNow().notNull(),
}, (table) => ({
  channelUserIdx: uniqueIndex("ti_channel_user_idx").on(table.channelId, table.userId),
  channelIdx: index("ti_channel_idx").on(table.channelId),
}));

export type TypingIndicator = typeof typingIndicators.$inferSelect;
export type InsertTypingIndicator = typeof typingIndicators.$inferInsert;

/**
 * Call logs - voice/video call history
 */
export const callLogs = mysqlTable("call_logs", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("clChannelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
  initiatorId: int("clInitiatorId").notNull().references(() => users.id),
  type: mysqlEnum("clType", ["voice", "video"]).notNull(),
  status: mysqlEnum("clStatus", ["ringing", "ongoing", "ended", "missed", "declined"]).notNull(),
  startedAt: timestamp("clStartedAt").defaultNow().notNull(),
  endedAt: timestamp("clEndedAt"),
  duration: int("clDuration"), // in seconds
  recordingUrl: varchar("clRecordingUrl", { length: 1000 }), // S3 URL to call recording
  transcriptUrl: varchar("clTranscriptUrl", { length: 1000 }), // S3 URL to transcript
  meetingId: int("clMeetingId").references(() => meetings.id), // Link to auto-generated meeting
}, (table) => ({
  channelIdx: index("cl_channel_idx").on(table.channelId),
  initiatorIdx: index("cl_initiator_idx").on(table.initiatorId),
  startedAtIdx: index("cl_started_at_idx").on(table.startedAt),
}));

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

/**
 * Call participants - tracks who joined/left calls
 */
export const callParticipants = mysqlTable("call_participants", {
  id: int("id").autoincrement().primaryKey(),
  callId: int("cpCallId").notNull().references(() => callLogs.id, { onDelete: "cascade" }),
  userId: int("cpUserId").notNull().references(() => users.id),
  joinedAt: timestamp("cpJoinedAt").defaultNow().notNull(),
  leftAt: timestamp("cpLeftAt"),
  role: mysqlEnum("cpRole", ["host", "participant"]).default("participant").notNull(),
  audioEnabled: boolean("cpAudioEnabled").default(true).notNull(),
  videoEnabled: boolean("cpVideoEnabled").default(false).notNull(),
}, (table) => ({
  callIdx: index("cp_call_idx").on(table.callId),
  userIdx: index("cp_user_idx").on(table.userId),
}));

export type CallParticipant = typeof callParticipants.$inferSelect;
export type InsertCallParticipant = typeof callParticipants.$inferInsert;

/**
 * Channel invite links - for external parties to join deal rooms
 */
export const channelInvites = mysqlTable("channel_invites", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("ciChannelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
  token: varchar("ciToken", { length: 64 }).notNull().unique(),
  createdBy: int("ciCreatedBy").notNull().references(() => users.id),
  expiresAt: timestamp("ciExpiresAt"),
  maxUses: int("ciMaxUses"), // NULL = unlimited
  usedCount: int("ciUsedCount").default(0).notNull(),
  isActive: boolean("ciIsActive").default(true).notNull(),
  createdAt: timestamp("ciCreatedAt").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("ci_token_idx").on(table.token),
  channelIdx: index("ci_channel_idx").on(table.channelId),
}));

export type ChannelInvite = typeof channelInvites.$inferSelect;
export type InsertChannelInvite = typeof channelInvites.$inferInsert;

// Communications relations
export const channelsRelations = relations(channels, ({ one, many }) => ({
  creator: one(users, { fields: [channels.createdBy], references: [users.id] }),
  members: many(channelMembers),
  messages: many(messages),
  calls: many(callLogs),
  invites: many(channelInvites),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, { fields: [channelMembers.channelId], references: [channels.id] }),
  user: one(users, { fields: [channelMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  replyTo: one(messages, { fields: [messages.replyToId], references: [messages.id] }),
  linkedMeeting: one(meetings, { fields: [messages.linkedMeetingId], references: [meetings.id] }),
  linkedContact: one(contacts, { fields: [messages.linkedContactId], references: [contacts.id] }),
  linkedTask: one(tasks, { fields: [messages.linkedTaskId], references: [tasks.id] }),
  reactions: many(messageReactions),
  attachments: many(messageAttachments),
}));

export const callLogsRelations = relations(callLogs, ({ one, many }) => ({
  channel: one(channels, { fields: [callLogs.channelId], references: [channels.id] }),
  initiator: one(users, { fields: [callLogs.initiatorId], references: [users.id] }),
  meeting: one(meetings, { fields: [callLogs.meetingId], references: [meetings.id] }),
  participants: many(callParticipants),
}));
