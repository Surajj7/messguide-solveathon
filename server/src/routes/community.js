import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { upload, publicUploadPath } from "../lib/upload.js";

const router = Router();

router.get("/", authRequired, async (req, res, next) => {
  try {
    const { q, tag, sort, period } = req.query;
    const where = {};
    if (period === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      where.createdAt = { gte: d };
    } else if (period === "month") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      where.createdAt = { gte: d };
    }

    let orderBy = { createdAt: "desc" };
    if (sort === "likes") {
      orderBy = { likes: { _count: "desc" } };
    } else if (sort === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (sort === "newest" || !sort) {
      orderBy = { createdAt: "desc" };
    }

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy,
      include: {
        author: { select: { id: true, name: true, email: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    let list = posts.map((p) => {
      let tags = [];
      try {
        tags = JSON.parse(p.tags || "[]");
      } catch {
        tags = [];
      }
      return { ...p, tagsParsed: tags };
    });
    if (tag) {
      list = list.filter((p) => p.tagsParsed.includes(tag));
    }
    if (q) {
      const qq = String(q).toLowerCase();
      list = list.filter((p) => p.content.toLowerCase().includes(qq));
    }
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  authRequired,
  requireRoles("STUDENT", "ADMIN"),
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
      let tagsRaw = req.body.tags;
      if (typeof tagsRaw === "string") {
        try {
          tagsRaw = JSON.parse(tagsRaw);
        } catch {
          tagsRaw = [];
        }
      }
      const content = (req.body.content || "").trim();
      if (!content && !req.file) {
        return res.status(400).json({ error: "Write something or attach a file" });
      }
      const tagStr = JSON.stringify(Array.isArray(tagsRaw) ? tagsRaw : []);
      const attachmentPath = req.file ? publicUploadPath(req.file.filename) : null;
      const post = await prisma.communityPost.create({
        data: {
          authorId: req.userId,
          content: content || "(attachment)",
          tags: tagStr,
          attachmentPath,
        },
      });
      res.status(201).json(post);
    } catch (e) {
      next(e);
    }
  }
);

router.post("/:id/like", authRequired, async (req, res, next) => {
  try {
    await prisma.communityPostLike.create({
      data: { postId: req.params.id, userId: req.userId },
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Already liked" });
    }
    next(e);
  }
});

router.post("/:id/comment", authRequired, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: "content required" });
    }
    const c = await prisma.communityComment.create({
      data: {
        postId: req.params.id,
        authorId: req.userId,
        content: content.trim(),
      },
    });
    res.status(201).json(c);
  } catch (e) {
    next(e);
  }
});

router.get("/:id/comments", authRequired, async (req, res, next) => {
  try {
    const list = await prisma.communityComment.findMany({
      where: { postId: req.params.id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true } } },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

export default router;
