import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { notifyStudents } from "../services/notifications.js";

const router = Router();

router.post("/", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { level, note } = req.body;
    if (!level) {
      return res.status(400).json({ error: "level required" });
    }
    const row = await prisma.crowdStatus.create({
      data: {
        userId: req.userId,
        level,
        note: note || null,
      },
    });
    await notifyStudents({
      type: "CROWD",
      title: "Mess crowd update",
      message: `Current crowd: ${level.replace(/_/g, " ")}${note ? `. ${note}` : ""}`,
      metadata: { level },
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.get("/latest", authRequired, async (req, res, next) => {
  try {
    const latest = await prisma.crowdStatus.findFirst({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    res.json(latest);
  } catch (e) {
    next(e);
  }
});

router.get("/history", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const list = await prisma.crowdStatus.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true } } },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

export default router;
