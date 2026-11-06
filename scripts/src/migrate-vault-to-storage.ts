import crypto from "crypto";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db, vaultItemsTable } from "@workspace/db";
import { and, isNotNull, or, isNull, eq, sql } from "drizzle-orm";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB limit
const BUCKET_NAME = "vault";

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function resolveExtension(fileName: string, mimeType: string): string {
  const fromName = path.extname(fileName || "").toLowerCase().replace(/^\./, "");
  if (fromName && ALLOWED_EXTENSIONS.has(fromName)) {
    return fromName;
  }
  const fromMime = MIME_TO_EXT[mimeType?.toLowerCase() || ""];
  if (fromMime && ALLOWED_EXTENSIONS.has(fromMime)) {
    return fromMime;
  }
  return "pdf";
}

let _supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }
  _supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabaseClient;
}

export async function runMigration() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("================================================================================");
  console.log(`VAULT STORAGE MIGRATION ${isDryRun ? "[DRY RUN ONLY - NO DATA MODIFIED]" : "[LIVE RUN]"}`);
  console.log("================================================================================");
  console.log("Source Table: vault_items");
  console.log("Preserved Backups: vault_items_backup_pre_migration, backups/*.json (UNTUOCHED)");
  console.log("Size Ceiling: 50 MB per file\n");

  // Query only legacy unmigrated rows where fileUrl starts with 'data:' and storagePath is null
  const rows = await db
    .select()
    .from(vaultItemsTable)
    .where(
      and(
        isNotNull(vaultItemsTable.fileUrl),
        sql`${vaultItemsTable.fileUrl} LIKE 'data:%'`,
        or(isNull(vaultItemsTable.storagePath), eq(vaultItemsTable.storagePath, ""))
      )
    )
    .orderBy(vaultItemsTable.id);

  console.log(`Found ${rows.length} legacy row(s) requiring migration.\n`);

  if (rows.length === 0) {
    console.log("No legacy Base64 rows to migrate. All vault items are already in storage!");
    return;
  }

  let processedCount = 0;
  let skippedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalDecodedBytes = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    processedCount++;

    const rawUrl = row.fileUrl || "";
    // Parse data URI: data:[<mediatype>][;base64],<data>
    const match = rawUrl.match(/^data:([^;]+);base64,(.*)$/s);
    if (!match) {
      console.warn(`[Row ${row.id}] SKIP: Invalid data URI format for "${row.title}"`);
      skippedCount++;
      continue;
    }

    const detectedMime = match[1] || row.mimeType || "application/octet-stream";
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");
    const decodedBytes = buffer.length;
    totalDecodedBytes += decodedBytes;

    const formattedSize = formatSize(decodedBytes);
    const ext = resolveExtension(row.fileName, detectedMime);

    console.log(
      `[${i + 1}/${rows.length}] ID: ${row.id} | Title: "${row.title.slice(0, 40)}" | File: ${row.fileName} | MIME: ${detectedMime} | Decoded: ${formattedSize}`
    );

    // Skip files exceeding 50 MB limit
    if (decodedBytes > MAX_FILE_BYTES) {
      console.warn(`   -> [SKIP] File size (${formattedSize}) exceeds 50 MB threshold.`);
      skippedCount++;
      continue;
    }

    if (isDryRun) {
      // In dry run mode, record simulated success without making changes
      successCount++;
      continue;
    }

    // --- Live Mode Execution ---
    try {
      const supabase = getSupabase();
      const storagePath = `${crypto.randomUUID()}.${ext}`;

      // 1. Upload buffer to Supabase Storage bucket 'vault'
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: detectedMime,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload error: ${uploadError.message}`);
      }

      // 2. Clear fileUrl ONLY after verified upload
      await db
        .update(vaultItemsTable)
        .set({
          storagePath,
          fileUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(vaultItemsTable.id, row.id));

      console.log(`   -> [SUCCESS] Uploaded as ${storagePath} and cleared Base64 fileUrl in DB.`);
      successCount++;
    } catch (err: any) {
      console.error(`   -> [FAILED] Row ${row.id} error:`, err.message);
      failureCount++;
      // Continue to next row without breaking
    }
  }

  console.log("\n================================================================================");
  console.log(`SUMMARY OF ${isDryRun ? "DRY RUN" : "MIGRATION"}`);
  console.log("================================================================================");
  console.log(`Total Rows Inspected : ${processedCount}`);
  console.log(`Eligible / Succeeded : ${successCount}`);
  console.log(`Skipped (>50MB / Bad): ${skippedCount}`);
  console.log(`Failed / Errors      : ${failureCount}`);
  console.log(`Total Decoded Volume : ${formatSize(totalDecodedBytes)}`);
  console.log("================================================================================\n");
}

// Execute if run directly
runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
