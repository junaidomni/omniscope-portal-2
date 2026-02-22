# OmniScope Intelligence Portal — Platform Capabilities

**Confidential — Internal Reference Document**
Prepared for OmniScope Leadership | February 2026

---

## 1. Platform Overview

The OmniScope Intelligence Portal is a sovereign-grade, multi-tenant operational platform designed for institutional environments where discretion, compliance, and execution precision are non-negotiable. It serves as the central nervous system for organizations managing high-value relationships, complex transactions, and sensitive communications across multiple jurisdictions.

The platform operates on a five-tier access architecture, ensuring that every user — from a newly invited team member to the platform owner — sees only what they need, controls only what they should, and leaves an auditable trail of every action taken.

At its core, the portal consolidates five operational domains into a single, unified workspace: **Command Center**, **Intelligence**, **Communications**, **Operations**, and **Relationships**. Each domain is purpose-built for institutional workflows, with AI-powered analysis, automated reporting, and cross-domain data synthesis that transforms raw activity into actionable intelligence.

### Key Platform Metrics

| Metric | Value |
|---|---|
| Database Tables | 49 |
| Backend Procedures | 250+ |
| Frontend Pages | 57+ |
| Workspace Domains | 5 |
| Admin Hub Pages | 14+ |
| Vitest Test Cases | 1,183 |

---

## 2. Access Levels & Permissions

The platform enforces a strict, hierarchical access model. Each tier inherits all capabilities of the tiers below it, with additional privileges layered on top. This design ensures data isolation between organizations while enabling cross-organizational oversight for those who need it.

### Tier 1: Public (Unauthenticated)

Public visitors see only the login page. No data, no navigation, no workspace access. Authentication is handled exclusively through Manus OAuth 2.0 with session-based cookies, ensuring that credentials never touch the platform directly.

### Tier 2: Invited User (Role: User)

Invited users are the standard operational tier. They receive full workspace access within their assigned organization, including all five domains. They can create and manage meetings, tasks, contacts, companies, documents, and communications. They can use the AI assistant ("Ask Omni") for natural-language queries across their organizational data. They cannot access other organizations, the admin panel, or the platform command center.

### Tier 3: Admin (Role: Admin)

Admins inherit all user capabilities and gain access to the **Admin Panel**, which provides cross-organizational user management, activity log review, and data deduplication tools. Admins can manage team members, review audit trails, and configure organization-level settings. They see the "Admin" link in the sidebar navigation.

### Tier 4: Account Owner

Account owners manage the **Account Console** — a dedicated management layer that sits above individual organizations. From here, they oversee all organizations under their account, manage billing and subscriptions, monitor usage against plan limits, review team composition across organizations, and configure account-level security policies. The Account Console has seven tabs: Overview, Organizations, Team, Billing, Usage, Security, and Settings.

### Tier 5: Platform Owner

Platform owners have the highest level of access. They see everything. The **Platform Command Center** (admin-hub) provides a god-view across all accounts, all organizations, all users, and all activity on the platform. Platform owners can provision new accounts, grant or revoke platform owner access to other users, manage subscriptions and plans, review revenue metrics, and monitor platform health. They see the "Platform" link (with a Crown icon) in the sidebar navigation.

### Access Level Comparison

| Capability | User | Admin | Account Owner | Platform Owner |
|---|:---:|:---:|:---:|:---:|
| Workspace (5 domains) | Yes | Yes | Yes | Yes |
| Ask Omni AI Assistant | Yes | Yes | Yes | Yes |
| HR Hub | Yes | Yes | Yes | Yes |
| Settings & Integrations | Yes | Yes | Yes | Yes |
| Admin Panel (users, audit, dedup) | — | Yes | Yes | Yes |
| Account Console (orgs, billing, team) | — | — | Yes | Yes |
| Platform Command Center | — | — | — | Yes |
| Provision New Accounts | — | — | — | Yes |
| Grant/Revoke Platform Access | — | — | — | Yes |
| Revenue Dashboard | — | — | — | Yes |
| Cross-Account Data Access | — | — | — | Yes |

---

## 3. Workspace Domains

### 3.1 Command Center

The Command Center is the operational dashboard — the first thing users see when they log in. It provides a real-time snapshot of organizational activity with AI-generated daily and weekly intelligence reports.

**Daily Reports** synthesize all meetings, tasks, and communications from the past 24 hours into a structured briefing. Each report includes meeting summaries with participant details, action items extracted from conversations, sector and jurisdiction breakdowns, and priority flags for items requiring immediate attention.

