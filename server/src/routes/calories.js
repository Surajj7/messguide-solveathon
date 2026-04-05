import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

const router = Router();

/** Suggested daily kcal from health goal (display only) */
const GOAL_KCAL_BY_HEALTH = {
  WEIGHT_LOSS: 1800,
  MUSCLE_GAIN: 2600,
  MAINTENANCE: 2200,
  HIGH_PROTEIN: 2400,
  BALANCED: 2200,
};

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

router.get("/summary", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);

    const [profile, rows] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId: req.userId } }),
      prisma.calorieEntry.findMany({
        where: {
          userId: req.userId,
          logDate: { gte: from },
        },
        select: { logDate: true, calories: true },
      }),
    ]);

    const byDay = new Map();
    for (const r of rows) {
      const key = dayStart(r.logDate).toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + r.calories);
    }

    const daily = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      daily.push({ date: key, total: Math.round(byDay.get(key) || 0) });
    }

    const health = profile?.healthGoal || "BALANCED";
    const goalKcal = GOAL_KCAL_BY_HEALTH[health] ?? 2200;

    const last7 = daily.slice(-7);
    const sum7 = last7.reduce((s, x) => s + x.total, 0);
    const avg7d = last7.length ? Math.round(sum7 / last7.length) : 0;

    res.json({
      goalKcal,
      healthGoal: health,
      daily,
      avg7d,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/entries", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const d = dayStart(dateStr + "T12:00:00");
    const list = await prisma.calorieEntry.findMany({
      where: { userId: req.userId, logDate: d },
      include: { menuItem: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const dayTotal = list.reduce((s, e) => s + e.calories, 0);
    res.json({ date: dateStr, entries: list, dayTotal: Math.round(dayTotal) });
  } catch (e) {
    next(e);
  }
});

/** Log several menu dishes at once (e.g. full lunch plate) */
router.post("/batch", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const { logDate, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }
    if (items.length > 80) {
      return res.status(400).json({ error: "Too many items at once" });
    }

    const ds = logDate || new Date().toISOString().slice(0, 10);
    const d = dayStart(ds + "T12:00:00");

    const rowData = [];
    for (const it of items) {
      const kcal = Number(it.calories);
      if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 20000) {
        return res.status(400).json({ error: "Each item needs valid calories" });
      }
      rowData.push({
        userId: req.userId,
        logDate: d,
        calories: kcal,
        label: typeof it.label === "string" && it.label.trim() ? it.label.trim() : null,
        menuItemId: it.menuItemId || null,
      });
    }

    const created = await prisma.$transaction(
      rowData.map((data) =>
        prisma.calorieEntry.create({
          data,
          include: { menuItem: { select: { id: true, name: true } } },
        })
      )
    );

    res.status(201).json({ count: created.length, entries: created });
  } catch (e) {
    next(e);
  }
});

router.post("/", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const { logDate, calories, label, menuItemId } = req.body;
    const kcal = Number(calories);
    if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 20000) {
      return res.status(400).json({ error: "calories must be a positive number" });
    }
    const ds = logDate || new Date().toISOString().slice(0, 10);
    const d = dayStart(ds + "T12:00:00");

    const entry = await prisma.calorieEntry.create({
      data: {
        userId: req.userId,
        logDate: d,
        calories: kcal,
        label: label?.trim() || null,
        menuItemId: menuItemId || null,
      },
      include: { menuItem: { select: { id: true, name: true } } },
    });
    res.status(201).json(entry);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const existing = await prisma.calorieEntry.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }
    await prisma.calorieEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
