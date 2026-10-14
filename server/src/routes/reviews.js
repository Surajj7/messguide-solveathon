import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { upload, publicUploadPath } from "../lib/upload.js";

const router = Router();

/** Get student's review context (their assigned mess type & caterer, plus available options) */
router.get("/context", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId },
    });
    res.json({
      assignedMessType: profile?.messType || "VEG",
      assignedCaterer: profile?.caterer || "ZENITH",
      availableMessTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
      availableCaterers: ["ZENITH", "PROODLE", "FUSION", "SRRC", "CRCL"],
    });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  authRequired,
  requireRoles("STUDENT"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      const { menuItemId, menuDate, rating, comment, messType: reqMessType, caterer: reqCaterer } = req.body;
      const r = Number(rating);
      if (!menuItemId || !menuDate || Number.isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: "menuItemId, menuDate, rating 1-5 required" });
      }
      const d = new Date(menuDate);
      d.setHours(0, 0, 0, 0);
      const attachmentPath = req.file
        ? publicUploadPath(req.file.filename)
        : null;

      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.userId },
      });
      // Daily feedback strictly belongs to the student's assigned mess type and caterer
      const messType = profile?.messType || "VEG";
      const caterer = profile?.caterer || "ZENITH";

      const review = await prisma.review.create({
        data: {
          userId: req.userId,
          menuItemId,
          menuDate: d,
          rating: r,
          comment: comment || null,
          attachmentPath,
          messType,
          caterer,
        },
      });
      res.status(201).json(review);
    } catch (e) {
      next(e);
    }
  }
);

router.get("/mine", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const list = await prisma.review.findMany({
      where: { userId: req.userId },
      include: { menuItem: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

/** Mess / Admin filters */
router.get("/report", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { from, to, menuItemId, messType, caterer } = req.query;
    const where = {};
    if (from || to) {
      where.menuDate = {};
      if (from) where.menuDate.gte = new Date(from);
      if (to) where.menuDate.lte = new Date(to);
    }
    if (menuItemId) where.menuItemId = menuItemId;
    if (messType) where.messType = messType;
    if (caterer) where.caterer = caterer;

    const reviews = await prisma.review.findMany({
      where,
      include: { menuItem: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(reviews);
  } catch (e) {
    next(e);
  }
});

export default router;
