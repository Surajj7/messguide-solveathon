import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/templates", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const list = await prisma.whatsAppTemplate.findMany({ orderBy: { createdAt: "desc" } });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post("/templates", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { name, body } = req.body;
    if (!name || !body) {
      return res.status(400).json({ error: "name, body required" });
    }
    const t = await prisma.whatsAppTemplate.create({ data: { name, body } });
    res.status(201).json(t);
  } catch (e) {
    next(e);
  }
});

router.post("/send-mock", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { templateId, recipientEmail, extraMessage } = req.body;
    let tpl = null;
    if (templateId) {
      tpl = await prisma.whatsAppTemplate.findUnique({ where: { id: templateId } });
    }
    const messageBody = tpl?.body || extraMessage || "";
    const row = await prisma.whatsAppNotification.create({
      data: {
        templateId: templateId || null,
        recipientSummary: recipientEmail || "all-students-demo",
        messageBody,
        status: "MOCKED",
        createdById: req.userId,
      },
    });
    res.status(201).json({
      ...row,
      demoNote:
        "This is a mocked send. Plug in WhatsApp Business API or Twilio sandbox in production.",
    });
  } catch (e) {
    next(e);
  }
});

router.get("/history", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const list = await prisma.whatsAppNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { template: true },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

export default router;
