import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/", authRequired, async (req, res, next) => {
  try {
    const list = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/read", authRequired, async (req, res, next) => {
  try {
    const existing = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }
    const n = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json(n);
  } catch (e) {
    next(e);
  }
});

router.post("/read-all", authRequired, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
