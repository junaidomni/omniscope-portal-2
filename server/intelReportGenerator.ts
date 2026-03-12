import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import { storagePut } from './storage';

interface IntelReportData {
  meetingTitle: string;
  meetingDate: Date;
  executiveSummary: string;
  fullTranscript?: string;
  sourceType: string;
  sourceId: string;
}

/**
 * Generate an Intel Report PDF from meeting data
 * Returns the S3 URL of the generated PDF
 */
export async function generateIntelReport(data: IntelReportData): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  
  // Set document metadata
  pdfDoc.setTitle(`Intel Report - ${data.meetingTitle}`);
  pdfDoc.setAuthor('OmniScope Intelligence Portal');
  pdfDoc.setCreationDate(new Date());

  // Add first page with report header
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();
  
  // Header with OmniScope branding
  page.drawText('OMNISCOPE INTELLIGENCE PORTAL', {
    x: 50,
    y: height - 50,
    size: 24,
    color: rgb(0.15, 0.15, 0.15), // Dark charcoal
    font: await pdfDoc.embedFont('Helvetica-Bold'),
  });

  page.drawText('Intel Report', {
    x: 50,
    y: height - 80,
    size: 18,
    color: rgb(0.8, 0.65, 0.2), // Gold accent
    font: await pdfDoc.embedFont('Helvetica-Bold'),
  });

  // Horizontal line
  page.drawLine({
    start: { x: 50, y: height - 95 },
    end: { x: width - 50, y: height - 95 },
    thickness: 2,
    color: rgb(0.8, 0.65, 0.2), // Gold
  });

  // Report metadata
  let yPosition = height - 130;
  const lineHeight = 20;
  const labelFont = await pdfDoc.embedFont('Helvetica-Bold');
  const contentFont = await pdfDoc.embedFont('Helvetica');

  // Meeting Title
  page.drawText('Meeting Title:', {
    x: 50,
    y: yPosition,
    size: 11,
    color: rgb(0.8, 0.65, 0.2), // Gold
    font: labelFont,
  });
  page.drawText(data.meetingTitle, {
    x: 150,
    y: yPosition,
    size: 11,
    color: rgb(0.15, 0.15, 0.15),
    font: contentFont,
  });
  yPosition -= lineHeight;

  // Meeting Date
  page.drawText('Date:', {
    x: 50,
    y: yPosition,
    size: 11,
    color: rgb(0.8, 0.65, 0.2),
    font: labelFont,
  });
  page.drawText(data.meetingDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }), {
    x: 150,
    y: yPosition,
    size: 11,
    color: rgb(0.15, 0.15, 0.15),
    font: contentFont,
  });
  yPosition -= lineHeight;

  // Source
  page.drawText('Source:', {
    x: 50,
    y: yPosition,
    size: 11,
    color: rgb(0.8, 0.65, 0.2),
    font: labelFont,
  });
  page.drawText(data.sourceType.charAt(0).toUpperCase() + data.sourceType.slice(1), {
    x: 150,
    y: yPosition,
    size: 11,
    color: rgb(0.15, 0.15, 0.15),
    font: contentFont,
  });
  yPosition -= lineHeight * 2;

  // Executive Summary Section
  page.drawText('Executive Summary', {
    x: 50,
    y: yPosition,
    size: 14,
    color: rgb(0.8, 0.65, 0.2),
    font: labelFont,
  });
  yPosition -= lineHeight;

  // Draw summary text with word wrapping
  const summaryLines = wrapText(data.executiveSummary, 100);
  for (const line of summaryLines) {
    if (yPosition < 100) {
      // Add new page if running out of space
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }
    page.drawText(line, {
      x: 50,
      y: yPosition,
      size: 10,
      color: rgb(0.15, 0.15, 0.15),
      font: contentFont,
    });
    yPosition -= lineHeight;
  }

  // Full Transcript Section (if provided)
  if (data.fullTranscript) {
    yPosition -= lineHeight;
    
    if (yPosition < 150) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }

    page.drawText('Full Transcript', {
      x: 50,
      y: yPosition,
      size: 14,
      color: rgb(0.8, 0.65, 0.2),
      font: labelFont,
    });
    yPosition -= lineHeight;

    const transcriptLines = wrapText(data.fullTranscript, 100);
    for (const line of transcriptLines) {
      if (yPosition < 50) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
      }
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 9,
        color: rgb(0.3, 0.3, 0.3),
        font: contentFont,
      });
      yPosition -= 16;
    }
  }

  // Footer on last page
  page.drawText(`Generated: ${new Date().toLocaleString('en-US')} | OmniScope Intelligence Portal`, {
    x: 50,
    y: 30,
    size: 8,
    color: rgb(0.6, 0.6, 0.6),
    font: contentFont,
  });

  // Save PDF to bytes
  const pdfBytes = await pdfDoc.save();

  // Upload to S3
  const fileName = `intel-reports/${data.sourceId}-${Date.now()}.pdf`;
  const { url } = await storagePut(fileName, pdfBytes, 'application/pdf');

  return url;
}

/**
 * Wrap text to fit within a specified character width
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }

  if (currentLine) lines.push(currentLine.trim());
  return lines;
}
