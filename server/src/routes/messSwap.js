import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import {
  applyCatererSwap,
  createMessUpgradeRequest,
} from "../services/messSwap.service.js";
import adminMessSwapRouter from "./messSwapAdmin.js";

const router = Router();

const MESS_TYPES = ["VEG", "NON_VEG", "SPECIAL"];

/** Student: eligible caterer swap options for current profile */
router.get("/options/eligible", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId },
    });
    if (!profile) {
      return res.status(400).json({ error: "Student profile not found" });
    }
    const options = await prisma.catererSwapOption.findMany({
      where: {
        isActive: true,
        messType: profile.messType,
        fromCaterer: profile.caterer,
      },
      orderBy: [{ messType: "asc" }, { fromCaterer: "asc" }, { toCaterer: "asc" }],
    });
    const withSlots = await Promise.all(
      options.map(async (opt) => {
        const used = await prisma.catererSwapRequest.count({
          where: { optionId: opt.id, status: "CONFIRMED" },
        });
        return {
          ...opt,
          slotsUsed: used,
          slotsLeft: Math.max(0, opt.totalSlots - used),
        };
      })
    );
    res.json({
      profile: {
        messType: profile.messType,
        caterer: profile.caterer,
        registrationNo: profile.registrationNo,
      },
      options: withSlots,
    });
  } catch (e) {
    next(e);
  }
});

router.post("/caterer/apply", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const { optionId } = req.body;
    if (!optionId) {
      return res.status(400).json({ error: "optionId required" });
    }
    const row = await applyCatererSwap(req.userId, optionId);
    res.status(201).json(row);
  } catch (e) {
    if (e.statusCode) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    next(e);
  }
});

router.get("/caterer/my", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const list = await prisma.catererSwapRequest.findMany({
      where: { userId: req.userId },
      include: { option: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post("/upgrade", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const { targetMessType, paymentId } = req.body;
    if (!targetMessType || !MESS_TYPES.includes(targetMessType)) {
      return res.status(400).json({ error: "Valid targetMessType required" });
    }
    const row = await createMessUpgradeRequest(req.userId, targetMessType, paymentId);
    res.status(201).json(row);
  } catch (e) {
    if (e.statusCode) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    next(e);
  }
});

router.get("/upgrade/my", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const list = await prisma.messUpgradeRequest.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { name: true } } },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

/** Combined history for student UI */
router.get("/history", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const [caterer, upgrade] = await Promise.all([
      prisma.catererSwapRequest.findMany({
        where: { userId: req.userId },
        include: { option: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.messUpgradeRequest.findMany({
        where: { userId: req.userId },
        include: { reviewedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    res.json({ catererSwaps: caterer, messUpgrades: upgrade });
  } catch (e) {
    next(e);
  }
});

router.use("/admin", adminMessSwapRouter);

export default router;
