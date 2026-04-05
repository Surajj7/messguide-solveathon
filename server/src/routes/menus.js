import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { getMenuForDate } from "../services/menuResolve.js";

const router = Router();

/** Public-ish: needs auth to know mess type for student; query messType for staff */
router.get("/day", authRequired, async (req, res, next) => {
  try {
    let messType = req.query.messType;
    if (!messType && req.userRole === "STUDENT") {
      const p = await prisma.studentProfile.findUnique({
        where: { userId: req.userId },
      });
      messType = p?.messType || "VEG";
    }
    if (!messType) {
      return res.status(400).json({ error: "messType required" });
    }
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await getMenuForDate(new Date(dateStr + "T12:00:00"), messType);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/items/:id", authRequired, async (req, res, next) => {
  try {
    const item = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }
    let tags = [];
    try {
      tags = JSON.parse(item.tags || "[]");
    } catch {
      tags = [];
    }
    res.json({ ...item, tags });
  } catch (e) {
    next(e);
  }
});

router.get("/items", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: { name: "asc" },
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

/** Add single menu date entry (mess/admin) */
router.post("/date-entry", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { menuDate, messType, mealSlot, menuItemId, sortOrder } = req.body;
    const d = new Date(menuDate);
    d.setHours(0, 0, 0, 0);
    const entry = await prisma.menuDateEntry.create({
      data: {
        menuDate: d,
        messType,
        mealSlot,
        menuItemId,
        sortOrder: sortOrder ?? 0,
      },
      include: { menuItem: true },
    });
    res.status(201).json(entry);
  } catch (e) {
    next(e);
  }
});

/** Template entry */
router.post("/template-entry", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { dayOfWeek, messType, mealSlot, menuItemId, sortOrder } = req.body;
    const entry = await prisma.menuTemplateEntry.create({
      data: {
        dayOfWeek: Number(dayOfWeek),
        messType,
        mealSlot,
        menuItemId,
        sortOrder: sortOrder ?? 0,
      },
      include: { menuItem: true },
    });
    res.status(201).json(entry);
  } catch (e) {
    next(e);
  }
});

router.delete("/date-entry/:id", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    await prisma.menuDateEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete("/template-entry/:id", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    await prisma.menuTemplateEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
