import { Router } from "express";
import { validateIntelligenceData, processIntelligenceData } from "./ingestion";
import { isFathomWebhookPayload, processFathomWebhook } from "./fathomIntegration";
import { generateMeetingPDF } from "./pdfGenerator";

export const webhookRouter = Router();

/**
 * PDF download endpoint for meeting reports
 * GET /api/meeting/:id/pdf
 */
webhookRouter.get("/meeting/:id/pdf", async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    const pdfBuffer = await generateMeetingPDF(meetingId);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="omniscope-report-${meetingId}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("[PDF] Error generating PDF:", error);
    if (error instanceof Error && error.message === "Meeting not found") {
      return res.status(404).json({ error: "Meeting not found" });
    }
    return res.status(500).json({ error: "Failed to generate PDF" });
  }
});

/**
 * Webhook endpoint for Plaud integration (legacy)
 * Receives pre-processed intelligence data from Zapier/n8n
 */
webhookRouter.post("/webhook/plaud", async (req, res) => {
  try {
    console.log("[Webhook:Plaud] Received request:", JSON.stringify(req.body, null, 2).substring(0, 500));
    
    const data = validateIntelligenceData(req.body);
    
    if (!data) {
      console.error("[Webhook:Plaud] Invalid data format");
      return res.status(400).json({
        success: false,
        error: "Invalid intelligence data format"
      });
    }

    const result = await processIntelligenceData(data);
    
    console.log("[Webhook:Plaud] Successfully processed:", result);
    
    return res.status(200).json({
      success: true,
      meetingId: result.meetingId
    });
    
  } catch (error) {
    console.error("[Webhook:Plaud] Error processing request:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Webhook endpoint for Fathom integration
 * Receives raw Fathom meeting data, processes it through LLM analysis,
 * and ingests it into the OmniScope intelligence database
 */
webhookRouter.post("/webhook/fathom", async (req, res) => {
  try {
    console.log("[Webhook:Fathom] Received request for meeting:", req.body?.title || req.body?.meeting_title || "Unknown");

    // Validate it looks like a Fathom payload
    if (!isFathomWebhookPayload(req.body)) {
      console.error("[Webhook:Fathom] Invalid Fathom payload");
      return res.status(400).json({
        success: false,
        error: "Invalid Fathom webhook payload"
      });
    }

    // Process through the Fathom integration pipeline (LLM analysis + ingestion)
    const result = await processFathomWebhook(req.body);
    
    console.log("[Webhook:Fathom] Processing result:", result);
    
    return res.status(200).json({
      success: result.success,
      meetingId: result.meetingId,
      reason: result.reason,
    });
    
  } catch (error) {
    console.error("[Webhook:Fathom] Error processing request:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Universal webhook endpoint - auto-detects source
 * Tries Fathom first, falls back to standard intelligence data format
 */
webhookRouter.post("/webhook/ingest", async (req, res) => {
  try {
    console.log("[Webhook:Ingest] Received request");

    // Try Fathom format first
    if (isFathomWebhookPayload(req.body)) {
      console.log("[Webhook:Ingest] Detected Fathom payload, routing to Fathom handler");
      const result = await processFathomWebhook(req.body);
      return res.status(200).json({
        success: result.success,
        meetingId: result.meetingId,
        source: "fathom",
      });
    }

    // Fall back to standard intelligence data format
    const data = validateIntelligenceData(req.body);
    if (data) {
      console.log("[Webhook:Ingest] Detected standard intelligence data format");
      const result = await processIntelligenceData(data);
      return res.status(200).json({
        success: result.success,
        meetingId: result.meetingId,
        source: "standard",
      });
    }

    return res.status(400).json({
      success: false,
      error: "Unrecognized webhook payload format"
    });
    
  } catch (error) {
    console.error("[Webhook:Ingest] Error processing request:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Health check endpoint for webhook verification
 */
webhookRouter.get("/webhook/health", (_req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "OmniScope Intelligence Portal",
    webhooks: {
      plaud: "/api/webhook/plaud",
      fathom: "/api/webhook/fathom",
      universal: "/api/webhook/ingest",
    },
    timestamp: new Date().toISOString(),
  });
});
