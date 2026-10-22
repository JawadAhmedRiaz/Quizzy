import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  let isAdmin = user?.role === "admin";
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (adminEmail && user?.email?.toLowerCase() === adminEmail) {
    isAdmin = true;
  }

  if (!isAdmin && user) {
    const [anyAdmin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);
    if (!anyAdmin) {
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, user.id));
      isAdmin = true;
    }
  }

  if (!user || !isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
