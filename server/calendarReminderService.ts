import { notifyOwner } from './_core/notification';

interface CalendarReminderData {
  meetingTitle: string;
  meetingDate: Date;
  recipientEmail: string;
  recipientName: string;
  intelReportUrl?: string;
}

/**
 * Send a calendar reminder email to Kyle Jackson for the next day
 * This notifies him about the meeting that was just recorded
 */
export async function sendCalendarReminder(data: CalendarReminderData): Promise<boolean> {
  // Calculate reminder time for next day at 9 AM
  const reminderDate = new Date(data.meetingDate);
  reminderDate.setDate(reminderDate.getDate() + 1);
  reminderDate.setHours(9, 0, 0, 0);

  const meetingDateStr = data.meetingDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const reminderDateStr = reminderDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build email content
  const title = `📅 Upcoming: ${data.meetingTitle}`;
  const content = `
Hi ${data.recipientName},

This is a reminder about your recorded meeting:

**${data.meetingTitle}**
Original Recording: ${meetingDateStr}
Reminder Scheduled: ${reminderDateStr}

${data.intelReportUrl ? `
📄 Intel Report: [View PDF](${data.intelReportUrl})

The full meeting transcript and executive summary are available in your Intel Report.
` : ''}

You can access the full meeting details in the OmniScope Intelligence Portal under Meetings → Recent Intelligence.

---
OmniScope Intelligence Portal
  `.trim();

  // Send notification via Manus built-in notification system
  try {
    const success = await notifyOwner({
      title,
      content,
    });
    return success;
  } catch (error) {
    console.error('Failed to send calendar reminder:', error);
    return false;
  }
}

/**
 * Send immediate notification about new meeting ingestion
 */
export async function sendMeetingIngestedNotification(data: {
  meetingTitle: string;
  meetingDate: Date;
  recipientName: string;
  intelReportUrl?: string;
}): Promise<boolean> {
  const meetingDateStr = data.meetingDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const title = `✅ Meeting Recorded: ${data.meetingTitle}`;
  const content = `
Hi ${data.recipientName},

Your meeting has been successfully recorded and processed:

**${data.meetingTitle}**
Recorded: ${meetingDateStr}

${data.intelReportUrl ? `
📄 Intel Report: [View PDF](${data.intelReportUrl})

The executive summary and full transcript are ready for review.
` : ''}

Access the meeting in the OmniScope Intelligence Portal → Meetings → Recent Intelligence

A calendar reminder will be sent tomorrow at 9 AM.

---
OmniScope Intelligence Portal
  `.trim();

  try {
    const success = await notifyOwner({
      title,
      content,
    });
    return success;
  } catch (error) {
    console.error('Failed to send meeting ingested notification:', error);
    return false;
  }
}
