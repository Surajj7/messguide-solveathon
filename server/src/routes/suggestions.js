import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

const router = Router();

router.post("/", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const { text, category } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: "text required" });
    }
    const s = await prisma.suggestion.create({
      data: {
        userId: req.userId,
        text: text.trim(),
        category: category || null,
      },
    });
    res.status(201).json(s);
  } catch (e) {
    next(e);
  }
});

router.get("/", authRequired, async (req, res, next) => {
  try {
    const list = await prisma.suggestion.findMany({
      orderBy: { upvoteCount: "desc" },
      include: { user: { select: { name: true, id: true } } },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/upvote", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    await prisma.suggestionVote.create({
      data: {
        suggestionId: req.params.id,
        userId: req.userId,
      },
    });
    const s = await prisma.suggestion.update({
      where: { id: req.params.id },
      data: { upvoteCount: { increment: 1 } },
    });
    res.json(s);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Already upvoted" });
    }
    next(e);
  }
});

export default router;
