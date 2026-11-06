import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import { db, vaultItemsTable, subjectsTable, systemConfigsTable, usersTable } from "@workspace/db";
import { adminMiddleware } from "../middlewares/adminMiddleware";
import {
  uploadVaultFile,
  deleteVaultFile,
  getSignedUrl,
  formatFileSize,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from "../lib/vaultStorage";

const router: IRouter = Router();

// Flag to log generated SQL once for verification
let hasLoggedVaultListSql = false;

// ============================================================================
// File Size & Upload Helpers
// ============================================================================

function sanitizeFileName(rawName: string): string {
  const base = path.basename(rawName || "document").replace(/[\0\r\n]/g, "").trim();
  return base || "document";
}

// Configurable file size ceiling (default 50 MB)
const DEFAULT_MAX_MB = 50;
function getMaxVaultFileMb(): number {
  const envVal = parseInt(process.env.VAULT_MAX_FILE_MB || "", 10);
  return !isNaN(envVal) && envVal > 0 ? envVal : DEFAULT_MAX_MB;
}

const vaultMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getMaxVaultFileMb() * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().replace(/^\./, "");
    const mime = (file.mimetype || "").toLowerCase();

    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`Invalid file extension '.${ext}'. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`));
      return;
    }

    if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
      cb(new Error(`Invalid file MIME type '${mime}'. Allowed: documents and images.`));
      return;
    }

    cb(null, true);
  },
});

function handleVaultUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.is("multipart/form-data")) {
    next();
    return;
  }

  vaultMulter.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: `File size exceeds the limit of ${getMaxVaultFileMb()} MB.` });
        return;
      }
      res.status(400).json({ error: err.message || "File upload validation failed." });
      return;
    }
    next();
  });
}

// ============================================================================
// Access Rule Helper (Fail Closed)
// ============================================================================

async function checkVaultAccess(req: Request): Promise<{ allowed: boolean; status?: number; error?: string }> {
  try {
    const [row] = await db
      .select({ value: systemConfigsTable.value })
      .from(systemConfigsTable)
      .where(eq(systemConfigsTable.key, "vault.isPublic"));

    // If setting doesn't exist, default to public; if query fails, catch block fails closed.
    const isPublic = row ? row.value !== "false" : true;
    if (isPublic) {
      return { allowed: true };
    }
  } catch (err: any) {
    const underlying = err?.cause || {};
    req.log?.error?.(
      {
        errMessage: err?.message,
        pgCode: underlying?.code,
        pgMessage: underlying?.message,
      },
      "Error checking vault.isPublic system config"
    );
    // Fail closed if lookup errors
    return { allowed: false, status: 403, error: "Study vault is currently unavailable." };
  }

  // When vault is locked (isPublic === false): require authenticated admin
  if (!req.isAuthenticated()) {
    return { allowed: false, status: 401, error: "Authentication required." };
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id, role: usersTable.role, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));

    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const isAdmin = user?.role === "admin" || (adminEmail && user?.email?.toLowerCase() === adminEmail);

    if (!isAdmin) {
      return { allowed: false, status: 403, error: "Study vault access is currently restricted to administrators." };
    }

    return { allowed: true };
  } catch (err: any) {
    const underlying = err?.cause || {};
    req.log?.error?.(
      {
        errMessage: err?.message,
        pgCode: underlying?.code,
        pgMessage: underlying?.message,
      },
      "Error checking admin permissions for vault access"
    );
    return { allowed: false, status: 403, error: "Access verification failed." };
  }
}

// ============================================================================
// Routes
// ============================================================================

// 1. Vault Accessibility Settings (Public to read, Admin only to update)
router.get("/vault/settings", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select({ value: systemConfigsTable.value })
      .from(systemConfigsTable)
      .where(eq(systemConfigsTable.key, "vault.isPublic"));
    const isPublic = row ? row.value !== "false" : true;
    res.json({ isPublic });
  } catch (err: any) {
    const underlying = err?.cause || {};
    req.log?.error?.(
      {
        errMessage: err?.message,
        pgCode: underlying?.code,
        pgMessage: underlying?.message,
      },
      "Error fetching vault settings"
    );
    res.json({ isPublic: false }); // Fail closed on error
  }
});

