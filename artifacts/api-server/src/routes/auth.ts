import { eq, and, gt } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable, emailVerificationsTable } from "@workspace/db";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import {
  clearSession,
  getSessionId,
  getSession,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
  hashPassword,
  verifyPassword,
  type SessionData,
} from "../lib/auth";

const router: IRouter = Router();

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "tempmail.com", "throwawaymail.com", "mailinator.com", "guerrillamail.com",
  "10minutemail.com", "sharklasers.com", "yopmail.com", "getairmail.com",
  "dispostable.com", "fakemailgenerator.com", "temp-mail.org", "trashmail.com",
  "burnermail.io", "maildrop.cc", "nada.ltd"
]);

async function sendVerificationEmail(email: string, firstName: string, code: string): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const resendApiKey = process.env.RESEND_API_KEY;

  console.log(`\n======================================================`);
  console.log(`[QUIZZY EMAIL VERIFICATION OTP]`);
  console.log(`To: ${email} (${firstName})`);
  console.log(`Verification Code: ${code}`);
  console.log(`======================================================\n`);

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; background: #0b0f19; color: #f8fafc; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 44px; margin-bottom: 8px;">🎓</div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #60a5fa, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Quizzy LMS</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">Your Personal Learning Management System</p>
      </div>
      
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #cbd5e1;">Welcome, <strong>${firstName}</strong>! Use the 6-digit code below to verify your email and activate your account:</p>
        <div style="display: inline-block; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 10px; padding: 12px 28px; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #60a5fa; font-family: monospace;">${code}</div>
        <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">This code is valid for <strong>10 minutes</strong>.</p>
      </div>
      
      <p style="text-align: center; font-size: 11px; color: #475569; margin: 0;">If you didn't request this email, you can safely ignore it.</p>
    </div>
  `;

  // 1. Try Gmail SMTP if configured (no custom domain required, delivers to anyone)
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser.trim(),
          pass: smtpPass.trim().replace(/\s+/g, ""),
        },
      });

      await transporter.sendMail({
        from: `"Quizzy LMS" <${smtpUser.trim()}>`,
        to: email,
        subject: `Your Quizzy Verification Code is ${code}`,
        html: htmlContent,
      });

      console.log(`[Gmail SMTP]: Verification email delivered successfully to ${email}`);
      return true;
    } catch (smtpErr) {
      console.error("[Gmail SMTP Error]:", smtpErr);
    }
  }

  // 2. Fallback to Resend if configured
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: "Quizzy LMS <onboarding@resend.dev>",
        to: email,
        subject: `Your Quizzy Verification Code is ${code}`,
        html: htmlContent,
      });
      if (error) {
        console.error("[Resend Error]:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[Resend Exception]:", err);
      return false;
    }
  }

  console.log("[Auth] No active email provider configured in .env. Code logged to terminal for development testing.");
  return false;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body ?? {};

  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: "First name, last name, email, and password are required" });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Basic regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }

  // Disposable domain check
  const domain = normalizedEmail.split("@")[1];
  if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    res.status(400).json({ error: "Disposable temporary email addresses are not permitted. Please use your real email." });
    return;
  }

  // Check if user already exists
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "An account with this email is already registered. Please log in instead." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete any prior pending verification for this email
  await db
    .delete(emailVerificationsTable)
    .where(eq(emailVerificationsTable.email, normalizedEmail));

  // Store new pending verification
  await db.insert(emailVerificationsTable).values({
    email: normalizedEmail,
    code: otp,
    userData: {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      passwordHash,
    },
    expiresAt,
  });

  // Send email via Resend (and logs to terminal for local dev)
  await sendVerificationEmail(normalizedEmail, String(firstName).trim(), otp);

  res.status(200).json({
    requireVerification: true,
    email: normalizedEmail,
    message: "A 6-digit verification code has been sent to your email.",
  });
});

router.post("/auth/verify-email", async (req: Request, res: Response) => {
  const { email, code } = req.body ?? {};

  if (!email || !code) {
    res.status(400).json({ error: "Email and 6-digit verification code are required" });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const cleanCode = String(code).trim();

  const [record] = await db
    .select()
    .from(emailVerificationsTable)
    .where(eq(emailVerificationsTable.email, normalizedEmail))
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "No pending verification found for this email. Please register again." });
    return;
  }

  if (new Date() > new Date(record.expiresAt)) {
    await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.email, normalizedEmail));
    res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    return;
  }

  if (record.code !== cleanCode) {
    res.status(400).json({ error: "Incorrect verification code. Please check your inbox and try again." });
    return;
  }

  const userData = record.userData as { firstName: string; lastName: string; passwordHash: string };

  // Check again to avoid duplicate race condition
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  let user = existingUser;
  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash: userData.passwordHash,
        profileImageUrl: null,
        role: "student",
      })
      .returning();
    user = created;
  }

  // Clean up verification record
  await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.email, normalizedEmail));

  // Create session
  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  res.status(200).json({ user: sessionData.user });
});

router.post("/auth/resend-code", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const [record] = await db
    .select()
    .from(emailVerificationsTable)
    .where(eq(emailVerificationsTable.email, normalizedEmail))
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "No pending verification found. Please register first." });
    return;
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db
    .update(emailVerificationsTable)
    .set({ code: newOtp, expiresAt })
    .where(eq(emailVerificationsTable.email, normalizedEmail));

  const userData = record.userData as { firstName?: string };
  await sendVerificationEmail(normalizedEmail, userData.firstName || "Student", newOtp);

  res.status(200).json({ success: true, message: "A new verification code has been sent to your email." });
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  res.json({ user: sessionData.user });
});

router.post("/auth/google", async (req: Request, res: Response) => {
  const { credential, email: directEmail, firstName: directFirstName, lastName: directLastName, profileImageUrl: directPhoto } = req.body ?? {};

  let email = directEmail;
  let firstName = directFirstName;
  let lastName = directLastName;
  let profileImageUrl = directPhoto;

  if (credential && typeof credential === "string") {
    try {
      const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (gRes.ok) {
        const gData = await gRes.json() as { email?: string; given_name?: string; family_name?: string; picture?: string; name?: string };
        if (gData.email) {
          email = gData.email;
          firstName = gData.given_name || (gData.name ? gData.name.split(" ")[0] : "Google");
          lastName = gData.family_name || (gData.name ? gData.name.split(" ").slice(1).join(" ") : "Student");
          profileImageUrl = gData.picture || null;
        }
      }
    } catch {
      // Fallback
    }
  }

  if (!email) {
    res.status(400).json({ error: "Valid email is required from Google sign-in" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  let user = existing;
  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({
        email,
        firstName: firstName || "Google",
        lastName: lastName || "User",
        profileImageUrl: profileImageUrl || null,
        role: "student",
      })
      .returning();
    user = created;
  } else if (profileImageUrl && !user.profileImageUrl) {
    await db
      .update(usersTable)
      .set({ profileImageUrl })
      .where(eq(usersTable.id, user.id));
    user.profileImageUrl = profileImageUrl;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  res.json({ user: sessionData.user });
});

router.post("/auth/apple", async (req: Request, res: Response) => {
  const { email, firstName, lastName, profileImageUrl } = req.body ?? {};

  if (!email) {
    res.status(400).json({ error: "Valid email is required from Apple sign-in" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  let user = existing;
  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({
        email,
        firstName: firstName || "Apple",
        lastName: lastName || "User",
        profileImageUrl: profileImageUrl || null,
        role: "student",
      })
      .returning();
    user = created;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  res.json({ user: sessionData.user });
});

router.post("/auth/change-password", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (!sid) {
    res.status(401).json({ error: "Unauthorized. Please log in first." });
    return;
  }
  const session = await getSession(sid);
  if (!session || !session.user?.id) {
    res.status(401).json({ error: "Session expired. Please log in again." });
    return;
  }

  const { currentPassword, newPassword } = req.body ?? {};
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters long." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  // If user already has a passwordHash, check currentPassword
  if (user.passwordHash) {
    if (!currentPassword) {
      res.status(400).json({ error: "Current password is required." });
      return;
    }
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }
  }

  const newHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true, message: "Password updated successfully!" });
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

export default router;
