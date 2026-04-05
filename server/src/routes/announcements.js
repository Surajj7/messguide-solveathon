import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { notifyStudents } from "../services/notifications.js";

const router = Router();

router.post("/", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "title, body required" });
    }
    const a = await prisma.announcement.create({
      data: {
        authorId: req.userId,
        title,
        body,
      },
    });
    await notifyStudents({
      type: "ANNOUNCEMENT",
      title,
      message: body.slice(0, 500),
      metadata: { announcementId: a.id },
    });
    res.status(201).json(a);
  } catch (e) {
    next(e);
  }
});

router.get("/", authRequired, async (req, res, next) => {
  try {
    const list = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { name: true } } },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

export default router;