**Weekly Reports** aggregate seven days of activity into trend analysis, showing meeting volume patterns, task completion rates, relationship engagement metrics, and strategic recommendations. Both report types are exportable as branded OmniScope documents for client distribution.

The Command Center also surfaces the **Activity Feed** — a chronological stream of all organizational actions — and provides quick-access cards for upcoming meetings, overdue tasks, and pending communications.

### 3.2 Intelligence

The Intelligence domain is the analytical core of the platform. It manages the full lifecycle of meetings — from scheduling through transcription to insight extraction.

**Meetings** are the primary data unit. Each meeting record captures participants, organizations involved, transcript content, AI-generated summaries, action items, tags, categories, and linked contacts. Meetings can be uploaded via transcript files (Plaud, Fathom, and other sources), with the platform automatically extracting structured data from unstructured conversation records.

**The Vault** provides secure document storage with folder organization, access controls, entity linking (documents can be linked to contacts, companies, or meetings), favorites, and template management. Documents support signing workflows through integrated signing providers.

**Pipeline** tracks deal flow and opportunity progression, giving teams visibility into active engagements and their current status.

**Templates** allow teams to create reusable document structures for recurring workflows — engagement letters, compliance checklists, meeting agendas, and report formats.

### 3.3 Communications

The Communications domain handles all email and calendar operations within the platform.

**Mail** provides a full email client with threading, starring, entity linking (emails are automatically associated with contacts and companies), and AI-powered thread summarization. Mail Analytics surfaces engagement patterns — response times, communication frequency by contact, and thread resolution rates.

**Calendar** integrates with external calendar providers (Google Calendar) to display upcoming events, sync meeting schedules, and provide scheduling context alongside relationship data.

### 3.4 Operations

The Operations domain manages task execution across the organization.

**Tasks** are created manually, extracted from meeting transcripts by AI, or generated from workflow triggers. Each task has assignees, due dates, priority levels, status tracking, and organizational context. Tasks can be linked to meetings, contacts, and companies, creating a complete audit trail from conversation to completion.

The task system supports filtering by status, priority, assignee, and date range, with bulk operations for team leads managing multiple workstreams.

### 3.5 Relationships

The Relationships domain is the CRM layer of the platform, managing the people and organizations that matter to the business.

**Contacts** are enriched profiles that aggregate all interactions — meetings attended, emails exchanged, tasks assigned, documents shared. Contact records include aliases (for matching across different data sources), notes, linked documents, and interaction history. The system supports automatic contact suggestion from meeting transcripts and email parsing.

**Companies** are organizational entities that group contacts and track corporate-level relationships. Company records include industry classification, jurisdiction, linked contacts, and aggregated engagement metrics.

**Pending Review** surfaces AI-suggested contacts and companies that have been detected in communications or meetings but not yet confirmed by a user, ensuring the CRM stays current without manual data entry.

---

## 4. Platform Administration

### 4.1 Account Console (Account Owners)

The Account Console provides account-level management across seven tabs:

**Overview** displays the account health score (0–100), organization count, team member count, monthly cost, and plan status at a glance. It lists all organizations under the account with member counts and quick-access links.

**Organizations** allows account owners to view all their organizations, create new ones, and manage organizational settings. Each organization card shows member count, status, and industry classification.

**Team** aggregates all users across all organizations, showing their roles, organization memberships, and activity status. This provides a single view of the entire human footprint under the account.

**Billing** displays the current subscription plan, billing cycle, and payment history. It shows the plan tier (Starter, Professional, Enterprise, or Sovereign) with associated limits and pricing.

**Usage** tracks resource consumption against plan limits — contacts created, meetings recorded, tasks tracked, documents stored, and organizations provisioned. Usage is broken down by organization for granular visibility.

**Security** shows authentication method, session status, login event count, and a detailed login history table with timestamps, device information, IP addresses, authentication methods, and success/failure status. Session policy information (timeout, MFA, concurrent sessions) is also displayed.

**Settings** allows account owners to update account name and billing email.

### 4.2 Platform Command Center (Platform Owners)

The Platform Command Center is the god-view. It provides cross-account, cross-organization visibility and control through 14+ pages organized into four sections:

**Overview Section:**
- **Dashboard** — Aggregated metrics: total organizations, team members, meetings, tasks, contacts, companies, integrations, and feature flags. Shows recent activity volume and platform health indicators.
- **Organizations** — Master list of all organizations with member counts, status, industry, and drill-down to organization detail views.
- **Accounts** — Master list of all accounts with owner information, plan tier, MRR, health score, organization count, and status. Searchable and filterable by plan and status. Includes "Provision Account" flow for onboarding new clients.
- **Account Detail** — Full drill-down into any account with editable MRR and health score, four tabs (Overview, Organizations, Usage, Billing History), and account controls (change plan, suspend, activate).

