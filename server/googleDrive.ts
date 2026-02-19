/**
 * Google Drive / Docs / Sheets Service
 * Provides authenticated clients and operations for the Intelligence Vault.
 */
import { google, drive_v3, docs_v1, sheets_v4 } from "googleapis";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { googleTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// OAUTH2 CLIENT FACTORY
// ============================================================================

function getOAuth2Client() {
  return new google.auth.OAuth2(
    ENV.googleClientId,
    ENV.googleClientSecret,
  );
}

/**
 * Get an authenticated OAuth2 client for a user (reusable across Drive/Docs/Sheets)
 */
async function getAuthClient(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const tokens = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  if (tokens.length === 0) return null;

  const token = tokens[0];
  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    token_type: token.tokenType,
    expiry_date: token.expiresAt ? token.expiresAt.getTime() : undefined,
  });

  // Auto-refresh: persist new tokens
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const updates: any = {};
      if (newTokens.access_token) updates.accessToken = newTokens.access_token;
      if (newTokens.refresh_token) updates.refreshToken = newTokens.refresh_token;
      if (newTokens.expiry_date) updates.expiresAt = new Date(newTokens.expiry_date);
      if (Object.keys(updates).length > 0) {
        await db.update(googleTokens).set(updates).where(eq(googleTokens.id, token.id));
        console.log(`[Google] Tokens refreshed for user ${userId}`);
      }
    } catch (err) {
      console.error("[Google] Failed to save refreshed tokens:", err);
    }
  });

  return oauth2Client;
}

// ============================================================================
// DRIVE CLIENT
// ============================================================================

export async function getDriveClient(userId: number): Promise<drive_v3.Drive | null> {
  const auth = await getAuthClient(userId);
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}

// ============================================================================
// DOCS CLIENT
// ============================================================================

export async function getDocsClient(userId: number): Promise<docs_v1.Docs | null> {
  const auth = await getAuthClient(userId);
  if (!auth) return null;
  return google.docs({ version: "v1", auth });
}

// ============================================================================
// SHEETS CLIENT
// ============================================================================

export async function getSheetsClient(userId: number): Promise<sheets_v4.Sheets | null> {
  const auth = await getAuthClient(userId);
  if (!auth) return null;
  return google.sheets({ version: "v4", auth });
}

// ============================================================================
// DRIVE OPERATIONS
// ============================================================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  shared?: boolean;
  owners?: { displayName: string; emailAddress: string }[];
}

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime: string;
  parents?: string[];
}

/**
 * List files in a Drive folder (or root)
 */
export async function listDriveFiles(
  userId: number,
  folderId?: string,
  pageToken?: string,
  pageSize: number = 50,
  query?: string,
  driveId?: string,
): Promise<{ files: DriveFile[]; nextPageToken?: string } | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    let q = "trashed = false";
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }
    if (query) {
      q += ` and (name contains '${query.replace(/'/g, "\\'")}')`;
    }

    const listParams: any = {
      q,
      pageSize,
      pageToken: pageToken || undefined,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents, shared, owners)",
      orderBy: "modifiedTime desc",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    };
    if (driveId) {
      listParams.driveId = driveId;
      listParams.corpora = "drive";
    }
    const response = await drive.files.list(listParams);

    return {
      files: (response.data.files || []) as DriveFile[],
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: any) {
    console.error("[Google Drive] List files error:", error.message);
    return null;
  }
}

/**
 * Search files across all of Drive
 */
export async function searchDriveFiles(
  userId: number,
  query: string,
  pageSize: number = 20,
): Promise<DriveFile[] | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const response = await drive.files.list({
      q: `trashed = false and (name contains '${query.replace(/'/g, "\\'")}' or fullText contains '${query.replace(/'/g, "\\'")}')`,
      pageSize,
      fields: "files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents, shared, owners)",
      orderBy: "modifiedTime desc",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return (response.data.files || []) as DriveFile[];
  } catch (error: any) {
    console.error("[Google Drive] Search error:", error.message);
    return null;
  }
}

/**
 * Get file metadata
 */
