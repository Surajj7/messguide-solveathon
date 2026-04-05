import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

const router = Router();

/**
 * Parse YYYY-MM-DD to a Date that matches PostgreSQL @db.Date reliably.
 * Avoids `new Date("2026-04-03")` + local setHours() shifting the calendar day.
 */
function parseDateOnlyUTC(dateStr) {
  const s = String(dateStr).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(Date.UTC(y, mo, day));
}

async function studentMessType(req) {
  const p = await prisma.studentProfile.findUnique({ where: { userId: req.userId } });
  return p?.messType || "VEG";
}

/** Upsert leftover: same day + meal + menu item updates quantity */
router.post("/", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { entryDate, mealSlot, itemName, quantity, unit, messType, menuItemId } = req.body;
    if (!entryDate || !mealSlot || quantity === "" || quantity === undefined || quantity === null) {
      return res.status(400).json({ error: "entryDate, mealSlot, quantity required" });
    }
    const d = parseDateOnlyUTC(entryDate);
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: "quantity must be a non-negative number" });
    }
    const unitStr = String(unit ?? "kg").trim() || "kg";

    const mid = menuItemId ? String(menuItemId) : null;
    let resolvedName = (itemName || "").trim();
    if (mid) {
      const mi = await prisma.menuItem.findUnique({ where: { id: mid } });
      if (!mi) {
        return res.status(400).json({ error: "Invalid menuItemId" });
      }
      resolvedName = mi.name;
    }
    if (!resolvedName) {
      return res.status(400).json({ error: "itemName or menuItemId required" });
    }

    const mt =
      messType === "VEG" || messType === "NON_VEG" || messType === "SPECIAL" ? messType : null;

    let existing = null;
    if (mid) {
      existing = await prisma.leftoverEntry.findFirst({
        where: { entryDate: d, mealSlot, menuItemId: mid, messType: mt },
      });
      if (!existing && mt) {
        existing = await prisma.leftoverEntry.findFirst({
          where: { entryDate: d, mealSlot, menuItemId: mid, messType: null },
        });
      }
    } else {
      existing = await prisma.leftoverEntry.findFirst({
        where: { entryDate: d, mealSlot, menuItemId: null, itemName: resolvedName, messType: mt },
      });
      if (!existing && mt) {
        existing = await prisma.leftoverEntry.findFirst({
          where: { entryDate: d, mealSlot, menuItemId: null, itemName: resolvedName, messType: null },
        });
      }
    }

    const common = {
      itemName: resolvedName,
      quantity: qty,
      unit: unitStr,
      messType: mt,
      menuItemId: mid,
    };

    if (existing) {
      const row = await prisma.leftoverEntry.update({
        where: { id: existing.id },
        data: common,
        include: { menuItem: { select: { id: true, name: true } } },
      });
      return res.json(row);
    }

    const row = await prisma.leftoverEntry.create({
      data: {
        entryDate: d,
        mealSlot,
        ...common,
      },
      include: { menuItem: { select: { id: true, name: true } } },
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

/** List entries — students see only their mess type */
router.get("/", authRequired, async (req, res, next) => {
  try {
    const { from, to, menuItemId } = req.query;
    let messTypeFilter = req.query.messType;
    if (req.userRole === "STUDENT") {
      messTypeFilter = await studentMessType(req);
    }
    const where = {};
    if (messTypeFilter) {
      where.messType = messTypeFilter;
    }
    if (menuItemId) {
      where.menuItemId = menuItemId;
    }
    if (from || to) {
      where.entryDate = {};
      if (from) {
        where.entryDate.gte = parseDateOnlyUTC(from);
      }
      if (to) {
        where.entryDate.lte = parseDateOnlyUTC(to);
      }
    }
    const rows = await prisma.leftoverEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { mealSlot: "asc" }],
      include: { menuItem: { select: { id: true, name: true } } },
      take: 500,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Time series for charts (per menu item) */
router.get("/series", authRequired, async (req, res, next) => {
  try {
    const { menuItemId, from, to } = req.query;
    if (!menuItemId) {
      return res.status(400).json({ error: "menuItemId required" });
    }
    let messTypeFilter = req.query.messType;
    if (req.userRole === "STUDENT") {
      messTypeFilter = await studentMessType(req);
    }
    const where = {
      menuItemId,
      messType: messTypeFilter || undefined,
    };
    if (!where.messType) {
      delete where.messType;
    }
    if (from || to) {
      where.entryDate = {};
      if (from) {
        where.entryDate.gte = parseDateOnlyUTC(from);
      }
      if (to) {
        where.entryDate.lte = parseDateOnlyUTC(to);
      }
    }
    const rows = await prisma.leftoverEntry.findMany({
      where,
      orderBy: { entryDate: "asc" },
      include: { menuItem: { select: { name: true } } },
    });
    const first = rows[0];
    res.json({
      itemName: first?.menuItem?.name || first?.itemName || "",
      unit: first?.unit || "kg",
      points: rows.map((r) => ({
        date: r.entryDate.toISOString().slice(0, 10),
        quantity: r.quantity,
        mealSlot: r.mealSlot,
        unit: r.unit,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** Distinct menu items that have leftover logs (for chart pickers) */
router.get("/tracked-items", authRequired, async (req, res, next) => {
  try {
    let messTypeFilter = req.query.messType;
    if (req.userRole === "STUDENT") {
      messTypeFilter = await studentMessType(req);
    }
    const { from, to } = req.query;
    const where = {
      menuItemId: { not: null },
      messType: messTypeFilter || undefined,
    };
    if (!where.messType) {
      delete where.messType;
    }
    if (from || to) {
      where.entryDate = {};
      if (from) {
        where.entryDate.gte = parseDateOnlyUTC(from);
      }
      if (to) {
        where.entryDate.lte = parseDateOnlyUTC(to);
      }
    }
    const rows = await prisma.leftoverEntry.findMany({
      where,
      select: { menuItemId: true, itemName: true },
    });
    const map = new Map();
    for (const r of rows) {
      if (r.menuItemId && !map.has(r.menuItemId)) {
        map.set(r.menuItemId, r.itemName);
      }
    }
    res.json([...map.entries()].map(([menuItemId, itemName]) => ({ menuItemId, itemName })));
  } catch (e) {
    next(e);
  }
});

router.get("/summary", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.entryDate = {};
      if (from) {
        where.entryDate.gte = parseDateOnlyUTC(from);
      }
      if (to) {
        where.entryDate.lte = parseDateOnlyUTC(to);
      }
    }
    const rows = await prisma.leftoverEntry.findMany({
      where,
      orderBy: { entryDate: "asc" },
    });
    const byItem = {};
    for (const r of rows) {
      const key = r.menuItemId ? `${r.itemName} (${r.menuItemId.slice(0, 8)})` : r.itemName;
      byItem[key] = (byItem[key] || 0) + r.quantity;
    }
    const topWaste = Object.entries(byItem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, qty]) => ({ name, quantity: qty }));
    res.json({ rows, topWaste });
  } catch (e) {
    next(e);
  }
});

export default router;
