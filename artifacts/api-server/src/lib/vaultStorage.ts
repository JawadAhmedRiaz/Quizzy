import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import path from "path";

export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
]);

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const BUCKET_NAME = "vault";

/**
 * Formats byte size consistently with existing frontend rows:
 * e.g. "110 KB" or "1.3 MB".
 */
export function formatFileSize(bytes: number): string {
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase Storage credentials missing: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be configured."
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

/**
 * Validates the file extension against the allowed vault extension list.
 */
export function validateVaultExtension(originalName: string): string {
  const ext = path.extname(originalName || "").toLowerCase().replace(/^\./, "");
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `File extension '.${ext || "unknown"}' is not permitted. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`
    );
  }
  return ext;
}

/**
 * Uploads a file buffer to the private "vault" bucket in Supabase Storage.
 * storagePath is strictly formatted as <uuid>.<validated_extension>, never using raw user filenames.
 */
export async function uploadVaultFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const ext = validateVaultExtension(originalName);
  const supabase = getSupabaseClient();
  const fileUuid = crypto.randomUUID();
  const storagePath = `${fileUuid}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return storagePath;
}

/**
 * Deletes a file from the private "vault" bucket in Supabase Storage.
 */
export async function deleteVaultFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);

  if (error) {
    throw new Error(`Supabase Storage deletion failed: ${error.message}`);
  }
}

/**
 * Generates a temporary signed URL for a private vault asset (default 1 hour / 3600 seconds).
 * Accepts an optional download file name to set Content-Disposition attachment.
 */
export async function getSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 3600,
  downloadFileName?: string
): Promise<string> {
  if (!storagePath) {
    throw new Error("storagePath is required to generate signed URL.");
  }
  const supabase = getSupabaseClient();

  const options = downloadFileName ? { download: downloadFileName } : undefined;
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds, options);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message || "Unknown error"}`);
  }

  return data.signedUrl;
}
