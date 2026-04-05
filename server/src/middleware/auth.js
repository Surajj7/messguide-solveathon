import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

export function authRequired(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/** Load full user from DB (optional use in routes) */
export async function attachUser(req, res, next) {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!u || !u.isActive) {
      return res.status(401).json({ error: "User not found or disabled" });
    }
    req.user = u;
    next();
  } catch (e) {
    next(e);
  }
}
