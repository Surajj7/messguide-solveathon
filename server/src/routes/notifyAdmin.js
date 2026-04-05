import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { notifyStudents } from "../services/notifications.js";

const router = Router();

router.post("/menu-change", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { title, message } = req.body;
    await notifyStudents({
      type: "MENU_CHANGE",
      title: title || "Menu update",
      message: message || "The mess menu has been updated. Check the app for details.",
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
