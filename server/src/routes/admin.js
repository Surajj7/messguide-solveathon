import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { clearMenuData } from "../services/menuClear.js";

const router = Router();

router.post("/clear-menu", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const deleteMenuItems = Boolean(req.body.deleteMenuItems);
    await clearMenuData({ deleteMenuItems });
    res.json({
      ok: true,
      deletedMenuCatalog: deleteMenuItems,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/overview", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const [
      studentCount,
      complaintCount,
      reviewAgg,
      suggestionsCount,
      leftovers,
      crowdCount,
      postsCount,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.complaint.count(),
      prisma.review.groupBy({
        by: ["menuItemId"],
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.suggestion.count(),
      prisma.leftoverEntry.findMany({ take: 500 }),
      prisma.crowdStatus.count(),
      prisma.communityPost.count(),
    ]);

    const items = await prisma.menuItem.findMany({
      where: { id: { in: reviewAgg.map((r) => r.menuItemId) } },
    });
    const idToName = Object.fromEntries(items.map((i) => [i.id, i.name]));

    const rated = reviewAgg
      .map((r) => ({
        menuItemId: r.menuItemId,
        name: idToName[r.menuItemId] || r.menuItemId,
        avg: r._avg.rating,
        count: r._count.rating,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => (b.avg || 0) - (a.avg || 0));

    const mostLiked = rated.slice(0, 5);
    const leastLiked = [...rated].sort((a, b) => (a.avg || 0) - (b.avg || 0)).slice(0, 5);

    const wasteByItem = {};
    for (const l of leftovers) {
      wasteByItem[l.itemName] = (wasteByItem[l.itemName] || 0) + l.quantity;
    }
    const highestWaste = Object.entries(wasteByItem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, quantity: qty }));

    res.json({
      totalStudents: studentCount,
      totalComplaints: complaintCount,
      totalSuggestions: suggestionsCount,
      crowdUpdates: crowdCount,
      communityPosts: postsCount,
      mostLikedDishes: mostLiked,
      leastLikedDishes: leastLiked,
      highestWasteItems: highestWaste,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/complaints", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { from, to, hostelBlock, messType, caterer } = req.query;
    const where = {};
    if (from || to) {
      where.menuDate = {};
      if (from) where.menuDate.gte = new Date(from);
      if (to) where.menuDate.lte = new Date(to);
    }
    const list = await prisma.complaint.findMany({
      where,
      include: {
        menuItem: true,
        user: {
          include: { studentProfile: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    let out = list;
    if (messType || hostelBlock || caterer) {
      out = list.filter((c) => {
        const p = c.user.studentProfile;
        if (!p) return false;
        if (messType && p.messType !== messType) return false;
        if (hostelBlock && p.hostelBlock !== hostelBlock) return false;
        if (caterer && p.caterer !== caterer) return false;
        return true;
      });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
});

/** Community moderation */
router.get("/community/posts", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const posts = await prisma.communityPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        author: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });
    const list = posts.map((p) => {
      let tagsParsed = [];
      try {
        tagsParsed = JSON.parse(p.tags || "[]");
      } catch {
        tagsParsed = [];
      }
      return { ...p, tagsParsed };
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get("/community/comments", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const comments = await prisma.communityComment.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        author: { select: { id: true, name: true, email: true } },
        post: { select: { id: true, content: true, createdAt: true } },
      },
    });
    res.json(comments);
  } catch (e) {
    next(e);
  }
});

router.delete("/community/comments/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    await prisma.communityComment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Comment not found" });
    }
    next(e);
  }
});

router.delete("/community/posts/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    await prisma.communityPost.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Post not found" });
    }
    next(e);
  }
});

export default router;
