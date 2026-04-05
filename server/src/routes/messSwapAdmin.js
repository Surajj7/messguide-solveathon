import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { cancelCatererSwapRequest, reviewMessUpgrade } from "../services/messSwap.service.js";

const router = Router();

const MESS_TYPES = ["VEG", "NON_VEG", "SPECIAL"];
const CATERERS = ["ZENITH", "SRRC", "GRACE", "RASSENCE", "PROODLE", "FUSION"];

function parseFilters(q) {
  return {
    q: (q.q || "").trim().toLowerCase(),
    registrationNo: (q.registrationNo || "").trim().toLowerCase(),
    requestType: q.requestType || "",
    messType: q.messType || "",
    status: q.status || "",
    from: q.from || "",
    to: q.to || "",
  };
}

function userMatchesSearch(user, f) {
  if (!f.q && !f.registrationNo) return true;
  const name = (user.name || "").toLowerCase();
  const email = (user.email || "").toLowerCase();
  const reg = (user.studentProfile?.registrationNo || "").toLowerCase();
  if (f.registrationNo && !reg.includes(f.registrationNo)) return false;
  if (f.q && !name.includes(f.q) && !email.includes(f.q) && !reg.includes(f.q)) return false;
  return true;
}

router.get("/stats", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const [
      catererTotal,
      upgradePending,
      upgradeApproved,
      options,
      catererConfirmed,
    ] = await Promise.all([
      prisma.catererSwapRequest.count(),
      prisma.messUpgradeRequest.count({ where: { status: "PENDING" } }),
      prisma.messUpgradeRequest.count({ where: { status: "APPROVED" } }),
      prisma.catererSwapOption.findMany(),
      prisma.catererSwapRequest.groupBy({
        by: ["optionId"],
        where: { status: "CONFIRMED" },
        _count: { _all: true },
      }),
    ]);
    const usedMap = Object.fromEntries(catererConfirmed.map((g) => [g.optionId, g._count._all]));
    let totalSlots = 0;
    let slotsUsed = 0;
    for (const o of options) {
      totalSlots += o.totalSlots;
      slotsUsed += usedMap[o.id] || 0;
    }
    res.json({
      totalCatererSwapRequests: catererTotal,
      pendingMessUpgrades: upgradePending,
      approvedMessUpgrades: upgradeApproved,
      totalSlotCapacity: totalSlots,
      slotsUsed,
      slotsLeft: Math.max(0, totalSlots - slotsUsed),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/options", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const options = await prisma.catererSwapOption.findMany({
      orderBy: [{ messType: "asc" }, { fromCaterer: "asc" }, { toCaterer: "asc" }],
    });
    const withSlots = await Promise.all(
      options.map(async (opt) => {
        const used = await prisma.catererSwapRequest.count({
          where: { optionId: opt.id, status: "CONFIRMED" },
        });
        return { ...opt, slotsUsed: used, slotsLeft: Math.max(0, opt.totalSlots - used) };
      })
    );
    res.json(withSlots);
  } catch (e) {
    next(e);
  }
});

router.post("/options", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { messType, fromCaterer, toCaterer, totalSlots, isActive } = req.body;
    if (!MESS_TYPES.includes(messType) || !CATERERS.includes(fromCaterer) || !CATERERS.includes(toCaterer)) {
      return res.status(400).json({ error: "Invalid messType or caterer" });
    }
    if (fromCaterer === toCaterer) {
      return res.status(400).json({ error: "fromCaterer and toCaterer must differ" });
    }
    const n = Number(totalSlots);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ error: "totalSlots must be a non-negative number" });
    }
    const row = await prisma.catererSwapOption.create({
      data: {
        messType,
        fromCaterer,
        toCaterer,
        totalSlots: Math.floor(n),
        isActive: isActive !== false,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "An option for this mess type and caterer pair already exists" });
    }
    next(e);
  }
});

router.patch("/options/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { totalSlots, isActive } = req.body;
    const data = {};
    if (totalSlots !== undefined) {
      const n = Number(totalSlots);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: "totalSlots invalid" });
      }
      const used = await prisma.catererSwapRequest.count({
        where: { optionId: req.params.id, status: "CONFIRMED" },
      });
      if (Math.floor(n) < used) {
        return res.status(400).json({
          error: `totalSlots cannot be below current confirmed count (${used})`,
        });
      }
      data.totalSlots = Math.floor(n);
    }
    if (typeof isActive === "boolean") data.isActive = isActive;
    const row = await prisma.catererSwapOption.update({
      where: { id: req.params.id },
      data,
    });
    res.json(row);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Option not found" });
    }
    next(e);
  }
});

router.get("/caterer-requests", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const f = parseFilters(req.query);
    const list = await prisma.catererSwapRequest.findMany({
      include: {
        user: { include: { studentProfile: true } },
        option: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    let filtered = list.filter((r) => userMatchesSearch(r.user, f));
    if (f.messType && MESS_TYPES.includes(f.messType)) {
      filtered = filtered.filter((r) => r.messTypeSnapshot === f.messType);
    }
    if (f.status) {
      filtered = filtered.filter((r) => r.status === f.status);
    }
    if (f.from) {
      const t = new Date(f.from);
      filtered = filtered.filter((r) => new Date(r.createdAt) >= t);
    }
    if (f.to) {
      const t = new Date(f.to);
      t.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => new Date(r.createdAt) <= t);
    }
    if (f.requestType && f.requestType !== "CATERER" && f.requestType !== "ALL") {
      filtered = [];
    }
    res.json(filtered);
  } catch (e) {
    next(e);
  }
});

router.patch("/caterer-requests/:id/cancel", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { adminNote } = req.body;
    const row = await cancelCatererSwapRequest(req.params.id, req.userId, adminNote);
    res.json(row);
  } catch (e) {
    if (e.statusCode) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    next(e);
  }
});

router.get("/upgrade-requests", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const f = parseFilters(req.query);
    const list = await prisma.messUpgradeRequest.findMany({
      include: {
        user: { include: { studentProfile: true } },
        reviewedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    let filtered = list.filter((r) => userMatchesSearch(r.user, f));
    if (f.messType && MESS_TYPES.includes(f.messType)) {
      filtered = filtered.filter((r) => r.targetMessType === f.messType);
    }
    if (f.status) {
      filtered = filtered.filter((r) => r.status === f.status);
    }
    if (f.from) {
      const t = new Date(f.from);
      filtered = filtered.filter((r) => new Date(r.createdAt) >= t);
    }
    if (f.to) {
      const t = new Date(f.to);
      t.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => new Date(r.createdAt) <= t);
    }
    if (f.requestType && f.requestType !== "UPGRADE" && f.requestType !== "ALL") {
      filtered = [];
    }
    res.json(filtered);
  } catch (e) {
    next(e);
  }
});

router.patch("/upgrade-requests/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { status, adminRemarks, assignedCaterer } = req.body;
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "status must be APPROVED or REJECTED" });
    }
    if (status === "APPROVED" && assignedCaterer && !CATERERS.includes(assignedCaterer)) {
      return res.status(400).json({ error: "Invalid assignedCaterer" });
    }
    const row = await reviewMessUpgrade(req.params.id, req.userId, {
      status,
      adminRemarks,
      assignedCaterer,
    });
    res.json(row);
  } catch (e) {
    if (e.statusCode) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    next(e);
  }
});

export default router;