router.post("/vault/settings", adminMiddleware, async (req, res): Promise<void> => {
  const { isPublic } = req.body;
  const val = isPublic === false ? "false" : "true";

  await db
    .insert(systemConfigsTable)
    .values({ key: "vault.isPublic", value: val })
    .onConflictDoUpdate({ target: systemConfigsTable.key, set: { value: val } });

  res.json({ success: true, isPublic: val === "true" });
});

// 2. Get vault items list (Lightweight: NEVER returns fileUrl or storagePath)
router.get("/vault", async (req, res): Promise<void> => {
  try {
    const access = await checkVaultAccess(req);
    if (!access.allowed) {
      res.status(access.status || 403).json({ error: access.error });
      return;
    }

    const subjectId = req.query.subjectId ? parseInt(req.query.subjectId as string, 10) : undefined;
    const category = req.query.category as string | undefined;

    // Explicitly select only lightweight columns; compute isLegacy in SQL; NEVER select raw fileUrl or storagePath
    const query = db
      .select({
        id: vaultItemsTable.id,
        userId: vaultItemsTable.userId,
        subjectId: vaultItemsTable.subjectId,
        title: vaultItemsTable.title,
        category: vaultItemsTable.category,
        description: vaultItemsTable.description,
        tags: vaultItemsTable.tags,
        fileName: vaultItemsTable.fileName,
        fileSize: vaultItemsTable.fileSize,
        mimeType: vaultItemsTable.mimeType,
        createdAt: vaultItemsTable.createdAt,
        updatedAt: vaultItemsTable.updatedAt,
        isLegacy: sql<boolean>`coalesce(${vaultItemsTable.fileUrl} LIKE 'data:%', false)`.as("is_legacy"),
      })
      .from(vaultItemsTable)
      .orderBy(desc(vaultItemsTable.createdAt));

    // Log the generated SQL query once to verify file_url is not in the select list as a raw column
    if (!hasLoggedVaultListSql) {
      hasLoggedVaultListSql = true;
      const sqlObj = query.toSQL();
      req.log?.info?.({ generatedSql: sqlObj.sql }, "Verified GET /vault generated SQL query");
      console.log("[VAULT_SQL_VERIFY]", sqlObj.sql);
    }

    const items = await query;

    let filtered = items;
    if (subjectId && !isNaN(subjectId)) {
      filtered = filtered.filter((i) => i.subjectId === subjectId);
    }
    if (category && category !== "all") {
      filtered = filtered.filter((i) => i.category === category);
    }

    // Return lightweight payloads with isLegacy boolean, stripping fileUrl and storagePath
    res.json(
      filtered.map((item) => ({
        id: item.id,
        userId: item.userId,
        subjectId: item.subjectId,
        title: item.title,
        category: item.category,
        description: item.description,
        tags: typeof item.tags === "string" ? JSON.parse(item.tags || "[]") : item.tags || [],
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        isLegacy: Boolean(item.isLegacy),
      }))
    );
  } catch (err: any) {
    const underlying = err?.cause || {};
    req.log?.error?.(
      {
        errMessage: err?.message,
        pgCode: underlying?.code,
        pgMessage: underlying?.message,
        pgDetail: underlying?.detail,
      },
      "Error executing GET /vault query"
    );
    console.error("[VAULT_LIST_ERROR]", {
      message: err?.message,
      causeCode: underlying?.code,
      causeMessage: underlying?.message,
    });
    res.status(500).json({ error: "Failed to load vault items." });
  }
});

