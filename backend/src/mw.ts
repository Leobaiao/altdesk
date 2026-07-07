import { NextFunction, Response } from "express";
import { verifyToken } from "./auth.js";
import { AuthenticatedRequest } from "./types/index.js";
import { getPool } from "./db.js";

export async function authMw(req: any, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  try {
    const decoded = verifyToken(h.slice(7));

    const pool = await getPool();
    const r = await pool.request()
      .input("userId", decoded.userId)
      .query(`
        SELECT u.Role, u.PermissionsJson, u.IsActive, u.DeletedAt,
               s.ExpiresAt, s.PlanCode, s.IsActive as SubActive, s.TrialExtended, s.GraceCount, s.GraceExpiresAt
        FROM altdesk.[User] u
        LEFT JOIN altdesk.Subscription s ON s.TenantId = u.TenantId
        WHERE u.UserId = @userId
      `);

    if (r.recordset.length === 0) return res.status(401).json({ error: "User not found" });
    const u = r.recordset[0];

    if (!u.IsActive || u.DeletedAt) {
      return res.status(403).json({ error: "Account deactivated or deleted" });
    }

    if (u.SubActive === false) {
      return res.status(403).json({ error: "Account suspended" });
    }

    if (u.ExpiresAt && new Date(u.ExpiresAt) < new Date()) {
      const allowedPaths = ['/api/billing', '/api/settings/extend-trial', '/api/auth/me', '/api/profile'];
      const isAllowed = allowedPaths.some(p => req.originalUrl.startsWith(p));
      if (!isAllowed) {
          return res.status(402).json({ 
              error: "Assinatura Expirada", 
              planCode: u.PlanCode,
              trialExtended: u.TrialExtended || 0,
              redirectToOffer: u.GraceCount >= 1
          });
      }
    }

    decoded.role = u.Role;
    if (u.PermissionsJson) {
      try {
        decoded.permissions = JSON.parse(u.PermissionsJson);
      } catch (e) {}
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u) return res.status(403).json({ error: "Forbidden" });

    // SUPERADMIN can access everything
    if (u.role === 'SUPERADMIN') return next();

    if (!roles.includes(u.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u) return res.status(403).json({ error: "Forbidden" });

    // SUPERADMIN and ADMIN can access everything
    if (u.role === 'SUPERADMIN' || u.role === 'ADMIN') return next();

    // Check granular permissions — user needs ANY of the listed permissions
    if (u.permissions) {
      const hasAny = permissions.some(p => (u.permissions as any)[p] === true);
      if (hasAny) return next();
    }

    return res.status(403).json({ 
      error: "Acesso Negado", 
      message: `Você não tem a permissão necessária: ${permissions.join(' ou ')}` 
    });
  };
}