**People Section:**
- **Team Members** — All users across the platform with their organization memberships, roles, and activity status.
- **Roles & Permissions** — Role hierarchy visualization and active user management with role assignment.
- **Super-Admins** — Dedicated page for managing platform owner access. Lists all current platform owners, provides a searchable user list for granting access, and includes confirmation dialogs with audit logging for every grant/revoke action.

**Platform Section:**
- **Integrations & API Keys** — All configured integrations with status, sync timestamps, and enable/disable controls.
- **Feature Flags** — Global feature toggle management with plan-gating (features can be restricted to specific plan tiers).
- **Platform Settings** — Global configuration including design preferences and platform-wide settings.

**Governance Section:**
- **Audit Log** — Complete activity trail across all organizations with filtering by action type and entity type.
- **Analytics** — Platform-wide analytics with meeting volume trends, task completion rates, and engagement metrics.
- **Health** — Real-time platform health monitoring showing entity counts, integration status, and system timestamps.
- **Billing** — Subscription management, plan assignment, and billing event history.
- **Revenue** — MRR/ARR metrics, MRR breakdown by plan tier with visual bars, subscription status distribution, billing cycle analysis, and recent billing events.

---

## 5. AI & Automation Capabilities

### Ask Omni (AI Assistant)

The "Ask Omni" feature provides natural-language search and analysis across all organizational data. Users can ask questions like "What did we discuss with Company X last month?" or "Show me all action items from this week's meetings" and receive structured, contextual responses drawn from meetings, contacts, tasks, and communications.

### Automated Intelligence Reports

The platform generates two types of automated reports:

**Daily Intelligence Briefings** compile all meetings, tasks, and communications from the past 24 hours into a structured document. Each briefing includes full meeting details with participant lists, AI-extracted action items, sector and jurisdiction breakdowns, and priority flags.

**Weekly Intelligence Summaries** aggregate seven days of activity into trend analysis with daily breakdowns, meeting volume patterns, task completion metrics, and strategic recommendations.

Both report types are exportable as branded OmniScope documents, ready for client distribution without additional formatting.

### AI-Powered Data Extraction

Meeting transcripts uploaded to the platform are automatically processed to extract:
- Participant names and organizations
- Action items and task assignments
- Key topics and discussion themes
- Contact suggestions for CRM enrichment
- Company references for relationship mapping

### Pending Suggestions

The system continuously analyzes communications and meetings to suggest new contacts and companies that should be added to the CRM. These suggestions appear in the "Pending Review" section, where users can confirm, modify, or dismiss them.

---

## 6. How OmniScope Helps Organizations

### For Institutional Teams

OmniScope eliminates the fragmentation that plagues institutional operations. Instead of switching between email clients, CRM systems, task managers, calendar apps, and document repositories, teams work within a single platform where every interaction is connected. A meeting with a client automatically creates contact records, generates tasks, links to relevant documents, and appears in the relationship timeline — all without manual data entry.

### For Compliance & Governance

Every action on the platform is logged. The audit trail captures who did what, when, and in which organizational context. For regulated industries — financial services, legal, government — this provides the documentation backbone that compliance teams require. Platform owners can review activity across all organizations, ensuring that governance standards are maintained at scale.

### For Leadership & Decision-Making

The Command Center's daily and weekly reports transform raw operational data into executive intelligence. Leaders don't need to attend every meeting or read every email — the platform synthesizes activity into briefings that highlight what matters, what's overdue, and what needs attention. The Revenue Dashboard gives platform owners real-time visibility into business metrics without waiting for monthly reports.

### For Multi-Organization Operations

Organizations that manage multiple entities — holding companies, consulting firms, family offices — benefit from the Account Console's cross-organizational view. A single account owner can oversee all their organizations, manage team composition across entities, and monitor usage against plan limits from one interface.

### For Scaling Operations

The platform's multi-tenant architecture means that adding a new organization, onboarding a new team, or provisioning a new account is a matter of minutes, not weeks. The Account Provisioning flow in the Platform Command Center allows platform owners to create new accounts with pre-configured plans, generate invite links, and notify new users — all from a single dialog.

---

*This document reflects the current state of the OmniScope Intelligence Portal as of February 2026. Features and capabilities are subject to ongoing development and enhancement.*