// 3. Get single vault item file URL (signed URL for Supabase Storage, inline string for legacy)
router.get("/vault/:id/file-url", async (req, res): Promise<void> => {
  const access = await checkVaultAccess(req);
  if (!access.allowed) {
    res.status(access.status || 403).json({ error: access.error });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid item ID" });
    return;
  }

  try {
    // Select only columns required for download/view
    const [item] = await db
      .select({
        id: vaultItemsTable.id,
        fileName: vaultItemsTable.fileName,
        mimeType: vaultItemsTable.mimeType,
        storagePath: vaultItemsTable.storagePath,
        fileUrl: vaultItemsTable.fileUrl,
      })
      .from(vaultItemsTable)
      .where(eq(vaultItemsTable.id, id))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "Vault item not found" });
      return;
    }

    // If item has a Supabase Storage path, generate a 1-hour signed URL
    if (item.storagePath) {
      try {
        const isDownload = req.query.download === "1";
        const downloadFileName = isDownload ? (item.fileName || "download") : undefined;
        const signedUrl = await getSignedUrl(item.storagePath, 3600, downloadFileName);
        res.json({
          url: signedUrl,
          fileName: item.fileName,
          mimeType: item.mimeType || "application/octet-stream",
          isLegacy: false,
        });
        return;
      } catch (err: any) {
        req.log?.error?.({ err, storagePath: item.storagePath }, "Error generating signed URL");
        res.status(500).json({ error: "Failed to generate download URL for this file." });
        return;
      }
    }

    // Legacy item with Base64 data: URL
    if (item.fileUrl) {
      res.json({
        url: item.fileUrl,
        fileName: item.fileName,
        mimeType: item.mimeType || "application/octet-stream",
        isLegacy: true,
      });
      return;
    }

    res.status(404).json({ error: "File content not available for this item." });
  } catch (err: any) {
    const underlying = err?.cause || {};
    req.log?.error?.(
      {
        errMessage: err?.message,
        pgCode: underlying?.code,
        pgMessage: underlying?.message,
      },
      "Error retrieving vault file URL"
    );
    res.status(500).json({ error: "Failed to retrieve document URL." });
  }
});

// 4. Upload / Create a new vault item (Admin only)
// Supports multipart/form-data (Supabase Storage) and legacy application/json (Base64)
router.post(
  "/vault",
  adminMiddleware,
  handleVaultUploadMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || "admin";

    // A. Multipart / Supabase Storage path
    if (req.file) {
      const { subjectId, title, category, description, tags } = req.body;

      if (!subjectId || !title) {
        res.status(400).json({ error: "Missing required fields (subjectId, title)." });
        return;
      }

      let parsedTags: string[] = [];
      if (tags) {
        try {
          parsedTags = typeof tags === "string" ? JSON.parse(tags) : Array.isArray(tags) ? tags : [];
        } catch {
          parsedTags = typeof tags === "string" ? [tags] : [];
        }
      }

      const originalName = req.file.originalname || "document.pdf";
      const sanitizedName = sanitizeFileName(originalName);
      const mimeType = req.file.mimetype || "application/octet-stream";
      const fileSize = formatFileSize(req.file.size);

      let storagePath: string;
      try {
        storagePath = await uploadVaultFile(req.file.buffer, originalName, mimeType);
      } catch (err: any) {
        req.log?.error?.({ err }, "Supabase storage upload error");
        res.status(500).json({ error: err.message || "Failed to store file in vault storage." });
        return;
      }

      const [created] = await db
        .insert(vaultItemsTable)
        .values({
          userId,
          subjectId: parseInt(String(subjectId), 10),
          title: String(title).trim(),
          category: category || "pdf",
          description: description ? String(description).trim() : null,
          storagePath,
          fileUrl: null,
          fileName: sanitizedName,
          fileSize,
          mimeType,
          tags: JSON.stringify(parsedTags),
        })
        .returning();

      res.status(201).json({
        id: created.id,
        userId: created.userId,
        subjectId: created.subjectId,
        title: created.title,
        category: created.category,
        description: created.description,
        tags: parsedTags,
        fileName: created.fileName,
        fileSize: created.fileSize,
        mimeType: created.mimeType,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        isLegacy: false,
      });
      return;
    }

    // B. Legacy JSON / Base64 upload path
    const { subjectId, title, category, description, fileUrl, fileName, fileSize, mimeType, tags } = req.body;

    if (!subjectId || !title || !fileUrl || !fileName) {
      res.status(400).json({ error: "Missing required fields (subjectId, title, fileUrl, fileName)" });
      return;
    }

    const [created] = await db
      .insert(vaultItemsTable)
      .values({
        userId,
        subjectId: parseInt(String(subjectId), 10),
        title: String(title).trim(),
        category: category || "pdf",
        description: description ? String(description).trim() : null,
        fileUrl,
        storagePath: null,
        fileName: sanitizeFileName(fileName),
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        tags: JSON.stringify(tags || []),
      })
      .returning();

    res.status(201).json({
      id: created.id,
      userId: created.userId,
      subjectId: created.subjectId,
      title: created.title,
      category: created.category,
      description: created.description,
      tags: typeof created.tags === "string" ? JSON.parse(created.tags || "[]") : created.tags || [],
      fileName: created.fileName,
      fileSize: created.fileSize,
      mimeType: created.mimeType,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      isLegacy: true,
    });
  }
);