export async function getDriveFile(
  userId: number,
  fileId: string,
): Promise<DriveFile | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const response = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents, shared, owners",
      supportsAllDrives: true,
    });

    return response.data as DriveFile;
  } catch (error: any) {
    console.error("[Google Drive] Get file error:", error.message);
    return null;
  }
}

/**
 * Create a new folder in Drive
 */
export async function createDriveFolder(
  userId: number,
  name: string,
  parentFolderId?: string,
): Promise<{ id: string; name: string; webViewLink: string } | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const fileMetadata: any = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      webViewLink: response.data.webViewLink || "",
    };
  } catch (error: any) {
    console.error("[Google Drive] Create folder error:", error.message);
    return null;
  }
}

// ============================================================================
// GOOGLE DOCS OPERATIONS
// ============================================================================

/**
 * Create a new Google Doc
 */
export async function createGoogleDoc(
  userId: number,
  title: string,
  folderId?: string,
): Promise<{ id: string; title: string; webViewLink: string } | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const fileMetadata: any = {
      name: title,
      mimeType: "application/vnd.google-apps.document",
    };
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });

    return {
      id: response.data.id!,
      title: response.data.name!,
      webViewLink: response.data.webViewLink || `https://docs.google.com/document/d/${response.data.id}/edit`,
    };
  } catch (error: any) {
    console.error("[Google Docs] Create error:", error.message);
    return null;
  }
}

/**
 * Copy a Google Doc (for template-based generation)
 */
export async function copyGoogleDoc(
  userId: number,
  sourceDocId: string,
  newTitle: string,
  folderId?: string,
): Promise<{ id: string; title: string; webViewLink: string } | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const copyMetadata: any = { name: newTitle };
    if (folderId) {
      copyMetadata.parents = [folderId];
    }

    const response = await drive.files.copy({
      fileId: sourceDocId,
      requestBody: copyMetadata,
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });

    return {
      id: response.data.id!,
      title: response.data.name!,
      webViewLink: response.data.webViewLink || `https://docs.google.com/document/d/${response.data.id}/edit`,
    };
  } catch (error: any) {
    console.error("[Google Docs] Copy error:", error.message);
    return null;
  }
}

/**
 * Replace merge fields in a Google Doc (e.g., {{client_name}} → "Acme Corp")
 */
export async function replaceMergeFields(
  userId: number,
  docId: string,
  mergeFields: Record<string, string>,
): Promise<boolean> {
  const docs = await getDocsClient(userId);
  if (!docs) return false;

  try {
    const requests = Object.entries(mergeFields).map(([key, value]) => ({
      replaceAllText: {
        containsText: {
          text: `{{${key}}}`,
          matchCase: false,
        },
        replaceText: value,
      },
    }));

    if (requests.length === 0) return true;

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });

    console.log(`[Google Docs] Replaced ${requests.length} merge fields in doc ${docId}`);
    return true;
  } catch (error: any) {
    console.error("[Google Docs] Replace merge fields error:", error.message);
    return false;
  }
}

/**
 * Read a Google Doc's text content (for AI analysis)
 */
export async function readGoogleDocText(
  userId: number,
  docId: string,
): Promise<string | null> {
  const docs = await getDocsClient(userId);
  if (!docs) return null;

  try {
    const response = await docs.documents.get({ documentId: docId });
    const content = response.data.body?.content || [];
    let text = "";

    for (const element of content) {
      if (element.paragraph) {
        for (const pe of element.paragraph.elements || []) {
          if (pe.textRun?.content) {
            text += pe.textRun.content;
          }
        }
      } else if (element.table) {
        for (const row of element.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            for (const cellContent of cell.content || []) {
              if (cellContent.paragraph) {
                for (const pe of cellContent.paragraph.elements || []) {
                  if (pe.textRun?.content) {
                    text += pe.textRun.content;
                  }
                }
              }
            }
            text += "\t";
          }
          text += "\n";
        }
      }
    }

    return text;
  } catch (error: any) {
    console.error("[Google Docs] Read text error:", error.message);
    return null;
  }
}

// ============================================================================
// GOOGLE SHEETS OPERATIONS
// ============================================================================

