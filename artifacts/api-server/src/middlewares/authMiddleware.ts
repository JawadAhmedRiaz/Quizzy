import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSessionId, getSession } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // 1. Clerk Authentication Authority
    const auth = getAuth(req);
    if (auth && auth.userId) {
      const clerkUserId = auth.userId;

      // Fast-path lookup by clerk_id
      let [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.clerkId, clerkUserId))
        .limit(1);

      if (!existingUser) {
        // Fetch verified user details from Clerk
        let clerkUser: any = null;
        try {
          clerkUser = await clerkClient.users.getUser(clerkUserId);
        } catch (e) {
          req.log?.warn?.({ err: e }, "Failed to fetch Clerk user details");
        }

        const primaryEmailObj = clerkUser?.emailAddresses?.find(
          (e: any) =>
            e.id === clerkUser.primaryEmailAddressId ||
            e.id === clerkUser.primary_email_address_id,
        ) || clerkUser?.emailAddresses?.[0];

        const primaryEmail = primaryEmailObj?.emailAddress || primaryEmailObj?.email_address;
        const isEmailVerified =
          primaryEmailObj?.verification?.status === "verified" ||
          primaryEmailObj?.verification?.status === "transfer_verified";

        if (primaryEmail && isEmailVerified) {
          const normalizedEmail = primaryEmail.toLowerCase().trim();

          // Check if an existing legacy account matches this verified email
          const [legacyUser] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, normalizedEmail))
            .limit(1);

          if (legacyUser) {
            // Establish mapping without modifying existing internal UUID or historical records
            await db
              .update(usersTable)
              .set({
                clerkId: clerkUserId,
                profileImageUrl:
                  clerkUser?.imageUrl || clerkUser?.image_url || legacyUser.profileImageUrl,
              })
              .where(eq(usersTable.id, legacyUser.id));

            legacyUser.clerkId = clerkUserId;
            existingUser = legacyUser;
          }
        }

        // If still no user exists, safely provision a brand-new internal UUID
        if (!existingUser) {
          const firstName = clerkUser?.firstName || clerkUser?.first_name || "Student";
          const lastName = clerkUser?.lastName || clerkUser?.last_name || "";
          const normalizedEmail = primaryEmail ? primaryEmail.toLowerCase().trim() : null;

          try {
            const [newUser] = await db
              .insert(usersTable)
              .values({
                // id will be automatically generated as a genuine UUID by PostgreSQL (gen_random_uuid())
                clerkId: clerkUserId,
                email: normalizedEmail,
                firstName,
                lastName,
                profileImageUrl: clerkUser?.imageUrl || clerkUser?.image_url || null,
                role: "student",
              })
              .onConflictDoUpdate({
                target: usersTable.clerkId,
                set: { updatedAt: new Date() },
              })
              .returning();

            existingUser = newUser;
          } catch (insertErr) {
            // Concurrent request fallback
            const [retryUser] = await db
              .select()
              .from(usersTable)
              .where(eq(usersTable.clerkId, clerkUserId))
              .limit(1);
            existingUser = retryUser;
          }

          // Idempotent initial profile provisioning for newly created users
          if (existingUser) {
            try {
              const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || firstName;
              await db
                .insert(profilesTable)
                .values({
                  userId: existingUser.id,
                  displayName: fullName,
                  xp: 0,
                  streakCount: 0,
                  streakLastDate: new Date().toISOString().slice(0, 10),
                })
                .onConflictDoNothing();
            } catch {
              // Profile already exists
            }
          }
        }
      }

      if (existingUser) {
        req.user = {
          id: existingUser.id, // Internal PostgreSQL UUID
          email: existingUser.email || undefined,
          firstName: existingUser.firstName || undefined,
          lastName: existingUser.lastName || undefined,
          profileImageUrl: existingUser.profileImageUrl || undefined,
          role: existingUser.role, // Server-side role authority
        };
        req.isAuthenticated = () => true;
        next();
        return;
      }
    }

    // 2. Legacy session fallback during cutover
    const sid = getSessionId(req);
    if (sid) {
      const session = await getSession(sid);
      if (session) {
        req.user = session.user;
        req.isAuthenticated = () => true;
        next();
        return;
      }
    }
  } catch (err) {
    req.log?.error?.({ err }, "authMiddleware error during authentication");
  }

  req.isAuthenticated = () => false;
  next();
}