// 5. Update an existing vault item (Admin only)
// Accepts multipart/form-data or application/json. If a replacement file is provided:
// 1. Upload new file to Supabase bucket.
// 2. Update DB row.
// 3. Delete old file from bucket.
// 4. If DB update fails, rollback the new file from storage immediately.
router.put(
  "/vault/:id",
  adminMiddleware,
  handleVaultUploadMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid item ID" });
      return;
    }

    try {
      // 1. Verify existence of item
      const [existing] = await db
        .select({
          id: vaultItemsTable.id,
          userId: vaultItemsTable.userId,
          subjectId: vaultItemsTable.subjectId,
          title: vaultItemsTable.title,
          category: vaultItemsTable.category,
          description: vaultItemsTable.description,
          tags: vaultItemsTable.tags,
          storagePath: vaultItemsTable.storagePath,
          fileUrl: vaultItemsTable.fileUrl,
          fileName: vaultItemsTable.fileName,
          fileSize: vaultItemsTable.fileSize,
          mimeType: vaultItemsTable.mimeType,
          createdAt: vaultItemsTable.createdAt,
          updatedAt: vaultItemsTable.updatedAt,
        })
        .from(vaultItemsTable)
        .where(eq(vaultItemsTable.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Vault item not found" });
        return;
      }

      // 2. Validate body fields
      const title = req.body.title !== undefined ? String(req.body.title).trim() : undefined;
      const subjectIdRaw = req.body.subjectId !== undefined ? req.body.subjectId : undefined;
      const category = req.body.category !== undefined ? String(req.body.category).trim() : undefined;
      const description = req.body.description !== undefined ? String(req.body.description).trim() : undefined;
      const tags = req.body.tags;

      if (title !== undefined) {
        if (title.length < 1 || title.length > 200) {
          res.status(400).json({ error: "Title must be between 1 and 200 characters." });
          return;
        }
      }

      const ALLOWED_CATEGORIES = new Set(["pdf", "handwritten", "notes", "summary", "other"]);
      if (category !== undefined && !ALLOWED_CATEGORIES.has(category)) {
        res.status(400).json({ error: `Invalid category '${category}'. Allowed: pdf, handwritten, notes, summary, other.` });
        return;
      }

      let subjectId: number | undefined;
      if (subjectIdRaw !== undefined && subjectIdRaw !== "") {
        subjectId = parseInt(String(subjectIdRaw), 10);
        if (isNaN(subjectId) || subjectId <= 0) {
          res.status(400).json({ error: "Invalid subjectId." });
          return;
        }
        const [subj] = await db
          .select({ id: subjectsTable.id })
          .from(subjectsTable)
          .where(eq(subjectsTable.id, subjectId))
          .limit(1);
        if (!subj) {
          res.status(400).json({ error: `Subject ID ${subjectId} does not exist.` });
          return;
        }
      }

      const updates: Partial<typeof vaultItemsTable.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (title !== undefined) updates.title = title;
      if (subjectId !== undefined) updates.subjectId = subjectId;
      if (category !== undefined) updates.category = category as any;
      if (description !== undefined) updates.description = description || null;
      if (tags !== undefined) {
        let parsedTags: string[] = [];
        try {
          parsedTags = typeof tags === "string" ? JSON.parse(tags) : Array.isArray(tags) ? tags : [];
        } catch {
          parsedTags = typeof tags === "string" ? [tags] : [];
        }
        updates.tags = JSON.stringify(parsedTags);
      }

      let newStoragePath: string | null = null;
      let oldStoragePathToDelete: string | null = null;

      // 3. If replacement file was provided, upload to bucket first
      if (req.file) {
        const originalName = req.file.originalname || "document.pdf";
        const sanitizedName = sanitizeFileName(originalName);
        const mimeType = req.file.mimetype || "application/octet-stream";
        const fileSize = formatFileSize(req.file.size);

        try {
          newStoragePath = await uploadVaultFile(req.file.buffer, originalName, mimeType);
        } catch (err: any) {
          req.log?.error?.({ err }, "Error uploading replacement vault file");
          res.status(500).json({ error: err.message || "Failed to upload replacement file." });
          return;
        }

        updates.storagePath = newStoragePath;
        updates.fileUrl = null; // Clear legacy Base64 if any
        updates.fileName = sanitizedName;
        updates.fileSize = fileSize;
        updates.mimeType = mimeType;

        if (existing.storagePath) {
          oldStoragePathToDelete = existing.storagePath;
        }
      }

      // 4. Update database row with rollback protection
      let updatedItem: typeof existing;
      try {
        const [row] = await db
          .update(vaultItemsTable)
          .set(updates)
          .where(eq(vaultItemsTable.id, id))
          .returning();
        updatedItem = row;
      } catch (dbErr: any) {
        // Rollback: delete new file immediately so storage is not orphaned
        if (newStoragePath) {
          try {
            await deleteVaultFile(newStoragePath);
          } catch (delErr: any) {
            req.log?.error?.({ delErr, newStoragePath }, "Failed to rollback orphaned storage file");
          }
        }
        const underlying = dbErr?.cause || {};
        req.log?.error?.(
          {
            errMessage: dbErr?.message,
            pgCode: underlying?.code,
            pgMessage: underlying?.message,
          },
          "Error updating vault item in database"
        );
        res.status(500).json({ error: "Failed to update vault item." });
        return;
      }

      // 5. On successful DB update, clean up old storage object
      if (oldStoragePathToDelete) {
        try {
          await deleteVaultFile(oldStoragePathToDelete);
        } catch (delErr: any) {
          req.log?.error?.({ delErr, oldStoragePathToDelete }, "Failed to delete old storage file after replacement");
        }
      }

      let parsedTags: string[] = [];
      if (updatedItem.tags) {
        try {
          parsedTags = typeof updatedItem.tags === "string" ? JSON.parse(updatedItem.tags) : updatedItem.tags;
        } catch {
          parsedTags = [];
        }
      }

      res.json({
        id: updatedItem.id,
        userId: updatedItem.userId,
        subjectId: updatedItem.subjectId,
        title: updatedItem.title,
        category: updatedItem.category,
        description: updatedItem.description,
        tags: parsedTags,
        fileName: updatedItem.fileName,
        fileSize: updatedItem.fileSize,
        mimeType: updatedItem.mimeType,
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
        isLegacy: false,
      });
    } catch (err: any) {
      const underlying = err?.cause || {};
      req.log?.error?.(
        {
          errMessage: err?.message,
          pgCode: underlying?.code,
          pgMessage: underlying?.message,
        },
        "Unexpected error in PUT /vault/:id"
      );
      res.status(500).json({ error: "Failed to update vault item." });
    }
  }
);

// 6. Delete a vault item (Admin only)
router.delete("/vault/:id", adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid item ID" });
    return;
  }

  try {
    // Find item selecting only id and storagePath
    const [item] = await db
      .select({
        id: vaultItemsTable.id,
        storagePath: vaultItemsTable.storagePath,
      })
      .from(vaultItemsTable)
      .where(eq(vaultItemsTable.id, id))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    // If storagePath is set, remove from Supabase Storage
    if (item.storagePath) {
      try {
        await deleteVaultFile(item.storagePath);
      } catch (err: any) {
        // Storage deletion failure is logged, but does not block deleting the DB row
        req.log?.error?.({ err, storagePath: item.storagePath }, "Failed to delete storage file from Supabase");
      }
    }

    await db.delete(vaultItemsTable).where(eq(vaultItemsTable.id, id));

    res.json({ success: true, id });
  } catch (err: any) {
    const underlying = err?.cause || {};
    req.log?.error?.(
      {
        errMessage: err?.message,
        pgCode: underlying?.code,
        pgMessage: underlying?.message,
      },
      "Error deleting vault item"
    );
    res.status(500).json({ error: "Failed to delete vault item." });
  }
});

export default router;
