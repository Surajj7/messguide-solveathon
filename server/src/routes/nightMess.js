import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { notifyStudents } from "../services/notifications.js";
import { NIGHT_MESS_CATALOG } from "../constants/nightMessCatalog.js";

const router = Router();

const CATALOG_NAMES = new Set(NIGHT_MESS_CATALOG.map((c) => c.name));
const CATALOG_PRICE = Object.fromEntries(
  NIGHT_MESS_CATALOG.map((c) => [c.name, c.priceInr])
);

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function stockFlags(availableQty, remainingQty) {
  const soldOut = availableQty > 0 && remainingQty <= 0;
  const lowStock =
    remainingQty > 0 && remainingQty <= Math.max(3, availableQty * 0.1);
  return { soldOut, lowStock };
}

async function loadNightMessDay(dateStr) {
  const d = startOfDay(new Date(dateStr + "T12:00:00"));
  const dbItems = await prisma.nightMessItem.findMany({
    where: { serviceDate: d },
    orderBy: { name: "asc" },
  });
  const byName = Object.fromEntries(dbItems.map((i) => [i.name, i]));

  const items = NIGHT_MESS_CATALOG.map((c) => {
    const row = byName[c.name];
    const availableQty = row?.availableQty ?? 0;
    const remainingQty = row?.remainingQty ?? 0;
    const { soldOut, lowStock } = stockFlags(availableQty, remainingQty);
    return {
      id: row?.id ?? null,
      name: c.name,
      price: c.priceInr,
      currency: "INR",
      availableQty,
      remainingQty,
      catalog: true,
      notListed: !row || availableQty <= 0,
      soldOut,
      lowStock,
    };
  });

  for (const row of dbItems) {
    if (CATALOG_NAMES.has(row.name)) continue;
    const { soldOut, lowStock } = stockFlags(row.availableQty, row.remainingQty);
    items.push({
      id: row.id,
      name: row.name,
      price: row.price,
      currency: "INR",
      availableQty: row.availableQty,
      remainingQty: row.remainingQty,
      catalog: false,
      isExtra: true,
      notListed: row.availableQty <= 0,
      soldOut,
      lowStock,
    });
  }

  return { date: d.toISOString().slice(0, 10), items };
}

router.get("/", authRequired, async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const payload = await loadNightMessDay(dateStr);
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

/**
 * Bulk upsert catalog items for a service date. Prices are always from NIGHT_MESS_CATALOG.
 * availableQty 0 removes that catalog row for the day.
 */
router.post(
  "/sync-day",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const { serviceDate, entries } = req.body;
      if (!serviceDate) {
        return res.status(400).json({ error: "serviceDate required" });
      }
      if (!Array.isArray(entries)) {
        return res.status(400).json({ error: "entries array required" });
      }

      const d = startOfDay(new Date(serviceDate));

      await prisma.$transaction(async (tx) => {
        for (const e of entries) {
          const name = String(e?.name || "").trim();
          if (!CATALOG_PRICE[name]) continue;

          const av = Math.max(0, Math.floor(Number(e.availableQty) || 0));
          let rem =
            e.remainingQty !== undefined && e.remainingQty !== ""
              ? Math.floor(Number(e.remainingQty))
              : av;
          rem = Math.min(Math.max(0, rem), av);

          const price = CATALOG_PRICE[name];

          if (av === 0) {
            await tx.nightMessItem.deleteMany({
              where: { serviceDate: d, name },
            });
            continue;
          }

          await tx.nightMessItem.upsert({
            where: {
              serviceDate_name: { serviceDate: d, name },
            },
            create: {
              serviceDate: d,
              name,
              price,
              availableQty: av,
              remainingQty: rem,
            },
            update: {
              price,
              availableQty: av,
              remainingQty: rem,
            },
          });
        }
      });

      const dateOnly =
        typeof serviceDate === "string"
          ? serviceDate.slice(0, 10)
          : d.toISOString().slice(0, 10);
      const payload = await loadNightMessDay(dateOnly);
      res.json(payload);
    } catch (e) {
      next(e);
    }
  }
);

router.patch("/:id/stock", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { remainingQty } = req.body;
    const before = await prisma.nightMessItem.findUnique({ where: { id: req.params.id } });
    const item = await prisma.nightMessItem.update({
      where: { id: req.params.id },
      data: { remainingQty: Number(remainingQty) },
    });
    if (before && item.remainingQty <= 0 && before.remainingQty > 0) {
      await notifyStudents({
        type: "NIGHT_MESS",
        title: "Night mess update",
        message: `${item.name} is sold out tonight.`,
        metadata: { itemId: item.id },
      });
    }
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.post("/item", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { serviceDate, name, price, availableQty, remainingQty } = req.body;
    const d = startOfDay(new Date(serviceDate));
    const item = await prisma.nightMessItem.upsert({
      where: {
        serviceDate_name: { serviceDate: d, name },
      },
      create: {
        serviceDate: d,
        name,
        price: Number(price),
        availableQty: Number(availableQty),
        remainingQty: Number(remainingQty ?? availableQty),
      },
      update: {
        price: Number(price),
        availableQty: Number(availableQty),
        remainingQty: Number(remainingQty ?? availableQty),
      },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

export default router;
