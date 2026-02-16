import * as db from "./db";
import { storagePut } from "./storage";

/**
 * Generate an OmniScope-branded Markdown report from meeting data
 */
export async function generateBrandedReport(meetingId: number): Promise<string> {
  const meeting = await db.getMeetingById(meetingId);
  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const participants = JSON.parse(meeting.participants || '[]');
  const organizations = JSON.parse(meeting.organizations || '[]');
  const jurisdictions = JSON.parse(meeting.jurisdictions || '[]');
  const highlights = JSON.parse(meeting.strategicHighlights || '[]');
  const opportunities = JSON.parse(meeting.opportunities || '[]');
  const risks = JSON.parse(meeting.risks || '[]');
  const keyQuotes = JSON.parse(meeting.keyQuotes || '[]');

  // Get tasks for this meeting
  const tasks = await db.getTasksForMeeting(meetingId);
  
  const meetingDate = new Date(meeting.meetingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate branded Markdown report
  const markdown = `
# OMNISCOPE
**ALL MARKETS. ONE SCOPE.**

---

## INTELLIGENCE REPORT

# ${organizations.length > 0 ? organizations.join(', ') : 'Meeting Report'}

---

## Meeting Information

- **Date:** ${meetingDate}
- **Location:** [Insert Location]
- **Participants:** ${participants.join(', ')}
- **Primary Lead:** ${meeting.primaryLead}
${organizations.length > 0 ? `- **Organizations:** ${organizations.join(', ')}` : ''}
${jurisdictions.length > 0 ? `- **Jurisdictions:** ${jurisdictions.join(', ')}` : ''}
- **Source:** ${meeting.sourceType}

---

## Executive Summary

${meeting.executiveSummary}

---

${highlights.length > 0 ? `
## Meeting Highlights

${highlights.map((h: string) => `- ${h}`).join('\n')}

---
` : ''}

${tasks.length > 0 ? `
## Next Arrangements / Action Items

${tasks.map((t) => `- [ ] **${t.title}**${t.assignedTo ? ` (Assigned to: ${t.assignedTo})` : ''}${t.description ? `\n  - ${t.description}` : ''}`).join('\n')}

---
` : ''}

${opportunities.length > 0 ? `
## Opportunities Identified

${opportunities.map((o: string) => `- ${o}`).join('\n')}

---
` : ''}

${risks.length > 0 ? `
## Risks & Considerations

${risks.map((r: string) => `- ${r}`).join('\n')}

---
` : ''}

${keyQuotes.length > 0 ? `
## Key Quotes

${keyQuotes.map((q: string) => `> "${q}"`).join('\n\n')}

---
` : ''}

${meeting.fullTranscript ? `
## Full Transcript

${meeting.fullTranscript}

---
` : ''}

---

**Report Generated:** ${new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}

**omniscopex.ae** | Confidential & Proprietary
`;

  return markdown.trim();
}

/**
 * Generate and upload branded report to S3, return URL
 */
export async function generateAndUploadBrandedReport(meetingId: number): Promise<string> {
  const markdown = await generateBrandedReport(meetingId);
  
  // Create filename with meeting ID and date
  const meeting = await db.getMeetingById(meetingId);
  if (!meeting) {
    throw new Error("Meeting not found");
  }
  
  const dateStr = new Date(meeting.meetingDate).toISOString().split('T')[0];
  const filename = `omniscope-report-${dateStr}-${meetingId}.md`;
  
  // Upload to S3
  const { url } = await storagePut(
    `intelligence-reports/${filename}`,
    Buffer.from(markdown, 'utf-8'),
    'text/markdown'
  );
  
  console.log(`[BrandedReport] Generated report for meeting ${meetingId}: ${url}`);
  
  return url;
}
