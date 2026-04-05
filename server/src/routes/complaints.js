import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { COMPLAINT_ESCALATION_THRESHOLD } from "../config.js";
import { notifyAdmins, notifyStudents } from "../services/notifications.js";
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
      const { menuItemId, menuDate, issueType, description } = req.body;
      if (!menuItemId || !menuDate || !issueType) {
        return res.status(400).json({ error: "menuItemId, menuDate, issueType required" });
      }
      const d = new Date(menuDate);
      d.setHours(0, 0, 0, 0);
      const attachmentPath = req.file ? publicUploadPath(req.file.filename) : null;
      const complaint = await prisma.complaint.create({
        data: {
          userId: req.userId,
          menuItemId,
          menuDate: d,
          issueType,
          description: description || null,
          attachmentPath,
        },
      });

      const count = await prisma.complaint.count({
        where: {
          menuItemId,
          menuDate: d,
          escalated: false,
        },
      });

      let updated = complaint;
      if (count >= COMPLAINT_ESCALATION_THRESHOLD) {
        await prisma.complaint.updateMany({
          where: { menuItemId, menuDate: d },
          data: { escalated: true },
        });
        const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
        await notifyAdmins({
          type: "ESCALATION",
          title: "High complaint volume",
          message: `Item "${item?.name || menuItemId}" on ${d.toISOString().slice(0, 10)} reached ${count} complaints.`,
          metadata: { menuItemId, menuDate: d.toISOString() },
        });
        await notifyStudents({
          type: "COMPLAINT",
          title: "Mess quality notice",
          message: "Management is reviewing feedback for a menu item today.",
          metadata: {},
        });
        updated = await prisma.complaint.findUnique({ where: { id: complaint.id } });
      }

      res.status(201).json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.get("/report", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { from, to, menuItemId, messType, hostelBlock, escalated } = req.query;
    const where = {};
    if (from || to) {
      where.menuDate = {};
      if (from) where.menuDate.gte = new Date(from);
      if (to) where.menuDate.lte = new Date(to);
    }
    if (menuItemId) where.menuItemId = menuItemId;
    if (escalated === "true") where.escalated = true;

    const list = await prisma.complaint.findMany({
      where,
      include: {
        menuItem: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let out = list;
    if (messType || hostelBlock) {
      const profs = await prisma.studentProfile.findMany({
        where: {
          ...(messType ? { messType } : {}),
          ...(hostelBlock ? { hostelBlock } : {}),
        },
        select: { userId: true },
      });
      const ids = new Set(profs.map((p) => p.userId));
      out = list.filter((c) => ids.has(c.userId));
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/status", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { status } = req.body;
    const c = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status },
    });
    const student = await prisma.user.findUnique({ where: { id: c.userId } });
    if (student) {
      await prisma.notification.create({
        data: {
          userId: student.id,
          type: "COMPLAINT",
          title: "Complaint update",
          message: `Your complaint status is now ${status}.`,
        },
      });
    }
    res.json(c);
  } catch (e) {
    next(e);
  }
});

export default router;
