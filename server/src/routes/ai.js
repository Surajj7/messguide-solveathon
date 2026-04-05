import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { groqChat, groqSummarizeMonthly, groqMealPlanHint } from "../services/groq.js";
import { getMenuForDate } from "../services/menuResolve.js";
import { buildMonthlyPdf } from "../services/pdfReport.js";

const router = Router();

const SYSTEM_CHAT = `You are a helpful mess hall and nutrition assistant for university students.
Never provide medical diagnosis. Encourage consulting professionals for health conditions.
Keep answers short and practical.`;

router.post(
  "/chat",
  authRequired,
  requireRoles("STUDENT", "ADMIN", "MESS_INCHARGE"),
  async (req, res, next) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) {
        return res.status(400).json({ error: "message required" });
      }
      const result = await groqChat(SYSTEM_CHAT, message.trim());
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post("/meal-plan", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId },
    });
    if (!profile) {
      return res.status(400).json({ error: "Profile not found" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const menu = await getMenuForDate(new Date(today + "T12:00:00"), profile.messType);
    const summary = JSON.stringify(menu.meals).slice(0, 6000);
    const result = await groqMealPlanHint(profile.healthGoal, summary);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/monthly-pdf", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0);

    const [complaints, reviews, suggestions, leftovers, posts] = await Promise.all([
      prisma.complaint.findMany({
        where: { menuDate: { gte: from, lte: to } },
        include: { menuItem: true },
      }),
      prisma.review.findMany({
        where: { menuDate: { gte: from, lte: to } },
        include: { menuItem: true },
      }),
      prisma.suggestion.findMany({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.leftoverEntry.findMany({ where: { entryDate: { gte: from, lte: to } } }),
      prisma.communityPost.findMany({ where: { createdAt: { gte: from, lte: to } } }),
    ]);

    const context = [
      `Complaints (${complaints.length}): ${complaints.map((c) => c.issueType).join(", ")}`,
      `Reviews avg sample: ${reviews.length} ratings`,
      `Suggestions: ${suggestions.map((s) => s.text).join(" | ").slice(0, 1500)}`,
      `Leftover logs: ${leftovers.length} entries`,
      `Community posts: ${posts.length}`,
    ].join("\n");

    const { text: executiveSummary, mock } = await groqSummarizeMonthly(context);

    const pdfBuffer = await buildMonthlyPdf({
      title: `Mess Monthly Review — ${m}/${y}`,
      executiveSummary,
      sections: [
        { title: "Top complaints (raw count)", body: String(complaints.length) },
        { title: "Student suggestions", body: suggestions.map((s) => `- ${s.text}`).join("\n").slice(0, 2000) },
        { title: "Waste / leftover notes", body: leftovers.map((l) => `${l.itemName}: ${l.quantity} ${l.unit}`).join("\n").slice(0, 2000) },
        { title: "AI mode", body: mock ? "Demo / fallback summary" : "Groq summary used" },
      ],
    });

    await prisma.aIReport.create({
      data: {
        month: m,
        year: y,
        summaryText: executiveSummary,
        pdfBytes: pdfBuffer,
        createdById: req.userId,
      },
    });

    res.json({
      mock,
      pdfBase64: pdfBuffer.toString("base64"),
      filename: `mess-review-${y}-${m}.pdf`,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
