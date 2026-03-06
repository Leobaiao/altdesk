import { NextFunction, Response } from "express";
import { verifyToken } from "./auth.js";
import { AuthenticatedRequest } from "./types/index.js";

export function authMw(req: any, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  try {
    req.user = verifyToken(h.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u) return res.status(403).json({ error: "Forbidden" });

    // SUPERADMIN can access ADMIN routes
    if (u.role === 'SUPERADMIN' && roles.includes('ADMIN')) {
      return next();
    }

    if (!roles.includes(u.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