/**
 * Create a new Google Sheet
 */
export async function createGoogleSheet(
  userId: number,
  title: string,
  folderId?: string,
): Promise<{ id: string; title: string; webViewLink: string } | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const fileMetadata: any = {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
    };
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });

    return {
      id: response.data.id!,
      title: response.data.name!,
      webViewLink: response.data.webViewLink || `https://docs.google.com/spreadsheets/d/${response.data.id}/edit`,
    };
  } catch (error: any) {
    console.error("[Google Sheets] Create error:", error.message);
    return null;
  }
}

/**
 * Read sheet data (for previewing in the Vault)
 */
export async function readSheetData(
  userId: number,
  spreadsheetId: string,
  range: string = "Sheet1!A1:Z100",
): Promise<{ values: string[][]; sheetTitle: string } | null> {
  const sheets = await getSheetsClient(userId);
  if (!sheets) return null;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    // Get sheet title
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title",
    });

    return {
      values: (response.data.values || []) as string[][],
      sheetTitle: meta.data.properties?.title || "Untitled",
    };
  } catch (error: any) {
    console.error("[Google Sheets] Read data error:", error.message);
    return null;
  }
}

// ============================================================================
// SHARED DRIVE OPERATIONS
// ============================================================================

/**
 * List shared drives the user has access to
 */
export async function listSharedDrives(
  userId: number,
): Promise<{ id: string; name: string }[] | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const response = await drive.drives.list({
      pageSize: 50,
      fields: "drives(id, name)",
    });

    return (response.data.drives || []).map(d => ({
      id: d.id!,
      name: d.name!,
    }));
  } catch (error: any) {
    console.error("[Google Drive] List shared drives error:", error.message);
    return null;
  }
}

/**
 * Recursively scan all files in a drive/folder
 */
export async function scanDriveRecursive(
  userId: number,
  folderId?: string,
  driveId?: string,
  depth: number = 0,
  maxDepth: number = 5,
): Promise<Array<DriveFile & { folderPath: string }>> {
  if (depth > maxDepth) return [];
  const drive = await getDriveClient(userId);
  if (!drive) return [];

  const allFiles: Array<DriveFile & { folderPath: string }> = [];
  let pageToken: string | undefined;

  try {
    do {
      let q = "trashed = false";
      if (folderId) q += ` and '${folderId}' in parents`;

      const listParams: any = {
        q,
        pageSize: 100,
        pageToken: pageToken || undefined,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents, shared, owners)",
        orderBy: "name",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      };
      if (driveId) {
        listParams.driveId = driveId;
        listParams.corpora = "drive";
      }

      const response = await drive.files.list(listParams);
      const files = (response.data.files || []) as DriveFile[];

      for (const file of files) {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          // Recurse into subfolders
          const subFiles = await scanDriveRecursive(userId, file.id, driveId, depth + 1, maxDepth);
          for (const sf of subFiles) {
            allFiles.push({ ...sf, folderPath: `${file.name}/${sf.folderPath}` });
          }
        } else {
          allFiles.push({ ...file, folderPath: "" });
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  } catch (error: any) {
    console.error(`[Google Drive] Scan recursive error at depth ${depth}:`, error.message);
  }

  return allFiles;
}

/**
 * Generate a document from a template:
 * 1. Copy the template doc
 * 2. Replace merge fields
 * 3. Return the new doc info
 */
export async function generateFromTemplate(
  userId: number,
  templateDocId: string,
  newTitle: string,
  mergeFields: Record<string, string>,
  folderId?: string,
): Promise<{ id: string; title: string; webViewLink: string } | null> {
  // Step 1: Copy the template
  const newDoc = await copyGoogleDoc(userId, templateDocId, newTitle, folderId);
  if (!newDoc) return null;

  // Step 2: Replace merge fields
  const replaced = await replaceMergeFields(userId, newDoc.id, mergeFields);
  if (!replaced) {
    console.warn(`[Google Docs] Merge field replacement failed for doc ${newDoc.id}, but doc was created`);
  }

  return newDoc;
}
