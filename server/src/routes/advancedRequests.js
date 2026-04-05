import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { upload, publicUploadPath } from "../lib/upload.js";
import {
  notifyAdmins,
  notifyMessInchargeUsers,
  notifyUser,
} from "../services/notifications.js";

const router = Router();

const TYPE_VALUES = ["ROOM_DELIVERY", "TEMP_MENU_CHANGE"];

function typeLabel(t) {
  if (t === "ROOM_DELIVERY") return "Food delivery to room";
  if (t === "TEMP_MENU_CHANGE") return "Temporary menu change";
  return t;
}

const studentInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      studentProfile: true,
    },
  },
  reviewedBy: { select: { id: true, name: true, email: true } },
};

router.post(
  "/",
  authRequired,
  requireRoles("STUDENT"),
  (req, res, next) => {
    upload.single("proof")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      const { requestDate, requestType, description } = req.body;
      if (!requestDate || !requestType || !description?.trim()) {
        return res.status(400).json({
          error: "requestDate, requestType, and description are required",
        });
      }
      if (!TYPE_VALUES.includes(requestType)) {
        return res.status(400).json({ error: "Invalid requestType" });
      }
      const d = new Date(requestDate);
      d.setHours(0, 0, 0, 0);
      const proofPath = req.file ? publicUploadPath(req.file.filename) : null;
      const row = await prisma.advancedRequest.create({
        data: {
          userId: req.userId,
          requestDate: d,
          requestType,
          description: description.trim(),
          proofPath,
        },
        include: studentInclude,
      });
      const student = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { name: true },
      });
      await notifyAdmins({
        type: "ADVANCED_REQUEST",
        title: "New advanced student request",
        message: `${student?.name || "A student"} submitted ${typeLabel(requestType)} for ${requestDate}. Open Admin → Advanced requests to review.`,
        metadata: { advancedRequestId: row.id },
      });
      res.status(201).json(row);
    } catch (e) {
      next(e);
    }
  }
);

router.get("/mine", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const list = await prisma.advancedRequest.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { name: true } } },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get(
  "/admin",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const { status } = req.query;
      const where = {};
      if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
        where.status = status;
      }
      const list = await prisma.advancedRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: studentInclude,
      });
      res.json(list);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/:id/approve",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const row = await prisma.advancedRequest.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      if (!row) {
        return res.status(404).json({ error: "Not found" });
      }
      if (row.status !== "PENDING") {
        return res.status(400).json({ error: "Request is no longer pending" });
      }
      const updated = await prisma.advancedRequest.update({
        where: { id: row.id },
        data: {
          status: "APPROVED",
          reviewedById: req.userId,
          reviewedAt: new Date(),
        },
        include: studentInclude,
      });
      const summary = `${typeLabel(row.requestType)} · ${row.requestDate.toISOString().slice(0, 10)}`;
      await notifyUser(row.userId, {
        type: "ADVANCED_REQUEST",
        title: "Request approved",
        message: `Your advanced request (${summary}) was approved by admin. Mess staff have been notified.`,
        metadata: { advancedRequestId: row.id, status: "APPROVED" },
      });
      await notifyMessInchargeUsers({
        type: "ADVANCED_REQUEST",
        title: "Approved advanced request",
        message: `${row.user.name} (${row.user.email}) — ${summary}. Status: APPROVED. Description: ${row.description.slice(0, 280)}${row.description.length > 280 ? "…" : ""}`,
        metadata: {
          advancedRequestId: row.id,
          status: "APPROVED",
          requestType: row.requestType,
          requestDate: row.requestDate.toISOString().slice(0, 10),
        },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/:id/reject",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const row = await prisma.advancedRequest.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      if (!row) {
        return res.status(404).json({ error: "Not found" });
      }
      if (row.status !== "PENDING") {
        return res.status(400).json({ error: "Request is no longer pending" });
      }
      const updated = await prisma.advancedRequest.update({
        where: { id: row.id },
        data: {
          status: "REJECTED",
          reviewedById: req.userId,
          reviewedAt: new Date(),
        },
        include: studentInclude,
      });
      const summary = `${typeLabel(row.requestType)} · ${row.requestDate.toISOString().slice(0, 10)}`;
      await notifyUser(row.userId, {
        type: "ADVANCED_REQUEST",
        title: "Request not approved",
        message: `Your advanced request (${summary}) was not approved. Contact the mess office if you need help.`,
        metadata: { advancedRequestId: row.id, status: "REJECTED" },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/mess-queue",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const list = await prisma.advancedRequest.findMany({
        where: { status: "APPROVED" },
        orderBy: { reviewedAt: "desc" },
        include: studentInclude,
      });
      res.json(list);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
