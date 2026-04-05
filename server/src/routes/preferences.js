import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

const router = Router();

router.post("/", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const { forDate, menuType, notes } = req.body;
    if (!forDate || !menuType) {
      return res.status(400).json({ error: "forDate, menuType required" });
    }
    const d = new Date(forDate);
    d.setHours(0, 0, 0, 0);
    const row = await prisma.mealPreference.create({
      data: {
        userId: req.userId,
        forDate: d,
        menuType,
        notes: notes || null,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.get("/mine", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const list = await prisma.mealPreference.findMany({
      where: { userId: req.userId },
      orderBy: { forDate: "desc" },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

/** Mess/Admin: aggregate preferences for forecasting */
router.get("/summary", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.forDate = {};
      if (from) where.forDate.gte = new Date(from);
      if (to) where.forDate.lte = new Date(to);
    }
    const rows = await prisma.mealPreference.findMany({ where });
    const byType = {};
    for (const r of rows) {
      byType[r.menuType] = (byType[r.menuType] || 0) + 1;
    }
    res.json({ total: rows.length, byMenuType: byType, rows });
  } catch (e) {
    next(e);
  }
});

export default router;
