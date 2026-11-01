import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
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
    req.log?.error?.({ err }, "authMiddleware error during session lookup");
  }
  req.isAuthenticated = () => false;
  next();
}
