import { jsPDF } from "jspdf";
import * as db from "./db";

// OmniScope brand colors
const COLORS = {
  black: "#0a0a0a",
  darkGray: "#18181b",
  medGray: "#27272a",
  lightGray: "#52525b",
  text: "#27272a",
  white: "#18181b",
  gold: "#ca8a04",
  green: "#22c55e",
  red: "#ef4444",
};

function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/**
 * Generate a branded OmniScope PDF report for a meeting
 */
export async function generateMeetingPDF(meetingId: number): Promise<Buffer> {
  const meeting = await db.getMeetingById(meetingId);
  if (!meeting) throw new Error("Meeting not found");

  const participants = JSON.parse(meeting.participants || "[]");
  const organizations = JSON.parse(meeting.organizations || "[]");
  const highlights = JSON.parse(meeting.strategicHighlights || "[]");
  const opportunities = JSON.parse(meeting.opportunities || "[]");
  const risks = JSON.parse(meeting.risks || "[]");
  const keyQuotes = JSON.parse(meeting.keyQuotes || "[]");
  const tasks = await db.getTasksForMeeting(meetingId);

  const displayTitle = meeting.meetingTitle || (organizations.length > 0 ? organizations.join(", ") : "Meeting Report");
  const meetingDate = new Date(meeting.meetingDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const meetingTime = new Date(meeting.meetingDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Helper: check if we need a new page
  function checkPage(needed: number) {
    if (y + needed > pageHeight - 25) {
      addFooter();
      doc.addPage();
      y = 20;
    }
  }

  // Helper: add footer to current page
  function addFooter() {
    doc.setFontSize(8);
    doc.setTextColor(...hexToRGB(COLORS.lightGray));
    doc.text("OmniScope Intelligence Portal  |  omniscopex.ae  |  Confidential & Proprietary", pageWidth / 2, pageHeight - 10, { align: "center" });
    const pageNum = doc.getNumberOfPages();
    doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  // Helper: draw a horizontal rule
  function drawHR() {
    doc.setDrawColor(...hexToRGB(COLORS.medGray));
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  // Helper: section heading
  function sectionHeading(title: string, color: string = COLORS.gold) {
    checkPage(15);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hexToRGB(color));
    doc.text(title, margin, y);
    y += 7;
  }

  // Helper: body text with word wrap
  function bodyText(text: string, indent: number = 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...hexToRGB(COLORS.text));
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, margin + indent, y);
      y += 5;
    }
    y += 2;
  }

  // Helper: bullet point
  function bulletPoint(text: string, bulletColor: string = COLORS.gold) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, contentWidth - 8);
    checkPage(lines.length * 5 + 2);
    
    // Draw bullet
    doc.setFillColor(...hexToRGB(bulletColor));
    doc.circle(margin + 2, y - 1.2, 1, "F");
    
    doc.setTextColor(...hexToRGB(COLORS.text));
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], margin + 8, y);
      y += 5;
    }
    y += 1;
  }

  // =========================================================================
  // PAGE 1: HEADER
  // =========================================================================

  // Dark header background
  doc.setFillColor(...hexToRGB(COLORS.darkGray));
  doc.rect(0, 0, pageWidth, 65, "F");

  // Gold accent line at top
  doc.setFillColor(...hexToRGB(COLORS.gold));
  doc.rect(0, 0, pageWidth, 2, "F");

  // OmniScope branding
  y = 18;
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255); // Always white on dark header
  doc.text("OMNISCOPE", margin, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hexToRGB(COLORS.gold));
  doc.text("ALL MARKETS. ONE SCOPE.", margin, y + 6);

  // Intelligence Report badge
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hexToRGB(COLORS.gold));
  doc.text("INTELLIGENCE REPORT", pageWidth - margin, y, { align: "right" });

  // Gold accent line below header
  doc.setFillColor(...hexToRGB(COLORS.gold));
  doc.rect(0, 63, pageWidth, 0.5, "F");

  // =========================================================================
  // MEETING TITLE & META
  // =========================================================================
  y = 78;

  // Meeting title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(10, 10, 10); // Near-black for title on white bg
  const titleLines = doc.splitTextToSize(displayTitle, contentWidth);
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 8;
  }
  y += 2;

  // Participants
  if (participants.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...hexToRGB(COLORS.gold));
    doc.text(participants.join(", "), margin, y);
    y += 6;
  }

  // Meta info
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hexToRGB(COLORS.lightGray));
  const metaParts = [meetingDate, meetingTime];
  if (meeting.primaryLead) metaParts.push(`Lead: ${meeting.primaryLead}`);
  if (organizations.length > 0) metaParts.push(`Org: ${organizations.join(", ")}`);
  doc.text(metaParts.join("  |  "), margin, y);
  y += 10;

  drawHR();
  y += 4;

  // =========================================================================
  // EXECUTIVE SUMMARY
  // =========================================================================
  sectionHeading("Executive Summary");
  if (meeting.executiveSummary) {
    bodyText(meeting.executiveSummary);
  }
  y += 4;

  // =========================================================================
  // STRATEGIC HIGHLIGHTS
  // =========================================================================
  if (highlights.length > 0) {
    sectionHeading("Strategic Highlights");
    for (const h of highlights) {
      bulletPoint(h, COLORS.gold);
    }
    y += 4;
  }

  // =========================================================================
  // OPPORTUNITIES & RISKS
  // =========================================================================
  if (opportunities.length > 0) {
    sectionHeading("Opportunities", COLORS.green);
    for (const o of opportunities) {
      bulletPoint(o, COLORS.green);
    }
    y += 4;
  }

  if (risks.length > 0) {
    sectionHeading("Risks & Red Flags", COLORS.red);
    for (const r of risks) {
      bulletPoint(r, COLORS.red);
    }
    y += 4;
  }

  // =========================================================================
  // KEY QUOTES
  // =========================================================================
  if (keyQuotes.length > 0) {
    sectionHeading("Key Quotes");
    for (const q of keyQuotes) {
      checkPage(15);
      // Quote background
      const quoteLines = doc.splitTextToSize(`"${q}"`, contentWidth - 16);
      const quoteHeight = quoteLines.length * 5 + 6;
      doc.setFillColor(...hexToRGB("#1c1c20"));
      doc.roundedRect(margin, y - 3, contentWidth, quoteHeight, 2, 2, "F");
      // Gold left border
      doc.setFillColor(...hexToRGB(COLORS.gold));
      doc.rect(margin, y - 3, 2, quoteHeight, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100); // Medium gray for readability on dark quote bg
      for (const line of quoteLines) {
        doc.text(line, margin + 8, y + 2);
        y += 5;
      }
      y += 6;
    }
    y += 4;
  }

  // =========================================================================
  // ACTION ITEMS
  // =========================================================================
  if (tasks.length > 0) {
    sectionHeading("Action Items");
    for (const task of tasks) {
      const priorityColor = task.priority === "high" ? COLORS.red : task.priority === "medium" ? COLORS.gold : COLORS.lightGray;

      // Priority badge text
      const badgeText = `[${(task.priority || "normal").toUpperCase()}]`;

      // Wrap task title
      const taskTitleLines = doc.splitTextToSize(task.title, contentWidth - 12);
      checkPage(taskTitleLines.length * 5 + 12);

      // Priority dot
      doc.setFillColor(...hexToRGB(priorityColor));
      doc.circle(margin + 2, y - 1.2, 1.2, "F");

      // Task title (wrapped)
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 10, 10); // Near-black for task titles
      for (let i = 0; i < taskTitleLines.length; i++) {
        doc.text(taskTitleLines[i], margin + 8, y);
        // Add priority badge after first line
        if (i === 0) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...hexToRGB(priorityColor));
          const lineWidth = doc.getTextWidth(taskTitleLines[i]);
          if (lineWidth + 20 < contentWidth - 12) {
            doc.text(badgeText, margin + 8 + lineWidth + 3, y);
          }
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(10, 10, 10);
        }
        y += 5;
      }

      // Description
      if (task.description) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...hexToRGB(COLORS.lightGray));
        const descLines = doc.splitTextToSize(task.description, contentWidth - 8);
        for (const line of descLines) {
          checkPage(4);
          doc.text(line, margin + 8, y);
          y += 4;
        }
      }

      // Due date & assignee
      const metaParts: string[] = [];
      if (task.dueDate) metaParts.push(`Due: ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
      if (task.assignedTo) metaParts.push(`Assigned: ${task.assignedTo}`);
      if (task.status) metaParts.push(`Status: ${task.status.replace("_", " ")}`);
      if (metaParts.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(...hexToRGB(COLORS.lightGray));
        doc.text(metaParts.join("  |  "), margin + 8, y + 1);
        y += 5;
      }

      y += 3;
    }
    y += 4;
  }

  // =========================================================================
  // JURISDICTIONS
  // =========================================================================
  const jurisdictions = JSON.parse(meeting.jurisdictions || "[]");
  if (jurisdictions.length > 0) {
    sectionHeading("Jurisdictions");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...hexToRGB(COLORS.text));
    doc.text(jurisdictions.join("  |  "), margin, y);
    y += 8;
  }

  // =========================================================================
  // FOOTER on last page
  // =========================================================================
  addFooter();

  // Gold accent line at bottom
  doc.setFillColor(...hexToRGB(COLORS.gold));
  doc.rect(0, pageHeight - 3, pageWidth, 0.5, "F");

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
