import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { upload, publicUploadPath } from "../lib/upload.js";

const router = Router();

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
      const { menuItemId, menuDate, rating, comment } = req.body;
      const r = Number(rating);
      if (!menuItemId || !menuDate || Number.isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: "menuItemId, menuDate, rating 1-5 required" });
      }
      const d = new Date(menuDate);
      d.setHours(0, 0, 0, 0);
      const attachmentPath = req.file
        ? publicUploadPath(req.file.filename)
        : null;
      const review = await prisma.review.create({
        data: {
          userId: req.userId,
          menuItemId,
          menuDate: d,
          rating: r,
          comment: comment || null,
          attachmentPath,
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
    const { from, to, menuItemId, messType } = req.query;
    const where = {};
    if (from || to) {
      where.menuDate = {};
      if (from) where.menuDate.gte = new Date(from);
      if (to) where.menuDate.lte = new Date(to);
    }
    if (menuItemId) where.menuItemId = menuItemId;
    const reviews = await prisma.review.findMany({
      where,
      include: { menuItem: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    let filtered = reviews;
    if (messType) {
      const students = await prisma.studentProfile.findMany({
        where: { messType },
        select: { userId: true },
      });
      const ids = new Set(students.map((s) => s.userId));
      filtered = reviews.filter((r) => ids.has(r.userId));
    }
    res.json(filtered);
  } catch (e) {
    next(e);
  }
});

export default router;
